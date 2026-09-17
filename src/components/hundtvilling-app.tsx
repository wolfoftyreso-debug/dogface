import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Camera, Copy, Download, ImagePlus, Images, Info, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDogTwin, getGeneration } from "@/lib/generate";
import { confirmCheckout, createCheckout, getBalance } from "@/lib/payment";
import {
  clearDraft,
  filenameForBreed,
  listHistory,
  loadDraft,
  saveDraft,
  saveHistoryItem,
} from "@/lib/history";
import { PhotoError, PHOTO_ACCEPT, isAllowedPhotoType, preprocessPhoto } from "@/lib/image";
import { savePhoto } from "@/lib/save-photo";
import { ERROR_MESSAGES, type HistoryItem, type PortraitStyle } from "@/lib/types";
import { RestoreDialog } from "@/components/restore-dialog";
import { CameraCapture } from "@/components/camera-capture";
import { ShareSheet } from "@/components/share-sheet";
import { FetchPlay } from "@/components/fetch-play";

const GENERATE_WAIT_MS = 180_000;
const JOB_KEY = "ht_job_id";
const EAT_MS = 1350;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasLiveCamera(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

export function HundtvillingApp() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HistoryItem | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [workStep, setWorkStep] = useState<"read" | "paint">("read");
  const [error, setError] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [freeRemaining, setFreeRemaining] = useState(1);
  const [paymentsReady, setPaymentsReady] = useState(true);
  const [aiReady, setAiReady] = useState(true);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreCode, setRestoreCode] = useState<string | null>(null);
  const [paidNotice, setPaidNotice] = useState<string | null>(null);
  const [latest, setLatest] = useState<HistoryItem | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [shareItem, setShareItem] = useState<HistoryItem | null>(null);
  const [style, setStyle] = useState<PortraitStyle>("dog");
  const [infoOpen, setInfoOpen] = useState(false);
  const [savePressUrl, setSavePressUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [playMode, setPlayMode] = useState<"fetch" | "eat">("fetch");

  useEffect(() => {
    void listHistory()
      .then((items) => {
        setHistory(items);
        if (latestRef.current) return;
        const first = items[0];
        if (first) {
          latestRef.current = first;
          setLatest(first);
          setStyle(first.splitDataUrl ? "split" : "dog");
        }
      })
      .catch(() => undefined);
    void getBalance()
      .then((balance) => {
        setRemaining(balance.remaining);
        setFreeRemaining(balance.freeRemaining);
        setPaymentsReady(balance.paymentsReady);
        setAiReady(balance.aiReady !== false);
      })
      .catch(() => undefined);
    void loadDraft().then((draft) => {
      if (draft) setPreview(draft);
    });
    const storedId = (() => {
      try {
        return sessionStorage.getItem(JOB_KEY);
      } catch {
        return null;
      }
    })();
    if (storedId) {
      void resumeJob(storedId);
    }
  }, []);

  useEffect(() => {
    const sessionId = typeof search.checkout === "string" ? search.checkout : "";
    if (!sessionId) return;
    void (async () => {
      const result = await confirmCheckout({ data: { sessionId } });
      await navigate({ search: {}, replace: true });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRemaining(result.remaining);
      setFreeRemaining(0);
      if (result.restoreCode) setRestoreCode(result.restoreCode);
      const draft = await loadDraft();
      if (draft) {
        setPreview(draft);
        setPaidNotice("Done. Tap Create.");
        setError(null);
      } else {
        setPaidNotice("Done. Choose the photo again.");
        setError(null);
      }
    })();
  }, [search.checkout, navigate]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [history, preview, working, latest, error]);

  const canGenerate = Boolean(preview) && !working;
  const needsPay = remaining === 0 && paymentsReady;
  const primaryLabel = needsPay ? "Buy $2.99" : "Create";
  const remainingLabel =
    remaining === null || !paymentsReady ? "" : remaining === 0 ? "0" : String(remaining);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setShareHint(null);
    try {
      const dataUrl = await preprocessPhoto(file);
      setPreview(dataUrl);
      await saveDraft(dataUrl);
    } catch (err) {
      if (err instanceof PhotoError) setError(err.message);
      else setError(ERROR_MESSAGES.unsupported);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && !isAllowedPhotoType(file.type)) {
      setError(ERROR_MESSAGES.unsupported);
      return;
    }
    void onFile(file);
  }

  function openCamera() {
    setError(null);
    if (hasLiveCamera()) {
      setCameraOpen(true);
      return;
    }
    cameraRef.current?.click();
  }

  function fallbackNativeCamera() {
    setCameraOpen(false);
    cameraRef.current?.click();
  }

  async function startCheckout() {
    setError(null);
    if (preview) await saveDraft(preview);
    try {
      const created = await createCheckout();
      if (!created.ok) {
        setError(created.message);
        return;
      }
      window.location.assign(created.url);
    } catch {
      setError(ERROR_MESSAGES.payment_unavailable);
    }
  }

  async function applyReady(response: Extract<Awaited<ReturnType<typeof getGeneration>>, { ok: true }>) {
    if (response.status !== "ready") return false;
    const item: HistoryItem = {
      id: response.id,
      createdAt: Date.now(),
      breed: response.breed,
      reason: response.reason,
      imageDataUrl: response.imageDataUrl,
      splitDataUrl: response.splitDataUrl,
      dogDataUrl: response.dogDataUrl,
    };
    setLatest(item);
    latestRef.current = item;
    setStyle(response.splitDataUrl ? "split" : "dog");
    setRemaining(response.remaining);
    setFreeRemaining(0);
    setPreview(null);
    await clearDraft();
    try {
      setHistory(await saveHistoryItem(item));
    } catch {
      try {
        const slim = { ...item, dogDataUrl: undefined };
        setHistory(await saveHistoryItem(slim));
      } catch {
        setHistory((current) => [item, ...current].slice(0, 10));
      }
    }
    return true;
  }

  async function finishWithEat(): Promise<void> {
    if (prefersReducedMotion()) return;
    setPlayMode("eat");
    await new Promise((resolve) => window.setTimeout(resolve, EAT_MS));
  }

  async function resumeJob(requestId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setPlayMode("fetch");
    setWorkStep("paint");
    setError(null);
    try {
      const peek = await getGeneration({ data: { id: requestId } });
      if (peek.ok && peek.status === "ready") {
        await finishWithEat();
        await applyReady(peek);
        return;
      }
      if (!peek.ok) return;
      const response = await pollUntilReady(requestId);
      if (response.ok) {
        await finishWithEat();
        if (await applyReady(response)) return;
        setError(ERROR_MESSAGES.timeout);
        return;
      }
      setError(response.message);
      if (typeof response.remaining === "number") setRemaining(response.remaining);
    } catch {
      setError(ERROR_MESSAGES.failed);
    } finally {
      sessionStorage.removeItem(JOB_KEY);
      inFlight.current = false;
      setWorking(false);
    }
  }

  async function runGeneration(image: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setPlayMode("fetch");
    setWorkStep("read");
    setError(null);
    setShareHint(null);
    setPaidNotice(null);
    const requestId = crypto.randomUUID();
    try {
      sessionStorage.setItem(JOB_KEY, requestId);
    } catch {
      // private mode
    }
    const paintTimer = window.setTimeout(() => setWorkStep("paint"), 2500);
    try {
      const started = await generateDogTwin({ data: { image, requestId, style: "dog" } });
      let response = started;
      const jobId = response.ok ? response.id : requestId;
      try {
        sessionStorage.setItem(JOB_KEY, jobId);
      } catch {
        // private mode
      }
      if (response.ok && response.status !== "ready") {
        response = await pollUntilReady(jobId);
      } else if (!response.ok && response.code === "failed") {
        const peek = await getGeneration({ data: { id: jobId } });
        if (peek.ok && peek.status !== "ready") {
          response = await pollUntilReady(jobId);
        }
      } else if (!response.ok && response.code === "busy") {
        const peek = await getGeneration({ data: { id: jobId } });
        if (peek.ok && peek.status !== "ready") {
          response = await pollUntilReady(jobId);
        }
      }
      if (!response || !response.ok) {
        if (response && !response.ok) {
          setError(response.message);
          if (typeof response.remaining === "number") setRemaining(response.remaining);
        } else {
          setError(ERROR_MESSAGES.timeout);
        }
        return;
      }
      await finishWithEat();
      if (!(await applyReady(response))) {
        setError(ERROR_MESSAGES.timeout);
      }
    } catch (err) {
      const timedOut = err instanceof Error && err.message === "timeout";
      setError(timedOut ? ERROR_MESSAGES.timeout : ERROR_MESSAGES.failed);
    } finally {
      window.clearTimeout(paintTimer);
      sessionStorage.removeItem(JOB_KEY);
      inFlight.current = false;
      setWorking(false);
    }
  }

  async function pollUntilReady(requestId: string) {
    const deadline = Date.now() + GENERATE_WAIT_MS;
    let last: Awaited<ReturnType<typeof getGeneration>> | null = null;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      last = await getGeneration({ data: { id: requestId } });
      if (last.ok && last.status === "ready") return last;
      if (!last.ok) return last;
    }
    return last ?? { ok: false as const, code: "timeout" as const, message: ERROR_MESSAGES.timeout };
  }

  async function onPrimary() {
    if (working) return;
    if (!aiReady) {
      setError(ERROR_MESSAGES.unavailable);
      return;
    }
    if (remaining === 0 && paymentsReady) {
      await startCheckout();
      return;
    }
    if (!preview) {
      setError(ERROR_MESSAGES.no_image);
      return;
    }
    await runGeneration(preview);
  }

  function displayedImage(item: HistoryItem): string {
    const isLatest = item.id === latest?.id;
    if (isLatest && style === "split" && item.splitDataUrl) return item.splitDataUrl;
    if (isLatest && style === "dog" && item.dogDataUrl) return item.dogDataUrl;
    if (isLatest && style === "dog" && item.splitDataUrl && item.imageDataUrl !== item.splitDataUrl) {
      return item.imageDataUrl;
    }
    return item.imageDataUrl;
  }

  async function saveImage(item: HistoryItem) {
    if (saving) return;
    setSaving(true);
    setShareHint(null);
    try {
      const result = await savePhoto(displayedImage(item), filenameForBreed(item.breed));
      if (!result.ok) return;
      if (result.mode === "downloaded") setShareHint("Photo saved.");
      if (result.mode === "press") setSavePressUrl(result.objectUrl);
    } catch {
      setShareHint("Couldn’t save. Try Share instead.");
    } finally {
      setSaving(false);
    }
  }

  function closeSavePress() {
    if (savePressUrl) URL.revokeObjectURL(savePressUrl);
    setSavePressUrl(null);
  }

  function openShare(item: HistoryItem) {
    setShareItem({ ...item, imageDataUrl: displayedImage(item) });
  }

  const shown = latest ? [latest, ...history.filter((item) => item.id !== latest.id)] : history;

  return (
    <main className="app-shell has-dock flex flex-col">
      <header className="flex items-center justify-between gap-3">
        <div className="brand">
          <img src="/logo-mark.png" alt="" className="brand-mark" />
          <p className="brand-name">
            Dogg
            <em>Style</em>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {remainingLabel ? (
            <p className="brand-count" aria-label={`${remainingLabel} photos left`}>
              {remainingLabel}
            </p>
          ) : null}
          <button type="button" className="brand-info" onClick={() => setInfoOpen(true)} aria-label="Info">
            <Info className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div ref={scrollerRef} className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        {shown.length === 0 && !preview && !working ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
              <div className="photo-hero is-fill">
                <img
                  src="/hero-split.jpg"
                  alt="Example: the person fused with the dog"
                  className="size-full object-cover"
                />
                <p className="hero-tag">Example</p>
              </div>
            </div>
            <h1 className="text-center font-display text-3xl tracking-tight">Which dog are you?</h1>
          </div>
        ) : null}

        {shown
          .slice()
          .reverse()
          .map((item) => {
            const isLatest = item.id === (latest?.id ?? shown[0]?.id);
            const shownUrl =
              isLatest && style === "split" && item.splitDataUrl
                ? item.splitDataUrl
                : isLatest && style === "dog" && item.dogDataUrl
                  ? item.dogDataUrl
                  : isLatest && style === "dog" && item.splitDataUrl && item.imageDataUrl !== item.splitDataUrl
                    ? item.imageDataUrl
                    : item.imageDataUrl;
            return (
            <article key={item.id} className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
                <div className="photo-square">
                  <img src={shownUrl} alt={item.breed} className="size-full object-contain" />
                </div>
              </div>
              <div>
                <h2 className="font-display text-2xl tracking-tight">{item.breed}</h2>
              </div>
              {isLatest && item.splitDataUrl && item.dogDataUrl ? (
                <div className="style-toggle" role="radiogroup" aria-label="Photo style">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={style === "dog"}
                    className={style === "dog" ? "is-on" : undefined}
                    onClick={() => setStyle("dog")}
                  >
                    Dog
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={style === "split"}
                    className={style === "split" ? "is-on" : undefined}
                    onClick={() => setStyle("split")}
                  >
                    Split
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => void saveImage(item)}
                  disabled={saving}
                  aria-label="Save photo"
                >
                  <Download className="size-4" strokeWidth={1.75} />
                  {saving ? "Saving …" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => openShare(item)} aria-label="Share to story">
                  <Share2 className="size-4" strokeWidth={1.75} />
                  Share
                </Button>
              </div>
              {item.id === shown[0]?.id ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShareHint(null);
                    libraryRef.current?.click();
                  }}
                  aria-label="New photo"
                >
                  <ImagePlus className="size-4" strokeWidth={1.75} />
                  New photo
                </Button>
              ) : null}
            </article>
            );
          })}

        {preview ? (
          <div className="overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
            <div className="photo-frame">
              <img src={preview} alt="Chosen photo" className="size-full object-contain" />
            </div>
            {!working ? (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  void clearDraft();
                }}
                className="mt-2 w-full py-2 text-center text-sm font-medium text-muted"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        ) : null}

        {working ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
            <FetchPlay mode={playMode} />
            <p className="text-base font-medium">
              {playMode === "eat" ? "Gotcha." : workStep === "read" ? "Reading the photo …" : "Making your dog …"}
            </p>
            {playMode === "fetch" ? <p className="text-sm text-muted">About 20 seconds.</p> : null}
          </div>
        ) : null}

        {paidNotice ? (
          <p className="text-center text-sm text-muted" role="status">
            {paidNotice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-surface px-3 py-2 text-center text-sm text-danger ring-1 ring-border" role="alert">
            {error}
          </p>
        ) : null}
        {shareHint ? (
          <p className="text-center text-sm text-muted" role="status">
            {shareHint}
          </p>
        ) : null}
        {restoreCode ? (
          <div className="rounded-xl bg-surface p-3 text-sm text-muted ring-1 ring-border">
            <p>
              Code: <span className="font-medium text-fg">{restoreCode}</span>
            </p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-fg underline-offset-2 hover:underline"
              onClick={() => {
                void navigator.clipboard?.writeText(restoreCode).then(
                  () => setShareHint("Code copied."),
                  () => setShareHint("Copy the code yourself."),
                );
              }}
            >
              <Copy className="size-3.5" strokeWidth={2} />
              Copy code
            </button>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-auto border-t border-border bg-bg/92 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={openCamera} aria-label="Take photo">
            <Camera className="size-4" strokeWidth={1.75} />
            Camera
          </Button>
          <Button variant="secondary" onClick={() => libraryRef.current?.click()} aria-label="Choose photo">
            <Images className="size-4" strokeWidth={1.75} />
            Photo
          </Button>
        </div>
        <Button className="mt-3" onClick={() => void onPrimary()} disabled={working || (!needsPay && !canGenerate)}>
          {primaryLabel}
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
        aria-label="Take photo"
      />
      <input
        ref={libraryRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        onChange={onInputChange}
        aria-label="Choose photo"
      />

      <RestoreDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onRestored={(next) => {
          setRemaining(next);
          setRestoreOpen(false);
        }}
      />
      {cameraOpen ? (
        <CameraCapture
          onCapture={(file) => {
            setCameraOpen(false);
            void onFile(file);
          }}
          onClose={() => setCameraOpen(false)}
          onUnavailable={fallbackNativeCamera}
        />
      ) : null}
      {shareItem ? (
        <ShareSheet item={shareItem} onClose={() => setShareItem(null)} onHint={setShareHint} />
      ) : null}
      {savePressUrl ? (
        <div className="share-sheet" role="dialog" aria-label="Save photo" aria-modal="true">
          <button type="button" className="share-dismiss" aria-label="Close" onClick={closeSavePress} />
          <div className="share-card">
            <h2 className="font-display text-2xl tracking-tight">Save photo</h2>
            <p className="mt-2 text-sm text-muted">Press and hold the image, then tap Save Image.</p>
            <img src={savePressUrl} alt="Your dog" className="mt-4 w-full rounded-2xl" />
            <Button className="mt-4" variant="secondary" onClick={closeSavePress}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
      {infoOpen ? (
        <InfoSheet
          onClose={() => setInfoOpen(false)}
          onRestore={() => {
            setInfoOpen(false);
            setRestoreOpen(true);
          }}
        />
      ) : null}
    </main>
  );
}

function InfoSheet({ onClose, onRestore }: { onClose: () => void; onRestore: () => void }) {
  return (
    <div className="share-sheet" role="dialog" aria-label="Info" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Close" onClick={onClose} />
      <div className="share-card">
        <h2 className="font-display text-2xl tracking-tight">Dogg Style</h2>
        <nav className="mt-5 flex flex-col">
          <a className="info-link" href="/integritet">
            Privacy
          </a>
          <a className="info-link" href="/villkor">
            Terms
          </a>
          <a className="info-link" href="/support">
            Support
          </a>
          <button type="button" className="info-link" onClick={onRestore}>
            Restore purchase
          </button>
        </nav>
      </div>
    </div>
  );
}
