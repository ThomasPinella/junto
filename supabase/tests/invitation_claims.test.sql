-- T02 invitation claiming: normalized-email matching, verified-identity-only
-- claims, historical claim evidence, durable memberships, duplicate claims,
-- and the invitation-gated signup hook.
-- Sources: docs/membership/authentication-and-membership.md §3,
-- docs/architecture/authorization.md §13, docs/implementation/critical-journeys.md §17.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (created as the privileged migration owner, rolled back at the end)
-- ---------------------------------------------------------------------------

insert into public.juntos (id, name, slug, description, archive_visibility, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'Junto Philadelphia', 'philadelphia', 'First chapter', 'public', 'active'),
  ('00000000-0000-4000-a000-00000000bbbb', 'Junto San Diego', 'san-diego', 'Second chapter', 'private', 'active');

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a11ce000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'Alice@Example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'bob@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ca401000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'carol@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'da7e0000-0000-4000-a000-000000000004', 'authenticated', 'authenticated', 'dave@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e4110000-0000-4000-a000-000000000005', 'authenticated', 'authenticated', 'erin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f4a10000-0000-4000-a000-000000000006', 'authenticated', 'authenticated', 'frank@example.com', null, '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0e140000-0000-4000-a000-000000000007', 'authenticated', 'authenticated', 'expired@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '9aace000-0000-4000-a000-000000000008', 'authenticated', 'authenticated', 'grace@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.junto_members (junto_id, user_id, role, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'b0b00000-0000-4000-a000-000000000002', 'member', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'ca401000-0000-4000-a000-000000000003', 'admin', 'active'),
  ('00000000-0000-4000-a000-00000000bbbb', '9aace000-0000-4000-a000-000000000008', 'admin', 'active');

insert into public.junto_invitations (id, junto_id, email_normalized, invited_by, role, expires_at)
values
  ('11111111-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000aaaa', '  Alice@Example.COM  ', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000bbbb', 'alice@example.com', '9aace000-0000-4000-a000-000000000008', 'member', null),
  ('11111111-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000aaaa', 'invitee@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000004', '00000000-0000-4000-a000-00000000aaaa', 'frank@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000005', '00000000-0000-4000-a000-00000000aaaa', 'expired@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', now() - interval '1 hour');

-- ---------------------------------------------------------------------------
-- 1–2: normalized-email storage and pending uniqueness
-- ---------------------------------------------------------------------------

select is(
  (select email_normalized from public.junto_invitations
    where id = '11111111-0000-4000-a000-000000000001'),
  'alice@example.com',
  '1. invitation email is stored trimmed and lowercased'
);

select throws_ok(
  $$insert into public.junto_invitations (junto_id, email_normalized)
    values ('00000000-0000-4000-a000-00000000aaaa', ' ALICE@example.com ')$$,
  '23505',
  null,
  '2. a second pending invitation for the same (junto, normalized email) is rejected'
);

-- ---------------------------------------------------------------------------
-- 3–5: uninvited verified user claims nothing and acquires nothing
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'da7e0000-0000-4000-a000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  0,
  '3. uninvited verified user claims nothing'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.profiles where id = 'da7e0000-0000-4000-a000-000000000004'),
  0,
  '4. uninvited verified user acquires no profile'
);

select is(
  (select count(*)::int from public.junto_members where user_id = 'da7e0000-0000-4000-a000-000000000004'),
  0,
  '5. uninvited verified user acquires no membership'
);

-- ---------------------------------------------------------------------------
-- 6–7: a different verified email cannot steal a pending invitation
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'e4110000-0000-4000-a000-000000000005', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  0,
  '6. mismatched verified email claims nothing (invitation theft prevented)'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select status = 'pending' and claimed_by is null and claimed_at is null
     from public.junto_invitations where id = '11111111-0000-4000-a000-000000000003'),
  '7. the mismatched invitation remains pending and unclaimed'
);

