import { createServerFn } from "@tanstack/react-start";

export const getBalance = createServerFn({ method: "GET" }).handler(async () => {
  const { readBalance } = await import("./stripe.server.ts");
  return readBalance();
});

export const createCheckout = createServerFn({ method: "POST" }).handler(async () => {
  const { startCheckout } = await import("./stripe.server.ts");
  return startCheckout();
});

export const confirmCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as { sessionId?: unknown }) : {};
    return { sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "" };
  })
  .handler(async ({ data }) => {
    const { confirmCheckoutSession } = await import("./stripe.server.ts");
    return confirmCheckoutSession(data.sessionId);
  });

export const restorePurchase = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as { code?: unknown }) : {};
    return { code: typeof raw.code === "string" ? raw.code : "" };
  })
  .handler(async ({ data }) => {
    const { restoreWithCode } = await import("./stripe.server.ts");
    return restoreWithCode(data.code);
  });
