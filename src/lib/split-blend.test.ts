import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { morphAlpha } from "./split-blend.ts";

describe("split morph", () => {
  it("is fully human on the left and fully dog on the right", () => {
    assert.equal(morphAlpha(0, 0.5), 0);
    assert.equal(morphAlpha(1, 0.5), 1);
  });

  it("melts across a wide center instead of a hard cut", () => {
    const mid = morphAlpha(0.5, 0.5);
    assert.ok(mid > 0.35 && mid < 0.65);
    const nearLeft = morphAlpha(0.32, 0.5);
    const nearRight = morphAlpha(0.68, 0.5);
    assert.ok(nearLeft > 0 && nearLeft < 0.45);
    assert.ok(nearRight > 0.55 && nearRight < 1);
  });
});
