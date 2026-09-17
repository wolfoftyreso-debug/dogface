import { useEffect, useRef } from "react";
import { Facebook, Instagram, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blobFromDataUrl, isAppleTouch } from "@/lib/save-photo";
import { filenameForBreed } from "@/lib/history";
import { openStoryApp, type StoryTarget } from "@/lib/share-story";
import type { HistoryItem } from "@/lib/types";

type ShareSheetProps = {
  item: HistoryItem;
  onClose: () => void;
  onHint: (message: string | null) => void;
};

export function ShareSheet({ item, onClose, onHint }: ShareSheetProps) {
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    let live = true;
    const name = filenameForBreed(item.breed);
    void blobFromDataUrl(item.imageDataUrl).then((blob) => {
      if (!live) return;
      fileRef.current = new File([blob], name, { type: blob.type || "image/jpeg" });
    });
    return () => {
      live = false;
    };
  }, [item.breed, item.imageDataUrl]);

  async function fileForShare(): Promise<File> {
    if (fileRef.current) return fileRef.current;
    const blob = await blobFromDataUrl(item.imageDataUrl);
    const file = new File([blob], filenameForBreed(item.breed), { type: blob.type || "image/jpeg" });
    fileRef.current = file;
    return file;
  }

  async function send(target: StoryTarget) {
    onHint(null);
    const file = await fileForShare();
    if (typeof navigator.share === "function") {
      const payload = { files: [file] };
      try {
        if (typeof navigator.canShare !== "function" || navigator.canShare(payload)) {
          await navigator.share(payload);
          onClose();
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    if (target !== "system" && isAppleTouch()) {
      openStoryApp(target);
      onHint("Save the photo first, then pick it from Recents in the app.");
      onClose();
      return;
    }
    onHint("Couldn’t share. Save the photo instead.");
  }

  return (
    <div className="share-sheet" role="dialog" aria-label="Share to story" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Close" onClick={onClose} />
      <div className="share-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Share</h2>
            <p className="mt-1 text-sm text-muted">The photo is attached. Tap Instagram in the next menu.</p>
          </div>
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fg"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <img src={item.imageDataUrl} alt="" className="mb-4 w-full rounded-2xl" />
        <div className="share-grid">
          <Button variant="secondary" onClick={() => void send("instagram")}>
            <Instagram className="size-4" strokeWidth={1.75} />
            Instagram
          </Button>
          <Button variant="secondary" onClick={() => void send("snapchat")}>
            <MessageCircle className="size-4" strokeWidth={1.75} />
            Snapchat
          </Button>
          <Button variant="secondary" onClick={() => void send("facebook")}>
            <Facebook className="size-4" strokeWidth={1.75} />
            Facebook
          </Button>
          <Button onClick={() => void send("system")}>Other apps</Button>
        </div>
      </div>
    </div>
  );
}
