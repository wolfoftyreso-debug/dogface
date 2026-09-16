import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function restoreSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim() ||
    "hundtvilling-dev"
  );
}

/** Deterministic so the return page can show the code even if the webhook granted first. */
export function restoreCodeForVisitor(visitorId: string): string {
  const digest = hmacSha256(restoreSecret(), `restore:${visitorId}`).toUpperCase();
  return `HT-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

export function restoreCode(): string {
  return restoreCodeForVisitor(randomId(16));
}

export function hashRestoreCode(code: string): string {
  return sha256(code.trim().toUpperCase());
}
