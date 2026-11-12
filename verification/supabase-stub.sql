-- TEST ONLY (never run against Supabase): mimics the Supabase bits our migration relies on. Not shipped.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
-- PostgREST connects as `authenticator` and switches into the role named in each request's JWT (what Supabase does).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'authpw' noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
