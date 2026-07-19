-- T05 authorization boundaries for essays: author ownership, draft privacy,
-- same-Junto members-only access, Junto isolation, admin moderation without
-- body rewriting, the validated publication transition path, publication
-- timestamp semantics, and the safe public projection.
-- Sources: docs/architecture/authorization.md §13, docs/content/essays.md §6,
-- docs/planning/product-decisions.md §14, docs/membership/user-roles.md §2.
begin;
create extension if not exists pgtap with schema extensions;

select plan(73);

-- ---------------------------------------------------------------------------
-- Fixtures: Philadelphia (public, active) with author alice, co-member bob,
-- admin carol, inactive member erin, inactive admin henry; San Diego
-- (private, active) with admin grace; Ghost (public but INACTIVE); dave is
-- an authenticated outsider with no memberships anywhere.
-- ---------------------------------------------------------------------------

insert into public.juntos (id, name, slug, description, archive_visibility, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'Junto Philadelphia', 'philadelphia', 'First chapter', 'public', 'active'),
  ('00000000-0000-4000-a000-00000000bbbb', 'Junto San Diego', 'san-diego', 'Second chapter', 'private', 'active'),
  ('00000000-0000-4000-a000-00000000cccc', 'Junto Ghost', 'ghost', 'Wound down', 'public', 'inactive');

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a11ce000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'alice@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'bob@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ca401000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'carol@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'da7e0000-0000-4000-a000-000000000004', 'authenticated', 'authenticated', 'dave@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e0e00000-0000-4000-a000-000000000005', 'authenticated', 'authenticated', 'erin@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'baddad00-0000-4000-a000-000000000006', 'authenticated', 'authenticated', 'henry@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '9aace000-0000-4000-a000-000000000008', 'authenticated', 'authenticated', 'grace@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- Every claimed member has a profile (claim_invitations creates it); the
-- public projection's author join relies on that invariant.
insert into public.profiles (id, display_name, slug)
values
  ('a11ce000-0000-4000-a000-000000000001', 'Alice Author', 'alice-author'),
  ('b0b00000-0000-4000-a000-000000000002', 'Bob Builder', 'bob-builder'),
  ('e0e00000-0000-4000-a000-000000000005', 'Erin Historical', 'erin-historical'),
  ('9aace000-0000-4000-a000-000000000008', 'Grace Adams', 'grace-adams');

insert into public.junto_members (junto_id, user_id, role, status)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'a11ce000-0000-4000-a000-000000000001', 'member', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'b0b00000-0000-4000-a000-000000000002', 'member', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'ca401000-0000-4000-a000-000000000003', 'admin', 'active'),
  ('00000000-0000-4000-a000-00000000aaaa', 'e0e00000-0000-4000-a000-000000000005', 'member', 'inactive'),
  ('00000000-0000-4000-a000-00000000aaaa', 'baddad00-0000-4000-a000-000000000006', 'admin', 'inactive'),
  ('00000000-0000-4000-a000-00000000bbbb', '9aace000-0000-4000-a000-000000000008', 'admin', 'active');

insert into public.meetings (id, junto_id, meeting_date, title, location)
values
  ('00000000-0000-4000-b000-0000000000f1', '00000000-0000-4000-a000-00000000aaaa',
   '2026-06-22', 'Future obligations', 'Carol''s apartment'),
  ('00000000-0000-4000-b000-0000000000f2', '00000000-0000-4000-a000-00000000bbbb',
   '2026-06-23', 'San Diego session', 'Grace''s place');

-- Essays across every state. Sensitive/private values are planted so their
-- absence from public reads is meaningful.
insert into public.essays
  (id, junto_id, author_id, meeting_id, title, slug, subtitle, body_markdown,
   status, visibility, published_at)
