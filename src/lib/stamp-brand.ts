function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  try {
    return await loadImage("/logo-mark.png");
  } catch {
    return null;
  }
}

export function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  logo: HTMLImageElement | null,
): { width: number; height: number } {
  const boxH = 72 * scale;
  const logoS = 56 * scale;
  const doggSize = 22 * scale;
  const styleSize = 15 * scale;
  ctx.font = `700 ${doggSize}px Fredoka, ui-rounded, system-ui, sans-serif`;
  const doggW = ctx.measureText("Dogg").width;
  ctx.font = `650 ${styleSize}px Fredoka, ui-rounded, system-ui, sans-serif`;
  const styleW = ctx.measureText("STYLE").width;
  const textW = Math.max(doggW, styleW);
  const boxW = (logo ? boxH : 18 * scale) + textW + 20 * scale;

  ctx.fillStyle = "rgba(255, 251, 243, 0.94)";
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(42, 20, 8, 0.1)";
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.stroke();

  if (logo) {
    const lx = x + (boxH - logoS) / 2;
    const ly = y + (boxH - logoS) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + boxH / 2, y + boxH / 2, logoS / 2 + 2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4d2e";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + boxH / 2, y + boxH / 2, logoS / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, lx, ly, logoS, logoS);
    ctx.restore();
  }

  const tx = x + (logo ? boxH : 14 * scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2a1408";
  ctx.font = `700 ${doggSize}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.fillText("Dogg", tx, y + boxH * 0.46);
  ctx.fillStyle = "#ff4d2e";
  ctx.font = `650 ${styleSize}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.letterSpacing = `${2.2 * scale}px`;
  ctx.fillText("STYLE", tx, y + boxH * 0.78);
  ctx.letterSpacing = "0px";

  return { width: boxW, height: boxH };
}

export async function stampBrand(dataUrl: string): Promise<string> {
  const photo = await loadImage(dataUrl);
  const logo = await loadLogo();
  try {
    await document.fonts.load("700 22px Fredoka");
    await document.fonts.load("650 15px Fredoka");
  } catch {
    // system rounded fonts still read as the mark
  }
  const canvas = document.createElement("canvas");
  canvas.width = photo.naturalWidth || photo.width;
  canvas.height = photo.naturalHeight || photo.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width, canvas.height) / 1080;
  const boxH = 72 * scale;
  const pad = 26 * scale;
  drawBrandLockup(ctx, pad, canvas.height - pad - boxH, scale, logo);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function stampBrandAll<T extends { imageDataUrl: string; splitDataUrl?: string; dogDataUrl?: string }>(
  item: T,
): Promise<T> {
  const imageDataUrl = await stampBrand(item.imageDataUrl);
  const splitDataUrl = item.splitDataUrl ? await stampBrand(item.splitDataUrl) : item.splitDataUrl;
  const dogDataUrl = item.dogDataUrl ? await stampBrand(item.dogDataUrl) : item.dogDataUrl;
  return { ...item, imageDataUrl, splitDataUrl, dogDataUrl };
}
