create table if not exists visitors (
  id text primary key,
  free_remaining integer not null default 1,
  paid_remaining integer not null default 0,
  restore_code_hash text,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id text primary key,
  visitor_id text not null references visitors (id),
  stripe_session_id text not null unique,
  status text not null default 'paid',
  granted integer not null default 5,
  consumed integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists purchases_visitor_id_idx on purchases (visitor_id);

create table if not exists generations (
  id text primary key,
  visitor_id text not null references visitors (id),
  payload_hash text not null,
  status text not null,
  reserved_kind text,
  breed_id text,
  breed_name text,
  reason text,
  result_data text,
  result_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generations_visitor_status_idx on generations (visitor_id, status);
create index if not exists generations_expires_idx on generations (result_expires_at);

create table if not exists webhook_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

create table if not exists rate_events (
  id serial primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_events_key_created_idx on rate_events (key, created_at);

create table if not exists app_counters (
  key text primary key,
  value integer not null default 0,
  updated_at timestamptz not null default now()
);
