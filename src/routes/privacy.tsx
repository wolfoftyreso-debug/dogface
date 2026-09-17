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
        By tapping Create you consent to sending that photo for this purpose. You can refuse camera
        access and pick a library photo instead. Paid photos do not require camera access. You can
        withdraw consent by not sending more photos and by deleting what’s stored on this phone
        (Info → Clear photos on this phone) and this site’s data in the browser.
      </p>
      <p>
        <strong className="font-semibold text-fg">Camera.</strong> If you tap Camera, the browser asks
        for camera access so you can take a selfie. The live preview is the recording indicator. We
        do not keep the stream after you close it. We do not use the microphone.
      </p>
      <p>
        <strong className="font-semibold text-fg">What we collect.</strong> The photo you choose
        (resized on your device); an anonymous session cookie (HttpOnly) for free/paid credits; a
        restore code after purchase; payment confirmation from Stripe (not your full card number).
        We do not collect your name, email, or Apple ID. We do not run ads or tracking SDKs.
      </p>
      <p>
        <strong className="font-semibold text-fg">How we use it.</strong> The photo is sent to our
        servers and to our AI provider (xAI) to analyze visible features and generate the result. We
        do not post it publicly, use it for ads, sell it, or use it to identify you.
      </p>
      <p>
        <strong className="font-semibold text-fg">Third parties.</strong> xAI processes the photo to
        generate the image. Stripe processes payment. They must protect that data at least as
        described here. We do not share photos with advertisers or data brokers.
      </p>
      <p>
        The original photo is not kept permanently on our server. A finished result may be buffered
        privately for up to 24 hours so it can be delivered if the connection drops. Backups and
        provider logs can live longer; we don’t promise every copy vanishes at that exact time.
      </p>
      <p>
        Photo history lives only in this browser (up to 10). It does not sync. Info → Clear photos
        on this phone deletes that history and drafts. Clearing this site’s data in Safari also
        deletes the session cookie and unused credits on this device. That is how you request
        deletion: there is no account to delete.
      </p>
      <p>
        Without a verified identity we can’t guarantee exactly one free photo per person. A new
        browser after clearing storage can grant a new free photo.
      </p>
    </LegalPage>
  );
}
