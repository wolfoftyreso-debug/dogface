import { sha256 } from "./crypto";
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
import { clientIp, ensureVisitor, getVisitorById, remainingOf } from "./session.server";
import { ERROR_MESSAGES, type GenerateErrorCode, type GenerateResult } from "./types";

function fail(code: GenerateErrorCode, remaining?: number): GenerateResult {
  return { ok: false, code, message: ERROR_MESSAGES[code], remaining };
}

function isRequestId(value: string): boolean {
  return /^[0-9a-f-]{16,64}$/i.test(value);
}

export async function runDogTwin(image: string, requestId: string): Promise<GenerateResult> {
  const payload = validateImagePayload(image);
  if (payload !== "ok") return fail(payload);
  if (!isRequestId(requestId)) return fail("failed");
  if (!process.env.XAI_API_KEY) return fail("unavailable");

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
      return {
        ok: true,
        id: existing.id,
        status: "ready",
        breed: existing.breedName || "",
        reason: existing.reason || "",
        imageDataUrl: existing.resultData,
        remaining: remainingOf(visitor),
      };
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

  const kind = await reserveCredit(visitor.id);
  if (!kind) return fail("payment_required", 0);

  try {
    await insertReservedJob({
      id: requestId,
      visitorId: visitor.id,
      payloadHash,
      reservedKind: kind,
    });
  } catch {
    await releaseCredit(visitor.id, kind);
    const raced = await getJob(requestId, visitor.id);
    const latest = await getVisitorById(visitor.id);
    if (raced?.resultData) {
      return {
        ok: true,
        id: raced.id,
        status: "ready",
        breed: raced.breedName || "",
        reason: raced.reason || "",
        imageDataUrl: raced.resultData,
        remaining: latest ? remainingOf(latest) : remainingOf(visitor),
      };
    }
    return fail("busy", remainingOf(visitor));
  }

  try {
    await setJobStatus(requestId, "analyzing");
    const { analyzePhoto, produceIdentityDog } = await import("./xai.server.ts");
    const analysis = await analyzePhoto(image);
    if (!analysis.validHuman || analysis.subjectSelection === "none") {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "no_human" });
      if (moved) await releaseCredit(visitor.id, kind);
      const latest = await getVisitorById(visitor.id);
      return fail("no_human", latest ? remainingOf(latest) : 1);
    }
    if (analysis.subjectSelection === "ambiguous") {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "ambiguous" });
      if (moved) await releaseCredit(visitor.id, kind);
      const latest = await getVisitorById(visitor.id);
      return fail("ambiguous", latest ? remainingOf(latest) : undefined);
    }
    if (!analysis.breedId && !analysis.breedName) {
      const moved = await setJobStatus(requestId, "rejected", { errorCode: "failed" });
      if (moved) await releaseCredit(visitor.id, kind);
      const latest = await getVisitorById(visitor.id);
      return fail("failed", latest ? remainingOf(latest) : undefined);
    }

    await setJobStatus(requestId, "generating", {
      breedId: analysis.breedId,
      breedName: analysis.breedName,
      reason: analysis.reason,
    });
    const imageDataUrl = await produceIdentityDog(image, analysis);
    const marked = await setJobStatus(requestId, "ready", {
      breedId: analysis.breedId,
      breedName: analysis.breedName,
      reason: analysis.reason,
      resultData: imageDataUrl,
    });
    if (!marked) {
      return fail("timeout");
    }
    await bumpGenerationCounter();
    const latest = await getVisitorById(visitor.id);
    return {
      ok: true,
      id: requestId,
      status: "ready",
      breed: analysis.breedName,
      reason: analysis.reason,
      imageDataUrl,
      remaining: latest ? remainingOf(latest) : 0,
    };
  } catch (err) {
    const { AppError } = await import("./xai.server.ts");
    const code = err instanceof AppError ? err.code : "failed";
    const current = await getJob(requestId, visitor.id);
    if (current?.status === "ready" && current.resultData) {
      const latest = await getVisitorById(visitor.id);
      return {
        ok: true,
        id: requestId,
        status: "ready",
        breed: current.breedName || "",
        reason: current.reason || "",
        imageDataUrl: current.resultData,
        remaining: latest ? remainingOf(latest) : 0,
      };
    }
    const moved = await setJobStatus(requestId, "failed", { errorCode: code });
    if (moved) await releaseCredit(visitor.id, kind);
    return fail(code);
  }
}

export async function readGeneration(id: string): Promise<GenerateResult> {
  if (!isRequestId(id)) return fail("failed");
  const visitor = await ensureVisitor();
  const job = await getJob(id, visitor.id);
  if (!job) return fail("failed", remainingOf(visitor));
  if (job.status === "ready" || job.status === "delivered") {
    if (!job.resultData) return fail("failed", remainingOf(visitor));
    if (job.status === "ready") await markDelivered(id, visitor.id);
    return {
      ok: true,
      id: job.id,
      status: "ready",
      breed: job.breedName || "",
      reason: job.reason || "",
      imageDataUrl: job.resultData,
      remaining: remainingOf(visitor),
    };
  }
  if (job.status === "rejected") {
    return fail((job.errorCode as GenerateErrorCode) || "no_human", remainingOf(visitor));
  }
  if (job.status === "failed" || job.status === "expired") {
    return fail((job.errorCode as GenerateErrorCode) || "failed", remainingOf(visitor));
  }
  return { ok: true, id: job.id, status: job.status, remaining: remainingOf(visitor) };
}
