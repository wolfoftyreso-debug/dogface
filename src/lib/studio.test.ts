import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnalysisResult } from "./types.ts";
import {
  buildStudioPrompt,
  cacheKey,
  clampStrength,
  parseStudioRequest,
  shouldSpendCredit,
} from "./studio.ts";

const analysis = {
  validHuman: true,
  subjectSelection: "single",
  breedId: "portuguese-water-dog",
  breedName: "Portuguese Water Dog",
  visibleTraits: "",
  reason: "",
  renderBrief: "",
  rejectionReason: "",
  coat: "",
  eyes: "",
  gaze: "",
  expression: "deadpan",
  eyeGeometry: "",
  facialGeometry: "",
  headPose: "",
  hairAndFurnishings: "",
  colorMap: "",
  skinTone: "",
  irisColor: "hazel",
  accentColors: "",
  hairTexture: "",
  identityAnchors: ["wide-set hazel eyes"],
} satisfies AnalysisResult;

describe("studio", () => {
  it("does not spend a credit while the slider moves", () => {
    assert.equal(shouldSpendCredit("slide"), false);
    assert.equal(shouldSpendCredit("render"), true);
  });

  it("rejects a zero-strength studio job", () => {
    assert.equal(parseStudioRequest({ mode: "dog-dna", strength: 0 }), null);
    assert.deepEqual(parseStudioRequest({ mode: "dog-dna", strength: 30 }), {
      mode: "dog-dna",
      strength: 30,
    });
  });

  it("describes 30% as anatomy, not an opacity blend", () => {
    const prompt = buildStudioPrompt(analysis, 30);
    assert.match(prompt, /30%/);
    assert.match(prompt, /not a transparent dog/i);
    assert.match(prompt, /hazel/);
    assert.match(prompt, /human positions/i);
    assert.doesNotMatch(prompt, /opacity blend of two photos/i);
  });

  it("describes 100% as a full dog", () => {
    const prompt = buildStudioPrompt(analysis, 100);
    assert.match(prompt, /WHOLE SUBJECT IS A DOG/);
    assert.match(prompt, /Zero human skin/);
  });

  it("clamps and caches by mode", () => {
    assert.equal(clampStrength(130), 100);
    assert.equal(cacheKey("full-dog", 40), "full-dog:100");
    assert.equal(cacheKey("dog-dna", 33.2), "dog-dna:33");
  });
});
