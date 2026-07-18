-- T02 structural coverage: identity, Juntos, invitations, memberships.
-- Sources: docs/architecture/data-model.md §12, docs/architecture/authorization.md §13.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- Core identity and membership tables exist.
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'juntos', 'juntos table exists');
select has_table('public', 'junto_invitations', 'junto_invitations table exists');
select has_table('public', 'junto_members', 'junto_members table exists');

-- RLS is the authorization boundary on every group-scoped table.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.juntos'::regclass),
  'RLS enabled on juntos'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.junto_invitations'::regclass),
  'RLS enabled on junto_invitations'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.junto_members'::regclass),
  'RLS enabled on junto_members'
);

-- Authorization helpers and the claim/signup-gate functions exist.
select has_function('public', 'normalize_email', array['text'], 'normalize_email exists');
select has_function('public', 'claim_invitations', array[]::text[], 'claim_invitations exists');
select has_function('public', 'is_active_member', array['uuid'], 'is_active_member exists');
select has_function('public', 'is_junto_admin', array['uuid'], 'is_junto_admin exists');
select has_function('public', 'shares_active_junto', array['uuid'], 'shares_active_junto exists');
select has_function(
  'public', 'before_user_created_hook', array['jsonb'],
  'before_user_created_hook exists (invitation-gated signup)'
);

-- Email normalization is case-insensitive and whitespace-trimmed
-- (docs/membership/authentication-and-membership.md §3.1).
select is(
  public.normalize_email('Thomas@Example.com'),
  'thomas@example.com',
  'normalize_email lowercases'
);
select is(
  public.normalize_email('  THOMAS@example.com  '),
  'thomas@example.com',
  'normalize_email trims whitespace'
);
select is(
  public.normalize_email(E' \tThomas@EXAMPLE.Com\n'),
  'thomas@example.com',
  'normalize_email handles mixed case and surrounding whitespace together'
);

-- One durable membership per (junto, user) — data-model.md §12 recommended uniqueness.
select col_is_unique(
  'public', 'junto_members', array['junto_id', 'user_id'],
  'junto_members unique on (junto_id, user_id)'
);

-- Only one pending invitation per (junto, normalized email).
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'junto_invitations'
      and indexdef like '%UNIQUE%'
      and indexdef like '%junto_id%'
      and indexdef like '%email_normalized%'
      and indexdef like '%pending%'
  ),
  'unique pending invitation per (junto_id, email_normalized)'
);

-- No automatic profile creation on auth.users: an uninvited verified email
-- must not acquire a profile (approved strict invitation-gated model).
select is(
  (
    select count(*)::int
    from pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgfoid::regproc::text like '%profile%'
  ),
  0,
  'no profile-creating trigger on auth.users'
);

select * from finish();
rollback;
