export type SavePhotoResult =
  | { ok: true; mode: "shared" | "downloaded" }
  | { ok: true; mode: "press"; objectUrl: string }
  | { ok: false; aborted: boolean };

function isAppleTouch(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (blob.size < 32) throw new Error("empty");
  if (blob.type.startsWith("image/")) return blob;
  return new Blob([blob], { type: "image/jpeg" });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export async function savePhoto(dataUrl: string, filename: string): Promise<SavePhotoResult> {
  const blob = await blobFromDataUrl(dataUrl);
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const apple = isAppleTouch();

  if (apple && typeof navigator.share === "function") {
    const payload = { files: [file], title: filename };
    const canFiles = typeof navigator.canShare !== "function" || navigator.canShare(payload);
    if (canFiles) {
      try {
        await navigator.share(payload);
        return { ok: true, mode: "shared" };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, aborted: true };
        }
      }
    }
  }

  if (!apple) {
    triggerDownload(blob, filename);
    return { ok: true, mode: "downloaded" };
  }

  return { ok: true, mode: "press", objectUrl: URL.createObjectURL(blob) };
}
