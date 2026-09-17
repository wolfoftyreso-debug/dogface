import { decodeProtectedHeader, importX509, jwtVerify } from "jose";
import { APPLE_BUNDLE_ID, APPLE_PRODUCT_ID } from "./apple-iap-ids";
import { dbConfigured } from "./db";
import { grantPack } from "./entitlement.server";
import { env } from "./env.server.ts";
import { attachCookieToVisitor, cookieVisitor, ensureVisitor, getVisitorById, remainingOf } from "./session.server";
import { ERROR_MESSAGES } from "./types";

export { APPLE_BUNDLE_ID, APPLE_PRODUCT_ID };

type AppleTx = {
  transactionId: string;
  productId: string;
  bundleId: string;
};

function pemFromX5c(derB64: string): string {
  const body = derB64.replace(/.{64}/g, "$&\n");
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}

export async function decodeAppleTransactionJws(jws: string): Promise<AppleTx> {
  const compact = jws.trim();
  if (compact.split(".").length !== 3) throw new Error("jws");
  const header = decodeProtectedHeader(compact);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || typeof x5c[0] !== "string" || !x5c[0]) throw new Error("x5c");
  const key = await importX509(pemFromX5c(x5c[0]), (header.alg as string) || "ES256");
  const { payload } = await jwtVerify(compact, key, { algorithms: ["ES256"] });
  const transactionId = String(payload.transactionId ?? "");
  const productId = String(payload.productId ?? "");
  const bundleId = String(payload.bundleId ?? "");
  if (!transactionId || !productId) throw new Error("payload");
  return { transactionId, productId, bundleId };
}

export async function confirmAppleTransaction(jws: string): Promise<
  | { ok: true; remaining: number; restoreCode: string }
  | { ok: false; message: string }
> {
  const expectedProduct = env("APPLE_IAP_PRODUCT_ID") || APPLE_PRODUCT_ID;
  const expectedBundle = env("APPLE_BUNDLE_ID") || APPLE_BUNDLE_ID;
  let tx: AppleTx;
  try {
    tx = await decodeAppleTransactionJws(jws);
  } catch {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }
  if (tx.productId !== expectedProduct) {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }
  if (tx.bundleId && tx.bundleId !== expectedBundle) {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }

  let visitorId: string;
  try {
    visitorId = dbConfigured() ? (await ensureVisitor()).id : cookieVisitor().id;
  } catch {
    visitorId = cookieVisitor().id;
  }
  if (!dbConfigured()) {
    return { ok: false, message: ERROR_MESSAGES.payment_unavailable };
  }
  const { restoreCode } = await grantPack(visitorId, `iap:${tx.transactionId}`);
  await attachCookieToVisitor(visitorId);
  const visitor = await getVisitorById(visitorId);
  return {
    ok: true,
    remaining: visitor ? remainingOf(visitor) : 5,
    restoreCode,
  };
}
