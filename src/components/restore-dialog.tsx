import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmAppleIap, restorePurchase } from "@/lib/payment";
import { isNativeApp, nativeRestorePurchases } from "@/lib/native-platform";

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
  const native = isNativeApp();

  if (!open) return null;

  async function restoreApple() {
    setBusy(true);
    setError(null);
    try {
      const list = await nativeRestorePurchases();
      let remaining = 0;
      let any = false;
      for (const jws of list) {
        const result = await confirmAppleIap({ data: { transactionJws: jws } });
        if (result.ok) {
          any = true;
          remaining = result.remaining;
        }
      }
      if (!any) {
        setError("No Apple purchase to restore. Enter your HT- code if you bought on the website.");
        return;
      }
      onRestored(remaining);
    } catch {
      setError("Couldn’t restore right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-fg/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        className="pay-sheet relative mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-3xl bg-surface p-6 text-fg shadow-lg ring-1 ring-border sm:mb-0"
      >
        <h2 id="restore-title" className="font-display text-2xl tracking-tight">
          Restore purchase
        </h2>
        <p className="mt-2 text-sm text-muted">
          {native
            ? "Restore an Apple purchase, or enter the HT- code from the website."
            : "Enter the code from your purchase."}
        </p>
        {native ? (
          <Button className="mt-4" disabled={busy} onClick={() => void restoreApple()}>
            Restore Apple purchase
          </Button>
        ) : null}
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
                  setError("Couldn’t restore right now.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Restore
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
