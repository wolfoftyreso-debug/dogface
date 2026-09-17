import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGenerationPrompt, extractJsonObject, parseAnalysis } from "./analysis.ts";
import { findBreed } from "./breeds.ts";
import { nextHistory } from "./history.ts";
import {
  buildCorrectionPrompt,
  nextQcAction,
  parseQc,
  qcAccepts,
} from "./identity.ts";
import { validateImagePayload } from "./image.ts";
import type { HistoryItem, QcResult } from "./types.ts";

const valid = {
  validHuman: true,
  subjectSelection: "single",
  breedId: "giant-schnauzer",
  breedName: "Giant Schnauzer",
  visibleTraits: "thick brows, walrus moustache, salt-and-pepper hair",
  reason: "Mustaschen och de markerade ögonbrynen pekade mot en schnauzer.",
  renderBrief: "A giant schnauzer with a blocky muzzle and salt-and-pepper beard.",
  rejectionReason: "",
  coat: "salt-and-pepper",
  eyes: "hazel, close-set",
  gaze: "straight into camera, lids slightly narrowed",
  expression: "deadpan closed mouth",
  eyeGeometry: "close-set almond eyes, left lid a touch narrower, low brows",
  facialGeometry: "long rectangular head, wide jaw, strong chin",
  headPose: "near-frontal, ~8 degree right tilt",
  hairAndFurnishings: "dense salt-and-pepper moustache curving down, heavy brows, short cropped hair",
  colorMap: "salt-and-pepper hair to salt-and-pepper coat; hazel iris to hazel dog eyes",
  identityAnchors: [
    "close-set eyes",
    "direct intense camera gaze",
    "left eye slightly narrower",
    "heavy horizontal eyebrows",
    "large downward-curving moustache",
    "rectangular facial silhouette",
    "dark wavy salt-and-pepper hair",
    "slight rightward head tilt",
  ],
};

const goodQc: QcResult = {
  acceptable: true,
  canineAnatomyValid: true,
  gazePreserved: true,
  eyeRelationshipPreserved: true,
  posePreserved: true,
  expressionPreserved: true,
  identityAnchorsPreserved: 7,
  identityAnchorsTotal: 8,
  genericBreed: false,
  weakestFeatures: ["left-eye asymmetry"],
  correctionInstructions: [],
};

const genericQc: QcResult = {
  acceptable: true,
  canineAnatomyValid: true,
  gazePreserved: true,
  eyeRelationshipPreserved: true,
  posePreserved: true,
  expressionPreserved: true,
  identityAnchorsPreserved: 8,
  identityAnchorsTotal: 8,
  genericBreed: true,
  weakestFeatures: ["generic specimen"],
  correctionInstructions: ["restore close-set eyes", "keep the downward moustache furnishings"],
};

describe("parseAnalysis", () => {
  it("accepts a catalog breed and Swedish reason", () => {
    const parsed = parseAnalysis(valid);
    assert.equal(parsed?.validHuman, true);
    assert.equal(parsed?.breedId, "giant-schnauzer");
    assert.equal(parsed?.breedName, "Riesenschnauzer");
    assert.match(parsed?.reason ?? "", /schnauzer/i);
    assert.equal(parsed?.identityAnchors.length, 8);
    assert.match(parsed?.gaze ?? "", /camera/i);
    assert.match(parsed?.headPose ?? "", /tilt/i);
  });

  it("keeps an unknown breed so generation can still run", () => {
    const parsed = parseAnalysis({
      ...valid,
      breedId: "golden-labrador",
      breedName: "Golden Labrador",
    });
    assert.equal(parsed?.breedId, "golden-labrador");
    assert.equal(parsed?.breedName, "Golden Labrador");
  });

  it("allows empty fields when no person is found", () => {
    const parsed = parseAnalysis({
      validHuman: false,
      subjectSelection: "none",
      breedId: "",
      breedName: "",
      visibleTraits: "",
      reason: "",
      renderBrief: "",
      rejectionReason: "no face",
      coat: "",
      eyes: "",
      gaze: "",
      expression: "",
      eyeGeometry: "",
      facialGeometry: "",
      headPose: "",
      hairAndFurnishings: "",
      colorMap: "",
      identityAnchors: [],
    });
    assert.equal(parsed?.validHuman, false);
    assert.equal(parsed?.subjectSelection, "none");
    assert.deepEqual(parsed?.identityAnchors, []);
  });

  it("parses when optional identity fields are missing", () => {
    const { eyeGeometry: _a, facialGeometry: _b, headPose: _c, hairAndFurnishings: _d, colorMap: _e, identityAnchors: _f, ...legacy } = valid;
    const parsed = parseAnalysis(legacy);
    assert.equal(parsed?.validHuman, true);
    assert.deepEqual(parsed?.identityAnchors, []);
    assert.equal(parsed?.eyeGeometry, "");
  });

  it("caps identity anchors at ten", () => {
    const parsed = parseAnalysis({
      ...valid,
      identityAnchors: Array.from({ length: 14 }, (_, i) => `anchor ${i + 1}`),
    });
    assert.equal(parsed?.identityAnchors.length, 10);
  });

  it("extracts a JSON object from extra text", () => {
    const extracted = extractJsonObject(`noise ${JSON.stringify(valid)} trailing`);
    assert.equal((extracted as { breedId: string }).breedId, "giant-schnauzer");
  });
});

