import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packPortraits, unpackPortraits } from "./result-pack.ts";

describe("portrait pack", () => {
  it("keeps a dog-only result as a data url", () => {
    const dog = "data:image/jpeg;base64,abc";
    assert.equal(packPortraits({ dog }), dog);
    assert.deepEqual(unpackPortraits(dog), { dog });
  });

  it("round-trips a fused split beside the dog", () => {
    const packed = packPortraits({
      dog: "data:image/jpeg;base64,dog",
      split: "data:image/jpeg;base64,split",
    });
    assert.match(packed, /^\{/);
    assert.deepEqual(unpackPortraits(packed), {
      dog: "data:image/jpeg;base64,dog",
      split: "data:image/jpeg;base64,split",
    });
  });
});
