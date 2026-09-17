import type { PortraitStyle } from "./types.ts";

export function parsePortraitStyle(value: unknown): PortraitStyle {
  return value === "split" ? "split" : "dog";
}

export function parseGenerateInput(input: unknown): {
  image: string;
  requestId: string;
  style: PortraitStyle;
} {
  if (!input || typeof input !== "object") {
    return { image: "", requestId: "", style: "dog" };
  }
  const raw = input as { image?: unknown; requestId?: unknown; style?: unknown };
  return {
    image: typeof raw.image === "string" ? raw.image : "",
    requestId: typeof raw.requestId === "string" ? raw.requestId : "",
    style: parsePortraitStyle(raw.style),
  };
}
