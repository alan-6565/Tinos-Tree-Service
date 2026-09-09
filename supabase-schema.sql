-- Run this once in the Supabase project's SQL editor (Database -> SQL Editor -> New query).

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('invoice', 'proposal')),
  number integer not null,
  client_name text not null,
  client_address text,
  client_email text,
  client_phone text,
  line_items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists counters (
  type text primary key,
  next_number integer not null
);

insert into counters (type, next_number)
values ('invoice', 1001)
on conflict (type) do nothing;

insert into counters (type, next_number)
values ('proposal', 101)
on conflict (type) do nothing;

-- Atomically returns the next number for a document type
-- and advances the counter.
create or replace function next_document_number(
  doc_type text
)
returns integer
language plpgsql
as $$
declare
  result integer;
begin
  update counters
  set next_number = next_number + 1
  where type = doc_type
  returning next_number - 1 into result;

  if result is null then
    raise exception 'Unknown document type: %', doc_type;
  end if;

  return result;
end;
$$;

alter table documents enable row level security;
alter table counters enable row level security;
