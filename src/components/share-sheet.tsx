import { Facebook, Instagram, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareStory, type StoryTarget } from "@/lib/share-story";
import { filenameForBreed } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

type ShareSheetProps = {
  item: HistoryItem;
  onClose: () => void;
  onHint: (message: string | null) => void;
};

export function ShareSheet({ item, onClose, onHint }: ShareSheetProps) {
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
        onHint("Story-bilden är sparad. Öppna appen och välj den i rullen.");
      }
      onClose();
    } catch {
      onHint("Kunde inte dela. Spara bilden i stället.");
    }
  }

  return (
    <div className="share-sheet" role="dialog" aria-label="Dela till story" aria-modal="true">
      <button type="button" className="share-dismiss" aria-label="Stäng" onClick={onClose} />
      <div className="share-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Dela</h2>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-fg"
            onClick={onClose}
            aria-label="Stäng"
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
          <Button onClick={() => void post("system")}>Andra appar</Button>
        </div>
      </div>
    </div>
  );
}
