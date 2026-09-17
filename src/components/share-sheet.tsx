import { useEffect } from "react";
import { Facebook, Instagram, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prefetchStoryCard, shareStory, SHARE_SAVED_HINT, type StoryTarget } from "@/lib/share-story";
import { filenameForBreed } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

type ShareSheetProps = {
  item: HistoryItem;
  onClose: () => void;
  onHint: (message: string | null) => void;
};

export function ShareSheet({ item, onClose, onHint }: ShareSheetProps) {
  useEffect(() => {
    prefetchStoryCard(item.imageDataUrl, item.breed);
  }, [item.breed, item.imageDataUrl]);

  async function post(target: StoryTarget) {
    onHint(null);
    try {
      const result = await shareStory({
        imageDataUrl: item.imageDataUrl,
        breed: item.breed,
        filename: filenameForBreed(item.breed),
        target,
      });
      if (result === "aborted") return;
      if (result === "saved") {
        onHint(
          target === "system"
            ? "Story photo saved. Open the app and pick it from Recents."
            : SHARE_SAVED_HINT[target],
        );
      }
      onClose();
    } catch {
      onHint("Couldn’t share. Save the photo instead.");
    }
  }

  return (
    <div className="share-sheet" role="dialog" aria-label="Share to story" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Close" onClick={onClose} />
      <div className="share-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Share</h2>
            <p className="mt-1 text-sm text-muted">The photo is attached. Tap Instagram in the next menu, then Story.</p>
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
        <div className="share-grid">
          <Button variant="secondary" onClick={() => void post("instagram")}>
            <Instagram className="size-4" strokeWidth={1.75} />
            Instagram
          </Button>
          <Button variant="secondary" onClick={() => void post("snapchat")}>
            <MessageCircle className="size-4" strokeWidth={1.75} />
            Snapchat
          </Button>
          <Button variant="secondary" onClick={() => void post("facebook")}>
            <Facebook className="size-4" strokeWidth={1.75} />
            Facebook
          </Button>
          <Button onClick={() => void post("system")}>Other apps</Button>
        </div>
      </div>
    </div>
  );
}
