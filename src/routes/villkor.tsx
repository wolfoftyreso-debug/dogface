import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/villkor")({
  beforeLoad: () => {
    throw redirect({ to: "/terms" });
  },
});
