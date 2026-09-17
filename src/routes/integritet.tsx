import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/integritet")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy" });
  },
});
