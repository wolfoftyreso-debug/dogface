export function parseGenerateInput(input: unknown): {
  image: string;
  requestId: string;
} {
  if (!input || typeof input !== "object") return { image: "", requestId: "" };
  const raw = input as { image?: unknown; requestId?: unknown };
  return {
    image: typeof raw.image === "string" ? raw.image : "",
    requestId: typeof raw.requestId === "string" ? raw.requestId : "",
  };
}
