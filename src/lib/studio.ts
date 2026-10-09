import type { AnalysisResult } from "./types.ts";

export type StudioEffectId =
  | "original"
  | "dog-dna"
  | "compare-v"
  | "compare-h"
  | "hybrid"
  | "full-dog"
  | "puppy"
  | "expression"
  | "breed"
  | "wild";

export type StudioRenderMode = "dog-dna" | "full-dog";

export type StudioRequest = {
  mode: StudioRenderMode;
  strength: number;
};

export type StudioEffect = {
  id: StudioEffectId;
  label: string;
  enabled: boolean;
  hint: string;
};

/** Incomplete effects stay visible but cannot call the model. */
export const STUDIO_EFFECTS: StudioEffect[] = [
  { id: "original", label: "Original", enabled: true, hint: "Your photo, unchanged." },
  { id: "dog-dna", label: "Dog DNA", enabled: true, hint: "How far the face moves toward the dog." },
  { id: "compare-v", label: "Split", enabled: true, hint: "Drag to compare. This does not create a new photo." },
  { id: "compare-h", label: "Stack", enabled: true, hint: "Drag to compare. This does not create a new photo." },
  { id: "hybrid", label: "Half & Half", enabled: true, hint: "The fused portrait from your generation." },
  { id: "full-dog", label: "Full Dog", enabled: true, hint: "A fully canine portrait. Rendering uses 1 photo." },
  { id: "puppy", label: "Puppy", enabled: false, hint: "Not available yet." },
  { id: "expression", label: "Expression", enabled: false, hint: "Not available yet." },
  { id: "breed", label: "Breed", enabled: false, hint: "Not available yet." },
  { id: "wild", label: "Wild", enabled: false, hint: "Not available yet." },
];

export const DNA_PRESETS = [0, 25, 50, 75, 100] as const;

export function clampStrength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseStudioRequest(value: unknown): StudioRequest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { mode?: unknown; strength?: unknown };
  const mode: StudioRenderMode | null =
    raw.mode === "full-dog" ? "full-dog" : raw.mode === "dog-dna" ? "dog-dna" : null;
  const strength = typeof raw.strength === "number" ? clampStrength(raw.strength) : -1;
  if (!mode || strength < 1 || strength > 100) return null;
  if (mode === "full-dog" && strength !== 100) return { mode, strength: 100 };
  return { mode, strength };
}

/** Slider movement never spends a credit. Only an explicit render does. */
export function shouldSpendCredit(action: "slide" | "render"): boolean {
  return action === "render";
}

export function cacheKey(mode: StudioRenderMode, strength: number): string {
  return `${mode}:${clampStrength(mode === "full-dog" ? 100 : strength)}`;
}

function anatomyAt(strength: number): string {
  if (strength <= 10) {
    return "a human face with only a faint canine cast in the eyes and the set of the mouth";
  }
  if (strength <= 20) {
    return "still clearly this person, with a slightly canine eye shape, nose tip, and expression";
  }
  if (strength <= 40) {
    return "a recognizable human whose eyes, nose, and jaw have real canine structure";
  }
  if (strength <= 60) {
    return "an equal fusion: one skull, human identity and canine muzzle sharing the same face";
  }
  if (strength <= 80) {
    return "a predominantly canine head that still carries this person's eyes, gaze, and expression";
  }
  return "almost fully canine, with only subtle human identity in the eyes, gaze, and expression";
}

export function buildStudioPrompt(analysis: AnalysisResult, strength: number): string {
  const n = clampStrength(strength);
  const breed = analysis.breedName || "dog";
  const breedId = analysis.breedId || "dog";
  const anchors = analysis.identityAnchors.filter(Boolean).slice(0, 8).join("; ");
  if (n >= 100) {
    return [
      `Regenerate this photograph as a photorealistic camera portrait of a real living ${breed} (${breedId}) that is THIS PERSON as a dog.`,
      "TRANSFORMATION STRENGTH 100%. THE WHOLE SUBJECT IS A DOG. Full canine head, muzzle, nose leather, whisker pads, ear leather, neck, and coat.",
      "Not a filter, not a costume, not a split face, not a human skull with fur, and not an opacity blend of two photos.",
      "Zero human skin, zero human nose, zero human mouth, zero human ears.",
      "The canine eyes, nose, and mouth still occupy the human eye centers, nose point, and mouth. Distort the breed skull to fit. Do not invent a larger head.",
      "Likeness lives in iris color, eye spacing, gaze, expression, and hair texture becoming coat.",
      anchors ? `Identity anchors: ${anchors}.` : "",
      analysis.irisColor ? `Iris lock: ${analysis.irisColor}.` : "",
      analysis.expression ? `Expression lock: ${analysis.expression}.` : "",
      "Square 1:1 head-and-shoulders. No text, watermark, collage, or extra faces.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `Regenerate this photograph as ONE new photorealistic portrait of this person becoming a real living ${breed} (${breedId}).`,
    `TRANSFORMATION STRENGTH ${n}%. The anatomy itself is ${n}% of the way from this human to that dog.`,
    `At this strength the subject is ${anatomyAt(n)}.`,
    "This must be one generated face with coherent skull, eye line, nose, mouth, and lighting. Eyes, nose, mouth, and jaw stay on the human positions. Change local anatomy and fur, not the landmark layout. Not a transparent dog laid over the human. Not a hard vertical cut. Not two photos joined.",
    "Keep crop, head scale, camera angle, clothing, background, and this person's iris color, gaze, and expression.",
    anchors ? `Identity anchors: ${anchors}.` : "",
    analysis.irisColor ? `Iris lock: ${analysis.irisColor}.` : "",
    analysis.expression ? `Expression lock: ${analysis.expression}.` : "",
    "Square 1:1 head-and-shoulders. No text, watermark, collage, or extra faces.",
  ]
    .filter(Boolean)
    .join(" ");
}
