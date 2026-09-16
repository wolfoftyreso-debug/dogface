alter table visitors add column if not exists token_hash text;
create unique index if not exists visitors_token_hash_idx on visitors (token_hash);
