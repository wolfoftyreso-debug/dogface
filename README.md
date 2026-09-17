# Doggy Style

En mobil webbapp som tar ett foto av en människa och skapar ett fotorealistiskt porträtt av den hund personen liknar.

Första lyckade bilden är gratis. Därefter: fem bilder för 2,99 USD som engångsköp. Ingen prenumeration.

## Stack

TanStack Start (Vite) + React + TypeScript. Förhandsvisningen i den här byggmiljön kräver port 8080 och den befintliga Start-servern, därför används inte Next.js App Router.

xAI Grok för bildanalys (`grok-4.5`) och bildredigering (`grok-imagine-image-2.0`). Stripe Checkout för köp. Neon Postgres i produktion, PGLite i lokal förhandsvisning. IndexedDB för de senaste 10 resultaten.

## Kommandon

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Flöde

1. Anonym HttpOnly-session (`ht_sid`). Servern lagrar en hash av token.
2. Foto normaliseras i webbläsaren (max 1600 px, JPEG, högst ~2 MB).
3. Servern reserverar en bild, analyserar mot en kennelklubbslista och genererar en hund (inte hybrid, inte split).
4. Reservation förbrukas först när en användbar bild finns. Fel och ogiltiga foton släpper reservationen.
5. Historik (max 10) i IndexedDB. Köpt saldo i databasen.

## Betalning

Stripe Checkout, 299 cent, produktnamn `5 hundbilder`. Webhook: `/api/stripe/webhook`. Housekeeping: `GET /api/cron/housekeeping` med `Authorization: Bearer $CRON_SECRET`.

Utan Stripe-nycklar visas ett ärligt blockerat köpläge. Saknad `XAI_API_KEY` ger inga slumpmässiga raser eller exempelbilder.

Återställningskod `HT-XXXX-XXXX-XXXX` visas efter köp. Bildhistoriken är lokal och kan inte molnåterställas.

## Hemligheter

Inga nycklar i klientkod. Se `.env.example`. Sätt dem i Vercel, committa dem inte.

| Variabel | Syfte |
|---|---|
| `XAI_API_KEY` | xAI, server only |
| `XAI_VISION_MODEL` | standard `grok-4.5` |
| `XAI_IMAGE_MODEL` | standard `grok-imagine-image-2.0` |
| `STRIPE_SECRET_KEY` | Checkout + session retrieve |
| `STRIPE_WEBHOOK_SECRET` | signaturverifiering |
| `STRIPE_PRICE_ID` | valfritt; annars `price_data` 299 USD cent |
| `DATABASE_URL` | Neon i produktion |
| `APP_BASE_URL` | Checkout return-URL |
| `CRON_SECRET` | housekeeping |
| `GENERATIONS_ENABLED` | nödstopp |
| `GENERATION_BUDGET_MAX` | globalt tak |
| `SESSION_SECRET` | återställningskoder |

Webhook-endpoint: `https://<domän>/api/stripe/webhook` för både test- och livemiljö, med respektive hemlighet.

## Kostnadskalkyl (uppskattning)

Märkt som uppskattning. Konsumentpriset är 2,99 USD och ändras inte här.

- Bildanalys, Grok Vision: uppskattningsvis någon cent per anrop beroende på bildstorlek.
- Bildgenerering/redigering, 1K: xAI listar omkring 0,04 USD per bild; redigering kan debiteras för både indata och utdata.
- Normala fel/återförsök: max en extra AI-runda, inte en extra saldodragning.
- Stripe: 2,9 % + 0,30 USD på 2,99 USD ≈ 0,39 USD.
- Drift: Vercel + Neon, låg vid v1-volym.
- Gratisbilden betalas av appägaren.

## Databas

Tabellerna täcker anonyma sessioner, köp, genereringsjobb, webhook-idempotens och rate limits. Originalfoton lagras inte. Färdig hundbild buffras högst 24 timmar. Säkerhetskopior hos Neon/xAI/Stripe följer deras egna retention — inte ett 24-timmarslöfte överallt.

Housekeeping rensar utgångna resultat och fastnade reservationer (äldre än 3 minuter) med engångsåterföring.
