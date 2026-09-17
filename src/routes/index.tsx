import { createFileRoute } from "@tanstack/react-router";
import { DoggStyleApp } from "@/components/hundtvilling-app";

type Search = {
  checkout?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  component: Home,
});

function Home() {
  return <DoggStyleApp />;
}
