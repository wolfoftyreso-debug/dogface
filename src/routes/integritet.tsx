import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/integritet")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <LegalPage title="Integritet">
      <p>
        Hundtvilling skapar en lekfull hundbild från ett foto du väljer. Fotot skickas till vår
        AI-leverantör (xAI) för analys och bildgenerering.
      </p>
      <p>
        Vi lagrar ingen inloggning. En anonym sessionscookie (HttpOnly) håller reda på din gratisbild
        och köpta bilder. Originalfotot sparas inte permanent på servern. En färdig hundbild kan
        buffras privat i högst 24 timmar för att kunna levereras igen vid avbrott.
      </p>
      <p>
        Databasens säkerhetskopior och leverantörernas lagring kan leva längre än 24 timmar. Vi lovar
        inte att varje kopia överallt försvinner exakt då.
      </p>
      <p>
        Bildhistoriken ligger i din webbläsare. Den synkas inte mellan enheter och molnåterställs inte.
        Köpta bilder kan återställas med återställningskoden från köpet.
      </p>
      <p>
        Betalning sker via Stripe. Vi identifierar inte vem du är och gör inga bedömningar av
        personlighet, etnicitet, hälsa eller andra känsliga egenskaper.
      </p>
      <p>
        Utan verifierad identitet kan vi inte garantera exakt en gratisbild per fysisk person. En ny
        webbläsarsession efter rensad lagring kan ge en ny gratisbild.
      </p>
    </LegalPage>
  );
}
