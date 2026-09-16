import { createFileRoute } from "@tanstack/react-router";
import { expireStaleJobs } from "@/lib/generation.server";

export const Route = createFileRoute("/api/cron/housekeeping")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.CRON_SECRET?.trim();
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!expected || token !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        await expireStaleJobs();
        return Response.json({ ok: true });
      },
    },
  },
});
