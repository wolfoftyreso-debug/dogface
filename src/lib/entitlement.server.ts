import { getSql, withTransaction } from "./db";
import { hashRestoreCode, randomId, restoreCodeForVisitor } from "./crypto";
import { remainingOf, type Visitor } from "./session.server";

export type ReservedKind = "free" | "paid";

export async function checkRateLimit(key: string, max = 12, windowMinutes = 15): Promise<boolean> {
  const sql = await getSql();
  await sql`insert into rate_events (key) values (${key})`;
  const rows = await sql.query<{ count: number }>(
    `select count(*)::int as count
     from rate_events
     where key = $1
       and created_at > now() - ($2::text || ' minutes')::interval`,
    [key, String(windowMinutes)],
  );
  return (rows[0]?.count ?? 0) <= max;
}

export async function generationsEnabled(): Promise<boolean> {
  const flag = process.env.GENERATIONS_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  const budget = Number(process.env.GENERATION_BUDGET_MAX || 0);
  if (!budget) return true;
  const sql = await getSql();
  const rows = await sql<{ value: number }>`
    select value from app_counters where key = 'generations_total'
  `;
  return (rows[0]?.value ?? 0) < budget;
}

export async function bumpGenerationCounter(): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into app_counters (key, value) values ('generations_total', 1)
    on conflict (key) do update set value = app_counters.value + 1, updated_at = now()
  `;
}

export async function reserveCredit(visitorId: string): Promise<ReservedKind | null> {
  return withTransaction(async (sql) => {
    const free = await sql<{ id: string }>`
      update visitors
      set free_remaining = 0
      where id = ${visitorId} and free_remaining > 0
      returning id
    `;
    if (free[0]) return "free";
    const paid = await sql<{ id: string }>`
      update visitors
      set paid_remaining = paid_remaining - 1
      where id = ${visitorId} and paid_remaining > 0
      returning id
    `;
    if (paid[0]) {
      await sql`
        update purchases
        set consumed = consumed + 1
        where id = (
          select id from purchases
          where visitor_id = ${visitorId}
            and status = 'paid'
            and consumed < granted
          order by created_at asc
          limit 1
        )
      `;
      return "paid";
    }
    return null;
  });
}

export async function releaseCredit(visitorId: string, kind: ReservedKind): Promise<void> {
  const sql = await getSql();
  if (kind === "free") {
    await sql`
      update visitors set free_remaining = 1
      where id = ${visitorId} and free_remaining = 0
    `;
    return;
  }
  await withTransaction(async (tx) => {
    await tx`
      update visitors
      set paid_remaining = paid_remaining + 1
      where id = ${visitorId}
    `;
    await tx`
      update purchases
      set consumed = greatest(consumed - 1, 0)
      where id = (
        select id from purchases
        where visitor_id = ${visitorId}
          and status = 'paid'
          and consumed > 0
        order by created_at desc
        limit 1
      )
    `;
  });
}

export async function grantPack(
  visitorId: string,
  stripeSessionId: string,
  paymentIntentId?: string,
): Promise<{ purchaseId: string; restoreCode: string }> {
  const code = restoreCodeForVisitor(visitorId);
  return withTransaction(async (sql) => {
    const existing = await sql<{ id: string }>`
      select id from purchases where stripe_session_id = ${stripeSessionId}
    `;
    if (existing[0]) {
      if (paymentIntentId) {
        await sql`
          update purchases
          set stripe_payment_intent_id = coalesce(stripe_payment_intent_id, ${paymentIntentId})
          where id = ${existing[0].id}
        `;
      }
      return { purchaseId: existing[0].id, restoreCode: code };
    }
    const purchaseId = randomId(12);
    await sql`
      insert into purchases (id, visitor_id, stripe_session_id, stripe_payment_intent_id, status, granted, consumed)
      values (${purchaseId}, ${visitorId}, ${stripeSessionId}, ${paymentIntentId || null}, 'paid', 5, 0)
    `;
    await sql`
      update visitors
      set paid_remaining = paid_remaining + 5,
          restore_code_hash = ${hashRestoreCode(code)}
      where id = ${visitorId}
    `;
    return { purchaseId, restoreCode: code };
  });
}

export async function revokePurchase(stripeRef: string): Promise<void> {
  if (!stripeRef) return;
  await withTransaction(async (sql) => {
    const rows = await sql<{ visitor_id: string; unused: number }>`
      select visitor_id, greatest(granted - consumed, 0)::int as unused
      from purchases
      where status = 'paid'
        and (stripe_session_id = ${stripeRef} or stripe_payment_intent_id = ${stripeRef})
      limit 1
    `;
    const row = rows[0];
    if (!row) return;
    const updated = await sql<{ id: string }>`
      update purchases
      set status = 'refunded'
      where status = 'paid'
        and (stripe_session_id = ${stripeRef} or stripe_payment_intent_id = ${stripeRef})
      returning id
    `;
    if (!updated[0]) return;
    if (row.unused > 0) {
      await sql`
        update visitors
        set paid_remaining = greatest(paid_remaining - ${row.unused}, 0)
        where id = ${row.visitor_id}
      `;
    }
  });
}

export async function restoreByCode(code: string): Promise<Visitor | null> {
  const hash = hashRestoreCode(code);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    free_remaining: number;
    paid_remaining: number;
    restore_code_hash: string | null;
  }>`
    select id, free_remaining, paid_remaining, restore_code_hash
    from visitors
    where restore_code_hash = ${hash}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    freeRemaining: Number(row.free_remaining) || 0,
    paidRemaining: Number(row.paid_remaining) || 0,
    restoreCodeHash: row.restore_code_hash,
  };
}

export { remainingOf };
