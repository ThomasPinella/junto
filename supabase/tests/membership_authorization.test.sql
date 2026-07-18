-- T02 authorization boundaries: active memberships authorize each Junto
-- independently, admin authority is Junto-scoped, deactivation revokes
-- private access immediately, and unauthenticated/cross-user/cross-Junto
-- access is denied.
-- Sources: docs/architecture/authorization.md §13, docs/membership/user-roles.md §2,
-- docs/membership/authentication-and-membership.md §3.4.
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

-- ---------------------------------------------------------------------------
-- Fixtures: two Juntos, a member (bob) and admin (carol) in Philadelphia,
-- an admin (grace) in San Diego, an uninvited user (dave), and alice, who
-- claims memberships in both Juntos.
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
  ('00000000-0000-0000-0000-000000000000', '9aace000-0000-4000-a000-000000000008', 'authenticated', 'authenticated', 'grace@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.junto_members (junto_id, user_id, role, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'b0b00000-0000-4000-a000-000000000002', 'member', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'ca401000-0000-4000-a000-000000000003', 'admin', 'active'),
  ('00000000-0000-4000-a000-00000000bbbb', '9aace000-0000-4000-a000-000000000008', 'admin', 'active');

insert into public.junto_invitations (id, junto_id, email_normalized, invited_by, role, expires_at)
values
  ('11111111-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000aaaa', 'alice@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000bbbb', 'alice@example.com', '9aace000-0000-4000-a000-000000000008', 'member', null),
  ('11111111-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000aaaa', 'invitee@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000004', '00000000-0000-4000-a000-00000000aaaa', 'frank@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', null),
  ('11111111-0000-4000-a000-000000000005', '00000000-0000-4000-a000-00000000aaaa', 'expired@example.com', 'ca401000-0000-4000-a000-000000000003', 'member', now() - interval '1 hour');

-- alice claims both memberships before the boundary tests.
select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform count(*) from public.claim_invitations();
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 1–5: unauthenticated access
-- ---------------------------------------------------------------------------

set local role anon;

select results_eq(
  $$select slug from public.juntos order by slug$$,
  $$values ('philadelphia'::text)$$,
  '1. anonymous visitors see only active public Juntos'
);

select throws_ok(
  'select count(*) from public.junto_members',
  '42501',
  null,
  '2. anonymous visitors cannot read memberships'
);

select throws_ok(
  'select count(*) from public.junto_invitations',
  '42501',
  null,
  '3. anonymous visitors cannot read invitations'
);

select throws_ok(
  'select count(*) from public.profiles',
  '42501',
  null,
  '4. anonymous visitors cannot read profiles'
);

select throws_ok(
  $$update public.juntos set name = 'hijacked'$$,
  '42501',
  null,
  '5. anonymous visitors cannot write Junto records'
);

reset role;

-- ---------------------------------------------------------------------------
-- 6–10: authenticated-but-unentitled versus member visibility
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'da7e0000-0000-4000-a000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select results_eq(
  $$select slug from public.juntos order by slug$$,
  $$values ('philadelphia'::text)$$,
  '6. an authenticated non-member sees only active public Juntos'
);

select is(
  (select count(*)::int from public.junto_members),
  0,
  '7. an authenticated non-member sees no membership rows'
);

select is(
  (select count(*)::int from public.junto_invitations),
  0,
  '8. an authenticated non-member sees no invitations'
);

select is(
  (select count(*)::int from public.profiles),
  0,
  '9. an authenticated non-member sees no member profiles'
);

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);

select results_eq(
  $$select slug from public.juntos order by slug$$,
  $$values ('philadelphia'::text), ('san-diego'::text)$$,
  '10. a member sees their private-archive Junto alongside public ones'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 11–19: ordinary member boundaries (bob, member of Philadelphia)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'b0b00000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  3,
  '11. an active member sees the active members of their own Junto'
);

