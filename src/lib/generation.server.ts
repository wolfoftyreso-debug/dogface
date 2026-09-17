import { getSql } from "./db";
import type { ReservedKind } from "./entitlement.server";
import { releaseCredit } from "./entitlement.server";
import type { GenerateErrorCode } from "./types";

export type JobStatus =
  | "reserved"
  | "analyzing"
  | "generating"
  | "ready"
  | "delivered"
  | "rejected"
  | "failed"
  | "expired";

export type GenerationJob = {
  id: string;
  visitorId: string;
  payloadHash: string;
  status: JobStatus;
  reservedKind: ReservedKind | null;
  breedId: string | null;
  breedName: string | null;
  reason: string | null;
  resultData: string | null;
  errorCode: string | null;
};

type Row = {
  id: string;
  visitor_id: string;
  payload_hash: string;
  status: JobStatus;
  reserved_kind: ReservedKind | null;
  breed_id: string | null;
  breed_name: string | null;
  reason: string | null;
  result_data: string | null;
  error_code: string | null;
};

function mapJob(row: Row): GenerationJob {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    payloadHash: row.payload_hash,
    status: row.status,
    reservedKind: row.reserved_kind,
    breedId: row.breed_id,
    breedName: row.breed_name,
    reason: row.reason,
    resultData: row.result_data,
    errorCode: row.error_code,
  };
}

export async function getJob(id: string, visitorId: string): Promise<GenerationJob | null> {
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, visitor_id, payload_hash, status, reserved_kind, breed_id, breed_name,
           reason, result_data, error_code
    from generations
    where id = ${id} and visitor_id = ${visitorId}
  `;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function hasActiveJob(visitorId: string, exceptId?: string): Promise<boolean> {
  return Boolean(await getActiveJob(visitorId, exceptId));
}

export async function getActiveJob(visitorId: string, exceptId?: string): Promise<GenerationJob | null> {
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, visitor_id, payload_hash, status, reserved_kind, breed_id, breed_name,
           reason, result_data, error_code
    from generations
    where visitor_id = ${visitorId}
      and status in ('reserved', 'analyzing', 'generating')
      and (${exceptId ?? ""} = '' or id <> ${exceptId ?? ""})
    order by created_at desc
    limit 1
  `;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function insertReservedJob(input: {
  id: string;
  visitorId: string;
  payloadHash: string;
  reservedKind: ReservedKind;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into generations (id, visitor_id, payload_hash, status, reserved_kind)
    values (${input.id}, ${input.visitorId}, ${input.payloadHash}, 'analyzing', ${input.reservedKind})
  `;
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
  extra?: {
    breedId?: string;
    breedName?: string;
    reason?: string;
    resultData?: string;
    errorCode?: GenerateErrorCode;
  },
): Promise<boolean> {
  const sql = await getSql();
  if (status === "ready") {
    const rows = await sql<{ id: string }>`
      update generations
      set status = 'ready',
          breed_id = coalesce(${extra?.breedId ?? null}, breed_id),
          breed_name = coalesce(${extra?.breedName ?? null}, breed_name),
          reason = coalesce(${extra?.reason ?? null}, reason),
          result_data = ${extra?.resultData ?? null},
          result_expires_at = now() + interval '1 day',
          updated_at = now()
      where id = ${id}
        and status in ('reserved', 'analyzing', 'generating')
      returning id
    `;
    return Boolean(rows[0]);
  }
  if (status === "rejected" || status === "failed" || status === "expired") {
    const rows = await sql<{ id: string }>`
      update generations
      set status = ${status},
          error_code = coalesce(${extra?.errorCode ?? null}, error_code),
          updated_at = now()
      where id = ${id}
        and status in ('reserved', 'analyzing', 'generating')
      returning id
    `;
    return Boolean(rows[0]);
  }
  const rows = await sql<{ id: string }>`
    update generations
    set status = ${status},
        breed_id = coalesce(${extra?.breedId ?? null}, breed_id),
        breed_name = coalesce(${extra?.breedName ?? null}, breed_name),
        reason = coalesce(${extra?.reason ?? null}, reason),
        updated_at = now()
    where id = ${id}
    returning id
  `;
  return Boolean(rows[0]);
}

export async function markDelivered(id: string, visitorId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update generations
    set status = 'delivered', updated_at = now()
    where id = ${id} and visitor_id = ${visitorId} and status = 'ready'
  `;
}

export async function expireStaleJobs(): Promise<void> {
  const sql = await getSql();
  const stale = await sql<{ id: string; visitor_id: string; reserved_kind: ReservedKind | null }>`
    update generations
    set status = 'expired', updated_at = now()
    where (
        status in ('analyzing', 'generating')
        and created_at < now() - interval '2 minutes'
      )
      or status = 'reserved'
    returning id, visitor_id, reserved_kind
  `;
  for (const job of stale) {
    if (job.reserved_kind) {
      await releaseCredit(job.visitor_id, job.reserved_kind);
    }
  }
  await sql`
    update generations
    set result_data = null
    where result_expires_at is not null
      and result_expires_at < now()
      and result_data is not null
  `;
  await sql`
    delete from rate_events where created_at < now() - interval '1 day'
  `;
}
