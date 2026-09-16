import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGenerateInput } from "./generate-input.ts";
import { hashRestoreCode, restoreCodeForVisitor } from "./crypto.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { createHmac } from "node:crypto";

describe("generate input", () => {
  it("ignores client paid flags", () => {
    const parsed = parseGenerateInput({
      image: "data:image/jpeg;base64,abc",
      paid: true,
      paymentIntentId: "pi_secret",
      remaining: 99,
    });
    assert.equal("paymentIntentId" in parsed, false);
    assert.equal("remaining" in parsed, false);
    assert.equal(parsed.requestId, "");
  });

  it("keeps a request id", () => {
    const parsed = parseGenerateInput({
      image: "data:image/jpeg;base64,abc",
      requestId: "11111111-2222-3333-4444-555555555555",
    });
    assert.equal(parsed.requestId, "11111111-2222-3333-4444-555555555555");
  });
});

describe("stripe signatures", () => {
  it("accepts a valid v1 signature and rejects a bad one", () => {
    const secret = "whsec_test";
    const body = "{\"id\":\"evt_1\"}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${v1}`, secret), true);
    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${"aa".repeat(32)}`, secret), false);
    assert.equal(verifyStripeSignature(body, null, secret), false);
  });

  it("rejects an old timestamp", () => {
    const secret = "whsec_test";
    const body = "{\"id\":\"evt_1\"}";
    const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 20);
    const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${v1}`, secret), false);
  });
});

describe("restore codes", () => {
  it("is stable for a visitor and case-insensitive to hash", () => {
    const a = restoreCodeForVisitor("visitor-1");
    const b = restoreCodeForVisitor("visitor-1");
    const c = restoreCodeForVisitor("visitor-2");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^HT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.equal(hashRestoreCode(a.toLowerCase()), hashRestoreCode(a));
  });
});
