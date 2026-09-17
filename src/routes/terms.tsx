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
        USD. It’s a one-time pack of credits. No subscription and no auto-renewal.
      </p>
      <p>
        <strong className="font-semibold text-fg">Website.</strong> Purchases on the website are
        completed with Stripe Checkout. They are not App Store purchases and are not billed by
        Apple.
      </p>
      <p>
        <strong className="font-semibold text-fg">iOS app.</strong> Purchases in the App Store app
        use Apple In-App Purchase only. Restore with Info → Restore purchase, or Apple’s Restore
        Purchases. Unused credits do not expire.
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
        A Stripe refund revokes unused photos from that website purchase. Apple refunds are handled
        by Apple; we then revoke unused credits from that App Store purchase.
      </p>
      <p>The service is provided as-is. Generation can fail, look odd, or take around a minute.</p>
    </LegalPage>
  );
}
