import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        Dogg Style is a website, not an App Store app. There is no Apple ID login and no App Store
        subscription to cancel. Purchases are restored in Info → Restore purchase, not through
        Apple.
      </p>
      <p>
        If a purchase doesn’t show: enter the code shown after payment (starts with HT-). Keep a
        screenshot of that code.
      </p>
      <p>
        If the code is missing, use the Stripe receipt emailed to you. The Checkout Session id
        starts with cs_, the Payment Intent id with pi_. Reply to that receipt or open the payment
        in Stripe’s customer portal from the receipt. We can’t restore photos that were already
        generated, and we can’t rebuild photo history from the cloud.
      </p>
      <p>
        To delete photos stored on this device: Info → Clear photos on this phone. That does not
        refund credits.
      </p>
      <p>Technical errors and invalid photos don’t use a credit. Saving and sharing is always free.</p>
    </LegalPage>
  );
}