values
  -- alice's private draft
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-00000000aaaa',
   'a11ce000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
   'On patience', 'on-patience', null, 'Patience draft body.',
   'draft', 'members_only', null),
  -- alice's published members-only essay
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-00000000aaaa',
   'a11ce000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
   'For the table only', 'for-the-table-only', null, 'Members-only body.',
   'published', 'members_only', '2026-01-10T00:00:00Z'),
  -- alice's published public essay (old timestamp proves preservation)
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-a000-00000000aaaa',
   'a11ce000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
   'What we owe the future', 'what-we-owe-the-future', 'On duty across time',
   '# Duty' || E'\n\n' || 'A public argument.',
   'published', 'public', '2020-06-01T00:00:00Z'),
  -- alice's standalone public essay (no meeting)
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-a000-00000000aaaa',
   'a11ce000-0000-4000-a000-000000000001', null,
   'A standalone note', 'a-standalone-note', null, 'Standalone body.',
   'published', 'public', '2026-02-02T00:00:00Z'),
  -- published public in the PRIVATE Junto — never publicly visible
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-a000-00000000bbbb',
   '9aace000-0000-4000-a000-000000000008', '00000000-0000-4000-b000-0000000000f2',
   'San Diego public attempt', 'san-diego-public', null, 'Private chapter body.',
   'published', 'public', '2026-02-03T00:00:00Z'),
  -- published public in the INACTIVE Junto — never publicly visible
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-a000-00000000cccc',
   '9aace000-0000-4000-a000-000000000008', null,
   'Ghost farewell', 'ghost-public', null, 'Ghost body.',
   'published', 'public', '2026-02-04T00:00:00Z'),
  -- deactivated erin's draft (private access must be gone)
  ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-a000-00000000aaaa',
   'e0e00000-0000-4000-a000-000000000005', null,
   'Erin unfinished', 'erin-unfinished', null, 'Erin draft body.',
   'draft', 'members_only', null),
  -- deactivated erin's historical public essay (must remain public)
  ('00000000-0000-4000-c000-000000000008', '00000000-0000-4000-a000-00000000aaaa',
   'e0e00000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-0000000000f1',
   'Erin looks back', 'erin-looks-back', null, 'Erin history body.',
   'published', 'public', '2026-03-03T00:00:00Z'),
  -- alice's published members-only essay reserved for admin moderation
  ('00000000-0000-4000-c000-000000000009', '00000000-0000-4000-a000-00000000aaaa',
   'a11ce000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
   'Under moderation', 'under-moderation', null, 'Moderated body.',
   'published', 'members_only', '2026-04-04T00:00:00Z');

-- ---------------------------------------------------------------------------
-- 1–16: unauthenticated visitors — no base access, no writes, and a
-- projection that exposes only eligible published public essays
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  'select count(*) from public.essays',
  '42501', null,
  '1. anonymous visitors cannot read the essays base table'
);
select throws_ok(
  $$insert into public.essays (junto_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa', 'Anon', 'anon-essay')$$,
  '42501', null,
  '2. anonymous visitors cannot create essays'
);
select throws_ok(
  $$update public.essays set title = 'hijacked'$$,
  '42501', null,
  '3. anonymous visitors cannot update essays'
);
select throws_ok(
  $$delete from public.essays$$,
  '42501', null,
  '4. anonymous visitors cannot delete essays'
);
select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'draft', 'public')$$,
  '42501', null,
  '5. anonymous visitors cannot execute publication transitions'
);

select is(
  (select count(*)::int from public.public_essays),
  3,
  '6. the projection holds exactly the eligible published public essays'
);

select ok(
  (select title = 'What we owe the future'
      and subtitle = 'On duty across time'
      and body_markdown like '# Duty%'
      and published_at = '2020-06-01T00:00:00Z'
      and author_name = 'Alice Author'
      and author_slug = 'alice-author'
      and junto_name = 'Junto Philadelphia'
      and junto_slug = 'philadelphia'
      and meeting_date = '2026-06-22'
      and meeting_title = 'Future obligations'
     from public.public_essays
    where slug = 'what-we-owe-the-future'),
  '7. a public essay carries its safe author, chapter, and meeting context'
);

select ok(
  (select meeting_date is null and meeting_title is null
     from public.public_essays
    where slug = 'a-standalone-note'),
  '8. a standalone essay appears publicly with empty meeting context'
);

select is(
  (select count(*)::int from public.public_essays
    where slug in ('on-patience', 'erin-unfinished')),
  0,
  '9. drafts never appear publicly'
);
select is(
  (select count(*)::int from public.public_essays
    where slug in ('for-the-table-only', 'under-moderation')),
  0,
  '10. published members-only essays never appear publicly'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'san-diego-public'),
  0,
  '11. a private Junto''s essays never appear publicly even when flagged public'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'ghost-public'),
  0,
  '12. an inactive Junto''s essays never appear publicly'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'no-such-essay'),
  0,
  '13. a nonexistent slug yields the same empty result as a private one'
);

