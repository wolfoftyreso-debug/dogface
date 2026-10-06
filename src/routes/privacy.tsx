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
        The first time you tap Create, the app asks you to confirm you are 13 or older and to allow
        sending that photo to our server and to xAI. You can say no. Camera access is optional: you
        can pick a library photo instead. You can withdraw consent by not sending more photos and by
        using Info → Delete my photos, which removes photos on this phone and finished results still
        stored for your session on our server. Purchase records stay so a restore can work. That is
        not a refund, and there is no account to delete.
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
        generate the image. Stripe processes website payments. Apple processes In-App Purchases in
        the iOS app. They must protect that data at least as described here. We do not share photos
        with advertisers or data brokers.
      </p>
      <p>
        The original photo is not kept permanently on our server. A finished result may be buffered
        privately for up to 24 hours so it can be delivered if the connection drops. Backups and
        provider logs can live longer; we don’t promise every copy vanishes at that exact time.
      </p>
      <p>
        Photo history lives only in this browser (up to 10). It does not sync. Info → Delete my
        photos removes that history, drafts, and any result still buffered on our server for this
        session. Clearing this site’s data in Safari also deletes the session cookie.
      </p>
      <p>
        Without a verified identity we can’t guarantee exactly one free photo per person. A new
        browser after clearing storage can grant a new free photo.
      </p>
    </LegalPage>
  );
}
