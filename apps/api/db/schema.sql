create table if not exists trace_runs (
  id text primary key,
  status text not null,
  request jsonb not null,
  result jsonb,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists fraud_cases (
  case_id text primary key,
  slug text not null unique,
  title text not null,
  summary text not null,
  seed jsonb not null,
  trace_id text not null,
  trace_hash text not null,
  trace_snapshot jsonb not null,
  public_uri text not null,
  metadata_hash text not null,
  narrative text not null,
  source_refs jsonb not null,
  anchor jsonb,
  attestations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table fraud_cases add column if not exists trace_hash text;