-- 55000: the join view is structurally non-updatable; no write machinery
-- exists at all, and no write privilege is granted either.
select throws_ok(
  $$insert into public.public_essays (slug, title)
    values ('injected', 'Injected')$$,
  '55000', null,
  '14. the projection accepts no inserts'
);
select throws_ok(
  $$update public.public_essays set title = 'hijacked'$$,
  '55000', null,
  '15. the projection accepts no updates'
);
select throws_ok(
  $$delete from public.public_essays$$,
  '55000', null,
  '16. the projection accepts no deletes'
);

reset role;

-- ---------------------------------------------------------------------------
-- 17–35: an ordinary co-member — no draft access, full published access in
-- their own Junto, and their own authoring lifecycle through the validated
-- transition path
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'b0b00000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  0,
  '17. a co-member cannot read another member''s draft'
);
select ok(
  (select body_markdown = 'Members-only body.'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000002'),
  '18. an active same-Junto member reads a published members-only essay'
);
select ok(
  (select body_markdown like '# Duty%'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003'),
  '19. an active same-Junto member reads a published public essay'
);
select is(
  (select count(*)::int from public.essays
    where junto_id = '00000000-0000-4000-a000-00000000bbbb'),
  0,
  '20. a member sees no essays of another Junto'
);

with attempt as (
     update public.essays set title = 'hijacked'
      where id = '00000000-0000-4000-c000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '21. a co-member cannot edit another member''s draft'
);

select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000002', 'draft', 'members_only')$$,
  '42501', null,
  '22. a co-member cannot transition another member''s essay'
);

select lives_ok(
  $$insert into public.essays (junto_id, meeting_id, title, slug, body_markdown)
    values ('00000000-0000-4000-a000-00000000aaaa',
            '00000000-0000-4000-b000-0000000000f1',
            'Bob''s first essay', 'bobs-first-essay', 'Bob writes.')$$,
  '23. an active member creates a draft in their own Junto'
);

select ok(
  (select author_id = 'b0b00000-0000-4000-a000-000000000002'
      and status = 'draft'
      and visibility = 'members_only'
      and published_at is null
     from public.essays
    where slug = 'bobs-first-essay'),
  '24. authorship derives from the authenticated identity and new essays ' ||
  'begin as members-only drafts'
);

select throws_ok(
  $$insert into public.essays (junto_id, meeting_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            '00000000-0000-4000-b000-0000000000f2',
            'Cross meeting', 'cross-meeting-attempt')$$,
  '23503', null,
  '25. an essay cannot be created against another Junto''s meeting'
);
select throws_ok(
  $$insert into public.essays (junto_id, title, slug)
    values ('00000000-0000-4000-a000-00000000bbbb',
            'Wrong chapter', 'wrong-chapter-attempt')$$,
  '42501', null,
  '26. a member cannot create essays in a Junto they do not belong to'
);
select throws_ok(
  $$insert into public.essays (junto_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'Slug thief', 'what-we-owe-the-future')$$,
  '23505', null,
  '27. a taken slug is rejected at the unique constraint'
);

select throws_ok(
  $$update public.essays set slug = 'renamed-slug'
     where slug = 'bobs-first-essay'$$,
  '42501', null,
  '28. even the author cannot rewrite a slug — links stay stable'
);
select throws_ok(
  $$update public.essays set status = 'published'
     where slug = 'bobs-first-essay'$$,
  '42501', null,
  '29. status can never change through an ordinary update'
);
select throws_ok(
  $$update public.essays set visibility = 'public'
     where slug = 'bobs-first-essay'$$,
  '42501', null,
  '30. visibility can never change through an ordinary update'
);
select throws_ok(
  $$update public.essays set published_at = now()
     where slug = 'bobs-first-essay'$$,
  '42501', null,
  '31. the publication timestamp can never be forged through an update'
);

select lives_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-first-essay'),
      'published', 'members_only')$$,
  '32. the author publishes their own essay members-only (no confirmation ' ||
  'needed — nothing becomes internet-visible)'
);
select ok(
  (select status = 'published' and published_at is not null
     from public.essays where slug = 'bobs-first-essay'),
  '33. publishing stamps the publication timestamp'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'bobs-first-essay'),
  0,
  '34. a members-only publication stays out of the public projection'
);

