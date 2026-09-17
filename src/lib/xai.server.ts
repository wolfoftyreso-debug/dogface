import {
  ANALYSIS_RESPONSE_FORMAT,
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_TEXT,
  buildGenerationPrompt,
  extractJsonObject,
  parseAnalysis,
} from "./analysis";
import { env } from "./env.server.ts";
import { ERROR_MESSAGES, type AnalysisResult, type GenerateErrorCode, type PortraitStyle } from "./types";

const ANALYSIS_TIMEOUT_MS = 35_000;
const IMAGE_TIMEOUT_MS = 55_000;
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
    max_tokens: 1200,
    temperature: 0.1,
    response_format: ANALYSIS_RESPONSE_FORMAT,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageDataUrl, detail: "high" },
          },
          {
            type: "text",
            text: ANALYSIS_USER_TEXT,
          },
        ],
      },
    ],
  };

  const res = await xaiFetch("/chat/completions", body, ANALYSIS_TIMEOUT_MS);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new AppError("failed");
  const parsed = parseAnalysis(extractJsonObject(content));
  if (!parsed) {
    console.info("[hundtvilling] analysis parse failed");
    throw new AppError("failed");
  }
  return parsed;
}

type ImagePayload = {
  data?: { url?: string; b64_json?: string }[];
};

async function dataUrlFromImagePayload(payload: ImagePayload): Promise<string> {
  const first = payload.data?.[0];
  if (!first) throw new AppError("failed");
  if (first.b64_json) {
    if (first.b64_json.length > 2_000_000) throw new AppError("failed");
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
  style: PortraitStyle = "split",
): Promise<string> {
  const prompt = buildGenerationPrompt(analysis, "", style);
  const body = {
    model: imageModel(),
    prompt,
    n: 1,
    aspect_ratio: "1:1",
    resolution: "1k",
    response_format: "b64_json",
    image: { url: imageDataUrl, type: "image_url" },
  };
  const res = await xaiFetch("/images/edits", body, IMAGE_TIMEOUT_MS);
  const json = (await res.json()) as ImagePayload;
  return await dataUrlFromImagePayload(json);
}

export async function produceIdentityDog(
  imageDataUrl: string,
  analysis: AnalysisResult,
  style: PortraitStyle = "split",
): Promise<string> {
  return generateDogImage(imageDataUrl, analysis, style);
}
