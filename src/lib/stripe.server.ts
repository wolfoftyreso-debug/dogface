import { getRequest } from "@tanstack/react-start/server";
import { checkRateLimit, grantPack, restoreByCode, revokePurchase } from "./entitlement.server";
import { getSql } from "./db";
import { env } from "./env.server.ts";
import { attachCookieToVisitor, clientIp, ensureVisitor, getVisitorById, remainingOf } from "./session.server";
import { verifyStripeSignature } from "./stripe-signature";
import { ERROR_MESSAGES } from "./types";

export const PACK_CENTS = 299;
export const PACK_SIZE = 5;

function stripeSecret(): string | undefined {
  return process.env.STRIPE_SECRET_KEY?.trim() || undefined;
}

function webhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

export function paymentsReady(): boolean {
  return Boolean(stripeSecret());
}

function appBaseUrl(): string {
  const fromEnv = process.env.APP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const request = getRequest();
  if (request) return new URL(request.url).origin;
  return "http://127.0.0.1:8080";
}

function paymentIntentIdOf(session: Record<string, unknown>): string {
  const pi = session.payment_intent;
  if (typeof pi === "string" && pi.startsWith("pi_")) return pi;
  if (pi && typeof pi === "object" && typeof (pi as { id?: string }).id === "string") {
    const id = (pi as { id: string }).id;
    if (id.startsWith("pi_")) return id;
  }
  return "";
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const secret = stripeSecret();
  if (!secret) throw new Error("unavailable");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error("stripe");
  return json;
}

async function stripeForm(
  path: string,
  fields: Record<string, string>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const secret = stripeSecret();
  if (!secret) throw new Error("unavailable");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error("stripe");
  return json;
}

export async function readBalance() {
  const visitor = await ensureVisitor();
  return {
    remaining: remainingOf(visitor),
    freeRemaining: visitor.freeRemaining,
    paidRemaining: visitor.paidRemaining,
    paymentsReady: paymentsReady(),
    aiReady: Boolean(env("XAI_API_KEY")),
  };
}

export async function startCheckout() {
  if (!paymentsReady()) {
    return { ok: false as const, code: "payment_unavailable" as const, message: ERROR_MESSAGES.payment_unavailable };
  }
  const visitor = await ensureVisitor();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  const success = `${appBaseUrl()}/?checkout={CHECKOUT_SESSION_ID}`;
  const cancel = `${appBaseUrl()}/`;
  const fields: Record<string, string> = {
    mode: "payment",
    success_url: success,
    cancel_url: cancel,
    client_reference_id: visitor.id,
    "metadata[visitorId]": visitor.id,
    "metadata[product]": "5-dog-images",
    "line_items[0][quantity]": "1",
  };
  if (priceId) {
    fields["line_items[0][price]"] = priceId;
  } else {
    fields["line_items[0][price_data][currency]"] = "usd";
    fields["line_items[0][price_data][unit_amount]"] = String(PACK_CENTS);
    fields["line_items[0][price_data][product_data][name]"] = "5 hundbilder";
  }
  try {
    const session = await stripeForm("checkout/sessions", fields, `co_${visitor.id}_${Date.now()}`);
    const url = typeof session.url === "string" ? session.url : "";
    if (!url) {
      return { ok: false as const, code: "payment_unavailable" as const, message: ERROR_MESSAGES.payment_unavailable };
    }
    return { ok: true as const, url };
  } catch {
    return { ok: false as const, code: "payment_unavailable" as const, message: ERROR_MESSAGES.payment_unavailable };
  }
}

export async function confirmCheckoutSession(sessionId: string) {
  if (!sessionId.startsWith("cs_")) {
    return { ok: false as const, message: ERROR_MESSAGES.payment_failed };
  }
  const visitor = await ensureVisitor();
  if (!paymentsReady()) {
    return { ok: false as const, message: ERROR_MESSAGES.payment_unavailable };
  }
  try {
    const session = await stripeGet(`checkout/sessions/${sessionId}`);
    return await deliverCheckoutSession(session, visitor.id);
  } catch {
    return { ok: false as const, message: ERROR_MESSAGES.payment_failed };
  }
}

export async function restoreWithCode(code: string) {
  if (!(await checkRateLimit(`restore:${clientIp()}`, 8, 15))) {
    return { ok: false as const, message: ERROR_MESSAGES.rate_limit };
  }
  const found = await restoreByCode(code);
  if (!found) return { ok: false as const, message: "Koden hittades inte. Kontrollera den och prova igen." };
  await ensureVisitor();
  await attachCookieToVisitor(found.id);
  return {
    ok: true as const,
    remaining: remainingOf(found),
    sameDevice: true,
  };
}

export async function deliverCheckoutSession(
  session: Record<string, unknown>,
  expectedVisitorId?: string,
): Promise<{ ok: true; remaining: number; restoreCode: string | null } | { ok: false; message: string }> {
  const id = typeof session.id === "string" ? session.id : "";
  const paymentStatus = typeof session.payment_status === "string" ? session.payment_status : "";
  const visitorId =
    (typeof session.client_reference_id === "string" && session.client_reference_id) ||
    (typeof (session.metadata as { visitorId?: string } | undefined)?.visitorId === "string"
      ? (session.metadata as { visitorId: string }).visitorId
      : "");
  if (!id || paymentStatus !== "paid" || !visitorId) {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }
  if (expectedVisitorId && expectedVisitorId !== visitorId) {
    return { ok: false, message: "Det här köpet tillhör en annan session." };
  }
  const amount = Number(session.amount_total ?? 0);
  const currency = String(session.currency ?? "");
  if (amount && amount !== PACK_CENTS) {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }
  if (currency && currency !== "usd") {
    return { ok: false, message: ERROR_MESSAGES.payment_failed };
  }
  const { restoreCode } = await grantPack(visitorId, id, paymentIntentIdOf(session) || undefined);
  const visitor = await getVisitorById(visitorId);
  return {
    ok: true,
    remaining: visitor ? remainingOf(visitor) : PACK_SIZE,
    restoreCode,
  };
}

export async function handleStripeWebhook(rawBody: string, signatureHeader: string | null): Promise<number> {
  const secret = webhookSecret();
  if (!secret) return 503;
  if (!verifyStripeSignature(rawBody, signatureHeader, secret)) return 400;
  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return 400;
  }
  if (!event.id || !event.type) return 400;
  const sql = await getSql();
  const inserted = await sql<{ stripe_event_id: string }>`
    insert into webhook_events (stripe_event_id) values (${event.id})
    on conflict do nothing
    returning stripe_event_id
  `;
  if (!inserted[0]) return 200;

  if (event.type === "checkout.session.completed") {
    const obj = event.data?.object ?? {};
    await deliverCheckoutSession(obj);
  }
  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created" ||
    event.type === "refund.created"
  ) {
    const obj = event.data?.object ?? {};
    const sessionId =
      typeof obj.checkout_session === "string"
        ? obj.checkout_session
        : typeof obj.metadata === "object" && obj.metadata && "sessionId" in obj.metadata
          ? String((obj.metadata as { sessionId?: string }).sessionId)
          : "";
    const paymentIntent =
      typeof obj.payment_intent === "string"
        ? obj.payment_intent
        : typeof (obj as { charge?: { payment_intent?: string } }).charge?.payment_intent === "string"
          ? (obj as { charge: { payment_intent: string } }).charge.payment_intent
          : "";
    if (sessionId.startsWith("cs_")) await revokePurchase(sessionId);
    else if (paymentIntent.startsWith("pi_")) await revokePurchase(paymentIntent);
  }
  return 200;
}
