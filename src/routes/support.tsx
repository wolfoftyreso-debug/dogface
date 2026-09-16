import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        Om ett köp inte syns: använd återställningskoden som visades efter betalningen. Bildhistoriken
        är lokal och kan inte återskapas från molnet.
      </p>
      <p>
        Om koden saknas behövs kvittot från Stripe. Ange Checkout Session-id (börjar med cs_) eller
        Payment Intent-id (börjar med pi_) från kvittot. Vi kan inte återställa förbrukade bilder.
      </p>
      <p>
        Tekniska fel och ogiltiga foton drar inte en bild. Spara och dela samma resultat är alltid
        gratis.
      </p>
    </LegalPage>
  );
}
