-- T04 authorization boundaries for meetings: active same-Junto members read
-- full details, only that Junto's own active admins mutate, nobody deletes,
-- and the public projection serves active public Juntos safely while leaking
-- nothing for private, inactive, or nonexistent Juntos.
-- Sources: docs/architecture/authorization.md §13, docs/membership/user-roles.md §2,
-- docs/content/meetings.md §5.
begin;
create extension if not exists pgtap with schema extensions;

select plan(51);

-- ---------------------------------------------------------------------------
-- Fixtures: Philadelphia (public, active) with admin carol, member bob,
-- inactive member erin, and inactive-admin henry; San Diego (private,
-- active) with admin grace; Ghost (public but INACTIVE); dave is an
-- authenticated outsider with no memberships anywhere.
-- ---------------------------------------------------------------------------

insert into public.juntos (id, name, slug, description, archive_visibility, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'Junto Philadelphia', 'philadelphia', 'First chapter', 'public', 'active'),
  ('00000000-0000-4000-a000-00000000bbbb', 'Junto San Diego', 'san-diego', 'Second chapter', 'private', 'active'),
  ('00000000-0000-4000-a000-00000000cccc', 'Junto Ghost', 'ghost', 'Wound down', 'public', 'inactive');

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'bob@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ca401000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'carol@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'da7e0000-0000-4000-a000-000000000004', 'authenticated', 'authenticated', 'dave@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e0e00000-0000-4000-a000-000000000005', 'authenticated', 'authenticated', 'erin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'baddad00-0000-4000-a000-000000000006', 'authenticated', 'authenticated', 'henry@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '9aace000-0000-4000-a000-000000000008', 'authenticated', 'authenticated', 'grace@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.junto_members (junto_id, user_id, role, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'b0b00000-0000-4000-a000-000000000002', 'member', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'ca401000-0000-4000-a000-000000000003', 'admin', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'e0e00000-0000-4000-a000-000000000005', 'member', 'inactive'),
  ('00000000-0000-4000-a000-00000000aaaa', 'baddad00-0000-4000-a000-000000000006', 'admin', 'inactive'),
  ('00000000-0000-4000-a000-00000000bbbb', '9aace000-0000-4000-a000-000000000008', 'admin', 'active');

-- Meeting history for Philadelphia across every lifecycle status, one
-- private San Diego meeting, and one meeting of the inactive Ghost Junto.
-- Sensitive fields (location, essay_deadline, created_by) are deliberately
-- populated so their absence from public reads is meaningful.
insert into public.meetings
  (id, junto_id, meeting_date, title, theme, description, location, essay_deadline, status, created_by)
values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000aaaa',
   current_date + 30, 'What do we owe the future?', 'Obligation', 'Essays on duty across time.',
   'Carol''s apartment', now() + interval '25 days', 'upcoming', 'ca401000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-00000000aaaa',
   current_date - 60, 'On honest doubt', 'Doubt', 'A completed gathering.',
   'The reading room', now() - interval '65 days', 'completed', 'ca401000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-00000000aaaa',
   current_date + 10, 'Postponed: on weather', null, 'Cancelled for the storm.',
   'Carol''s apartment', null, 'cancelled', 'ca401000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-00000000aaaa',
   current_date - 120, 'The first table', 'Beginnings', 'The founding meeting.',
   'A borrowed kitchen', now() - interval '125 days', 'archived', 'ca401000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-00000000bbbb',
   current_date + 14, 'San Diego private session', null, 'Members only planning.',
   'Grace''s place', now() + interval '10 days', 'upcoming', '9aace000-0000-4000-a000-000000000008'),
  ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-00000000cccc',
   current_date - 200, 'Ghost chapter farewell', null, 'Final gathering.',
   'Old hall', null, 'completed', null);

-- ---------------------------------------------------------------------------
-- 1–4: unauthenticated visitors have no path to the base table
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  'select count(*) from public.meetings',
  '42501', null,
  '1. anonymous visitors cannot read the meetings base table'
);
select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 1)$$,
  '42501', null,
  '2. anonymous visitors cannot create meetings'
);
select throws_ok(
  $$update public.meetings set title = 'hijacked'$$,
  '42501', null,
  '3. anonymous visitors cannot update meetings'
);
select throws_ok(
  $$delete from public.meetings$$,
  '42501', null,
  '4. anonymous visitors cannot delete meetings'
);

-- ---------------------------------------------------------------------------
-- 5–17: the public projection is complete for an active public Junto and
-- silent for everything else
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.public_meetings
    where junto_slug = 'philadelphia'),
  4,
  '5. visitors see the public chapter''s full meeting history'
);

