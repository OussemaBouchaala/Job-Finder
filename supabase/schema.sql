
create extension if not exists pgcrypto;
create table if not exists public.hosts (
  id text primary key, name text not null, place text, region text, remote_paid boolean not null default false,
  tier text, rank integer not null default 99, kind text, verify boolean not null default false, mode text, pay text,
  why text, apply text, timing text, deadline date, link text, status text not null default 'research', notes text,
  last_checked timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  added_at date default current_date, posted_at date, source text, apply_email text, apply_url text);
create table if not exists public.sync_log (id uuid primary key default gen_random_uuid(), ran_at timestamptz not null default now(), summary text);
create table if not exists public.profile (id text primary key default 'me', base_cv text not null default '', preferences text not null default '', updated_at timestamptz not null default now());
create table if not exists public.match_scores (host_id text primary key references public.hosts(id) on delete cascade, score integer not null, reasons jsonb not null default '[]', gaps jsonb not null default '[]', updated_at timestamptz not null default now());
create table if not exists public.application_docs (id uuid primary key default gen_random_uuid(), host_id text not null references public.hosts(id) on delete cascade, kind text not null, language text not null default 'en', title text, content text not null default '', meta jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists hosts_touch on public.hosts;
create trigger hosts_touch before update on public.hosts for each row execute function public.touch_updated_at();
create or replace function public.is_owner() returns boolean language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'oussema.bouchaala23@gmail.com' $$;
do $$ declare t text; begin
  foreach t in array array['hosts','sync_log','profile','match_scores','application_docs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('drop policy if exists "tmp import" on public.%I', t);
    -- Only the owner's account can read or write; other sign-ups see nothing.
    execute format('create policy "owner all" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop; end $$;
