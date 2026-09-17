import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>
        By using Dogg Style you agree to these terms. You must be at least 13. If you are under 18,
        you need a parent or guardian’s permission.
      </p>
      <p>
        The first successful dog photo is free. After that you can buy five more photos for $2.99
        USD. It’s a one-time purchase on this website through Stripe. No subscription and no
        auto-renewal. These are website purchases, not Apple In-App Purchases.
      </p>
      <p>
        A credit is used only when a usable dog photo is actually made. Invalid photos and technical
        errors don’t use a credit. Saving or sharing the same result is free. A new Create is a new
        generation.
      </p>
      <p>
        You must only upload photos you have the right to use. You grant us a limited license to
        process that photo solely to generate and deliver your result. You may keep and share the
        result for personal, non-commercial fun. The result is entertainment, not a statement about
        identity, health, or character.
      </p>
      <p>
        Don’t upload sexual content involving minors, or anyone who hasn’t agreed to be photographed
        for this. We may refuse or delete jobs that break the law or these terms.
      </p>
      <p>
        Payment is handled by Stripe Checkout. A refund through Stripe revokes unused purchased
        photos from that purchase, not other valid purchases and not photos already generated.
      </p>
      <p>The service is provided as-is. Generation can fail, look odd, or take around a minute.</p>
    </LegalPage>
  );
}
