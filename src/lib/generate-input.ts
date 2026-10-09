import type { PortraitStyle } from "./types.ts";
import { parseStudioRequest, type StudioRequest } from "./studio.ts";

export function parsePortraitStyle(value: unknown): PortraitStyle {
  return value === "split" ? "split" : "dog";
}

export function parseGenerateInput(input: unknown): {
  image: string;
  requestId: string;
  style: PortraitStyle;
  studio: StudioRequest | null;
} {
  if (!input || typeof input !== "object") {
    return { image: "", requestId: "", style: "dog", studio: null };
  }
  const raw = input as { image?: unknown; requestId?: unknown; style?: unknown; studio?: unknown };
  return {
    image: typeof raw.image === "string" ? raw.image : "",
    requestId: typeof raw.requestId === "string" ? raw.requestId : "",
    style: parsePortraitStyle(raw.style),
    studio: parseStudioRequest(raw.studio),
  };
}
