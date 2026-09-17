import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packPortraits, toClientPortraits, unpackPortraits } from "./result-pack.ts";

describe("portrait pack", () => {
  it("keeps a dog-only result as a data url", () => {
    const dog = "data:image/jpeg;base64,abc";
    assert.equal(packPortraits({ dog }), dog);
    assert.deepEqual(unpackPortraits(dog), { dog });
    assert.deepEqual(toClientPortraits({ dog }), { imageDataUrl: dog });
  });

  it("shows the fused morph by default and keeps the full dog for Hund", () => {
    const packed = packPortraits({
      dog: "data:image/jpeg;base64,dog",
      split: "data:image/jpeg;base64,split",
    });
    assert.match(packed, /^\{/);
    const unpacked = unpackPortraits(packed);
    assert.deepEqual(unpacked, {
      dog: "data:image/jpeg;base64,dog",
      split: "data:image/jpeg;base64,split",
    });
    assert.deepEqual(toClientPortraits(unpacked!), {
      imageDataUrl: "data:image/jpeg;base64,split",
      splitDataUrl: "data:image/jpeg;base64,split",
      dogDataUrl: "data:image/jpeg;base64,dog",
    });
  });
});
