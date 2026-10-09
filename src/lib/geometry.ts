export type Point = { x: number; y: number };

/** Normalized 0–1 coordinates from MediaPipe on the source photo. */
export type FaceGeometry = {
  source: "mediapipe";
  faceWidth: number;
  ipd: number;
  yaw: number | null;
  outline: Point[];
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouth: Point;
  chin: Point;
  forehead: Point;
  leftCheek: Point;
  rightCheek: Point;
  jawLeft: Point;
  jawRight: Point;
};

export type MeasuredFace = {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouth: Point;
  chin: Point;
  jawLeft: Point;
  jawRight: Point;
};

export type AlignmentReport = {
  ok: boolean;
  eye: number;
  nose: number;
  mouth: number;
  contour: number;
};

/** Provisional. Not a proven perceptual threshold. */
export const ALIGN_TARGETS = {
  eye: 0.02,
  nose: 0.03,
  mouth: 0.03,
  contour: 0.05,
} as const;

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalizedDisplacement(a: Point, b: Point, faceWidth: number): number {
  return pointDistance(a, b) / Math.max(faceWidth, 0.05);
}

export function compareAlignment(source: FaceGeometry, measured: MeasuredFace): AlignmentReport {
  const width = source.faceWidth;
  const eye = Math.max(
    normalizedDisplacement(source.leftEye, measured.leftEye, width),
    normalizedDisplacement(source.rightEye, measured.rightEye, width),
  );
  const nose = normalizedDisplacement(source.nose, measured.nose, width);
  const mouth = normalizedDisplacement(source.mouth, measured.mouth, width);
  const contour = Math.max(
    normalizedDisplacement(source.chin, measured.chin, width),
    normalizedDisplacement(source.jawLeft, measured.jawLeft, width),
    normalizedDisplacement(source.jawRight, measured.jawRight, width),
  );
  return {
    ok:
      eye < ALIGN_TARGETS.eye &&
      nose < ALIGN_TARGETS.nose &&
      mouth < ALIGN_TARGETS.mouth &&
      contour < ALIGN_TARGETS.contour,
    eye,
    nose,
    mouth,
    contour,
  };
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}% of face width`;
}

export function alignmentCorrection(report: AlignmentReport): string {
  return [
    "GEOMETRY CORRECTION. The previous candidate missed the human landmark lock.",
    `Eye centers are off by ${pct(report.eye)} (target under 2%).`,
    `Nose center is off by ${pct(report.nose)} (target under 3%).`,
    `Mouth center is off by ${pct(report.mouth)} (target under 3%).`,
    `Jaw and chin are off by ${pct(report.contour)} (target under 5%).`,
    "Move the canine eyes, nose, mouth, and jaw onto the source positions. Shorten the muzzle so the nose stays on the human nose point. Do not grow a second muzzle and do not add a second eye. Distort breed proportions to fit.",
  ].join(" ");
}

function pctPoint(point: Point): string {
  return `${Math.round(point.x * 1000) / 10}%,${Math.round(point.y * 1000) / 10}%`;
}

export function geometryDirective(geometry: FaceGeometry): string {
  return [
    "GEOMETRY LOCK. The human face is the anatomical ground truth. Retarget the dog onto that face. Breed proportions lose when they fight alignment.",
    "IMAGE 1 is the photograph to transform. IMAGE 2, when present, is a position chart in the same frame. It is not a style reference and not a second subject. Do not draw its markers or lines.",
    `Left eye center ${pctPoint(geometry.leftEye)}. Right eye center ${pctPoint(geometry.rightEye)}. Interpupillary distance ${(geometry.ipd * 100).toFixed(1)}% of image width.`,
    `Nose tip ${pctPoint(geometry.nose)}. Mouth center ${pctPoint(geometry.mouth)}. Chin ${pctPoint(geometry.chin)}. Forehead ${pctPoint(geometry.forehead)}.`,
    `Cheeks ${pctPoint(geometry.leftCheek)} and ${pctPoint(geometry.rightCheek)}. Jaw ${pctPoint(geometry.jawLeft)} and ${pctPoint(geometry.jawRight)}.`,
    geometry.yaw == null
      ? "Keep the source head rotation."
      : `Keep head yaw near ${geometry.yaw.toFixed(1)} degrees.`,
    "One skull, one eye line, one nose, one mouth, one jaw. No duplicated features and no pasted dog head.",
  ].join(" ");
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return (
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function parseFaceGeometry(value: unknown): FaceGeometry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.source !== "mediapipe") return null;
  const keys = [
    "leftEye",
    "rightEye",
    "nose",
    "mouth",
    "chin",
    "forehead",
    "leftCheek",
    "rightCheek",
    "jawLeft",
    "jawRight",
  ] as const;
  const points = {} as Record<(typeof keys)[number], Point>;
  for (const key of keys) {
    if (!isPoint(raw[key])) return null;
    points[key] = raw[key];
  }
  const faceWidth = typeof raw.faceWidth === "number" ? raw.faceWidth : 0;
  const ipd = typeof raw.ipd === "number" ? raw.ipd : 0;
  if (faceWidth < 0.05 || faceWidth > 1.5 || ipd < 0.02 || ipd > 0.8) return null;
  const outline = Array.isArray(raw.outline) ? raw.outline.filter(isPoint).slice(0, 40) : [];
  if (outline.length < 8) return null;
  const yaw =
    typeof raw.yaw === "number" && Number.isFinite(raw.yaw) ? Math.max(-80, Math.min(80, raw.yaw)) : null;
  return { source: "mediapipe", faceWidth, ipd, yaw, outline, ...points };
}

export function parseMeasuredFace(value: unknown): MeasuredFace | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const keys = ["leftEye", "rightEye", "nose", "mouth", "chin", "jawLeft", "jawRight"] as const;
  const points = {} as Record<(typeof keys)[number], Point>;
  for (const key of keys) {
    if (!isPoint(raw[key])) return null;
    points[key] = raw[key];
  }
  return points;
}

export function geometrySignature(geometry: FaceGeometry): string {
  const round = (value: number) => value.toFixed(2);
  return [geometry.leftEye, geometry.rightEye, geometry.nose, geometry.mouth, geometry.chin]
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(";");
}
