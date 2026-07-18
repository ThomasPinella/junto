-- Foundation smoke test for the local Supabase stack, run via `pnpm test:db`
-- (`supabase test db`, which requires `pnpm db:start` first).
-- T01 ships no product schema; T02 introduces domain tables, policies, and
-- their pgTAP coverage alongside versioned migrations.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

-- The platform schemas the product will build on must exist.
select has_schema('public');
select has_schema('auth');
select has_schema('storage');

select * from finish();
rollback;