select is(
  (select count(*)::int from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'),
  0,
  '12. an active member sees no membership rows of another Junto'
);

select is(
  (select count(*)::int from public.junto_invitations),
  0,
  '13. an ordinary member sees no invitations'
);

select is(
  (select count(*)::int from public.profiles
    where id = 'a11ce000-0000-4000-a000-000000000001'),
  1,
  '14. an active member can read a co-member profile in a shared Junto'
);

with attempt as (
     update public.profiles set display_name = 'hijacked'
      where id = 'a11ce000-0000-4000-a000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '15. a member cannot modify another member''s profile'
);

with attempt as (
     update public.junto_members set role = 'admin'
      where user_id = 'b0b00000-0000-4000-a000-000000000002'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '16. a member cannot escalate their own role'
);

with attempt as (
     update public.junto_members set status = 'inactive'
      where user_id = 'ca401000-0000-4000-a000-000000000003'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '17. a member cannot deactivate another membership'
);

select throws_ok(
  $$insert into public.junto_invitations (junto_id, email_normalized)
    values ('00000000-0000-4000-a000-00000000aaaa', 'friend@example.com')$$,
  '42501',
  null,
  '18. an ordinary member cannot create invitations'
);

with attempt as (
     update public.juntos set description = 'hijacked'
      where id = '00000000-0000-4000-a000-00000000aaaa'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '19. an ordinary member cannot change Junto settings'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 20–26: Junto-scoped admin authority over invitations (carol, Philadelphia)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$insert into public.junto_invitations (junto_id, email_normalized)
    values ('00000000-0000-4000-a000-00000000aaaa', ' NewMember@Example.com ')$$,
  '20. a Junto admin can invite into their own Junto'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select invited_by from public.junto_invitations
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and email_normalized = 'newmember@example.com'),
  'ca401000-0000-4000-a000-000000000003'::uuid,
  '21. invited_by is derived from the authenticated admin, not client input'
);

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.junto_invitations
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  5,
  '22. a Junto admin sees all invitations of their own Junto'
);

select is(
  (select count(*)::int from public.junto_invitations
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'),
  0,
  '23. a Junto admin sees no invitations of another Junto'
);

select throws_ok(
  $$insert into public.junto_invitations (junto_id, email_normalized)
    values ('00000000-0000-4000-a000-00000000bbbb', 'intruder@example.com')$$,
  '42501',
  null,
  '24. a Junto admin cannot invite into another Junto'
);

with attempt as (
     update public.junto_invitations set status = 'revoked'
      where id = '11111111-0000-4000-a000-000000000003'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '25. a Junto admin can revoke a pending invitation in their Junto'
);

select throws_ok(
  $$update public.junto_invitations set status = 'claimed'
     where id = '11111111-0000-4000-a000-000000000004'$$,
  '42501',
  null,
  '26. an admin cannot forge claim evidence by direct update'
);

-- ---------------------------------------------------------------------------
-- 27–34: deactivation revokes access immediately; reactivation restores it
-- ---------------------------------------------------------------------------

with attempt as (
     update public.junto_members set status = 'inactive'
      where junto_id = '00000000-0000-4000-a000-00000000aaaa'
        and user_id = 'b0b00000-0000-4000-a000-000000000002'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '27. a Junto admin can deactivate a membership in their Junto'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select status = 'inactive' and deactivated_at is not null
     from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and user_id = 'b0b00000-0000-4000-a000-000000000002'),
  '28. deactivation records status and deactivated_at'
);

select set_config('request.jwt.claims',
  json_build_object('sub', 'b0b00000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  public.is_active_member('00000000-0000-4000-a000-00000000aaaa'),
  false,
  '29. a deactivated member immediately loses active-membership authorization'
);

select is(
  (select count(*)::int from public.junto_members),
  1,
  '30. a deactivated member sees only their own membership row'
);

select is(
  (select count(*)::int from public.profiles
    where id = 'a11ce000-0000-4000-a000-000000000001'),
  0,
  '31. a deactivated member immediately loses co-member profile access'
);

select is(
  (select count(*)::int from public.juntos where slug = 'philadelphia'),
  1,
  '32. a deactivated member still sees the public Junto page data'
);

reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

with attempt as (
     update public.junto_members set status = 'active'
      where junto_id = '00000000-0000-4000-a000-00000000aaaa'
        and user_id = 'b0b00000-0000-4000-a000-000000000002'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '33. a Junto admin can reactivate a membership in their Junto'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select status = 'active' and deactivated_at is null
     from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and user_id = 'b0b00000-0000-4000-a000-000000000002'),
  '34. reactivation clears deactivated_at'
);

