import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FaceGeometry, MeasuredFace } from "./geometry.ts";
import {
  applyAffine,
  compositeLockedSplit,
  fitFaceAffine,
  invertAffine,
  seamColumn,
  warpIsSafe,
  type Raster,
} from "./split-lock.ts";

function face(): FaceGeometry {
  return {
    source: "mediapipe",
    faceWidth: 0.4,
    ipd: 0.16,
    yaw: 0,
    outline: Array.from({ length: 8 }, (_, index) => ({ x: 0.2 + index * 0.05, y: 0.2 })),
    leftEye: { x: 0.42, y: 0.4 },
    rightEye: { x: 0.58, y: 0.4 },
    nose: { x: 0.5, y: 0.55 },
    mouth: { x: 0.5, y: 0.68 },
    chin: { x: 0.5, y: 0.86 },
    forehead: { x: 0.5, y: 0.18 },
    leftCheek: { x: 0.32, y: 0.55 },
    rightCheek: { x: 0.68, y: 0.55 },
    jawLeft: { x: 0.36, y: 0.74 },
    jawRight: { x: 0.64, y: 0.74 },
  };
}

function shifted(dx: number): MeasuredFace {
  const source = face();
  const move = (point: { x: number; y: number }) => ({ x: point.x + dx, y: point.y });
  return {
    leftEye: move(source.leftEye),
    rightEye: move(source.rightEye),
    nose: move(source.nose),
    mouth: move(source.mouth),
    chin: move(source.chin),
    jawLeft: move(source.jawLeft),
    jawRight: move(source.jawRight),
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

describe("split lock", () => {
  it("cuts on the nose, not on a guessed image center", () => {
    assert.equal(seamColumn(100, 0.62), 62);
    assert.equal(seamColumn(100, 0.05), 30);
    assert.equal(seamColumn(100, 0.95), 70);
  });

  it("keeps the human half pixel-identical and puts the dog only on the right", () => {
    const source = fill(10, 4, [200, 10, 10, 255]);
    const generated = fill(10, 4, [10, 180, 10, 255]);
    const seam = seamColumn(10, 0.5);
    const out = compositeLockedSplit(source, generated, seam, null);
    for (let x = 0; x < seam; x++) {
      assert.equal(out.data[x * 4], 200);
      assert.equal(out.data[x * 4 + 1], 10);
    }
    for (let x = seam; x < 10; x++) {
      assert.equal(out.data[x * 4], 10);
      assert.equal(out.data[x * 4 + 1], 180);
    }
  });

  it("moves a drifted dog eye back onto the human eye", () => {
    const source = face();
    const measured = shifted(0.04);
    const fitted = fitFaceAffine(source, measured);
    assert.ok(fitted);
    assert.equal(warpIsSafe(source, measured, fitted), true);
    const landed = applyAffine(fitted, measured.rightEye);
    assert.ok(Math.abs(landed.x - source.rightEye.x) < 0.005);
    assert.ok(Math.abs(landed.y - source.rightEye.y) < 0.005);
    const inverse = invertAffine(fitted);
    assert.ok(inverse);
    const sampled = applyAffine(inverse, source.rightEye);
    assert.ok(Math.abs(sampled.x - measured.rightEye.x) < 0.005);
  });

  it("refuses a warp that would tear the face", () => {
    const source = face();
    const measured = shifted(0.2);
    const fitted = fitFaceAffine(source, measured);
    assert.ok(fitted);
    assert.equal(warpIsSafe(source, measured, fitted), false);
  });
});
