import { appendFileSync } from "node:fs";
import { sha256 } from "./crypto";
import { dbConfigured } from "./db";
import {
  bumpGenerationCounter,
  checkRateLimit,
  generationsEnabled,
  releaseCredit,
  reserveCredit,
} from "./entitlement.server";
import {
  expireStaleJobs,
  getJob,
  hasActiveJob,
  insertReservedJob,
  markDelivered,
  setJobStatus,
} from "./generation.server";
import { validateImagePayload } from "./image";
import {
  clientIp,
  cookieVisitor,
  ensureVisitor,
  getVisitorById,
  remainingOf,
  writeCookieVisitor,
  type Visitor,
} from "./session.server";
import { env } from "./env.server.ts";
import { packPortraits, toClientPortraits, unpackPortraits } from "./result-pack";
import { paymentsReady } from "./stripe.server.ts";
import { ERROR_MESSAGES, type GenerateErrorCode, type GenerateResult, type PortraitStyle } from "./types";

function fail(code: GenerateErrorCode, remaining?: number): GenerateResult {
  return { ok: false, code, message: ERROR_MESSAGES[code], remaining };
}

function isRequestId(value: string): boolean {
  return /^[0-9a-f-]{16,64}$/i.test(value);
}

function onVercel(): boolean {
  return Boolean(process.env["VERCEL"]);
}

function logJob(msg: string, err?: unknown) {
  const extra = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err ? String(err) : "";
  const line = `[hundtvilling] ${new Date().toISOString()} ${msg}${extra ? ` ${extra}` : ""}\n`;
  console.info(line.trim());
  try {
    appendFileSync("/tmp/hundtvilling.log", line);
  } catch {
    // preview/prod /tmp only
  }
}

type MemJob = {
  id: string;
  visitorId: string;
  status: "analyzing" | "generating" | "ready" | "rejected" | "failed";
  breed: string;
  reason: string;
  imageDataUrl: string;
  splitDataUrl?: string;
  dogDataUrl?: string;
  errorCode: GenerateErrorCode | "";
  remaining: number;
};

const memRef = globalThis as typeof globalThis & { __htJobs__?: Map<string, MemJob> };
function memJobs(): Map<string, MemJob> {
  memRef.__htJobs__ ??= new Map();
  return memRef.__htJobs__;
}

function pending(id: string, remaining: number): GenerateResult {
  return { ok: true, id, status: "analyzing", remaining };
}

function readyResult(
  id: string,
  portraits: { dog: string; split?: string },
  breed: string,
  reason: string,
  remaining: number,
): GenerateResult {
  const view = toClientPortraits(portraits);
  return {
    ok: true,
    id,
    status: "ready",
    breed,
    reason,
    imageDataUrl: view.imageDataUrl,
    splitDataUrl: view.splitDataUrl,
    dogDataUrl: view.dogDataUrl,
    remaining,
  };
}

function readyFromPacked(id: string, raw: string, breed: string, reason: string, remaining: number): GenerateResult {
  const portraits = unpackPortraits(raw);
  if (!portraits) return fail("failed", remaining);
  return readyResult(id, portraits, breed, reason, remaining);
}

export async function runDogTwin(
  image: string,
  requestId: string,
  style: PortraitStyle = "dog",
): Promise<GenerateResult> {
  const payload = validateImagePayload(image);
  if (payload !== "ok") return fail(payload);
  if (!isRequestId(requestId)) return fail("failed");
  const hasKey = Boolean(env("XAI_API_KEY"));
  logJob(`generate start hasKey=${hasKey} db=${dbConfigured()} req=${requestId.slice(0, 8)}`);
  if (!hasKey) return fail("unavailable");
  if (!dbConfigured()) return runWithoutDb(image, requestId, style);

  await expireStaleJobs();
  if (!(await generationsEnabled())) return fail("disabled");

  const visitor = await ensureVisitor();
  const ip = clientIp();
  if (!(await checkRateLimit(`gen:${visitor.id}`)) || !(await checkRateLimit(`ip:${ip}`))) {
    return fail("rate_limit", remainingOf(visitor));
  }

  const payloadHash = sha256(image);
  const existing = await getJob(requestId, visitor.id);
  if (existing) {
    if (existing.payloadHash !== payloadHash) return fail("failed", remainingOf(visitor));
    if (existing.status === "ready" || existing.status === "delivered") {
      if (!existing.resultData) return fail("failed", remainingOf(visitor));
      return readyFromPacked(
        existing.id,
        existing.resultData,
        existing.breedName || "",
        existing.reason || "",
        remainingOf(visitor),
      );
    }
    if (existing.status === "rejected") {
      return fail((existing.errorCode as GenerateErrorCode) || "no_human", remainingOf(visitor));
    }
    if (existing.status === "failed" || existing.status === "expired") {
      return fail((existing.errorCode as GenerateErrorCode) || "failed", remainingOf(visitor));
    }
    return { ok: true, id: existing.id, status: existing.status, remaining: remainingOf(visitor) };
  }

  if (await hasActiveJob(visitor.id)) return fail("busy", remainingOf(visitor));

  const kind = (await reserveCredit(visitor.id)) ?? (paymentsReady() ? null : "open");
  if (!kind) return fail("payment_required", 0);

  try {
    await insertReservedJob({
      id: requestId,
      visitorId: visitor.id,
      payloadHash,
      reservedKind: kind,
    });
  } catch (err) {
    logJob("insert job", err);
    await releaseCredit(visitor.id, kind);
    const raced = await getJob(requestId, visitor.id);
    const latest = await getVisitorById(visitor.id);
    if (raced?.resultData) {
      return readyFromPacked(
        raced.id,
        raced.resultData,
        raced.breedName || "",
        raced.reason || "",
        latest ? remainingOf(latest) : remainingOf(visitor),
      );
    }
    return fail("busy", remainingOf(visitor));
  }

  const latest = await getVisitorById(visitor.id);
  const remaining = latest ? remainingOf(latest) : 0;
  if (!onVercel()) {
    const snap = { requestId, image, style, visitorId: visitor.id, kind };
    setImmediate(() => {
      void finishDbJob(snap.requestId, snap.image, snap.style, snap.visitorId, snap.kind).catch((err) =>
        logJob("background job", err),
      );
    });
    return pending(requestId, remaining);
  }
  try {
    return await finishDbJob(requestId, image, style, visitor.id, kind);
  } catch (err) {
    logJob("await job", err);
    return fail("failed", remaining);
  }
}

