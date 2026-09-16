import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("stripe-signature");
        const status = await handleStripeWebhook(raw, signature);
        return new Response(status === 200 ? "ok" : "error", { status });
      },
    },
  },
});
