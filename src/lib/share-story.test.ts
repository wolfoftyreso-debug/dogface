import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageShareData, isShareableJpeg, storyFilename } from "./share-payload.ts";

describe("instagram share payload", () => {
  it("attaches a jpeg file and never a page url", () => {
    const file = new File([new Uint8Array(64)], "doggstyle-poodle.jpg", { type: "image/jpeg" });
    const data = imageShareData(file);
    assert.equal("url" in data, false);
    assert.equal("text" in data, false);
    assert.equal(data.files?.[0], file);
  });

  it("accepts a jpeg under 8 MB with a .jpg name", () => {
    const file = new File([new Uint8Array(200)], "doggstyle-story.jpg", { type: "image/jpeg" });
    assert.equal(isShareableJpeg(file), true);
  });

  it("rejects a file that would share as a web page", () => {
    const file = new File([new Uint8Array(200)], "story", { type: "text/plain" });
    assert.equal(isShareableJpeg(file), false);
  });

  it("names the story file as a jpeg", () => {
    assert.match(storyFilename("Standard Poodle"), /\.jpg$/);
    assert.match(storyFilename("Standard Poodle"), /^doggstyle-/);
  });
});
