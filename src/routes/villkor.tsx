import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/villkor")({ component: TermsPage });

function TermsPage() {
  return (
    <LegalPage title="Villkor">
      <p>
        Första lyckade hundbilden är gratis. Därefter kan du köpa fem ytterligare bilder för 2,99 USD.
        Det är ett engångsköp. Ingen prenumeration och ingen automatisk förnyelse.
      </p>
      <p>
        En bild förbrukas bara när en användbar hundbild faktiskt har skapats. Ogiltiga foton och
        tekniska fel drar inte en bild. Att spara eller dela samma resultat är gratis. En ny begärd
        bild är en ny generering.
      </p>
      <p>
        Resultatet är underhållning, inte en vetenskaplig bedömning. Använd bara foton du har rätt att
        använda.
      </p>
      <p>
        Betalning hanteras av Stripe Checkout. Återbetalning återkallar oanvända köpta bilder från det
        köpet, inte andra giltiga köp.
      </p>
    </LegalPage>
  );
}
