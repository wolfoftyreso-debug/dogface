import assert from "node:assert/strict";
import { test } from "node:test";
import { blobFromDataUrl } from "./save-photo.ts";

const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

test("blobFromDataUrl", async (t) => {
  await t.test("turns a data url into a blob", async () => {
    const blob = await blobFromDataUrl(PIXEL);
    assert.equal(blob.size > 20, true);
    assert.match(blob.type, /^image\//);
  });
});
