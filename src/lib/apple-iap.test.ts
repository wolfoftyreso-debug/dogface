import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPLE_BUNDLE_ID, APPLE_PRODUCT_ID } from "./apple-iap-ids.ts";

describe("Apple IAP ids", () => {
  it("uses a consumable product id, not a subscription", () => {
    assert.equal(APPLE_PRODUCT_ID, "com.doggstyle.pack5");
    assert.equal(APPLE_BUNDLE_ID, "app.doggstyle.ios");
    assert.equal(APPLE_PRODUCT_ID.includes("sub"), false);
  });
});
