import type { FaceGeometry, MeasuredFace, Point } from "./geometry.ts";
import { applyHumanColors, sampleHumanPalette } from "./color-lock.ts";

export type Affine = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type Raster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const MAX_WARP_SHIFT = 0.18;

function solve3(matrix: number[][], right: number[]): number[] | null {
  const rows = matrix.map((row, index) => [...row, right[index]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-10) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const div = rows[col][col];
    for (let c = col; c < 4; c++) rows[col][c] /= div;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let c = col; c < 4; c++) rows[row][c] -= factor * rows[col][c];
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]];
}

export function applyAffine(transform: Affine, point: Point): Point {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

export function invertAffine(transform: Affine): Affine | null {
  const det = transform.a * transform.d - transform.c * transform.b;
  if (Math.abs(det) < 1e-8) return null;
  const a = transform.d / det;
  const c = -transform.c / det;
  const b = -transform.b / det;
  const d = transform.a / det;
  return {
    a,
    b,
    c,
    d,
    e: -(a * transform.e + c * transform.f),
    f: -(b * transform.e + d * transform.f),
  };
}

/** Maps measured landmarks onto the human landmarks. */
export function fitFaceAffine(source: FaceGeometry, measured: MeasuredFace): Affine | null {
  const from = [measured.leftEye, measured.rightEye, measured.nose, measured.mouth];
  const to = [source.leftEye, source.rightEye, source.nose, source.mouth];
  let xx = 0;
  let xy = 0;
  let x1 = 0;
  let yy = 0;
  let y1 = 0;
  let n = 0;
  let xu = 0;
  let yu = 0;
  let u1 = 0;
  let xv = 0;
  let yv = 0;
  let v1 = 0;
  for (let i = 0; i < from.length; i++) {
    const x = from[i].x;
    const y = from[i].y;
    const u = to[i].x;
    const v = to[i].y;
    xx += x * x;
    xy += x * y;
    x1 += x;
    yy += y * y;
    y1 += y;
    n += 1;
    xu += x * u;
    yu += y * u;
    u1 += u;
    xv += x * v;
    yv += y * v;
    v1 += v;
  }
  const xCoef = solve3(
    [
      [xx, xy, x1],
      [xy, yy, y1],
      [x1, y1, n],
    ],
    [xu, yu, u1],
  );
  const yCoef = solve3(
    [
      [xx, xy, x1],
      [xy, yy, y1],
      [x1, y1, n],
    ],
    [xv, yv, v1],
  );
  if (!xCoef || !yCoef) return null;
  return { a: xCoef[0], c: xCoef[1], e: xCoef[2], b: yCoef[0], d: yCoef[1], f: yCoef[2] };
}

export function warpIsSafe(source: FaceGeometry, measured: MeasuredFace, transform: Affine): boolean {
  const width = Math.max(source.faceWidth, 0.05);
  const pairs = [
    [measured.leftEye, source.leftEye],
    [measured.rightEye, source.rightEye],
    [measured.nose, source.nose],
    [measured.mouth, source.mouth],
  ] as const;
  for (const [from, to] of pairs) {
    const shift = Math.hypot(from.x - to.x, from.y - to.y) / width;
    if (shift > MAX_WARP_SHIFT) return false;
  }
  const sx = Math.hypot(transform.a, transform.b);
  const sy = Math.hypot(transform.c, transform.d);
  if (sx < 0.8 || sx > 1.25 || sy < 0.8 || sy > 1.25) return false;
  return invertAffine(transform) !== null;
}

/** Facial midline. Clamped so a bad nose point cannot hide either half. */
export function seamColumn(width: number, noseX: number): number {
  const clamped = Math.min(0.7, Math.max(0.3, noseX));
  const col = Math.round(clamped * width);
  return Math.min(width - 1, Math.max(1, col));
}

export type NosePin = {
  from: Point;
  to: Point;
  eyeY: number;
  chinY: number;
};

/** Largest compact dark blob on the dog side. Specks and wide shadows do not count. */
export function findCanineNose(raster: Raster, nose: Point, seam: number): Point | null {
  const width = raster.width;
  const height = raster.height;
  if (width < 8 || height < 8) return null;
  const x0 = Math.max(0, seam);
  const x1 = Math.min(width - 1, Math.round((nose.x + 0.3) * width));
  const y0 = Math.max(0, Math.round((nose.y - 0.02) * height));
  const y1 = Math.min(height - 1, Math.round((nose.y + 0.38) * height));
  const spanX = x1 - x0 + 1;
  const darkAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const luma = raster.data[i] * 0.2126 + raster.data[i + 1] * 0.7152 + raster.data[i + 2] * 0.0722;
    return luma < 42;
  };
  const seen = new Uint8Array(spanX * (y1 - y0 + 1));
  const seenAt = (x: number, y: number) => (y - y0) * spanX + (x - x0);
  let bestScore = 0;
  let best: Point | null = null;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!darkAt(x, y) || seen[seenAt(x, y)]) continue;
      const stack = [[x, y]];
      seen[seenAt(x, y)] = 1;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let left = x;
      let right = x;
      let top = y;
      let bottom = y;
      while (stack.length) {
        const [cx, cy] = stack.pop() as [number, number];
        area += 1;
        sumX += cx;
        sumY += cy;
        left = Math.min(left, cx);
        right = Math.max(right, cx);
        top = Math.min(top, cy);
        bottom = Math.max(bottom, cy);
        const next = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of next) {
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
          const slot = seenAt(nx, ny);
          if (seen[slot] || !darkAt(nx, ny)) continue;
          seen[slot] = 1;
          stack.push([nx, ny]);
        }
      }
      const blobW = right - left + 1;
      const blobH = bottom - top + 1;
      if (area < 12 || blobW < 3 || blobH < 3 || blobW > blobH * 4) continue;
      const centerX = sumX / area;
      const dist = Math.abs(centerX / width - nose.x);
      const score = area / (1 + dist * 6);
      if (score > bestScore) {
        bestScore = score;
        best = { x: centerX / (width - 1), y: sumY / area / (height - 1) };
      }
    }
  }
  return best;
}

