-- T01 chapter bootstrap: authorization, atomicity, least-privilege grants,
-- fail-closed inputs, and cross-Junto isolation.
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

insert into public.juntos (id, name, slug, archive_visibility, status)
values
  ('71000000-0000-4000-a000-000000000001', 'Junto Alder', 'alder', 'private', 'active'),
  ('71000000-0000-4000-a000-000000000002', 'Junto Birch', 'birch', 'private', 'active');

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-a000-000000000011', 'authenticated', 'authenticated', 'alder-admin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-a000-000000000012', 'authenticated', 'authenticated', 'alder-member@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-a000-000000000013', 'authenticated', 'authenticated', 'former-admin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-a000-000000000014', 'authenticated', 'authenticated', 'birch-admin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.junto_members (junto_id, user_id, role, status)
values
  ('71000000-0000-4000-a000-000000000001', '71000000-0000-4000-a000-000000000011', 'admin', 'active'),
  ('71000000-0000-4000-a000-000000000001', '71000000-0000-4000-a000-000000000012', 'member', 'active'),
  ('71000000-0000-4000-a000-000000000001', '71000000-0000-4000-a000-000000000013', 'admin', 'inactive'),
  ('71000000-0000-4000-a000-000000000002', '71000000-0000-4000-a000-000000000014', 'admin', 'active');

select has_function(
  'public',
  'bootstrap_junto',
  array['text', 'text', 'text', 'text', 'text'],
  '1. the chapter bootstrap RPC exists with only metadata inputs'
);

select ok(
  (select p.prosecdef from pg_proc p
    where p.oid = 'public.bootstrap_junto(text,text,text,text,text)'::regprocedure),
  '2. the RPC is security definer for its atomic privileged writes'
);

select ok(
  (select 'search_path=""' = any(p.proconfig) from pg_proc p
    where p.oid = 'public.bootstrap_junto(text,text,text,text,text)'::regprocedure),
  '3. the privileged RPC pins an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.bootstrap_junto(text,text,text,text,text)',
    'execute'
  ),
  '4. authenticated requests may invoke the RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.bootstrap_junto(text,text,text,text,text)',
    'execute'
  ),
  '5. anonymous requests have no execute grant'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.bootstrap_junto(text,text,text,text,text)',
    'execute'
  ),
  '6. the application service role has no bootstrap path'
);

select is(
  (select count(*)::int from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'bootstrap_junto'
      and grantee = 'PUBLIC'),
  0,
  '7. PUBLIC retains no implicit execute privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.juntos', 'insert'),
  '8. authenticated clients cannot bypass the RPC with direct inserts'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$select * from public.bootstrap_junto('  Junto Maple  ', 'maple', '  A new table.  ', '  Center City  ')$$,
  '9. an eligible active admin can bootstrap a chapter'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select name || '|' || archive_visibility || '|' || description || '|' || location
     from public.juntos where slug = 'maple'),
  'Junto Maple|private|A new table.|Center City',
  '10. bootstrap trims metadata and defaults the archive to private'
);

select is(
  (select role || '|' || status from public.junto_members
    where junto_id = (select id from public.juntos where slug = 'maple')
      and user_id = '71000000-0000-4000-a000-000000000011'),
  'admin|active',
  '11. the creator becomes the first active admin'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$select * from public.bootstrap_junto('Junto Cedar', 'cedar', null, null, 'public')$$,
  '12. the creator may explicitly choose a public archive'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select archive_visibility from public.juntos where slug = 'cedar'),
  'public',
  '13. explicit public visibility is persisted'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$select * from public.bootstrap_junto('Duplicate Maple', 'maple')$$,
  '23505', null,
  '14. a duplicate slug is rejected by the unique constraint'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.juntos where slug = 'maple'),
  1,
  '15. duplicate failure leaves the existing chapter unchanged'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$select * from public.bootstrap_junto('Bad Slug', 'Bad Slug')$$,
  '22023', null,
  '16. malformed slugs fail at the database boundary'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Null visibility', 'null-visibility', null, null, null)$$,
  '22023', null,
  '17. explicit null visibility fails closed rather than becoming public or private'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Reserved route', 'sign-in')$$,
  '22023', null,
  '18. the static portal sign-in slug is reserved at the RPC boundary'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.juntos
    where slug in ('Bad Slug', 'null-visibility', 'sign-in')),
  0,
  '19. invalid and reserved inputs create no orphan chapter'
);

select set_config(
  'junto.test_chapter_snapshot',
  (select md5(string_agg(to_jsonb(j)::text, ',' order by j.id))
     from public.juntos j),
  true
);
select set_config(
  'junto.test_membership_snapshot',
  (select md5(string_agg(to_jsonb(m)::text, ',' order by m.id))
     from public.junto_members m),
  true
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000012', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$select * from public.bootstrap_junto('Private slug probe', 'birch')$$,
  '42501', null,
  '20. ordinary-member authorization wins before an existing private slug probe'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Malformed probe', 'Bad Slug')$$,
  '42501', null,
  '21. ordinary-member authorization wins before malformed slug validation'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Reserved probe', 'sign-in')$$,
  '42501', null,
  '22. ordinary-member authorization wins before reserved slug validation'
);

