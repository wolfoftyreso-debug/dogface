alter table purchases add column if not exists stripe_payment_intent_id text;
create unique index if not exists purchases_payment_intent_idx
  on purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