export function nosePinFor(geometry: FaceGeometry, found: Point): NosePin | null {
  const eyeY = Math.min(geometry.leftEye.y, geometry.rightEye.y);
  const chinY = geometry.chin.y;
  if (found.y <= eyeY + 0.02 || found.y >= chinY - 0.02) return null;
  const shift = Math.hypot(found.x - geometry.nose.x, found.y - geometry.nose.y);
  if (shift < 0.03 || shift > 0.35) return null;
  return { from: found, to: geometry.nose, eyeY, chinY };
}

/** Sample the generated face so the canine nose lands on the human nose. Eyes stay put. */
export function sampleForNosePin(pin: NosePin, out: Point): Point {
  const eyeY = pin.eyeY;
  const noseY = pin.to.y;
  const chinY = pin.chinY;
  const y = Math.min(1, Math.max(0, out.y));
  let sy = y;
  if (y <= eyeY) sy = y;
  else if (y <= noseY) {
    const t = (y - eyeY) / Math.max(0.001, noseY - eyeY);
    sy = eyeY + t * (pin.from.y - eyeY);
  } else if (y <= chinY) {
    const t = (y - noseY) / Math.max(0.001, chinY - noseY);
    sy = pin.from.y + t * (chinY - pin.from.y);
  }
  const span = Math.max(0.08, Math.min(Math.abs(noseY - eyeY), Math.abs(chinY - noseY)));
  const weight = Math.max(0, 1 - Math.abs(y - noseY) / span);
  const sx = out.x + (pin.from.x - pin.to.x) * weight;
  return { x: sx, y: Math.min(1, Math.max(0, sy)) };
}

function sample(raster: Raster, nx: number, ny: number): [number, number, number, number] {
  const x = Math.min(raster.width - 1, Math.max(0, nx * (raster.width - 1)));
  const y = Math.min(raster.height - 1, Math.max(0, ny * (raster.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(raster.width - 1, x0 + 1);
  const y1 = Math.min(raster.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (px: number, py: number) => {
    const i = (py * raster.width + px) * 4;
    return [raster.data[i], raster.data[i + 1], raster.data[i + 2], raster.data[i + 3]] as const;
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  const mix = (i: number) =>
    Math.round(
      a[i] * (1 - tx) * (1 - ty) + b[i] * tx * (1 - ty) + c[i] * (1 - tx) * ty + d[i] * tx * ty,
    );
  return [mix(0), mix(1), mix(2), mix(3)];
}

export function compositeLockedSplit(
  source: Raster,
  generated: Raster,
  seam: number,
  inverse: Affine | null,
  pin: NosePin | null = null,
): Raster {
  const width = source.width;
  const height = source.height;
  const data = new Uint8ClampedArray(source.data);
  if (generated.width !== width || generated.height !== height) return { width, height, data };
  for (let y = 0; y < height; y++) {
    for (let x = seam; x < width; x++) {
      const nx = width <= 1 ? 0 : x / (width - 1);
      const ny = height <= 1 ? 0 : y / (height - 1);
      const sampled = pin
        ? sampleForNosePin(pin, { x: nx, y: ny })
        : inverse
          ? applyAffine(inverse, { x: nx, y: ny })
          : { x: nx, y: ny };
      const pixel = sample(generated, sampled.x, sampled.y);
      const i = (y * width + x) * 4;
      data[i] = pixel[0];
      data[i + 1] = pixel[1];
      data[i + 2] = pixel[2];
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

export async function lockSplitPortrait(
  sourceUrl: string,
  generatedUrl: string,
  geometry: FaceGeometry,
  measured: MeasuredFace | null,
): Promise<string> {
  const [sourceImage, generatedImage] = await Promise.all([loadImage(sourceUrl), loadImage(generatedUrl)]);
  const width = Math.max(1, sourceImage.naturalWidth || sourceImage.width);
  const height = Math.max(1, sourceImage.naturalHeight || sourceImage.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(sourceImage, 0, 0, width, height);
  const sourceData = ctx.getImageData(0, 0, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(generatedImage, 0, 0, width, height);
  const generatedData = ctx.getImageData(0, 0, width, height);
  const generated = { width, height, data: generatedData.data };
  const seam = seamColumn(width, geometry.nose.x);
  const found = findCanineNose(generated, geometry.nose, seam);
  const pin = found ? nosePinFor(geometry, found) : null;
  const fitted = !pin && measured ? fitFaceAffine(geometry, measured) : null;
  const inverse = fitted && measured && warpIsSafe(geometry, measured, fitted) ? invertAffine(fitted) : null;
  const locked = compositeLockedSplit(
    { width, height, data: sourceData.data },
    generated,
    seam,
    inverse,
    pin,
  );
  const colored = applyHumanColors(
    locked,
    seam,
    geometry,
    sampleHumanPalette({ width, height, data: sourceData.data }, geometry),
  );
  const image = ctx.createImageData(width, height);
  image.data.set(colored.data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