describe("breed catalog", () => {
  it("finds Swedish and English names", () => {
    assert.equal(findBreed("Golden Retriever")?.id, "golden-retriever");
    assert.equal(findBreed("Schäfer")?.id, "german-shepherd");
    assert.equal(findBreed("weimaraner")?.nameSv, "Weimaraner");
  });
});

describe("generation prompt", () => {
  it("asks for a split portrait of this person as this breed", () => {
    const parsed = parseAnalysis(valid);
    assert.ok(parsed);
    const prompt = buildGenerationPrompt(parsed);
    assert.match(prompt, /THIS PERSON AS THIS BREED/i);
    assert.match(prompt, /VERTICAL SPLIT PORTRAIT/i);
    assert.match(prompt, /LEFT HALF/i);
    assert.match(prompt, /RIGHT HALF/i);
    assert.match(prompt, /HARD IDENTITY ANCHORS/i);
    assert.match(prompt, /close-set eyes/i);
    assert.match(prompt, /downward-curving moustache/i);
    assert.match(prompt, /PRIORITY ORDER/i);
    assert.match(prompt, /1 gaze direction/i);
    assert.match(prompt, /COMPOSITION LOCK/i);
    assert.doesNotMatch(prompt, /Forbidden: human skin/);
    assert.doesNotMatch(prompt, /puppy-like hero lighting/i);
  });
});

describe("identity QC", () => {
  it("accepts a customized canine that kept the anchors", () => {
    assert.equal(qcAccepts(goodQc), true);
    assert.equal(nextQcAction(1, goodQc), "accept");
  });

  it("rejects a generic breed portrait even if the model marked it acceptable", () => {
    assert.equal(qcAccepts(genericQc), false);
    assert.equal(nextQcAction(1, genericQc), "correct");
    assert.equal(nextQcAction(2, genericQc), "accept");
  });

  it("rejects lost gaze or a low anchor ratio", () => {
    assert.equal(qcAccepts({ ...goodQc, gazePreserved: false }), false);
    assert.equal(
      qcAccepts({ ...goodQc, identityAnchorsPreserved: 2, identityAnchorsTotal: 8, acceptable: false }),
      false,
    );
    assert.equal(qcAccepts({ ...goodQc, canineAnatomyValid: false }), false);
  });

  it("accepts when QC is unavailable rather than looping", () => {
    assert.equal(nextQcAction(1, null), "accept");
    assert.equal(nextQcAction(2, null), "accept");
  });

  it("parses QC JSON and builds a targeted correction prompt", () => {
    const parsed = parseQc({
      acceptable: false,
      canineAnatomyValid: true,
      gazePreserved: false,
      eyeRelationshipPreserved: true,
      posePreserved: false,
      expressionPreserved: true,
      identityAnchorsPreserved: 3,
      identityAnchorsTotal: 8,
      genericBreed: false,
      weakestFeatures: ["gaze", "head tilt"],
      correctionInstructions: [
        "look directly into camera",
        "narrow the left eye slightly",
        "keep the rightward tilt",
      ],
    });
    assert.ok(parsed);
    assert.equal(qcAccepts(parsed), false);
    const analysis = parseAnalysis(valid);
    assert.ok(analysis);
    const correction = buildCorrectionPrompt(analysis, parsed);
    assert.match(correction, /FAILED IDENTITY QC/i);
    assert.match(correction, /look directly into camera/);
    assert.match(correction, /Do not randomly regenerate/);
  });
});

describe("history", () => {
  it("keeps ten newest items", () => {
    const first: HistoryItem = {
      id: "1",
      createdAt: 1,
      breed: "Pudel",
      reason: "lockar",
      imageDataUrl: "data:image/jpeg;base64,a",
    };
    let items = [first];
    for (let i = 2; i <= 12; i += 1) {
      items = nextHistory(items, { ...first, id: String(i), createdAt: i });
    }
    assert.equal(items.length, 10);
    assert.equal(items[0]?.id, "12");
    assert.equal(items.at(-1)?.id, "3");
  });
});

describe("image payload", () => {
  it("rejects non-jpeg data urls", () => {
    assert.equal(validateImagePayload("data:image/png;base64,abc"), "unsupported");
    assert.equal(validateImagePayload(""), "no_image");
  });
});
