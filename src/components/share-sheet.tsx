import { useEffect, useRef } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blobFromDataUrl, sharePhotoFile } from "@/lib/save-photo";
import { filenameForBreed } from "@/lib/history";
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
      fileRef.current = new File([blob], name, { type: "image/jpeg" });
    });
    return () => {
      live = false;
    };
  }, [item.breed, item.imageDataUrl]);

  async function share() {
    onHint(null);
    let file = fileRef.current;
    if (!file) {
      const blob = await blobFromDataUrl(item.imageDataUrl);
      file = new File([blob], filenameForBreed(item.breed), { type: "image/jpeg" });
      fileRef.current = file;
    }
    const result = await sharePhotoFile(file);
    if (result === "aborted") return;
    if (result === "shared") {
      onClose();
      return;
    }
    onHint("Use Save, then pick the photo from Recents in Instagram.");
    onClose();
  }

  return (
    <div className="share-sheet" role="dialog" aria-label="Share photo" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Close" onClick={onClose} />
      <div className="share-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Share</h2>
            <p className="mt-2 text-sm text-muted">
              The photo is attached. Tap Instagram, then Story.
            </p>
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
        <Button onClick={() => void share()}>
          <Share2 className="size-4" strokeWidth={1.75} />
          Share photo
        </Button>
      </div>
    </div>
  );
}