-- ---------------------------------------------------------------------------
-- 8–9: an unverified email cannot claim its own invitation
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'f4a10000-0000-4000-a000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  0,
  '8. unverified email claims nothing even with a matching invitation'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select status = 'pending' and claimed_by is null
     from public.junto_invitations where id = '11111111-0000-4000-a000-000000000004'),
  '9. the unverified user''s invitation remains pending'
);

-- ---------------------------------------------------------------------------
-- 10–11: expired invitations are not claimable
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '0e140000-0000-4000-a000-000000000007', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  0,
  '10. expired invitation is not claimable'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select claimed_by is null and claimed_at is null
     from public.junto_invitations where id = '11111111-0000-4000-a000-000000000005'),
  '11. the expired invitation records no claim'
);

-- ---------------------------------------------------------------------------
-- 12–15: successful claim — normalized matching, multiple memberships,
-- historical evidence, and profile creation
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select results_eq(
  $$select junto_id, member_role from public.claim_invitations()$$,
  $$values ('00000000-0000-4000-a000-00000000aaaa'::uuid, 'member'::text),
           ('00000000-0000-4000-a000-00000000bbbb'::uuid, 'member'::text)$$,
  '12. verified user claims all matching invitations across Juntos in one call'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.junto_members
    where user_id = 'a11ce000-0000-4000-a000-000000000001' and status = 'active'),
  2,
  '13. claiming created two independent active memberships'
);

select is(
  (select count(*)::int from public.junto_invitations
    where claimed_by = 'a11ce000-0000-4000-a000-000000000001'
      and status = 'claimed' and claimed_at is not null),
  2,
  '14. claims recorded historical evidence (claimed_by, claimed_at, status)'
);

select results_eq(
  $$select display_name, slug from public.profiles
     where id = 'a11ce000-0000-4000-a000-000000000001'$$,
  $$values ('alice'::text, 'alice'::text)$$,
  '15. claiming created the member profile'
);

-- ---------------------------------------------------------------------------
-- 16–18: duplicate claim is a safe no-op
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  0,
  '16. a second claim call returns nothing new'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.junto_members
    where user_id = 'a11ce000-0000-4000-a000-000000000001' and status = 'active'),
  2,
  '17. duplicate claim left exactly two active memberships'
);

select is(
  (select count(*)::int from public.junto_invitations
    where claimed_by = 'a11ce000-0000-4000-a000-000000000001'),
  2,
  '18. duplicate claim recorded no additional claim evidence'
);

-- ---------------------------------------------------------------------------
-- 19–20: unauthenticated denial
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  'select * from public.claim_invitations()',
  '42501',
  null,
  '19. anonymous role cannot execute claim_invitations'
);

reset role;
set local role authenticated;

select throws_ok(
  'select * from public.claim_invitations()',
  '42501',
  null,
  '20. authenticated role without a JWT identity cannot claim'
);

reset role;

-- ---------------------------------------------------------------------------
-- 21–25: invitation-gated signup hook (before_user_created)
-- ---------------------------------------------------------------------------

select is(
  public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('email', 'dave@example.com'))
  ) -> 'error' ->> 'http_code',
  '403',
  '21. signup hook rejects an email with no invitation'
);

select is(
  public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('email', '  INVITEE@Example.com '))
  ),
  '{}'::jsonb,
  '22. signup hook admits a pending invitee with normalized matching'
);

select ok(
  public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('email', 'alice@example.com'))
  ) ? 'error',
  '23. signup hook rejects an already-claimed invitation email'
);

select ok(
  public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('email', 'expired@example.com'))
  ) ? 'error',
  '24. signup hook rejects an expired invitation email'
);

select is(
  public.before_user_created_hook(jsonb_build_object('email', 'invitee@example.com')),
  '{}'::jsonb,
  '25. signup hook also accepts the top-level email payload shape'
);

select * from finish();
rollback;