-- ---------------------------------------------------------------------------
-- 35–43: memberships are independent per Junto; account survives deactivation
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

with attempt as (
     update public.junto_members set status = 'inactive'
      where junto_id = '00000000-0000-4000-a000-00000000aaaa'
        and user_id = 'a11ce000-0000-4000-a000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '35. the Philadelphia admin deactivates alice''s Philadelphia membership'
);

select is(
  (select count(*)::int from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and user_id = 'a11ce000-0000-4000-a000-000000000001'),
  1,
  '36. an admin still sees inactive membership rows of their Junto'
);

reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  public.is_active_member('00000000-0000-4000-a000-00000000aaaa'),
  false,
  '37. alice immediately loses Philadelphia authorization'
);

select is(
  public.is_active_member('00000000-0000-4000-a000-00000000bbbb'),
  true,
  '38. alice''s San Diego membership is unaffected'
);

select is(
  (select count(*)::int from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'),
  2,
  '39. alice still sees San Diego''s active members'
);

with attempt as (
     update public.profiles set display_name = 'Alice'
      where id = 'a11ce000-0000-4000-a000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '40. alice''s account and own profile remain intact after one deactivation'
);

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$insert into public.junto_invitations (junto_id, email_normalized)
    values ('00000000-0000-4000-a000-00000000aaaa', ' ALICE@example.COM ')$$,
  '41. an admin can re-invite a deactivated member'
);

reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.claim_invitations()),
  1,
  '42. the re-invited member claims and is reactivated'
);

reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select count(*) = 2 from public.junto_members
    where user_id = 'a11ce000-0000-4000-a000-000000000001')
  and exists (
    select 1 from public.junto_members
     where junto_id = '00000000-0000-4000-a000-00000000aaaa'
       and user_id = 'a11ce000-0000-4000-a000-000000000001'
       and status = 'active' and deactivated_at is null),
  '43. reactivation reuses the durable membership record without duplication'
);

-- ---------------------------------------------------------------------------
-- 44–47: admin authority never crosses Juntos
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

with attempt as (
     update public.junto_members set status = 'inactive'
      where junto_id = '00000000-0000-4000-a000-00000000bbbb'
        and user_id = '9aace000-0000-4000-a000-000000000008'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '44. a Philadelphia admin cannot deactivate a San Diego membership'
);

with attempt as (
     update public.juntos set description = 'managed'
      where id = '00000000-0000-4000-a000-00000000aaaa'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '1',
  '45. a Junto admin can update their own Junto''s settings'
);

with attempt as (
     update public.juntos set description = 'hijacked'
      where id = '00000000-0000-4000-a000-00000000bbbb'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(current_setting('junto.test_rows', true), '0',
  '46. a Junto admin cannot update another Junto''s settings'
);

reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', '9aace000-0000-4000-a000-000000000008', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.junto_members
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  0,
  '47. a San Diego admin sees no Philadelphia membership rows'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 48–50: profiles and memberships exist only through claiming — clients can
-- never insert or delete them directly
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'da7e0000-0000-4000-a000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.profiles (id, display_name, slug)
    values ('da7e0000-0000-4000-a000-000000000004', 'Dave', 'dave')$$,
  '42501',
  null,
  '48. an authenticated user cannot create their own profile directly'
);

select throws_ok(
  $$insert into public.junto_members (junto_id, user_id)
    values ('00000000-0000-4000-a000-00000000aaaa', 'da7e0000-0000-4000-a000-000000000004')$$,
  '42501',
  null,
  '49. an authenticated user cannot create a membership directly'
);

select throws_ok(
  $$delete from public.junto_members$$,
  '42501',
  null,
  '50. an authenticated user cannot delete membership records'
);

reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
