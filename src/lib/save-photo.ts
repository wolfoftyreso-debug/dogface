export type SavePhotoResult =
  | { ok: true; mode: "shared" | "downloaded" }
  | { ok: true; mode: "press"; objectUrl: string }
  | { ok: false; aborted: boolean };

export function isAppleTouch(): boolean {
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

export async function sharePhotoFile(file: File): Promise<"shared" | "aborted" | "unavailable"> {
  if (typeof navigator.share !== "function") return "unavailable";
  const data = { files: [file] };
  if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
    return "unavailable";
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
    return "unavailable";
  }
}

export async function savePhoto(dataUrl: string, filename: string): Promise<SavePhotoResult> {
  const blob = await blobFromDataUrl(dataUrl);
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const apple = isAppleTouch();

  if (apple) {
    const shared = await sharePhotoFile(file);
    if (shared === "shared") return { ok: true, mode: "shared" };
    if (shared === "aborted") return { ok: false, aborted: true };
    return { ok: true, mode: "press", objectUrl: URL.createObjectURL(blob) };
  }

  triggerDownload(blob, filename);
  return { ok: true, mode: "downloaded" };
}
