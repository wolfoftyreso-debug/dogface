import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        If a purchase doesn’t show: use the restore code shown after payment. Photo history is local
        and can’t be rebuilt from the cloud.
      </p>
      <p>
        If the code is missing you need the Stripe receipt. Send the Checkout Session id (starts
        with cs_) or Payment Intent id (starts with pi_) from the receipt. We can’t restore used
        photos.
      </p>
      <p>
        Technical errors and invalid photos don’t use a credit. Saving and sharing the same result
        is always free.
      </p>
    </LegalPage>
  );
}
