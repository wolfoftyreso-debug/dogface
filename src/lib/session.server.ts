import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "./db";
import { randomId, sha256 } from "./crypto";

const COOKIE = "ht_sid";
const MAX_AGE = 60 * 60 * 24 * 400;

export type Visitor = {
  id: string;
  freeRemaining: number;
  paidRemaining: number;
  restoreCodeHash: string | null;
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

export function clientIp(): string {
  const request = getRequest();
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 128) || "unknown";
}

export async function ensureVisitor(): Promise<Visitor> {
  const sql = await getSql();
  const existing = getCookie(COOKIE)?.trim();
  if (existing && existing.length >= 32 && existing.length <= 128) {
    const tokenHash = sha256(existing);
    const byToken = await sql<VisitorRow>`
      select id, free_remaining, paid_remaining, restore_code_hash
      from visitors where token_hash = ${tokenHash}
    `;
    if (byToken[0]) return mapVisitor(byToken[0]);
    const byId = await sql<VisitorRow>`
      select id, free_remaining, paid_remaining, restore_code_hash
      from visitors where id = ${tokenHash}
    `;
    if (byId[0]) {
      await sql`update visitors set token_hash = ${tokenHash} where id = ${byId[0].id}`;
      return mapVisitor(byId[0]);
    }
  }

  const token = randomId(24);
  const tokenHash = sha256(token);
  const id = randomId(16);
  await sql`
    insert into visitors (id, token_hash) values (${id}, ${tokenHash})
    on conflict (id) do nothing
  `;
  setCookie(COOKIE, token, cookieOptions());
  return {
    id,
    freeRemaining: 1,
    paidRemaining: 0,
    restoreCodeHash: null,
  };
}

type VisitorRow = {
  id: string;
  free_remaining: number;
  paid_remaining: number;
  restore_code_hash: string | null;
};

function mapVisitor(row: VisitorRow): Visitor {
  return {
    id: row.id,
    freeRemaining: Number(row.free_remaining) || 0,
    paidRemaining: Number(row.paid_remaining) || 0,
    restoreCodeHash: row.restore_code_hash,
  };
}

export async function getVisitorById(id: string): Promise<Visitor | null> {
  const sql = await getSql();
  const rows = await sql<VisitorRow>`
    select id, free_remaining, paid_remaining, restore_code_hash
    from visitors where id = ${id}
  `;
  return rows[0] ? mapVisitor(rows[0]) : null;
}

export async function attachCookieToVisitor(visitorId: string): Promise<void> {
  const token = getCookie(COOKIE)?.trim();
  if (!token) return;
  const sql = await getSql();
  const tokenHash = sha256(token);
  await sql`update visitors set token_hash = null where token_hash = ${tokenHash} and id <> ${visitorId}`;
  await sql`update visitors set token_hash = ${tokenHash} where id = ${visitorId}`;
}

export function remainingOf(visitor: Visitor): number {
  return Math.max(0, visitor.freeRemaining) + Math.max(0, visitor.paidRemaining);
}
