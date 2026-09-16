import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGenerationPrompt, extractJsonObject, parseAnalysis } from "./analysis.ts";
import { findBreed } from "./breeds.ts";
import { nextHistory } from "./history.ts";
import { validateImagePayload } from "./image.ts";
import type { HistoryItem } from "./types.ts";

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
  eyes: "hazel",
  gaze: "straight into camera",
  expression: "deadpan",
};

describe("parseAnalysis", () => {
  it("accepts a catalog breed and Swedish reason", () => {
    const parsed = parseAnalysis(valid);
    assert.equal(parsed?.validHuman, true);
    assert.equal(parsed?.breedId, "giant-schnauzer");
    assert.equal(parsed?.breedName, "Riesenschnauzer");
    assert.match(parsed?.reason ?? "", /schnauzer/i);
  });

  it("rejects invented breeds", () => {
    const parsed = parseAnalysis({
      ...valid,
      breedId: "golden-labrador",
      breedName: "Golden Labrador",
    });
    assert.equal(parsed?.breedId, "");
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
    });
    assert.equal(parsed?.validHuman, false);
    assert.equal(parsed?.subjectSelection, "none");
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
  it("asks for a real dog, not a hybrid", () => {
    const parsed = parseAnalysis(valid);
    assert.ok(parsed);
    const prompt = buildGenerationPrompt(parsed);
    assert.match(prompt, /ONE dog/i);
    assert.match(prompt, /Forbidden: human skin/);
    assert.doesNotMatch(prompt, /split-face/i);
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
