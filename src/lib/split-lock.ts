import type { FaceGeometry, MeasuredFace, Point } from "./geometry.ts";

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

/** Dark nose leather to the right of the seam. The top of the blob wins over a dark beard. */
export function findCanineNose(raster: Raster, nose: Point, seam: number): Point | null {
  const width = raster.width;
  const height = raster.height;
  if (width < 8 || height < 8) return null;
  const x0 = Math.max(0, seam);
  const x1 = Math.min(width - 1, Math.round((nose.x + 0.28) * width));
  const y0 = Math.max(0, Math.round((nose.y - 0.04) * height));
  const y1 = Math.min(height - 1, Math.round((nose.y + 0.34) * height));
  const dark = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const luma = raster.data[i] * 0.2126 + raster.data[i + 1] * 0.7152 + raster.data[i + 2] * 0.0722;
    return luma < 42;
  };
  let top = -1;
  for (let y = y0; y <= y1; y++) {
    let row = 0;
    for (let x = x0; x <= x1; x++) if (dark(x, y)) row += 1;
    if (row >= 3) {
      top = y;
      break;
    }
  }
  if (top < 0) return null;
  const yEnd = Math.min(y1, top + Math.max(3, Math.round(height * 0.08)));
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = top; y <= yEnd; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!dark(x, y)) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  if (count < 8) return null;
  return { x: sumX / count / (width - 1), y: sumY / count / (height - 1) };
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
  const image = ctx.createImageData(width, height);
  image.data.set(locked.data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
