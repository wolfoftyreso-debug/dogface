import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyHumanColors, recolorToward, sampleHumanPalette } from "./color-lock.ts";
import type { FaceGeometry } from "./geometry.ts";
import type { Raster } from "./split-lock.ts";

function face(): FaceGeometry {
  return {
    source: "mediapipe",
    faceWidth: 0.4,
    ipd: 0.16,
    yaw: 0,
    outline: Array.from({ length: 8 }, (_, index) => ({ x: 0.2 + index * 0.05, y: 0.2 })),
    leftEye: { x: 0.35, y: 0.4 },
    rightEye: { x: 0.65, y: 0.4 },
    nose: { x: 0.5, y: 0.55 },
    mouth: { x: 0.5, y: 0.68 },
    chin: { x: 0.5, y: 0.86 },
    forehead: { x: 0.5, y: 0.22 },
    leftCheek: { x: 0.32, y: 0.58 },
    rightCheek: { x: 0.68, y: 0.58 },
    jawLeft: { x: 0.36, y: 0.74 },
    jawRight: { x: 0.64, y: 0.74 },
  };
}

function fill(width: number, height: number, rgba: [number, number, number, number]): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

function paint(raster: Raster, x: number, y: number, rgb: [number, number, number]) {
  const i = (y * raster.width + x) * 4;
  raster.data[i] = rgb[0];
  raster.data[i + 1] = rgb[1];
  raster.data[i + 2] = rgb[2];
}

describe("human color lock", () => {
  it("moves a breed-gray coat toward the person's hair and leaves the human half", () => {
    const geometry = face();
    const source = fill(40, 40, [210, 170, 140, 255]);
    const hairX = Math.round(geometry.forehead.x * 39);
    const hairY = Math.round(Math.max(0, geometry.forehead.y - 0.05) * 39);
    for (let y = hairY - 2; y <= hairY + 2; y++) {
      for (let x = hairX - 2; x <= hairX + 2; x++) paint(source, x, y, [150, 70, 30]);
    }
    const eyeX = Math.round(geometry.leftEye.x * 39);
    const eyeY = Math.round(geometry.leftEye.y * 39);
    for (let y = eyeY - 2; y <= eyeY + 2; y++) {
      for (let x = eyeX - 2; x <= eyeX + 2; x++) paint(source, x, y, [90, 140, 70]);
    }
    const palette = sampleHumanPalette(source, geometry);
    assert.ok(palette.hair);
    assert.ok(palette.hair.r > palette.hair.b);
    assert.ok(palette.iris);
    const dog = fill(40, 40, [140, 140, 140, 255]);
    const seam = 20;
    const out = applyHumanColors(dog, seam, geometry, palette);
    assert.equal(out.data[0], 140);
    const fur = seam * 4;
    assert.ok(out.data[fur] > out.data[fur + 2]);
    const moved = recolorToward({ r: 140, g: 140, b: 140 }, palette.hair, 0.62);
    assert.ok(moved.r > moved.b);
  });

  it("keeps a black nose dark while warming it, and does not tint the pupil", () => {
    const geometry = face();
    const dog = fill(20, 20, [20, 20, 20, 255]);
    const out = applyHumanColors(dog, 0, geometry, {
      iris: { r: 80, g: 140, b: 90 },
      hair: { r: 160, g: 80, b: 40 },
      skin: { r: 210, g: 160, b: 130 },
    });
    const leather = out.data[0];
    assert.ok(leather < 80);
    assert.ok(out.data[0] >= out.data[2]);
  });

  it("always copies a dark iris onto a blue dog eye", () => {
    const geometry = face();
    const source = fill(80, 80, [200, 170, 150, 255]);
    const eyeX = Math.round(geometry.leftEye.x * 79);
    const eyeY = Math.round(geometry.leftEye.y * 79);
    for (let y = eyeY - 3; y <= eyeY + 3; y++) {
      for (let x = eyeX - 3; x <= eyeX + 3; x++) paint(source, x, y, [46, 28, 16]);
    }
    const palette = sampleHumanPalette(source, geometry);
    assert.ok(palette.iris);
    assert.ok(palette.iris.r > palette.iris.b);
    const dog = fill(80, 80, [170, 170, 170, 255]);
    const dogEyeX = Math.round(geometry.rightEye.x * 79);
    const dogEyeY = Math.round(geometry.rightEye.y * 79);
    paint(dog, dogEyeX, dogEyeY, [70, 130, 210]);
    const out = applyHumanColors(dog, 30, geometry, palette);
    const i = (dogEyeY * 80 + dogEyeX) * 4;
    assert.ok(out.data[i] > out.data[i + 2]);
  });
});
