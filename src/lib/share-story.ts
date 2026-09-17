export type StoryTarget = "instagram" | "snapchat" | "facebook" | "system";

const APP_SCHEME: Record<Exclude<StoryTarget, "system">, string> = {
  instagram: "instagram://story-camera",
  snapchat: "snapchat://",
  facebook: "facebook://stories",
};

export const SHARE_SAVED_HINT: Record<Exclude<StoryTarget, "system">, string> = {
  instagram: "Instagram is opening. Save the photo first if you want it in the story.",
  snapchat: "Snapchat is opening. Save the photo first if you want it in the story.",
  facebook: "Facebook is opening. Save the photo first if you want it in the story.",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

let storyCache: { key: string; blob: Blob } | null = null;

function storyKey(imageDataUrl: string, breed: string): string {
  return `${breed}:${imageDataUrl.length}:${imageDataUrl.slice(-64)}`;
}

export async function composeStoryCard(imageDataUrl: string, breed: string): Promise<Blob> {
  const key = storyKey(imageDataUrl, breed);
  if (storyCache?.key === key) return storyCache.blob;

  const photo = await loadImage(imageDataUrl);
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.fillStyle = "#fff1dc";
  ctx.fillRect(0, 0, width, height);

  const pad = 72;
  const card = width - pad * 2;
  const cardY = 430;
  const radius = 48;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, cardY, card, card, radius);
  ctx.clip();
  ctx.fillStyle = "#fffbf3";
  ctx.fillRect(pad, cardY, card, card);
  const scale = Math.max(card / photo.width, card / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  ctx.drawImage(photo, pad + (card - dw) / 2, cardY + (card - dh) / 2, dw, dh);
  ctx.restore();

  ctx.strokeStyle = "rgba(58, 39, 20, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pad, cardY, card, card, radius);
  ctx.stroke();

  ctx.fillStyle = "#2a1408";
  ctx.textAlign = "center";
  ctx.font = "700 72px ui-rounded, system-ui, sans-serif";
  ctx.fillText("Look how alike I got", width / 2, 280);

  ctx.font = "600 42px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(breed, width / 2, cardY + card + 88);

  ctx.fillStyle = "#8a4e32";
  ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
  const caption = wrapText(ctx, `Half me, half ${breed}.`, width - pad * 2);
  caption.forEach((line, index) => {
    ctx.fillText(line, width / 2, cardY + card + 140 + index * 36);
  });

  ctx.fillStyle = "#ff4d2e";
  ctx.font = "700 34px ui-rounded, system-ui, sans-serif";
  ctx.fillText("Dogg Style", width / 2, height - 120);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("blob");
  storyCache = { key, blob };
  return blob;
}

export function prefetchStoryCard(imageDataUrl: string, breed: string): void {
  void composeStoryCard(imageDataUrl, breed);
}

export function openStoryApp(target: Exclude<StoryTarget, "system">): void {
  window.location.href = APP_SCHEME[target];
}

async function copyImage(blob: Blob): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": composePng(blob),
      }),
    ]);
  } catch {
    // Clipboard is best-effort; opening the app must not wait on it.
  }
}

async function composePng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return png ?? blob;
}

export function copyStoryImage(imageDataUrl: string, breed: string): void {
  void composeStoryCard(imageDataUrl, breed).then((blob) => copyImage(blob));
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

async function nativeShare(file: File, title: string, text: string): Promise<"shared" | "saved" | "aborted"> {
  if (typeof navigator.share !== "function") {
    triggerDownload(file);
    return "saved";
  }
  const filesOnly = { files: [file] };
  try {
    if (typeof navigator.canShare !== "function" || navigator.canShare(filesOnly)) {
      await navigator.share(filesOnly);
      return "shared";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
  }
  try {
    await navigator.share({ title, text, files: [file] });
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
    triggerDownload(file);
    return "saved";
  }
}

export async function shareStory(opts: {
  imageDataUrl: string;
  breed: string;
  filename: string;
  target: StoryTarget;
}): Promise<"shared" | "saved" | "aborted"> {
  const blob = await composeStoryCard(opts.imageDataUrl, opts.breed);
  const file = new File([blob], opts.filename.replace(/\.jpe?g$/i, "") + "-story.jpg", {
    type: "image/jpeg",
  });
  return nativeShare(file, "Look how alike I got", `Half me, half ${opts.breed}.`);
}
