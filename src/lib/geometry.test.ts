import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALIGN_TARGETS,
  alignmentCorrection,
  compareAlignment,
  geometryDirective,
  parseFaceGeometry,
  type FaceGeometry,
  type MeasuredFace,
} from "./geometry.ts";
import { faceFromLandmarks } from "./face-geometry.ts";

function face(shift = 0): FaceGeometry {
  return {
    source: "mediapipe",
    faceWidth: 0.4,
    ipd: 0.16,
    yaw: 2,
    outline: [
      { x: 0.3, y: 0.1 },
      { x: 0.7, y: 0.1 },
      { x: 0.75, y: 0.4 },
      { x: 0.7, y: 0.8 },
      { x: 0.5, y: 0.9 },
      { x: 0.3, y: 0.8 },
      { x: 0.25, y: 0.4 },
      { x: 0.3, y: 0.15 },
    ],
    leftEye: { x: 0.4, y: 0.4 },
    rightEye: { x: 0.6, y: 0.4 },
    nose: { x: 0.5, y: 0.55 },
    mouth: { x: 0.5, y: 0.68 },
    chin: { x: 0.5, y: 0.86 },
    forehead: { x: 0.5, y: 0.2 },
    leftCheek: { x: 0.32, y: 0.55 },
    rightCheek: { x: 0.68, y: 0.55 },
    jawLeft: { x: 0.36, y: 0.74 },
    jawRight: { x: 0.64, y: 0.74 },
  };
}

function measured(shift: number): MeasuredFace {
  const source = face();
  const move = (point: { x: number; y: number }) => ({ x: point.x + shift, y: point.y });
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

describe("geometry lock", () => {
  it("accepts a face that stays inside the provisional targets", () => {
    const report = compareAlignment(face(), measured(0.004));
    assert.equal(report.ok, true);
    assert.ok(report.eye < ALIGN_TARGETS.eye);
  });

  it("rejects an eye shift above 2% of face width", () => {
    const report = compareAlignment(face(), measured(0.02));
    assert.equal(report.ok, false);
    assert.ok(report.eye > ALIGN_TARGETS.eye);
    assert.match(alignmentCorrection(report), /Eye centers are off/);
  });

  it("puts the human landmarks ahead of breed freedom", () => {
    const prompt = geometryDirective(face());
    assert.match(prompt, /ground truth/i);
    assert.match(prompt, /pasted dog head/i);
    assert.match(prompt, /Left eye center/);
  });

  it("rejects a geometry payload that is not from MediaPipe", () => {
    assert.equal(parseFaceGeometry({ source: "guess", leftEye: { x: 0.4, y: 0.4 } }), null);
    assert.equal(parseFaceGeometry(face())?.source, "mediapipe");
  });

  it("builds a face from MediaPipe indexes", () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[33] = { x: 0.4, y: 0.4, z: 0 };
    landmarks[133] = { x: 0.46, y: 0.4, z: 0 };
    landmarks[159] = { x: 0.43, y: 0.38, z: 0 };
    landmarks[145] = { x: 0.43, y: 0.42, z: 0 };
    landmarks[263] = { x: 0.6, y: 0.4, z: 0 };
    landmarks[362] = { x: 0.54, y: 0.4, z: 0 };
    landmarks[386] = { x: 0.57, y: 0.38, z: 0 };
    landmarks[374] = { x: 0.57, y: 0.42, z: 0 };
    landmarks[1] = { x: 0.5, y: 0.55, z: 0 };
    landmarks[13] = { x: 0.5, y: 0.66, z: 0 };
    landmarks[14] = { x: 0.5, y: 0.7, z: 0 };
    landmarks[152] = { x: 0.5, y: 0.88, z: 0 };
    landmarks[10] = { x: 0.5, y: 0.16, z: 0 };
    landmarks[234] = { x: 0.3, y: 0.5, z: 0 };
    landmarks[454] = { x: 0.7, y: 0.5, z: 0 };
    landmarks[172] = { x: 0.36, y: 0.74, z: 0 };
    landmarks[397] = { x: 0.64, y: 0.74, z: 0 };
    const parsed = faceFromLandmarks(landmarks);
    assert.equal(parsed?.source, "mediapipe");
    assert.ok(parsed && parsed.leftEye.x < parsed.rightEye.x);
    assert.ok(parsed && parsed.ipd > 0.1);
  });
});
