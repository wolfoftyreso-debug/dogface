import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Dogg Style makes a playful dog photo from a picture you choose. The photo is sent to our AI
        provider (xAI) for analysis and image generation.
      </p>
      <p>
        We don’t store a login. An anonymous session cookie (HttpOnly) tracks your free photo and
        purchased photos. The original photo is not kept permanently on the server. A finished dog
        photo may be buffered privately for up to 24 hours so it can be delivered again if something
        drops.
      </p>
      <p>
        Database backups and provider storage can live longer than 24 hours. We don’t promise that
        every copy everywhere disappears at that exact time.
      </p>
      <p>
        Photo history lives in your browser. It doesn’t sync across devices and isn’t restored from
        the cloud. Purchased photos can be restored with the restore code from the purchase.
      </p>
      <p>
        Payment goes through Stripe. We don’t identify who you are and we don’t judge personality,
        ethnicity, health, or other sensitive traits.
      </p>
      <p>
        Without a verified identity we can’t guarantee exactly one free photo per person. A new
        browser session after clearing storage can grant a new free photo.
      </p>
    </LegalPage>
  );
}
