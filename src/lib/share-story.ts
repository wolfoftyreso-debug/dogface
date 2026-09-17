import { drawBrandLockup } from "./stamp-brand";
import { imageShareData, isShareableJpeg, storyFilename } from "./share-payload";

export { imageShareData, isShareableJpeg, storyFilename };

/** Meta Stories background: min 720×1280, recommended 9:16. */
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  ctx.drawImage(photo, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

export async function composeStoryJpeg(imageDataUrl: string): Promise<Blob> {
  const photo = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#1a0f08";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  coverDraw(ctx, photo, STORY_WIDTH, STORY_HEIGHT);

  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImage("/logo-mark.png");
  } catch {
    logo = null;
  }
  try {
    await document.fonts.load("700 22px Fredoka");
  } catch {
    // system fonts
  }
  const scale = 1.15;
  const boxH = 72 * scale;
  const pad = 48;
  drawBrandLockup(ctx, pad, STORY_HEIGHT - pad - boxH - 160, scale, logo);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob || blob.size < 32) throw new Error("blob");
  return blob;
}

export async function prepareStoryFile(imageDataUrl: string, breed: string): Promise<File> {
  const blob = await composeStoryJpeg(imageDataUrl);
  return new File([blob], storyFilename(breed), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function shareImageFile(file: File): Promise<"shared" | "aborted" | "unavailable"> {
  if (typeof navigator.share !== "function") return Promise.resolve("unavailable");
  if (!isShareableJpeg(file)) return Promise.resolve("unavailable");
  const data = imageShareData(file);
  if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
    return Promise.resolve("unavailable");
  }
  return navigator
    .share(data)
    .then(() => "shared" as const)
    .catch((err: unknown) =>
      err instanceof Error && err.name === "AbortError" ? ("aborted" as const) : ("unavailable" as const),
    );
}
