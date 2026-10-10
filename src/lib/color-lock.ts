import type { FaceGeometry, Point } from "./geometry.ts";
import type { Raster } from "./split-lock.ts";

export type RGB = { r: number; g: number; b: number };

export type HumanPalette = {
  iris: RGB | null;
  hair: RGB | null;
  skin: RGB | null;
};

const FUR_BLEND = 0.62;
const EYE_BLEND = 0.8;
const LEATHER_BLEND = 0.35;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbAt(raster: Raster, x: number, y: number): RGB {
  const i = (y * raster.width + x) * 4;
  return { r: raster.data[i], g: raster.data[i + 1], b: raster.data[i + 2] };
}

function luma(color: RGB): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function rgbToHsl(color: RGB): [number, number, number] {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = clampByte(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: clampByte(channel(hue / 360 + 1 / 3) * 255),
    g: clampByte(channel(hue / 360) * 255),
    b: clampByte(channel(hue / 360 - 1 / 3) * 255),
  };
}

function lerpHue(from: number, to: number, t: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return (from + delta * t + 360) % 360;
}

export function recolorToward(pixel: RGB, target: RGB, amount: number): RGB {
  const [h1, s1, l1] = rgbToHsl(pixel);
  const [h2, s2] = rgbToHsl(target);
  return hslToRgb(lerpHue(h1, h2, amount), s1 + (s2 - s1) * amount, l1);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sampleDisc(raster: Raster, point: Point, radiusPx: number, minLuma: number, maxLuma: number): RGB | null {
  const cx = Math.round(point.x * (raster.width - 1));
  const cy = Math.round(point.y * (raster.height - 1));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = cy - radiusPx; y <= cy + radiusPx; y++) {
    for (let x = cx - radiusPx; x <= cx + radiusPx; x++) {
      if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > radiusPx * radiusPx) continue;
      const color = rgbAt(raster, x, y);
      const tone = luma(color);
      if (tone < minLuma || tone > maxLuma) continue;
      rs.push(color.r);
      gs.push(color.g);
      bs.push(color.b);
    }
  }
  if (rs.length < 4) return null;
  return { r: median(rs), g: median(gs), b: median(bs) };
}

function hueDistance(a: RGB, b: RGB): number {
  const [h1] = rgbToHsl(a);
  const [h2] = rgbToHsl(b);
  let delta = Math.abs(h1 - h2);
  if (delta > 180) delta = 360 - delta;
  return delta;
}

export function sampleHumanPalette(raster: Raster, geometry: FaceGeometry): HumanPalette {
  const radius = Math.max(2, Math.round(raster.width * 0.015));
  const iris =
    sampleDisc(raster, geometry.leftEye, radius, 45, 190) ??
    sampleDisc(raster, geometry.rightEye, radius, 45, 190);
  const skin =
    sampleDisc(raster, geometry.leftCheek, radius, 50, 230) ??
    sampleDisc(raster, geometry.nose, radius, 50, 230);
  const hairSpots: Point[] = [
    { x: geometry.forehead.x, y: Math.max(0, geometry.forehead.y - 0.05) },
    { x: geometry.leftEye.x, y: (geometry.forehead.y + geometry.leftEye.y) / 2 },
    { x: geometry.leftCheek.x, y: geometry.leftEye.y },
  ];
  let hair: RGB | null = null;
  let hairScore = -1;
  for (const spot of hairSpots) {
    const color = sampleDisc(raster, spot, radius, 25, 220);
    if (!color) continue;
    const tone = luma(color);
    if (tone < 30) continue;
    if (skin && hueDistance(color, skin) < 14 && Math.abs(luma(color) - luma(skin)) < 25) continue;
    const [, sat] = rgbToHsl(color);
    const score = sat * 2 + (tone > 40 && tone < 200 ? 0.2 : 0);
    if (score > hairScore) {
      hair = color;
      hairScore = score;
    }
  }
  return { iris, hair, skin };
}

export function applyHumanColors(
  raster: Raster,
  seam: number,
  geometry: FaceGeometry,
  palette: HumanPalette,
): Raster {
  const data = new Uint8ClampedArray(raster.data);
  const eyeX = Math.round(geometry.rightEye.x * (raster.width - 1));
  const eyeY = Math.round(geometry.rightEye.y * (raster.height - 1));
  const eyeR = Math.max(3, Math.round(raster.width * 0.035));
  for (let y = 0; y < raster.height; y++) {
    for (let x = seam; x < raster.width; x++) {
      const i = (y * raster.width + x) * 4;
      const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const tone = luma(pixel);
      const inEye = (x - eyeX) ** 2 + (y - eyeY) ** 2 <= eyeR * eyeR;
      let next = pixel;
      if (inEye && palette.iris && tone >= 40 && tone <= 200) {
        next = recolorToward(pixel, palette.iris, EYE_BLEND);
      } else if (tone < 40 && palette.skin) {
        next = recolorToward(pixel, palette.skin, LEATHER_BLEND);
      } else if (palette.hair && tone >= 40 && tone <= 225) {
        next = recolorToward(pixel, palette.hair, FUR_BLEND);
      }
      data[i] = next.r;
      data[i + 1] = next.g;
      data[i + 2] = next.b;
    }
  }
  return { width: raster.width, height: raster.height, data };
}
