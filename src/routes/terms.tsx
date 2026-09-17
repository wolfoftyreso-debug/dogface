import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>
        The first successful dog photo is free. After that you can buy five more photos for $2.99.
        It’s a one-time purchase. No subscription and no auto-renewal.
      </p>
      <p>
        A credit is used only when a usable dog photo is actually made. Invalid photos and technical
        errors don’t use a credit. Saving or sharing the same result is free. A new request is a new
        generation.
      </p>
      <p>
        The result is entertainment, not a scientific judgment. Only use photos you have the right
        to use.
      </p>
      <p>
        Payment is handled by Stripe Checkout. A refund revokes unused purchased photos from that
        purchase, not other valid purchases.
      </p>
    </LegalPage>
  );
}
