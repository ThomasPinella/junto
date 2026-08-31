-- Chapter applications: anonymous submit-only privacy, exact verified reviewer
-- authorization, and atomic approval/decline behavior.
begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a9000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'TXPINELLA@GMAIL.COM', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a9000000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'ordinary@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

select has_table('public', 'chapter_applications', '1. the private application table exists');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.chapter_applications'::regclass),
  '2. row level security is enabled'
);
select has_function('public', 'submit_chapter_application', array['text','text','text','text','text'], '3. bounded submit RPC exists');
select has_function('public', 'list_chapter_applications', array[]::text[], '4. reviewer list RPC exists');
select has_function('public', 'decide_chapter_application', array['uuid','text','text'], '5. atomic decision RPC exists');
select ok((select prosecdef from pg_proc where oid = 'public.submit_chapter_application(text,text,text,text,text)'::regprocedure), '6. submit is security definer');
select ok((select prosecdef from pg_proc where oid = 'public.list_chapter_applications()'::regprocedure), '7. list is security definer');
select ok((select prosecdef from pg_proc where oid = 'public.decide_chapter_application(uuid,text,text)'::regprocedure), '8. decision is security definer');
select ok((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.submit_chapter_application(text,text,text,text,text)'::regprocedure), '9. submit pins an empty search path');
select ok((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.list_chapter_applications()'::regprocedure), '10. list pins an empty search path');
select ok((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.decide_chapter_application(uuid,text,text)'::regprocedure), '11. decision pins an empty search path');
select ok(has_function_privilege('anon', 'public.submit_chapter_application(text,text,text,text,text)', 'execute'), '12. anon may submit');
select ok(has_function_privilege('authenticated', 'public.submit_chapter_application(text,text,text,text,text)', 'execute'), '13. authenticated callers retain the same public submit capability');
select ok(not has_function_privilege('anon', 'public.list_chapter_applications()', 'execute'), '14. anon cannot list');
select ok(not has_function_privilege('anon', 'public.decide_chapter_application(uuid,text,text)', 'execute'), '15. anon cannot decide');
select ok(not has_function_privilege('service_role', 'public.list_chapter_applications()', 'execute'), '16. service role is not an application-review path');
select ok(not has_table_privilege('anon', 'public.chapter_applications', 'select'), '17. anon has no table read grant');
select ok(not has_table_privilege('authenticated', 'public.chapter_applications', 'select'), '18. authenticated has no table read grant');
select ok(not has_table_privilege('anon', 'public.chapter_applications', 'insert'), '19. anon cannot bypass submit with a direct insert');

set local role anon;
select throws_ok(
  $$select count(*) from public.chapter_applications$$,
  '42501', null,
  '20. an anonymous direct read is denied'
);
select lives_ok(
  $$select * from public.submit_chapter_application('  Junto Oak  ', '  Philadelphia  ', ' Applicant@Example.COM ', '  A serious local table.  ', '')$$,
  '21. anonymous callers can submit a valid bounded application'
);
reset role;

select is(
  (select chapter_name || '|' || location || '|' || applicant_email_normalized || '|' || intent_note
     from public.chapter_applications where applicant_email_normalized = 'applicant@example.com'),
  'Junto Oak|Philadelphia|applicant@example.com|A serious local table.',
  '22. submission stores only normalized trimmed private data'
);
select set_config(
  'junto.test_application_id',
  (select id::text from public.chapter_applications where applicant_email_normalized = 'applicant@example.com'),
  true
);

set local role anon;
select lives_ok(
  $$select * from public.submit_chapter_application('Bot chapter', 'Bot city', 'bot@example.com', 'Bot note', 'https://spam.example')$$,
  '23. a filled honeypot receives a non-disclosing success response'
);
reset role;
select is((select count(*)::int from public.chapter_applications where applicant_email_normalized = 'bot@example.com'), 0, '24. the honeypot stores no application');

set local role anon;
select throws_ok(
  $$select * from public.submit_chapter_application('Duplicate', 'Elsewhere', ' APPLICANT@example.com ', 'Another note', '')$$,
  '23505', null,
  '25. one pending application per normalized email is enforced'
);
reset role;
select is((select count(*)::int from public.chapter_applications where applicant_email_normalized = 'applicant@example.com'), 1, '26. duplicate failure leaves one original application');

set local role anon;
select throws_ok($$select * from public.submit_chapter_application('', 'City', 'a@example.com', 'Note', '')$$, '22023', null, '27. blank names fail closed');
select throws_ok($$select * from public.submit_chapter_application('Name', repeat('x',241), 'b@example.com', 'Note', '')$$, '22023', null, '28. oversized locations fail closed');
select throws_ok($$select * from public.submit_chapter_application('Name', 'City', 'a@b@c.example', 'Note', '')$$, '22023', null, '29. malformed emails fail closed');
select throws_ok($$select * from public.submit_chapter_application('Name', 'City', 'c@example.com', '', '')$$, '22023', null, '30. blank intent notes fail closed');
select throws_ok($$select * from public.submit_chapter_application('Name', 'City', 'd@example.com', 'Note', repeat('x',201))$$, '22023', null, '31. oversized honeypot input fails closed');
reset role;
select is((select count(*)::int from public.chapter_applications), 1, '32. malformed submissions create no rows');

set local role anon;
select throws_ok($$select * from public.list_chapter_applications()$$, '42501', null, '33. anon has no list RPC execution path');
reset role;

select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000002','role','authenticated')::text, true);
set local role authenticated;
select throws_ok($$select * from public.list_chapter_applications()$$, '42501', null, '34. an ordinary verified user cannot list applications');
reset role;

update auth.users set email_confirmed_at = null where id = 'a9000000-0000-4000-a000-000000000001';
select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok($$select * from public.list_chapter_applications()$$, '42501', null, '35. the exact but unverified reviewer email cannot list');
reset role;
update auth.users set email_confirmed_at = now() where id = 'a9000000-0000-4000-a000-000000000001';

select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.list_chapter_applications()), 1, '36. only the exact normalized verified reviewer can list');
reset role;

select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000002','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.decide_chapter_application('00000000-0000-4000-a000-000000000000','not-a-decision','Bad Slug')$$,
  '42501', null,
  '37. reviewer authorization wins before malformed decision validation'
);
select throws_ok(
  $$select * from public.decide_chapter_application(current_setting('junto.test_application_id')::uuid,'approve','applications')$$,
  '42501', null,
  '38. reviewer authorization wins before the applications reserved-slug validation'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  $$select * from public.decide_chapter_application(current_setting('junto.test_application_id')::uuid,'approve','applications-circle')$$,
  '39. the reviewer can approve the nearby applications-circle slug'
);
reset role;

select is((select name || '|' || location || '|' || archive_visibility || '|' || status from public.juntos where slug='applications-circle'), 'Junto Oak|Philadelphia|private|active', '40. approval creates the requested private active chapter');
select is(
  (select role || '|' || status || '|' || email_normalized || '|' || invited_by::text
     from public.junto_invitations where junto_id=(select id from public.juntos where slug='applications-circle')),
  'admin|pending|applicant@example.com|a9000000-0000-4000-a000-000000000001',
  '41. approval creates the pending applicant admin invitation with reviewer evidence'
);
select ok(
  (select status='approved' and reviewed_by='a9000000-0000-4000-a000-000000000001' and reviewed_at is not null and junto_id=(select id from public.juntos where slug='applications-circle') from public.chapter_applications where applicant_email_normalized='applicant@example.com'),
  '42. approval records complete durable decision evidence'
);

select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.decide_chapter_application(current_setting('junto.test_application_id')::uuid,'decline',null)$$,
  '22023', null,
  '43. an already-decided application cannot be decided again'
);
reset role;
select is((select count(*)::int from public.juntos where slug='applications-circle'), 1, '44. repeated decisions create no duplicate chapter');

insert into public.chapter_applications (id, chapter_name, location, applicant_email_normalized, intent_note)
values ('a9000000-0000-4000-a000-000000000011', 'Collision Table', 'Boston', 'collision@example.com', 'Collision proof.');
insert into public.juntos (name, slug, archive_visibility, status)
values ('Existing slug', 'existing-slug', 'private', 'active');
select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.decide_chapter_application('a9000000-0000-4000-a000-000000000011','approve','existing-slug')$$,
  '23505', null,
  '45. a chapter slug collision aborts approval'
);
reset role;
select is((select status from public.chapter_applications where applicant_email_normalized='collision@example.com'), 'pending', '46. a slug collision leaves the application pending');
select is((select count(*)::int from public.junto_invitations where email_normalized='collision@example.com'), 0, '47. a slug collision creates no partial invitation');

insert into public.chapter_applications (id, chapter_name, location, applicant_email_normalized, intent_note)
values ('a9000000-0000-4000-a000-000000000012', 'Atomic Failure', 'Chicago', 'atomic@example.com', 'Atomic proof.');
create function public.fail_application_invitation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.juntos j where j.id=new.junto_id and j.slug='atomic-failure') then
    raise exception 'forced invitation failure' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger fail_application_invitation before insert on public.junto_invitations