select throws_ok(
  $$select * from public.bootstrap_junto(null, null, null, null, null)$$,
  '42501', null,
  '23. ordinary-member authorization wins before null-input validation'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select md5(string_agg(to_jsonb(j)::text, ',' order by j.id))
     from public.juntos j),
  current_setting('junto.test_chapter_snapshot'),
  '24. ordinary-member denials create or alter no chapter rows'
);

select is(
  (select md5(string_agg(to_jsonb(m)::text, ',' order by m.id))
     from public.junto_members m),
  current_setting('junto.test_membership_snapshot'),
  '25. ordinary-member denials create or alter no membership rows'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000013', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$select * from public.bootstrap_junto('Private slug probe', 'birch')$$,
  '42501', null,
  '26. inactive-admin authorization wins before an existing private slug probe'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Malformed probe', 'Bad Slug')$$,
  '42501', null,
  '27. inactive-admin authorization wins before malformed slug validation'
);

select throws_ok(
  $$select * from public.bootstrap_junto('Reserved probe', 'sign-in')$$,
  '42501', null,
  '28. inactive-admin authorization wins before reserved slug validation'
);

select throws_ok(
  $$select * from public.bootstrap_junto(null, null, null, null, null)$$,
  '42501', null,
  '29. inactive-admin authorization wins before null-input validation'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select md5(string_agg(to_jsonb(j)::text, ',' order by j.id))
     from public.juntos j),
  current_setting('junto.test_chapter_snapshot'),
  '30. inactive-admin denials create or alter no chapter rows'
);

select is(
  (select md5(string_agg(to_jsonb(m)::text, ',' order by m.id))
     from public.junto_members m),
  current_setting('junto.test_membership_snapshot'),
  '31. inactive-admin denials create or alter no membership rows'
);

set local role authenticated;
select throws_ok(
  $$select * from public.bootstrap_junto('No identity', 'no-identity')$$,
  '42501', null,
  '32. an authenticated database role without auth.uid() is denied'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.bootstrap_junto('Anonymous', 'anonymous-attempt')$$,
  '42501', null,
  '33. an unauthenticated request cannot execute the RPC'
);
reset role;

create function public.fail_atomic_bootstrap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.juntos j
     where j.id = new.junto_id and j.slug = 'atomic-failure'
  ) then
    raise exception 'forced membership failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger fail_atomic_bootstrap
  before insert on public.junto_members
  for each row execute function public.fail_atomic_bootstrap();

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$select * from public.bootstrap_junto('Atomic failure', 'atomic-failure')$$,
  '23514', null,
  '34. a forced first-membership failure aborts bootstrap'
);

reset role;
select set_config('request.jwt.claims', '', true);
drop trigger fail_atomic_bootstrap on public.junto_members;
drop function public.fail_atomic_bootstrap();

select is(
  (select count(*)::int from public.juntos where slug = 'atomic-failure'),
  0,
  '35. atomic failure leaves no orphan Junto row'
);

select is(
  (select count(*)::int from public.junto_members m
    join public.juntos j on j.id = m.junto_id
    where j.slug = 'atomic-failure'),
  0,
  '36. atomic failure leaves no partial membership'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000014', 'role', 'authenticated')::text, true);
set local role authenticated;

with attempt as (
  update public.juntos set name = 'Cross-Junto hijack'
   where slug = 'maple' returning 1
)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);

select is(
  current_setting('junto.test_rows', true),
  '0',
  '37. another chapter admin cannot update the new chapter settings'
);

select is(
  (select count(*)::int from public.juntos where slug = 'maple'),
  0,
  '38. another chapter admin cannot read the private new chapter'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000012', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.juntos where slug = 'maple'),
  0,
  '39. an ordinary member of the source chapter cannot read the new chapter'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', '71000000-0000-4000-a000-000000000011', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.juntos where slug in ('alder', 'maple')),
  2,
  '40. the creator reads both independently authorized memberships'
);

select throws_ok(
  $$insert into public.juntos (name, slug) values ('Direct', 'direct')$$,
  '42501', null,
  '41. an eligible admin still cannot bypass bootstrap with a direct insert'
);

reset role;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$update public.juntos set slug = 'sign-in' where slug = 'alder'$$,
  '23514', null,
  '42. the table boundary blocks a trusted direct reserved-slug update'
);

select is(
  (select slug from public.juntos
    where id = '71000000-0000-4000-a000-000000000001'),
  'alder',
  '43. the rejected direct update leaves the chapter slug unchanged'
);

select throws_ok(
  $$insert into public.juntos (name, slug) values (repeat('x', 121), 'oversized')$$,
  '23514', null,
  '44. additive database bounds protect direct trusted writes too'
);

select is(
  (select count(*)::int from public.juntos
    where id in (
      '71000000-0000-4000-a000-000000000001',
      '71000000-0000-4000-a000-000000000002'
    )),
  2,
  '45. seed chapter rows remain intact throughout the suite'
);

select * from finish();
rollback;
