import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Camera, Copy, Download, ImagePlus, Images, Loader2, Share2 } from "lucide-react";
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
import { PhotoError, isAllowedPhotoType, preprocessPhoto } from "@/lib/image";
import { ERROR_MESSAGES, type HistoryItem, type PortraitStyle } from "@/lib/types";
import { RestoreDialog } from "@/components/restore-dialog";
import { CameraCapture } from "@/components/camera-capture";
import { ShareSheet } from "@/components/share-sheet";

const GENERATE_WAIT_MS = 210_000;

function hasLiveCamera(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

function waitWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("timeout"));
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function HundtvillingApp() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

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
  const [style, setStyle] = useState<PortraitStyle>("split");

  useEffect(() => {
    void listHistory().then(setHistory).catch(() => undefined);
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
        setPaidNotice("Köpet är klart. Fem bilder finns kvar. Tryck Skapa hundbild för att fortsätta.");
        setError(null);
      } else {
        setPaidNotice("Köpet är klart. Fem bilder finns kvar. Välj fotot igen.");
        setError(null);
      }
    })();
  }, [search.checkout, navigate]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [history, preview, working, latest, error]);

  const canGenerate = Boolean(preview) && !working;
  const primaryLabel =
    remaining === 0
      ? "Köp 5 bilder – 2,99 USD"
      : freeRemaining > 0
        ? "Skapa gratis"
        : "Skapa hundbild";

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

  async function runGeneration(image: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setWorkStep("read");
    setError(null);
    setShareHint(null);
    setPaidNotice(null);
    const requestId = crypto.randomUUID();
    const paintTimer = window.setTimeout(() => setWorkStep("paint"), 8000);
    try {
      const generatePromise = generateDogTwin({ data: { image, requestId, style } });
      const poll = (async () => {
        for (let i = 0; i < 42; i += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
          const job = await getGeneration({ data: { id: requestId } });
          if (job.ok && job.status === "ready") return job;
          if (!job.ok && job.code !== "failed") return job;
        }
        return null;
      })();
      const raced = await Promise.race([
        waitWithTimeout(generatePromise, GENERATE_WAIT_MS),
        poll.then((value) => value ?? waitWithTimeout(generatePromise, GENERATE_WAIT_MS)),
      ]);
      const response = raced;
      if (!response || !response.ok) {
        if (response && !response.ok) {
          setError(response.message);
          if (typeof response.remaining === "number") setRemaining(response.remaining);
        } else {
          setError(ERROR_MESSAGES.timeout);
        }
        return;
      }
      if (response.status !== "ready") {
        setError(ERROR_MESSAGES.timeout);
        return;
      }
      const item: HistoryItem = {
        id: response.id,
        createdAt: Date.now(),
        breed: response.breed,
        reason: response.reason,
        imageDataUrl: response.imageDataUrl,
      };
      setLatest(item);
      setRemaining(response.remaining);
      setFreeRemaining(0);
      setPreview(null);
      await clearDraft();
      try {
        setHistory(await saveHistoryItem(item));
      } catch {
        setHistory((current) => [item, ...current].slice(0, 10));
      }
    } catch (err) {
      const timedOut = err instanceof Error && err.message === "timeout";
      setError(timedOut ? ERROR_MESSAGES.timeout : ERROR_MESSAGES.failed);
    } finally {
      window.clearTimeout(paintTimer);
      inFlight.current = false;
      setWorking(false);
    }
  }

  async function onPrimary() {
    if (working) return;
    if (!aiReady) {
      setError(ERROR_MESSAGES.unavailable);
      return;
    }
    if (remaining === 0) {
      if (!paymentsReady) {
        setError(ERROR_MESSAGES.payment_unavailable);
        return;
      }
      await startCheckout();
      return;
    }
    if (!preview) {
      setError(ERROR_MESSAGES.no_image);
      return;
    }
    await runGeneration(preview);
  }

  async function saveImage(item: HistoryItem) {
    try {
      const res = await fetch(item.imageDataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameForBreed(item.breed);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setShareHint("Kunde inte spara. Prova igen.");
    }
  }

  const shown = latest ? [latest, ...history.filter((item) => item.id !== latest.id)] : history;
  const remainingLabel =
    remaining === null
      ? ""
      : remaining === 1
        ? "1 bild kvar"
        : remaining === 0
          ? "Inga bilder kvar"
          : `${remaining} bilder kvar`;

  return (
    <main className="app-shell flex flex-col">
      <header className="flex items-center justify-between gap-3">
        <div className="brand">
          <img src="/logo-mark.png" alt="" className="brand-mark" />
          <p className="brand-name">
            Doggy
            <em>Style</em>
          </p>
        </div>
        {remainingLabel ? (
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{remainingLabel}</p>
        ) : null}
      </header>

      <div ref={scrollerRef} className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4">
        {shown.length === 0 && !preview && !working ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
              <div className="photo-hero">
                <img
                  src="/hero-split.jpg"
                  alt="Exempel: hälften människa, hälften hund"
                  className="size-full object-cover"
                />
              </div>
            </div>
            <div className="text-center">
              <h1 className="font-display text-3xl tracking-tight">Vilken hund är du?</h1>
              <p className="mt-3 text-base text-muted">
                Splitscreen: hälften du, hälften en riktig hund. Titta vad lik du blev.
                <br />
                Första bilden är gratis.
              </p>
            </div>
          </div>
        ) : null}

        {shown
          .slice()
          .reverse()
          .map((item) => (
            <article key={item.id} className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
                <div className="photo-square">
                  <img src={item.imageDataUrl} alt={`En ${item.breed}`} className="size-full object-contain" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Titta vad lik du blev</p>
                <h2 className="mt-1 font-display text-2xl tracking-tight">{item.breed}</h2>
                {item.reason ? <p className="mt-2 text-base text-muted">{item.reason}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => void saveImage(item)} aria-label="Spara bild">
                  <Download className="size-4" strokeWidth={1.75} />
                  Spara
                </Button>
                <Button variant="secondary" onClick={() => setShareItem(item)} aria-label="Dela till story">
                  <Share2 className="size-4" strokeWidth={1.75} />
                  Dela
                </Button>
              </div>
              {item.id === shown[0]?.id ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShareHint(null);
                    libraryRef.current?.click();
                  }}
                  aria-label="Ny bild"
                >
                  <ImagePlus className="size-4" strokeWidth={1.75} />
                  Ny bild
                </Button>
              ) : null}
            </article>
          ))}

        {preview ? (
          <div className="overflow-hidden rounded-3xl bg-surface p-2 ring-1 ring-border">
            <div className="photo-frame">
              <img src={preview} alt="Valt foto" className="size-full object-contain" />
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
                Ta bort foto
              </button>
            ) : null}
          </div>
        ) : null}

        {working ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
            <Loader2 className="work-spin size-8 text-fg" strokeWidth={1.75} />
            <p className="text-base font-medium">
              {workStep === "read" ? "Läser bilden …" : "Målar din Doggy Style …"}
            </p>
            <p className="text-sm text-muted">Det kan ta ett par minuter. Låt skärmen vara öppen.</p>
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
              Spara din återställningskod: <span className="font-medium text-fg">{restoreCode}</span>
            </p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-fg underline-offset-2 hover:underline"
              onClick={() => {
                void navigator.clipboard?.writeText(restoreCode).then(
                  () => setShareHint("Koden är kopierad."),
                  () => setShareHint("Kopiera koden manuellt."),
                );
              }}
            >
              <Copy className="size-3.5" strokeWidth={2} />
              Kopiera kod
            </button>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-auto border-t border-border bg-bg/92 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <p className="mb-3 text-center text-xs text-subtle">
          Använd ett foto du har rätt att använda. Bilden skickas till vår AI-leverantör för att skapa din
          Doggy Style.
        </p>
        <div className="style-toggle mb-3" role="radiogroup" aria-label="Bildstil">
          <button
            type="button"
            role="radio"
            aria-checked={style === "split"}
            className={style === "split" ? "is-on" : undefined}
            onClick={() => setStyle("split")}
          >
            Splitscreen
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={style === "dog"}
            className={style === "dog" ? "is-on" : undefined}
            onClick={() => setStyle("dog")}
          >
            Hela hunden
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={openCamera} aria-label="Ta foto">
            <Camera className="size-4" strokeWidth={1.75} />
            Ta foto
          </Button>
          <Button variant="secondary" onClick={() => libraryRef.current?.click()} aria-label="Välj bild">
            <Images className="size-4" strokeWidth={1.75} />
            Välj bild
          </Button>
        </div>
        <Button className="mt-3" onClick={() => void onPrimary()} disabled={working || (remaining !== 0 && !canGenerate)}>
          {primaryLabel}
        </Button>
        {remaining === 0 ? (
          <p className="mt-2 text-center text-xs text-muted">Engångsköp. Ingen prenumeration.</p>
        ) : null}
        <nav className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-subtle">
          <a href="/integritet" className="underline-offset-2 hover:underline">
            Integritet
          </a>
          <a href="/villkor" className="underline-offset-2 hover:underline">
            Villkor
          </a>
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => setRestoreOpen(true)}>
            Återställ köp
          </button>
          <a href="/support" className="underline-offset-2 hover:underline">
            Support
          </a>
        </nav>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
        aria-label="Ta foto"
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onInputChange}
        aria-label="Välj bild"
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
    </main>
  );
}
