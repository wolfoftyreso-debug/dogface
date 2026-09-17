import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareStoryFile, shareImageFile } from "@/lib/share-story";
import type { HistoryItem } from "@/lib/types";

type ShareSheetProps = {
  item: HistoryItem;
  onClose: () => void;
  onHint: (message: string | null) => void;
};

export function ShareSheet({ item, onClose, onHint }: ShareSheetProps) {
  const fileRef = useRef<File | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fileRef.current = null;
    setReady(false);
    setPreview(null);
    void prepareStoryFile(item.imageDataUrl, item.breed).then((file) => {
      if (!live) return;
      fileRef.current = file;
      setPreview(URL.createObjectURL(file));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [item.breed, item.imageDataUrl]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function shareNow() {
    const file = fileRef.current;
    if (!file) return;
    onHint(null);
    void shareImageFile(file).then((result) => {
      if (result === "aborted") return;
      if (result === "shared") {
        onClose();
        return;
      }
      onHint("Your phone couldn’t attach the photo. Use Save, then Instagram → Story → Recents.");
      onClose();
    });
  }

  return (
    <div className="share-sheet" role="dialog" aria-label="Share to Instagram Story" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Close" onClick={onClose} />
      <div className="share-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Instagram Story</h2>
            <p className="mt-2 text-sm text-muted">
              The photo is attached as a Story (9:16). In the menu tap Instagram, then Story.
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
        <img
          src={preview ?? item.imageDataUrl}
          alt=""
          className="mb-4 mx-auto max-h-80 w-auto rounded-2xl"
        />
        <Button onClick={shareNow} disabled={!ready}>
          <Share2 className="size-4" strokeWidth={1.75} />
          {ready ? "Share to Story" : "Preparing …"}
        </Button>
      </div>
    </div>
  );
}