select bag_eq(
  $$select status from public.public_meetings where junto_slug = 'philadelphia'$$,
  $$values ('upcoming'::text), ('completed'), ('cancelled'), ('archived')$$,
  '6. every lifecycle status is represented honestly in the public record'
);

select results_eq(
  $$select title, status from public.public_meetings
     where junto_slug = 'philadelphia' and meeting_date = current_date - 60$$,
  $$values ('On honest doubt'::text, 'completed'::text)$$,
  '7. the public date lookup resolves deterministically to one safe record'
);

select is(
  (select count(*)::int from public.public_meetings
    where junto_slug = 'san-diego'),
  0,
  '8. a private Junto''s meetings never appear publicly'
);

select is(
  (select count(*)::int from public.public_meetings
    where junto_slug = 'ghost'),
  0,
  '9. an inactive Junto''s meetings never appear publicly even if flagged public'
);

select is(
  (select count(*)::int from public.public_meetings
    where junto_slug = 'no-such-junto'),
  0,
  '10. a nonexistent Junto yields the same empty result as a private one'
);

select throws_ok(
  'select location from public.public_meetings',
  '42703', null,
  '11. the projection has no location column to leak'
);
select throws_ok(
  'select essay_deadline from public.public_meetings',
  '42703', null,
  '12. the projection has no essay_deadline column to leak'
);
select throws_ok(
  'select created_by from public.public_meetings',
  '42703', null,
  '13. the projection has no creator identity to leak'
);

-- 55000: the join view is structurally non-updatable, so no write machinery
-- exists at all — and no write privilege is granted either (see
-- meetings_schema test 44).
select throws_ok(
  $$insert into public.public_meetings (junto_slug, meeting_date, status)
    values ('philadelphia', current_date, 'upcoming')$$,
  '55000', null,
  '14. the projection accepts no inserts'
);
select throws_ok(
  $$update public.public_meetings set title = 'hijacked'$$,
  '55000', null,
  '15. the projection accepts no updates'
);
select throws_ok(
  $$delete from public.public_meetings$$,
  '55000', null,
  '16. the projection accepts no deletes'
);

select ok(
  exists (
    select 1 from public.public_meetings
     where junto_slug = 'philadelphia'
       and status = 'archived'
       and meeting_date = current_date - 120
  ),
  '17. an archived meeting remains publicly addressable history'
);

reset role;

-- ---------------------------------------------------------------------------
-- 18–24: an active member reads full details in their own Junto only, and
-- can mutate nothing
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'b0b00000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.meetings
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  4,
  '18. an active member sees every meeting of their own Junto'
);

select ok(
  (select location = 'Carol''s apartment' and essay_deadline is not null
     from public.meetings
    where id = '00000000-0000-4000-b000-000000000001'),
  '19. a member reads the full private details, location and deadline included'
);

select is(
  (select count(*)::int from public.meetings
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'),
  0,
  '20. a member sees no meetings of another Junto'
);

select results_eq(
  $$select id from public.meetings
     where junto_id = '00000000-0000-4000-a000-00000000aaaa'
       and status = 'upcoming' and meeting_date >= current_date
     order by meeting_date$$,
  $$values ('00000000-0000-4000-b000-000000000001'::uuid)$$,
  '21. only genuinely upcoming meetings qualify as next — never cancelled, ' ||
  'completed, or archived ones'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 3)$$,
  '42501', null,
  '22. an ordinary member cannot create meetings'
);

with attempt as (
     update public.meetings set title = 'hijacked'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '23. an ordinary member cannot edit meetings'
);

select throws_ok(
  $$delete from public.meetings
     where id = '00000000-0000-4000-b000-000000000001'$$,
  '42501', null,
  '24. an ordinary member cannot delete meetings'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 25–28: an authenticated outsider gets nothing beyond the public projection
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'da7e0000-0000-4000-a000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.meetings),
  0,
  '25. an authenticated non-member sees no meeting rows at all'
);

select is(
  (select count(*)::int from public.public_meetings
    where junto_slug = 'philadelphia'),
  4,
  '26. the safe public projection remains available to authenticated users'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 4)$$,
  '42501', null,
  '27. an outsider cannot create meetings anywhere'
);

with attempt as (
     update public.meetings set title = 'hijacked'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '28. an outsider cannot edit meetings anywhere'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 29–36: admin authority is scoped to the admin's own Junto, and identity/
-- provenance columns are immutable even for admins
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '9aace000-0000-4000-a000-000000000008', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.meetings
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  0,
  '29. a San Diego admin reads no Philadelphia meeting rows'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 5)$$,
  '42501', null,
  '30. a San Diego admin cannot create meetings in Philadelphia'
);

