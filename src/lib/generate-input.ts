import type { PortraitStyle } from "./types.ts";
import { parseStudioRequest, type StudioRequest } from "./studio.ts";
import { parseFaceGeometry, type FaceGeometry } from "./geometry.ts";

const GUIDE_MAX = 500_000;

export function parsePortraitStyle(value: unknown): PortraitStyle {
  return value === "split" ? "split" : "dog";
}

export function parseGenerateInput(input: unknown): {
  image: string;
  requestId: string;
  style: PortraitStyle;
  studio: StudioRequest | null;
  geometry: FaceGeometry | null;
  geometryGuide: string | null;
} {
  if (!input || typeof input !== "object") {
    return { image: "", requestId: "", style: "dog", studio: null, geometry: null, geometryGuide: null };
  }
  const raw = input as {
    image?: unknown;
    requestId?: unknown;
    style?: unknown;
    studio?: unknown;
    geometry?: unknown;
    geometryGuide?: unknown;
  };
  const guide = typeof raw.geometryGuide === "string" ? raw.geometryGuide : "";
  return {
    image: typeof raw.image === "string" ? raw.image : "",
    requestId: typeof raw.requestId === "string" ? raw.requestId : "",
    style: parsePortraitStyle(raw.style),
    studio: parseStudioRequest(raw.studio),
    geometry: parseFaceGeometry(raw.geometry),
    geometryGuide: guide.startsWith("data:image/jpeg") && guide.length <= GUIDE_MAX ? guide : null,
  };
}
