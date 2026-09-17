export type StoryTarget = "instagram" | "snapchat" | "facebook" | "system";

const APP_SCHEME: Record<Exclude<StoryTarget, "system">, string> = {
  instagram: "instagram://story-camera",
  snapchat: "snapchat://",
  facebook: "facebook://stories",
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

export async function composeStoryCard(imageDataUrl: string, breed: string): Promise<Blob> {
  const photo = await loadImage(imageDataUrl);
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.fillStyle = "#f6ead8";
  ctx.fillRect(0, 0, width, height);

  const pad = 72;
  const card = width - pad * 2;
  const cardY = 430;
  const radius = 48;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, cardY, card, card, radius);
  ctx.clip();
  ctx.fillStyle = "#fff8ee";
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

  ctx.fillStyle = "#3a2714";
  ctx.textAlign = "center";
  ctx.font = 'italic 72px "Times New Roman", Georgia, serif';
  ctx.fillText("Titta vad lik jag blev", width / 2, 280);

  ctx.font = '600 42px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(breed, width / 2, cardY + card + 88);

  ctx.fillStyle = "#7a5c42";
  ctx.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  const caption = wrapText(ctx, `Hälften jag, hälften ${breed}.`, width - pad * 2);
  caption.forEach((line, index) => {
    ctx.fillText(line, width / 2, cardY + card + 140 + index * 36);
  });

  ctx.fillStyle = "#a18468";
  ctx.font = 'italic 32px "Times New Roman", Georgia, serif';
  ctx.fillText("Hundtvilling", width / 2, height - 120);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("blob");
  return blob;
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
  const payload = {
    title: "Titta vad lik jag blev",
    text: `Hälften jag, hälften ${opts.breed}.`,
    files: [file],
  };

  if (typeof navigator.share === "function") {
    const canFiles = typeof navigator.canShare !== "function" || navigator.canShare(payload);
    try {
      if (canFiles) {
        await navigator.share(payload);
        return "shared";
      }
      await navigator.share({ title: payload.title, text: payload.text });
      triggerDownload(file);
      return "saved";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "aborted";
    }
  }

  triggerDownload(file);
  const app = opts.target;
  if (app !== "system") {
    window.setTimeout(() => {
      window.location.href = APP_SCHEME[app];
    }, 350);
  }
  return "saved";
}
