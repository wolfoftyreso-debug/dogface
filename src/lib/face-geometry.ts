import { type FaceGeometry, type Point } from "./geometry.ts";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176,
  149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

type Landmark = { x: number; y: number; z?: number };

let landmarkerPromise: Promise<{
  detect: (image: HTMLImageElement) => { faceLandmarks: Landmark[][] };
} | null> | null = null;

function average(points: Landmark[]): Point | null {
  if (!points.length) return null;
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

function at(landmarks: Landmark[], index: number): Landmark | null {
  const point = landmarks[index];
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return null;
  return point;
}

async function landmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(WASM);
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })().catch(() => null);
  }
  return landmarkerPromise;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

export function faceFromLandmarks(landmarks: Landmark[]): FaceGeometry | null {
  const eyeA = average([33, 133, 159, 145].map((index) => at(landmarks, index)).filter((point) => point !== null));
  const eyeB = average([263, 362, 386, 374].map((index) => at(landmarks, index)).filter((point) => point !== null));
  const nose = at(landmarks, 1);
  const mouthUpper = at(landmarks, 13);
  const mouthLower = at(landmarks, 14);
  const chin = at(landmarks, 152);
  const forehead = at(landmarks, 10);
  const cheekA = at(landmarks, 234);
  const cheekB = at(landmarks, 454);
  const jawA = at(landmarks, 172);
  const jawB = at(landmarks, 397);
  if (!eyeA || !eyeB || !nose || !mouthUpper || !mouthLower || !chin || !forehead || !cheekA || !cheekB || !jawA || !jawB) {
    return null;
  }
  const leftEye = eyeA.x <= eyeB.x ? eyeA : eyeB;
  const rightEye = eyeA.x <= eyeB.x ? eyeB : eyeA;
  const leftCheek = cheekA.x <= cheekB.x ? cheekA : cheekB;
  const rightCheek = cheekA.x <= cheekB.x ? cheekB : cheekA;
  const jawLeft = jawA.x <= jawB.x ? jawA : jawB;
  const jawRight = jawA.x <= jawB.x ? jawB : jawA;
  const mouth = { x: (mouthUpper.x + mouthLower.x) / 2, y: (mouthUpper.y + mouthLower.y) / 2 };
  const faceWidth = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y);
  const ipd = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (faceWidth < 0.05 || ipd < 0.02) return null;
  const outline = OVAL.map((index) => at(landmarks, index)).filter((point): point is Landmark => point !== null);
  if (outline.length < 8) return null;
  const zA = landmarks[33]?.z ?? 0;
  const zB = landmarks[263]?.z ?? 0;
  const yaw = Math.max(-80, Math.min(80, (zA - zB) * 80));
  return {
    source: "mediapipe",
    faceWidth,
    ipd,
    yaw,
    outline: outline.map((point) => ({ x: point.x, y: point.y })),
    leftEye,
    rightEye,
    nose: { x: nose.x, y: nose.y },
    mouth,
    chin: { x: chin.x, y: chin.y },
    forehead: { x: forehead.x, y: forehead.y },
    leftCheek: { x: leftCheek.x, y: leftCheek.y },
    rightCheek: { x: rightCheek.x, y: rightCheek.y },
    jawLeft: { x: jawLeft.x, y: jawLeft.y },
    jawRight: { x: jawRight.x, y: jawRight.y },
  };
}

export async function drawGeometryGuide(imageUrl: string, geometry: FaceGeometry): Promise<string | null> {
  const image = await loadImage(imageUrl);
  const longest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = Math.min(1, 640 / Math.max(longest, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(2, Math.round((image.naturalHeight || image.height) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const xy = (point: Point) => ({ x: point.x * canvas.width, y: point.y * canvas.height });
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, canvas.width * 0.008);
  ctx.beginPath();
  geometry.outline.forEach((point, index) => {
    const next = xy(point);
    if (index === 0) ctx.moveTo(next.x, next.y);
    else ctx.lineTo(next.x, next.y);
  });
  ctx.closePath();
  ctx.stroke();
  const mark = (point: Point, color: string) => {
    const next = xy(point);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(next.x, next.y, Math.max(5, canvas.width * 0.018), 0, Math.PI * 2);
    ctx.fill();
  };
  mark(geometry.leftEye, "#27d7ff");
  mark(geometry.rightEye, "#ffe14a");
  mark(geometry.nose, "#3ddc67");
  mark(geometry.mouth, "#ff4fd8");
  mark(geometry.chin, "#ffffff");
  const url = canvas.toDataURL("image/jpeg", 0.72);
  return url.length > 500_000 ? null : url;
}

export async function detectFaceGeometry(imageUrl: string): Promise<FaceGeometry | null> {
  if (typeof window === "undefined") return null;
  const detector = await landmarker();
  if (!detector) return null;
  const image = await loadImage(imageUrl);
  const result = detector.detect(image);
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks?.length) return null;
  return faceFromLandmarks(landmarks);
}