select throws_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-first-essay'),
      'published', 'public')$$,
  'P0001', 'confirmation-required',
  '35. making an essay internet-visible fails closed without explicit ' ||
  'confirmation'
);

-- ---------------------------------------------------------------------------
-- 36–40: the author's full lifecycle — confirmed exposure, immediate
-- revocation, unpublish, and the blank-body guard
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-first-essay'),
      'published', 'public', true)$$,
  '36. the confirmed transition makes the essay public'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'bobs-first-essay'),
  1,
  '37. the confirmed public essay appears in the projection immediately'
);

select lives_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-first-essay'),
      'published', 'members_only')$$,
  '38. the author withdraws the essay to members-only without confirmation'
);
select ok(
  (select not exists (select 1 from public.public_essays
                       where slug = 'bobs-first-essay'))
  and exists (select 1 from public.essays
               where slug = 'bobs-first-essay' and status = 'published'),
  '39. public visibility ends immediately while members retain access'
);

-- Setup: a draft may exist with an empty body; publishing it must not.
insert into public.essays (junto_id, title, slug, body_markdown)
values ('00000000-0000-4000-a000-00000000aaaa',
        'Empty essay', 'bobs-empty-essay', '');
select throws_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-empty-essay'),
      'published', 'members_only')$$,
  '23514', null,
  '40. a blank-bodied essay cannot be published'
);

-- ---------------------------------------------------------------------------
-- 41–42: invalid transition input and the delete boundary
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from public.transition_essay(
      (select id from public.essays where slug = 'bobs-first-essay'),
      'archived', 'members_only')$$,
  '22023', null,
  '41. an unknown status is rejected as invalid input'
);
select throws_ok(
  $$delete from public.essays where slug = 'bobs-first-essay'$$,
  '42501', null,
  '42. not even the author holds a delete path — unpublish is the ' ||
  'revocation mechanism'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 43–51: the author edits drafts and controls publication timestamps
-- coherently across publish, visibility changes, unpublish, and republish
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'a11ce000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select ok(
  (select body_markdown = 'Patience draft body.'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  '43. the author reads their own draft'
);

with attempt as (
     update public.essays
        set title = 'On patience, revised', body_markdown = 'Revised body.'
      where id = '00000000-0000-4000-c000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '44. the author edits their own draft title and body'
);
select is(
  (select slug from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  'on-patience',
  '45. a title edit never alters the established slug'
);

select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'published', 'members_only')$$,
  '46. the author withdraws a public essay to members-only'
);
select ok(
  (select published_at = '2020-06-01T00:00:00Z'
      and not exists (select 1 from public.public_essays
                       where slug = 'what-we-owe-the-future')
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003'),
  '47. a visibility-only change preserves the original publication ' ||
  'timestamp and leaves the projection immediately'
);

select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'published', 'public', true)$$,
  '48. the confirmed return to public succeeds'
);
select ok(
  (select published_at = '2020-06-01T00:00:00Z'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003')
  and exists (select 1 from public.public_essays
               where slug = 'what-we-owe-the-future'),
  '49. restoring public visibility preserves the original publication date'
);

select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'draft', 'public')$$,
  '50. the author unpublishes the essay entirely'
);
select ok(
  (select status = 'draft' and published_at is null
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003')
  and not exists (select 1 from public.public_essays
                   where slug = 'what-we-owe-the-future'),
  '51. unpublishing clears the publication timestamp and removes every ' ||
  'public trace while the author keeps the draft'
);

-- ---------------------------------------------------------------------------
-- 52–54: republish gets a fresh timestamp; meeting integrity holds on
-- reassignment; visibility input is validated
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'published', 'public', true)$$,
  '52. the author republishes with confirmation'
);
select ok(
  (select published_at is not null
      and published_at <> '2020-06-01T00:00:00Z'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003'),
  '53. republishing after an unpublish stamps a fresh publication time — ' ||
  'the withdrawal is honest history'
);

select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000003', 'published', 'everyone')$$,
  '22023', null,
  '54. an unknown visibility is rejected as invalid input'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 55–60: the Junto admin moderates — reads drafts, edits metadata,
-- transitions publication — but can never rewrite an author's words
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'ca401000-0000-4000-a000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

-- alice's draft, erin's draft, and bob's empty draft are all visible to
-- the chapter's own admin for authorized moderation.
select ok(
  (select count(*) = 3 from public.essays where status = 'draft'
      and junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and author_id <> 'ca401000-0000-4000-a000-000000000003'),
  '55. the Junto admin reads members'' drafts for authorized moderation'
);

with attempt as (
     update public.essays set title = 'On patience (edited by moderation)'
      where id = '00000000-0000-4000-c000-000000000001'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '1',
  '56. the admin may moderate essay metadata'
);

select throws_ok(
  $$update public.essays set body_markdown = 'rewritten by admin'
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '42501', null,
  '57. only the author may change the essay body — admin moderation is ' ||
  'not ghostwriting'
);

select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000009', 'draft', 'members_only')$$,
  '58. the admin unpublishes a member''s essay as moderation'
);
select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000009', 'published', 'public')$$,
  'P0001', 'confirmation-required',
  '59. even the admin needs explicit confirmation to expose an essay ' ||
  'publicly'
);
select lives_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000009', 'published', 'members_only')$$,
  '60. the admin restores the members-only publication'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 61–65: cross-Junto admin authority confers nothing
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '9aace000-0000-4000-a000-000000000008', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.essays
    where junto_id = '00000000-0000-4000-a000-00000000aaaa'),
  0,
  '61. a San Diego admin reads no Philadelphia essay rows — drafts, ' ||
  'members-only, and public alike'
);

