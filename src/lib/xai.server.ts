import {
  ANALYSIS_RESPONSE_FORMAT,
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_TEXT,
  buildGenerationPrompt,
  extractJsonObject,
  fallbackAnalysis,
  parseAnalysis,
} from "./analysis";
import { env } from "./env.server.ts";
import { buildStudioPrompt, type StudioRequest } from "./studio.ts";
import {
  alignmentCorrection,
  compareAlignment,
  parseMeasuredFace,
  type FaceGeometry,
} from "./geometry.ts";
import { ERROR_MESSAGES, type AnalysisResult, type GenerateErrorCode, type PortraitStyle } from "./types";

const ANALYSIS_TIMEOUT_MS = 50_000;
const IMAGE_TIMEOUT_MS = 75_000;
const XAI_BASE = "https://api.x.ai/v1";

export class AppError extends Error {
  readonly code: GenerateErrorCode;
  constructor(code: GenerateErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.code = code;
    this.name = "AppError";
  }
}

function visionModel(): string {
  return process.env.XAI_VISION_MODEL?.trim() || "grok-4.5";
}

function imageModel(): string {
  return process.env.XAI_IMAGE_MODEL?.trim() || "grok-imagine-image-2.0";
}

async function xaiFetch(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const apiKey = env("XAI_API_KEY");
  if (!apiKey) throw new AppError("unavailable");

  let res: Response;
  try {
    res = await fetch(`${XAI_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new AppError("timeout");
    }
    if (err instanceof Error && /timeout|aborted/i.test(err.message)) {
      throw new AppError("timeout");
    }
    throw new AppError("failed");
  }

  if (!res.ok) {
    let snippet = "";
    try {
      snippet = (await res.text()).slice(0, 240);
    } catch {
      // drain only
    }
    console.info(`[hundtvilling] xAI ${path} status=${res.status} body=${snippet}`);
    if (res.status === 429) throw new AppError("rate_limit");
    if (res.status === 408 || res.status === 504) throw new AppError("timeout");
    throw new AppError("failed");
  }
  return res;
}

export async function analyzePhoto(imageDataUrl: string): Promise<AnalysisResult> {
  const body = {
    model: visionModel(),
    reasoning_effort: "low",
    max_tokens: 800,
    temperature: 0.1,
    response_format: ANALYSIS_RESPONSE_FORMAT,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageDataUrl, detail: "low" },
          },
          {
            type: "text",
            text: ANALYSIS_USER_TEXT,
          },
        ],
      },
    ],
  };

  try {
    const res = await xaiFetch("/chat/completions", body, ANALYSIS_TIMEOUT_MS);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return fallbackAnalysis();
    const parsed = parseAnalysis(extractJsonObject(content));
    if (!parsed) {
      console.info("[hundtvilling] analysis parse failed, using fallback");
      return fallbackAnalysis();
    }
    return parsed;
  } catch (err) {
    const code = err instanceof AppError ? err.code : "failed";
    console.info(`[hundtvilling] analysis ${code}, using fallback`);
    return fallbackAnalysis();
  }
}

type ImagePayload = {
  data?: { url?: string; b64_json?: string }[];
};

async function dataUrlFromImagePayload(payload: ImagePayload): Promise<string> {
  const first = payload.data?.[0];
  if (!first) throw new AppError("failed");
  if (first.b64_json) {
    if (first.b64_json.length > 3_500_000) throw new AppError("failed");
    return `data:image/jpeg;base64,${first.b64_json}`;
  }
  if (!first.url) throw new AppError("failed");
  let parsed: URL;
  try {
    parsed = new URL(first.url);
  } catch {
    throw new AppError("failed");
  }
  if (parsed.protocol !== "https:") throw new AppError("failed");
  let res: Response;
  try {
    res = await fetch(first.url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError("failed");
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) throw new AppError("failed");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 32 || buf.byteLength > 1_800_000) throw new AppError("failed");
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export async function generateDogImage(
  imageDataUrl: string,
  analysis: AnalysisResult,
  style: PortraitStyle = "dog",
  extra = "",
  geometry: FaceGeometry | null = null,
  guide: string | null = null,
): Promise<string> {
  const prompt = buildGenerationPrompt(analysis, extra, style, geometry);
  const locked = Boolean(geometry && guide);
  const body = locked
    ? {
        model: imageModel(),
        prompt,
        n: 1,
        resolution: "1k",
        response_format: "url",
        images: [
          { url: imageDataUrl, type: "image_url" },
          { url: guide, type: "image_url" },
        ],
      }
    : {
        model: imageModel(),
        prompt,
        n: 1,
        aspect_ratio: "1:1",
        resolution: "1k",
        response_format: "url",
        image: { url: imageDataUrl, type: "image_url" },
      };
  try {
    const res = await xaiFetch("/images/edits", body, IMAGE_TIMEOUT_MS);
    const json = (await res.json()) as ImagePayload;
    return await dataUrlFromImagePayload(json);
  } catch (err) {
    if (!locked) throw err;
    console.info("[hundtvilling] geometry chart rejected, continuing with landmark text only");
    const fallback = {
      model: imageModel(),
      prompt,
      n: 1,
      aspect_ratio: "1:1",
      resolution: "1k",
      response_format: "url",
      image: { url: imageDataUrl, type: "image_url" },
    };
    const res = await xaiFetch("/images/edits", fallback, IMAGE_TIMEOUT_MS);
    const json = (await res.json()) as ImagePayload;
    return await dataUrlFromImagePayload(json);
  }
}

const MEASURE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "face_points",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        leftEye: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        rightEye: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        nose: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        mouth: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        chin: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        jawLeft: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        jawRight: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
      },
      required: ["leftEye", "rightEye", "nose", "mouth", "chin", "jawLeft", "jawRight"],
    },
  },
};

export async function measureResultPoints(imageDataUrl: string): Promise<ReturnType<typeof parseMeasuredFace>> {
  try {
    const res = await xaiFetch(
      "/chat/completions",
      {
        model: visionModel(),
        reasoning_effort: "low",
        max_tokens: 400,
        temperature: 0,
        response_format: MEASURE_FORMAT,
        messages: [
          {
            role: "system",
            content:
              "Estimate facial landmark positions on this portrait. Coordinates are 0 to 1 of image width and height. This is not identification. If a feature is canine, mark where that feature sits, not where a textbook dog would place it.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
              { type: "text", text: "Return the landmark positions only." },
            ],
          },
        ],
      },
      ANALYSIS_TIMEOUT_MS,
    );
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseMeasuredFace(JSON.parse(content));
  } catch (err) {
    console.info("[hundtvilling] geometry measure failed", err instanceof Error ? err.message : "error");
    return null;
  }
}

export async function produceStudioPortrait(
  imageDataUrl: string,
  analysis: AnalysisResult,
  studio: StudioRequest,
): Promise<{ dog: string; split?: string }> {
  const strength = studio.mode === "full-dog" ? 100 : studio.strength;
  const body = {
    model: imageModel(),
    prompt: buildStudioPrompt(analysis, strength),
    n: 1,
    aspect_ratio: "1:1",
    resolution: "1k",
    response_format: "url",
    image: { url: imageDataUrl, type: "image_url" },
  };
  const res = await xaiFetch("/images/edits", body, IMAGE_TIMEOUT_MS);
  const json = (await res.json()) as ImagePayload;
  return { dog: await dataUrlFromImagePayload(json) };
}

export async function produceIdentityDog(
  imageDataUrl: string,
  analysis: AnalysisResult,
  style: PortraitStyle = "dog",
): Promise<string> {
  return generateDogImage(imageDataUrl, analysis, style);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  imageDataUrl: string,
  analysis: AnalysisResult,
  style: PortraitStyle,
  geometry: FaceGeometry | null = null,
  guide: string | null = null,
): Promise<string> {
  try {
    return await generateDogImage(imageDataUrl, analysis, style, "", geometry, guide);
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "rate_limit") throw err;
    await sleep(1500);
    return generateDogImage(imageDataUrl, analysis, style, "", geometry, guide);
  }
}

export async function producePortraits(
  imageDataUrl: string,
  analysis: AnalysisResult,
  geometry: FaceGeometry | null = null,
  guide: string | null = null,
): Promise<{ dog: string; split?: string }> {
  const lock = geometry && env("GEOMETRY_LOCK") !== "0" ? geometry : null;
  const chart = lock ? guide : null;
  const split = await generateWithRetry(imageDataUrl, analysis, "split", lock, chart);
  if (!lock) return { dog: split, split };
  const measured = await measureResultPoints(split);
  if (!measured) {
    console.info("[hundtvilling] geometry measure unavailable; delivering first candidate");
    return { dog: split, split };
  }
  const report = compareAlignment(lock, measured);
  console.info(
    `[hundtvilling] geometry eye=${report.eye.toFixed(3)} nose=${report.nose.toFixed(3)} mouth=${report.mouth.toFixed(3)} contour=${report.contour.toFixed(3)} ok=${report.ok}`,
  );
  if (report.ok) return { dog: split, split };
  const corrected = await generateDogImage(
    imageDataUrl,
    analysis,
    "split",
    alignmentCorrection(report),
    lock,
    chart,
  );
  return { dog: corrected, split: corrected };
}