for each row execute function public.fail_application_invitation();
select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.decide_chapter_application('a9000000-0000-4000-a000-000000000012','approve','atomic-failure')$$,
  '23514', null,
  '48. a forced invitation failure aborts approval'
);
reset role;
drop trigger fail_application_invitation on public.junto_invitations;
drop function public.fail_application_invitation();
select is((select count(*)::int from public.juntos where slug='atomic-failure'), 0, '49. invitation failure leaves no orphan chapter');
select is((select status from public.chapter_applications where applicant_email_normalized='atomic@example.com'), 'pending', '50. invitation failure leaves the application pending');

insert into public.chapter_applications (id, chapter_name, location, applicant_email_normalized, intent_note)
values ('a9000000-0000-4000-a000-000000000013', 'Declined Table', 'Seattle', 'declined@example.com', 'Decline proof.');
select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  $$select * from public.decide_chapter_application('a9000000-0000-4000-a000-000000000013','decline',null)$$,
  '51. the reviewer can durably decline a pending application'
);
reset role;
select ok(
  (select status='declined' and reviewed_by='a9000000-0000-4000-a000-000000000001' and reviewed_at is not null and junto_id is null from public.chapter_applications where applicant_email_normalized='declined@example.com'),
  '52. decline persists complete decision evidence without a chapter'
);
select is((select count(*)::int from public.junto_invitations where email_normalized='declined@example.com'), 0, '53. decline creates no invitation');

insert into public.chapter_applications (id, chapter_name, location, applicant_email_normalized, intent_note)
values ('a9000000-0000-4000-a000-000000000014', 'Reserved Route', 'Austin', 'reserved@example.com', 'Reserved-slug proof.');
select set_config('request.jwt.claims', json_build_object('sub','a9000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.decide_chapter_application('a9000000-0000-4000-a000-000000000014','approve','applications')$$,
  '22023', null,
  '54. the reviewer cannot approve an application with the static applications slug'
);
reset role;
select ok(
  (select status='pending' and reviewed_by is null and reviewed_at is null and junto_id is null from public.chapter_applications where applicant_email_normalized='reserved@example.com'),
  '55. reserved-slug approval failure leaves the application pending'
);
select is((select count(*)::int from public.juntos where slug='applications'), 0, '56. reserved-slug approval failure creates no chapter');
select is((select count(*)::int from public.junto_invitations where email_normalized='reserved@example.com'), 0, '57. reserved-slug approval failure creates no invitation');

select * from finish();
rollback;