async function finishDbJob(
  requestId: string,
  image: string,
  style: PortraitStyle,
  visitorId: string,
  kind: "free" | "paid" | "open",
): Promise<GenerateResult> {
  try {
    const { analyzePhoto, producePortraits, AppError } = await import("./xai.server.ts");
    const analysis = await analyzePhoto(image);
    if (!analysis.validHuman || analysis.subjectSelection === "none") {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "no_human" });
      if (moved) await releaseCredit(visitorId, kind);
      const latest = await getVisitorById(visitorId);
      return fail("no_human", latest ? remainingOf(latest) : 1);
    }
    if (analysis.subjectSelection === "ambiguous") {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "ambiguous" });
      if (moved) await releaseCredit(visitorId, kind);
      const latest = await getVisitorById(visitorId);
      return fail("ambiguous", latest ? remainingOf(latest) : undefined);
    }
    if (!analysis.breedId && !analysis.breedName) {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "failed" });
      if (moved) await releaseCredit(visitorId, kind);
      const latest = await getVisitorById(visitorId);
      return fail("failed", latest ? remainingOf(latest) : undefined);
    }

    await setJobStatus(requestId, "generating", {
      breedId: analysis.breedId,
      breedName: analysis.breedName,
      reason: analysis.reason,
    });
    const portraits = await producePortraits(image, analysis);
    const marked = await setJobStatus(requestId, "ready", {
      breedId: analysis.breedId,
      breedName: analysis.breedName,
      reason: analysis.reason,
      resultData: packPortraits(portraits),
    });
    if (!marked) return fail("timeout");
    await bumpGenerationCounter();
    const latest = await getVisitorById(visitorId);
    logJob(`ready ${requestId.slice(0, 8)} ${analysis.breedName}${portraits.split ? " +split" : ""}`);
    return readyResult(requestId, portraits, analysis.breedName, analysis.reason, latest ? remainingOf(latest) : 0);
  } catch (err) {
    const { AppError } = await import("./xai.server.ts");
    const code = err instanceof AppError ? err.code : "failed";
    logJob(`job fail ${requestId.slice(0, 8)} ${code}`, err);
    const current = await getJob(requestId, visitorId);
    if (current?.status === "ready" && current.resultData) {
      const latest = await getVisitorById(visitorId);
      return readyFromPacked(
        requestId,
        current.resultData,
        current.breedName || "",
        current.reason || "",
        latest ? remainingOf(latest) : 0,
      );
    }
    const moved = await setJobStatus(requestId, "failed", { errorCode: code });
    if (moved) await releaseCredit(visitorId, kind);
    return fail(code);
  }
}

async function runWithoutDb(
  image: string,
  requestId: string,
  style: PortraitStyle,
): Promise<GenerateResult> {
  const visitor = cookieVisitor();
  let kind: "free" | "paid" | "open";
  if (visitor.freeRemaining > 0) {
    kind = "free";
    visitor.freeRemaining = 0;
    writeCookieVisitor(visitor);
  } else if (visitor.paidRemaining > 0) {
    kind = "paid";
    visitor.paidRemaining = Math.max(0, visitor.paidRemaining - 1);
    writeCookieVisitor(visitor);
  } else if (!paymentsReady()) {
    kind = "open";
  } else {
    return fail("payment_required", 0);
  }

  memJobs().set(requestId, {
    id: requestId,
    visitorId: visitor.id,
    status: "analyzing",
    breed: "",
    reason: "",
    imageDataUrl: "",
    errorCode: "",
    remaining: remainingOf(visitor),
  });

  if (!onVercel()) {
    const snap = { requestId, image, style, visitor, kind };
    setImmediate(() => {
      void finishMemJob(snap.requestId, snap.image, snap.style, snap.visitor, snap.kind).catch((err) =>
        logJob("mem job", err),
      );
    });
    return pending(requestId, remainingOf(visitor));
  }
  return finishMemJob(requestId, image, style, visitor, kind);
}

