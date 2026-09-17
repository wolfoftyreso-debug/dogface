export type PackedPortraits = {
  dog: string;
  split?: string;
};

export type ClientPortraits = {
  imageDataUrl: string;
  splitDataUrl?: string;
  dogDataUrl?: string;
};

export function packPortraits(portraits: PackedPortraits): string {
  if (!portraits.split) return portraits.dog;
  return JSON.stringify({ dog: portraits.dog, split: portraits.split });
}

export function unpackPortraits(raw: string | null | undefined): PackedPortraits | null {
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return { dog: raw };
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as { dog?: unknown; split?: unknown };
    if (typeof parsed.dog !== "string" || !parsed.dog.startsWith("data:image/")) return null;
    return {
      dog: parsed.dog,
      split:
        typeof parsed.split === "string" && parsed.split.startsWith("data:image/")
          ? parsed.split
          : undefined,
    };
  } catch {
    return null;
  }
}

/** Fused morph is the default photo. Full dog is the Hund toggle. */
export function toClientPortraits(portraits: PackedPortraits): ClientPortraits {
  if (portraits.split) {
    return {
      imageDataUrl: portraits.split,
      splitDataUrl: portraits.split,
      dogDataUrl: portraits.dog !== portraits.split ? portraits.dog : undefined,
    };
  }
  return { imageDataUrl: portraits.dog };
}
