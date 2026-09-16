import { createServerFn } from "@tanstack/react-start";
import { parseGenerateInput } from "./generate-input";
import { ERROR_MESSAGES, type GenerateResult } from "./types";

export { parseGenerateInput } from "./generate-input";

export const generateDogTwin = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseGenerateInput(input))
  .handler(async ({ data }): Promise<GenerateResult> => {
    try {
      const { runDogTwin } = await import("./generate-run.server.ts");
      return await runDogTwin(data.image, data.requestId);
    } catch (err) {
      console.info("[hundtvilling] generateDogTwin", err instanceof Error ? err.message : "error");
      return { ok: false, code: "failed", message: ERROR_MESSAGES.failed };
    }
  });

export const getGeneration = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as { id?: unknown }) : {};
    return { id: typeof raw.id === "string" ? raw.id : "" };
  })
  .handler(async ({ data }): Promise<GenerateResult> => {
    const { readGeneration } = await import("./generate-run.server.ts");
    return readGeneration(data.id);
  });
