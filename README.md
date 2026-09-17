# Dogg Style

A mobile web app that takes a photo of a person and makes a photorealistic portrait of the dog they look like.

The first successful photo is free. After that: five photos for $2.99 as a one-time purchase. No subscription.

## Stack

TanStack Start (Vite) + React + TypeScript. The preview in this build environment needs port 8080 and the existing Start server, so this is not Next.js App Router.

xAI Grok for photo analysis (`grok-4.5`) and image editing (`grok-imagine-image-2.0`). Stripe Checkout for purchases. Neon Postgres in production, PGLite in local preview. IndexedDB for the last 10 results.

## Commands

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Flow

1. Take or pick a photo.
2. The photo is normalized in the browser (max 1600 px, JPEG, about 2 MB).
3. The server analyzes the photo and paints the dog.
4. A credit is used only when a usable photo exists. Errors and invalid photos release the reservation.
5. History (max 10) in IndexedDB. Purchased balance in the database.

## Payments

Stripe Checkout, 299 cents, product name `5 dog photos`. Webhook: `/api/stripe/webhook`. Housekeeping: `GET /api/cron/housekeeping` with `Authorization: Bearer $CRON_SECRET`.

Without Stripe keys, purchases stay honestly blocked. A missing `XAI_API_KEY` does not invent random breeds or sample photos.

Restore code `HT-XXXX-XXXX-XXXX` is shown after purchase. Photo history is local and cannot be restored from the cloud.

## Secrets

No keys in client code. See `.env.example`. Set them in Vercel; do not commit them.

| Variable | Use |
|---|---|
| `XAI_API_KEY` | generation |
| `STRIPE_SECRET_KEY` | Checkout |
| `STRIPE_WEBHOOK_SECRET` | webhook |
| `DATABASE_URL` | Neon |
| `GENERATIONS_ENABLED` | kill switch |
| `SESSION_SECRET` | restore codes |
| `CRON_SECRET` | housekeeping |

Webhook endpoint: `https://<domain>/api/stripe/webhook` for test and live, with the matching secret.

## Cost notes

Marked as estimates. The consumer price is $2.99 and does not change here.

- Photo analysis, Grok Vision: roughly a fraction of a cent per call depending on size.
- Image generation/edit, 1K: xAI lists about $0.04 per image; edits may bill input and output.
- Normal errors/retries: at most one extra AI round, not an extra credit.
- Stripe: 2.9% + $0.30 on $2.99 ≈ $0.39.
- Hosting: Vercel + Neon, low at v1 volume.
- The free photo is paid by the app owner.

## Data

Tables cover anonymous sessions, purchases, generation jobs, webhook idempotency, and rate limits. Original photos are not stored. A finished dog photo is buffered for up to 24 hours. Backups at Neon/xAI/Stripe follow their own retention — not a 24-hour promise everywhere.

Housekeeping clears expired results and stuck reservations (older than 3 minutes) with a one-time refund of the credit.