with attempt as (
     update public.meetings set title = 'hijacked'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '31. a San Diego admin cannot edit Philadelphia meetings'
);

select lives_ok(
  $$insert into public.meetings (junto_id, meeting_date, title)
    values ('00000000-0000-4000-a000-00000000bbbb', current_date + 45,
            'San Diego planning')$$,
  '32. a Junto admin schedules meetings in their own Junto'
);

select is(
  (select created_by from public.meetings
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'
      and meeting_date = current_date + 45),
  '9aace000-0000-4000-a000-000000000008'::uuid,
  '33. created_by derives from the authenticated admin, not client input'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date, created_by)
    values ('00000000-0000-4000-a000-00000000bbbb', current_date + 46,
            'da7e0000-0000-4000-a000-000000000004')$$,
  '42501', null,
  '34. creator identity can never be client-supplied'
);

select throws_ok(
  $$update public.meetings
      set junto_id = '00000000-0000-4000-a000-00000000aaaa'
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'$$,
  '42501', null,
  '35. a meeting cannot be moved to another Junto through ordinary update'
);

select throws_ok(
  $$update public.meetings
      set created_by = 'da7e0000-0000-4000-a000-000000000004'
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'$$,
  '42501', null,
  '36. a meeting cannot be re-attributed through ordinary update'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 37–40: inactive memberships confer nothing, member or admin
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'e0e00000-0000-4000-a000-000000000005', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.meetings),
  0,
  '37. an inactive member reads no meeting rows'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'baddad00-0000-4000-a000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.meetings),
  0,
  '38. an inactive admin reads no meeting rows'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 6)$$,
  '42501', null,
  '39. an inactive admin cannot create meetings'
);

with attempt as (
     update public.meetings set title = 'hijacked'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '40. an inactive admin cannot edit meetings'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 41–48: the selected Junto's own admin manages the full lifecycle — but
-- never deletes
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$insert into public.meetings
      (junto_id, meeting_date, title, theme, location, essay_deadline)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 90,
            'Autumn session', 'Attention', 'Carol''s apartment',
            now() + interval '85 days')$$,
  '41. the Philadelphia admin schedules a Philadelphia meeting'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', current_date + 30)$$,
  '23505', null,
  '42. the same date cannot be double-booked within the Junto'
);

with attempt as (
     update public.meetings
        set title = 'What do we owe the future? (revised)',
            location = 'The back room at Fergie''s',
            essay_deadline = now() + interval '20 days'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '43. the Junto admin edits meeting details'
);

with attempt as (
     update public.meetings set status = 'completed'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '44. the Junto admin marks a meeting completed'
);

with attempt as (
     update public.meetings set status = 'cancelled'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '45. the Junto admin cancels a meeting'
);

with attempt as (
     update public.meetings set status = 'upcoming'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '46. the Junto admin reopens a meeting as upcoming'
);

with attempt as (
     update public.meetings set status = 'archived'
      where id = '00000000-0000-4000-b000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '47. the Junto admin archives a meeting — a status change, not a delete'
);

select throws_ok(
  $$delete from public.meetings
     where id = '00000000-0000-4000-b000-000000000004'$$,
  '42501', null,
  '48. even the Junto admin has no destructive delete path'
);

-- ---------------------------------------------------------------------------
-- 49–51: archive semantics — the record survives, leaves the upcoming
-- program, and remains part of safe public history
-- ---------------------------------------------------------------------------

select ok(
  (select status = 'archived' and location = 'The back room at Fergie''s'
     from public.meetings
    where id = '00000000-0000-4000-b000-000000000001'),
  '49. the archived record survives intact, private details preserved'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'b0b00000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select ok(
  (select count(*) = 0 from public.meetings
     where id = '00000000-0000-4000-b000-000000000001'
       and status = 'upcoming' and meeting_date >= current_date)
  and exists (
    select 1 from public.meetings
     where id = '00000000-0000-4000-b000-000000000001'),
  '50. an archived meeting leaves the upcoming program yet stays readable ' ||
  'to members'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select ok(
  exists (
    select 1 from public.public_meetings
     where junto_slug = 'philadelphia'
       and meeting_date = current_date + 30
       and status = 'archived'
  ),
  '51. the archived meeting''s public history page remains addressable'
);

reset role;

select * from finish();
rollback;
