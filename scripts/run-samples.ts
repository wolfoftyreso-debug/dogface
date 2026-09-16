import fs from "node:fs";
import path from "node:path";
import {
  ANALYSIS_RESPONSE_FORMAT,
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_TEXT,
  buildGenerationPrompt,
  extractJsonObject,
  parseAnalysis,
} from "../src/lib/analysis.ts";

const KEY = process.env.XAI_API_KEY;
const BASE = "https://api.x.ai/v1";
const OUT = "/workspace/artifacts/samples";

const SAMPLES = ["mustache", "redhead", "curls", "silver"];

if (!KEY) {
  console.error("XAI_API_KEY missing");
  process.exit(1);
}

function dataUrlFromFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function xai(pathname: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    try {
      await res.arrayBuffer();
    } catch {
      // drain only
    }
    throw new Error(`xAI ${pathname} ${res.status}`);
  }
  return res.json();
}

async function analyze(imageDataUrl: string) {
  const json = (await xai(
    "/chat/completions",
    {
      model: "grok-4.5",
      reasoning_effort: "medium",
      max_tokens: 1100,
      temperature: 0.1,
      response_format: ANALYSIS_RESPONSE_FORMAT,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            { type: "text", text: ANALYSIS_USER_TEXT },
          ],
        },
      ],
    },
    60_000,
  )) as { choices?: { message?: { content?: string | null } }[] };

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty analysis");
  const parsed = parseAnalysis(extractJsonObject(content));
  if (!parsed || !parsed.validHuman) throw new Error("no human / malformed");
  return parsed;
}

async function generate(imageDataUrl: string, analysis: ReturnType<typeof parseAnalysis>) {
  if (!analysis) throw new Error("no analysis");
  const prompt = buildGenerationPrompt(analysis);
  const base = {
    model: "grok-imagine-image-2.0",
    prompt,
    n: 1,
    aspect_ratio: "3:4",
    response_format: "b64_json" as const,
  };
  const bodies = [
    { ...base, resolution: "2k", image: { url: imageDataUrl, type: "image_url" } },
    { ...base, resolution: "1k", image: { url: imageDataUrl, type: "image_url" } },
  ];

  let last: unknown;
  for (const body of bodies) {
    try {
      const json = (await xai("/images/edits", body, 120_000)) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const first = json.data?.[0];
      if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
      if (first?.url) {
        const res = await fetch(first.url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error("image url fetch failed");
        return Buffer.from(await res.arrayBuffer());
      }
      throw new Error("empty image");
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("image failed");
}

async function runOne(name: string) {
  const humanPath = path.join(OUT, `${name}-human.jpg`);
  const dogPath = path.join(OUT, `${name}-dog.jpg`);
  const metaPath = path.join(OUT, `${name}.json`);
  console.log(`[${name}] start`);
  const image = dataUrlFromFile(humanPath);
  const analysis = await analyze(image);
  console.log(`[${name}] ${analysis.breed} — ${analysis.reason}`);
  const dog = await generate(image, analysis);
  fs.writeFileSync(dogPath, dog);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        breed: analysis.breed,
        reason: analysis.reason,
        coat: analysis.coat,
        eyes: analysis.eyes,
        gaze: analysis.gaze,
        expression: analysis.expression,
      },
      null,
      2,
    ),
  );
  console.log(`[${name}] wrote ${dogPath} (${dog.byteLength} bytes)`);
}

for (const name of SAMPLES) {
  await runOne(name);
}
