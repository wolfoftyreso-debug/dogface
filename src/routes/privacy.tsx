import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/lib/legal-page";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Dogg Style is a website that turns a photo of a person into a playful dog portrait. It is
        entertainment, not a scientific or medical product. It is not directed at children under 13.
      </p>
      <p>
        <strong className="font-semibold text-fg">Camera.</strong> If you tap Camera, the browser asks
        for camera access so you can take a selfie. We do not keep a live camera stream after you
        close it. You can deny the permission and pick a photo from your library instead.
      </p>
      <p>
        <strong className="font-semibold text-fg">Photos.</strong> The photo you choose is processed
        on your device (resized) and sent to our servers and to our AI provider (xAI) to analyze
        features and generate the result. We do not post your photo publicly. We do not use it for
        ads. We do not sell it.
      </p>
      <p>
        We don’t store a login. An anonymous session cookie (HttpOnly) tracks your free photo and
        purchased credits. The original photo is not kept permanently on the server. A finished
        result may be buffered privately for up to 24 hours so it can be delivered again if the
        connection drops.
      </p>
      <p>
        Database backups and provider logs can live longer than 24 hours. We don’t promise that
        every copy everywhere disappears at that exact time.
      </p>
      <p>
        Photo history lives only in this browser. It does not sync across devices. Purchased credits
        can be restored with the restore code from the purchase. Use Info → Clear photos on this
        phone to delete local history and drafts. Clearing browser data also deletes the session
        cookie and unused credits on this device.
      </p>
      <p>
        Payment is processed by Stripe. We receive a payment confirmation, not your full card
        number. We do not identify who you are from the photo, and we do not infer ethnicity,
        health, or other sensitive traits as a product feature.
      </p>
      <p>
        Without a verified identity we can’t guarantee exactly one free photo per person. A new
        browser after clearing storage can grant a new free photo.
      </p>
    </LegalPage>
  );
}
