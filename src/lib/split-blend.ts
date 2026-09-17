/** 0 = fully human, 1 = fully dog. Wide organic melt, never a hard midline. */
export function morphAlpha(nx: number, ny: number): number {
  const x = Math.max(0, Math.min(1, nx));
  const y = Math.max(0, Math.min(1, ny));
  const center = 0.5 + Math.sin(y * Math.PI * 1.7) * 0.03;
  const half = 0.28;
  const t = (x - (center - half)) / (half * 2);
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

export async function blendSplitPortrait(humanUrl: string, dogUrl: string): Promise<string> {
  const [human, dog] = await Promise.all([loadImage(humanUrl), loadImage(dogUrl)]);
  const width = Math.max(1, dog.naturalWidth || dog.width);
  const height = Math.max(1, dog.naturalHeight || dog.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(human, 0, 0, width, height);
  const dogCanvas = document.createElement("canvas");
  dogCanvas.width = width;
  dogCanvas.height = height;
  const dogCtx = dogCanvas.getContext("2d");
  if (!dogCtx) throw new Error("canvas");
  dogCtx.drawImage(dog, 0, 0, width, height);
  const image = dogCtx.getImageData(0, 0, width, height);
  const data = image.data;
  const lastX = Math.max(1, width - 1);
  const lastY = Math.max(1, height - 1);
  for (let y = 0; y < height; y += 1) {
    const ny = y / lastY;
    for (let x = 0; x < width; x += 1) {
      const alpha = morphAlpha(x / lastX, ny);
      const index = (y * width + x) * 4 + 3;
      data[index] = Math.round(data[index] * alpha);
    }
  }
  dogCtx.putImageData(image, 0, 0);
  ctx.drawImage(dogCanvas, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}
