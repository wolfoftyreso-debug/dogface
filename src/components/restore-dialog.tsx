import { useState } from "react";
import { Button } from "@/components/ui/button";
import { restorePurchase } from "@/lib/payment";

export function RestoreDialog({
  open,
  onClose,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  onRestored: (remaining: number) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-fg/40" aria-label="Stäng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        className="pay-sheet relative mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-3xl bg-surface p-6 text-fg shadow-lg ring-1 ring-border sm:mb-0"
      >
        <h2 id="restore-title" className="font-display text-2xl tracking-tight">
          Återställ köp
        </h2>
        <p className="mt-2 text-sm text-muted">
          Bildhistoriken är lokal och kan inte molnåterställas. Köpta bilder kan återställas med koden från köpet.
        </p>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-4 h-12 w-full rounded-xl border border-border bg-bg px-4 text-base"
          placeholder="HT-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
        />
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button
            disabled={busy || code.trim().length < 8}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await restorePurchase({ data: { code } });
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  onRestored(result.remaining);
                } catch {
                  setError("Kunde inte återställa just nu.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Återställ
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
        </div>
      </div>
    </div>
  );
}