async function finishMemJob(
  requestId: string,
  image: string,
  style: PortraitStyle,
  visitor: Visitor,
  kind: "free" | "paid" | "open",
): Promise<GenerateResult> {
  const refund = () => {
    if (kind === "open") return;
    if (kind === "free") visitor.freeRemaining = 1;
    else visitor.paidRemaining += 1;
    writeCookieVisitor(visitor);
  };
  try {
    const { analyzePhoto, producePortraits, AppError } = await import("./xai.server.ts");
    const analysis = await analyzePhoto(image);
    if (!analysis.validHuman || analysis.subjectSelection === "none") {
      refund();
      memJobs().set(requestId, {
        ...memJobs().get(requestId)!,
        status: "rejected",
        errorCode: "no_human",
        remaining: remainingOf(visitor),
      });
      return fail("no_human", remainingOf(visitor));
    }
    if (analysis.subjectSelection === "ambiguous") {
      refund();
      memJobs().set(requestId, {
        ...memJobs().get(requestId)!,
        status: "rejected",
        errorCode: "ambiguous",
        remaining: remainingOf(visitor),
      });
      return fail("ambiguous", remainingOf(visitor));
    }
    if (!analysis.breedId && !analysis.breedName) {
      refund();
      memJobs().set(requestId, {
        ...memJobs().get(requestId)!,
        status: "rejected",
        errorCode: "failed",
        remaining: remainingOf(visitor),
      });
      return fail("failed", remainingOf(visitor));
    }
    const current = memJobs().get(requestId);
    if (current) current.status = "generating";
    const portraits = await producePortraits(image, analysis);
    const view = toClientPortraits(portraits);
    memJobs().set(requestId, {
      id: requestId,
      visitorId: visitor.id,
      status: "ready",
      breed: analysis.breedName,
      reason: analysis.reason,
      imageDataUrl: view.imageDataUrl,
      splitDataUrl: view.splitDataUrl,
      dogDataUrl: view.dogDataUrl,
      errorCode: "",
      remaining: remainingOf(visitor),
    });
    logJob(`mem ready ${requestId.slice(0, 8)} ${analysis.breedName}${portraits.split ? " +split" : ""}`);
    return readyResult(requestId, portraits, analysis.breedName, analysis.reason, remainingOf(visitor));
  } catch (err) {
    const { AppError } = await import("./xai.server.ts");
    refund();
    const code = err instanceof AppError ? err.code : "failed";
    logJob(`mem fail ${requestId.slice(0, 8)} ${code}`, err);
    memJobs().set(requestId, {
      id: requestId,
      visitorId: visitor.id,
      status: "failed",
      breed: "",
      reason: "",
      imageDataUrl: "",
      errorCode: code,
      remaining: remainingOf(visitor),
    });
    return fail(code, remainingOf(visitor));
  }
}

export async function readGeneration(id: string): Promise<GenerateResult> {
  if (!isRequestId(id)) return fail("failed");
  const mem = memJobs().get(id);
  if (mem) {
    if (mem.status === "ready") {
      return {
        ok: true,
        id: mem.id,
        status: "ready",
        breed: mem.breed,
        reason: mem.reason,
        imageDataUrl: mem.imageDataUrl,
        splitDataUrl: mem.splitDataUrl,
        dogDataUrl: mem.dogDataUrl,
        remaining: mem.remaining,
      };
    }
    if (mem.status === "rejected" || mem.status === "failed") {
      return fail((mem.errorCode as GenerateErrorCode) || "failed", mem.remaining);
    }
    return { ok: true, id: mem.id, status: mem.status, remaining: mem.remaining };
  }
  if (!dbConfigured()) return fail("failed", remainingOf(cookieVisitor()));

  const visitor = await ensureVisitor();
  const job = await getJob(id, visitor.id);
  if (!job) return fail("failed", remainingOf(visitor));
  if (job.status === "ready" || job.status === "delivered") {
    if (!job.resultData) return fail("failed", remainingOf(visitor));
    if (job.status === "ready") await markDelivered(id, visitor.id);
    return readyFromPacked(
      job.id,
      job.resultData,
      job.breedName || "",
      job.reason || "",
      remainingOf(visitor),
    );
  }
  if (job.status === "rejected") {
    return fail((job.errorCode as GenerateErrorCode) || "no_human", remainingOf(visitor));
  }
  if (job.status === "failed" || job.status === "expired") {
    return fail((job.errorCode as GenerateErrorCode) || "failed", remainingOf(visitor));
  }
  return { ok: true, id: job.id, status: job.status, remaining: remainingOf(visitor) };
}
