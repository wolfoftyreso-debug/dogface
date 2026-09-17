import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        Reach us:{" "}
        <a className="font-semibold text-fg underline-offset-2 hover:underline" href="https://github.com/wolfoftyreso-debug/dogface/issues/new">
          open a support request
        </a>
        . Include your restore code (HT-…) or Apple receipt.
      </p>
      <p>
        <strong className="font-semibold text-fg">Website.</strong> There is no Apple ID login and
        no App Store subscription to cancel. Restore with Info → Restore purchase and the code shown
        after Stripe payment.
      </p>
      <p>
        <strong className="font-semibold text-fg">iOS app.</strong> Buy and restore through Apple
        In-App Purchase. You can also enter the HT- code from a website purchase.
      </p>
      <p>
        If the code is missing on the website, use the Stripe receipt. Checkout Session ids start
        with cs_, Payment Intent ids with pi_. We can’t restore photos that were already generated,
        and we can’t rebuild photo history from the cloud.
      </p>
      <p>
        To delete photos stored on this device: Info → Clear photos on this phone. That does not
        refund credits.
      </p>
      <p>Technical errors and invalid photos don’t use a credit. Saving and sharing is always free.</p>
    </LegalPage>
  );
}
