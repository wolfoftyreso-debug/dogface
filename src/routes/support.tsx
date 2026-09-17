import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        Dogg Style is a website. Purchases are restored in the app, not through the App Store.
      </p>
      <p>
        If a purchase doesn’t show: open Info → Restore purchase and enter the code shown after
        payment (starts with HT-). Keep a screenshot of that code.
      </p>
      <p>
        If the code is missing, use the Stripe receipt. The Checkout Session id starts with cs_,
        the Payment Intent id with pi_. We can’t restore photos that were already generated, and we
        can’t rebuild photo history from the cloud — history lives on this phone.
      </p>
      <p>
        To delete photos stored on this device: Info → Clear photos on this phone. That does not
        refund credits.
      </p>
      <p>Technical errors and invalid photos don’t use a credit. Saving and sharing is always free.</p>
    </LegalPage>
  );
}