with attempt as (
     update public.essays set title = 'hijacked'
      where id = '00000000-0000-4000-c000-000000000002'
      returning 1)
select set_config('junto.test_rows',
  coalesce((select count(*)::text from attempt), '0'), true);
select is(current_setting('junto.test_rows', true), '0',
  '62. a San Diego admin cannot edit Philadelphia essays'
);

select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000002', 'draft', 'members_only')$$,
  '42501', null,
  '63. a San Diego admin cannot transition Philadelphia essays'
);

select ok(
  (select body_markdown = 'Private chapter body.'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000005'),
  '64. the San Diego admin still reads their own chapter''s essays in full'
);

select throws_ok(
  $$insert into public.essays (junto_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'Grace crosses over', 'grace-crossover')$$,
  '42501', null,
  '65. a San Diego admin cannot create essays in Philadelphia'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 66–68: an authenticated outsider gets nothing beyond the safe projection
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'da7e0000-0000-4000-a000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.essays),
  0,
  '66. an authenticated non-member sees no essay base rows at all'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'what-we-owe-the-future'),
  1,
  '67. the safe public projection remains available to authenticated users'
);
select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000099', 'draft', 'members_only')$$,
  '42501', null,
  '68. a nonexistent essay id denies identically to an unauthorized one — ' ||
  'the transition path discloses nothing'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 69–72: deactivation revokes private access, member and admin alike, while
-- already-public history remains public
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', 'e0e00000-0000-4000-a000-000000000005', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.essays),
  0,
  '69. a deactivated author reads no essay rows — not even their own draft'
);
select throws_ok(
  $$select * from public.transition_essay(
      '00000000-0000-4000-c000-000000000008', 'draft', 'public')$$,
  '42501', null,
  '70. a deactivated author cannot transition their own essays'
);
select is(
  (select count(*)::int from public.public_essays
    where slug = 'erin-looks-back'),
  1,
  '71. a deactivated author''s already-public essay remains public history'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'baddad00-0000-4000-a000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.essays),
  0,
  '72. an inactive admin reads no essay rows — dormant admin authority ' ||
  'confers nothing'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 73: the transition path never escalated — identity, Junto, meeting,
-- words, and slug all unchanged after the full lifecycle above
-- ---------------------------------------------------------------------------

select ok(
  (select author_id = 'a11ce000-0000-4000-a000-000000000001'
      and junto_id = '00000000-0000-4000-a000-00000000aaaa'
      and meeting_id = '00000000-0000-4000-b000-0000000000f1'
      and body_markdown like '# Duty%'
      and slug = 'what-we-owe-the-future'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000003'),
  '73. transitions changed only status, visibility, and publication time — ' ||
  'never identity, Junto, meeting, body, or slug'
);

select * from finish();
rollback;
