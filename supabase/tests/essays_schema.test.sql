-- T05 structural coverage: the essays table, its constraints, triggers, and
-- grants; the absence of any destructive delete path; the publication
-- transition function; and the safe public projection.
-- Sources: docs/content/essays.md §6, docs/architecture/data-model.md §12,
-- docs/architecture/authorization.md §13, docs/planning/product-decisions.md §14.
begin;
create extension if not exists pgtap with schema extensions;

select plan(64);

-- ---------------------------------------------------------------------------
-- 1–2: table and RLS
-- ---------------------------------------------------------------------------

select has_table('public', 'essays', '1. essays table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.essays'::regclass),
  '2. RLS enabled on essays'
);

-- ---------------------------------------------------------------------------
-- 3–15: approved model columns (docs/architecture/data-model.md §12)
-- ---------------------------------------------------------------------------

select has_column('public', 'essays', 'id', '3. id column');
select has_column('public', 'essays', 'junto_id', '4. junto_id column');
select has_column('public', 'essays', 'author_id', '5. author_id column');
select has_column('public', 'essays', 'meeting_id', '6. meeting_id column');
select has_column('public', 'essays', 'title', '7. title column');
select has_column('public', 'essays', 'slug', '8. slug column');
select has_column('public', 'essays', 'subtitle', '9. subtitle column');
select has_column('public', 'essays', 'body_markdown', '10. body_markdown column');
select has_column('public', 'essays', 'status', '11. status column');
select has_column('public', 'essays', 'visibility', '12. visibility column');
select has_column('public', 'essays', 'published_at', '13. published_at column');
select has_column('public', 'essays', 'created_at', '14. created_at column');
select has_column('public', 'essays', 'updated_at', '15. updated_at column');

-- ---------------------------------------------------------------------------
-- 16–23: types and required fields — status and visibility are separate
-- concepts (docs/content/essays.md §6.3), meeting stays nullable for future
-- standalone essays (§6.2)
-- ---------------------------------------------------------------------------

select col_not_null('public', 'essays', 'junto_id',
  '16. junto_id is required (every essay carries its Junto)');
select col_not_null('public', 'essays', 'author_id',
  '17. author_id is required (every essay has one author)');
select col_not_null('public', 'essays', 'title', '18. title is required');
select col_not_null('public', 'essays', 'slug', '19. slug is required');
select col_not_null('public', 'essays', 'body_markdown',
  '20. body_markdown is required (Markdown is the canonical format)');
select col_is_null('public', 'essays', 'meeting_id',
  '21. meeting_id is nullable (future standalone essays)');
select col_type_is('public', 'essays', 'published_at',
  'timestamp with time zone', '22. published_at is a timestamptz');
select col_is_null('public', 'essays', 'published_at',
  '23. published_at is nullable (drafts have none)');

-- ---------------------------------------------------------------------------
-- 24–27: uniqueness and foreign keys, including the same-Junto meeting seam
-- ---------------------------------------------------------------------------

select col_is_unique('public', 'essays', array['slug'],
  '24. slugs are globally unique (public URLs are /essays/[slug])');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.essays'::regclass
      and contype = 'f'
      and confrelid = 'public.juntos'::regclass
  ),
  '25. essays.junto_id references juntos'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.essays'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ),
  '26. essays.author_id references auth.users'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.essays'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (junto_id, meeting_id) REFERENCES meetings(junto_id, id)'
  ),
  '27. (junto_id, meeting_id) references the T04 composite meeting seam — ' ||
  'an essay can never attach to another Junto''s meeting'
);

-- ---------------------------------------------------------------------------
-- 28–31: provenance, guard, and timestamp triggers
-- ---------------------------------------------------------------------------

select has_function('public', 'prepare_essay', array[]::text[],
  '28. prepare_essay exists (author_id derives from auth.uid())');
select has_trigger('public', 'essays', 'essays_prepare',
  '29. essays_prepare trigger installed');
select has_trigger('public', 'essays', 'essays_guard_update',
  '30. essays_guard_update trigger installed (author-only body edits)');
select has_trigger('public', 'essays', 'essays_set_updated_at',
  '31. essays_set_updated_at trigger installed');

-- ---------------------------------------------------------------------------
-- 32–46: defaults, domains, slug rules, and integrity behavior (as owner)
-- ---------------------------------------------------------------------------

insert into public.juntos (id, name, slug, status, archive_visibility)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'Junto Philadelphia', 'philadelphia', 'active', 'public'),
  ('00000000-0000-4000-a000-00000000bbbb', 'Junto San Diego', 'san-diego', 'active', 'private');

insert into auth.users
  (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a11ce000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'alice@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.meetings (id, junto_id, meeting_date)
values
  ('00000000-0000-4000-b000-0000000000f1',
   '00000000-0000-4000-a000-00000000aaaa', '2026-06-22'),
  ('00000000-0000-4000-b000-0000000000f2',
   '00000000-0000-4000-a000-00000000bbbb', '2026-06-23');

insert into public.essays (id, junto_id, author_id, meeting_id, title, slug, body_markdown)
values ('00000000-0000-4000-c000-000000000001',
        '00000000-0000-4000-a000-00000000aaaa',
        'a11ce000-0000-4000-a000-000000000001',
        '00000000-0000-4000-b000-0000000000f1',
        'What we owe the future', 'what-we-owe-the-future', 'A first draft.');

select ok(
  (select status = 'draft'
      and visibility = 'members_only'
      and published_at is null
      and id is not null
      and created_at is not null
      and updated_at is not null
     from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  '32. defaults: new essays are members-only drafts with no publication ' ||
  'timestamp'
);

select throws_ok(
  $$update public.essays set status = 'archived'
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '23514', null,
  '33. status accepts only draft and published'
);

select throws_ok(
  $$update public.essays set visibility = 'secret'
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '23514', null,
  '34. visibility accepts only public and members_only'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001', '   ', 'blank-title')$$,
  '23514', null,
  '35. a blank title is rejected'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, title, slug, subtitle)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001', 'Titled', 'blank-subtitle', '  ')$$,
  '23514', null,
  '36. a blank subtitle is rejected (null is the honest empty value)'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001', 'Bad slug', 'Not A Slug')$$,
  '23514', null,
  '37. slugs must be lowercase URL-safe'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001', 'Bad slug', 'trailing-')$$,
  '23514', null,
  '38. a trailing hyphen is not a valid slug'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, title, slug)
    values ('00000000-0000-4000-a000-00000000bbbb',
            'a11ce000-0000-4000-a000-000000000001', 'Duplicate',
            'what-we-owe-the-future')$$,
  '23505', null,
  '39. slug uniqueness is global — even across Juntos'
);

select throws_ok(
  $$update public.essays set status = 'published'
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '23514', null,
  '40. a published essay must carry a publication timestamp'
);

select throws_ok(
  $$update public.essays set published_at = now()
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '23514', null,
  '41. a draft must not carry a publication timestamp'
);

select throws_ok(
  $$insert into public.essays
      (junto_id, author_id, title, slug, body_markdown, status, published_at)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001', 'Empty', 'empty-body',
            '   ', 'published', now())$$,
  '23514', null,
  '42. a published essay must have a nonblank body'
);

select throws_ok(
  $$insert into public.essays (junto_id, author_id, meeting_id, title, slug)
    values ('00000000-0000-4000-a000-00000000aaaa',
            'a11ce000-0000-4000-a000-000000000001',
            '00000000-0000-4000-b000-0000000000f2',
            'Cross-Junto', 'cross-junto-meeting')$$,
  '23503', null,
  '43. an essay cannot reference another Junto''s meeting'
);

select throws_ok(
  $$update public.essays
      set meeting_id = '00000000-0000-4000-b000-0000000000f2'
    where id = '00000000-0000-4000-c000-000000000001'$$,
  '23503', null,
  '44. an essay cannot be reassigned to another Junto''s meeting'
);

select lives_ok(
  $$update public.essays set meeting_id = null
     where id = '00000000-0000-4000-c000-000000000001'$$,
  '45. an essay may stand without a meeting'
);

update public.essays
   set title = 'Trigger check', updated_at = '2000-01-01T00:00:00Z'
 where id = '00000000-0000-4000-c000-000000000001';
select ok(
  (select updated_at > '2001-01-01T00:00:00Z'
     from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  '46. updated_at is trigger-maintained and cannot be pinned by the writer'
);

-- ---------------------------------------------------------------------------
-- 47–50: the public projection exposes only safe columns and hardened
-- catalog options (R10 note: assert view options for both projections)
-- ---------------------------------------------------------------------------

select has_view('public', 'public_essays', '47. public_essays view exists');
select bag_eq(
  $$select column_name::text
      from information_schema.columns
     where table_schema = 'public' and table_name = 'public_essays'$$,
  $$values ('slug'::text), ('title'), ('subtitle'), ('body_markdown'),
           ('published_at'), ('author_name'), ('author_slug'),
           ('junto_name'), ('junto_slug'), ('meeting_date'),
           ('meeting_title')$$,
  '48. projection carries exactly the safe columns — no ids, status, ' ||
  'visibility, email, location, deadline, or membership data'
);
select ok(
  (select coalesce(array_to_string(c.reloptions, ','), '')
            like '%security_barrier=true%'
      and coalesce(array_to_string(c.reloptions, ','), '')
            not like '%security_invoker=true%'
     from pg_class c
    where c.oid = 'public.public_essays'::regclass),
  '49. public_essays runs with owner rights behind a security barrier'
);
select ok(
  (select coalesce(array_to_string(c.reloptions, ','), '')
            like '%security_barrier=true%'
      and coalesce(array_to_string(c.reloptions, ','), '')
            not like '%security_invoker=true%'
     from pg_class c
    where c.oid = 'public.public_meetings'::regclass),
  '50. public_meetings carries the same hardened view options'
);

-- ---------------------------------------------------------------------------
-- 51–58: no destructive path, immutable identity, and grants
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'essays'
      and cmd = 'DELETE'),
  0,
  '51. no delete policy exists on essays — unpublish is the revocation path'
);

select ok(
  not has_table_privilege('anon', 'public.essays', 'SELECT')
  and not has_any_column_privilege('anon', 'public.essays', 'SELECT')
  and not has_any_column_privilege('anon', 'public.essays', 'INSERT')
  and not has_any_column_privilege('anon', 'public.essays', 'UPDATE'),
  '52. anon holds no privilege at all on the essays base table'
);

select ok(
  not has_table_privilege('authenticated', 'public.essays', 'DELETE')
  and not has_table_privilege('anon', 'public.essays', 'DELETE'),
  '53. API user roles hold no DELETE privilege on essays'
);

select ok(
  not has_column_privilege('authenticated', 'public.essays', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.essays', 'junto_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.essays', 'author_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.essays', 'slug', 'UPDATE'),
  '54. id, junto_id, author_id, and slug can never be rewritten through ' ||
  'the API — identity and links are stable'
);

select ok(
  not has_column_privilege('authenticated', 'public.essays', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.essays', 'visibility', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.essays', 'published_at', 'UPDATE'),
  '55. publication state can never change through ordinary updates — only ' ||
  'the validated transition path'
);

select ok(
  not has_column_privilege('authenticated', 'public.essays', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.essays', 'author_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.essays', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.essays', 'published_at', 'INSERT'),
  '56. id, author identity, and publication state can never be ' ||
  'client-supplied on insert'
);

select ok(
  has_column_privilege('authenticated', 'public.essays', 'title', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'slug', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'body_markdown', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'visibility', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'meeting_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'junto_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.essays', 'subtitle', 'INSERT'),
  '57. members create drafts through the approved insert columns'
);

select ok(
  has_column_privilege('authenticated', 'public.essays', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.essays', 'subtitle', 'UPDATE')
  and has_column_privilege('authenticated', 'public.essays', 'body_markdown', 'UPDATE')
  and has_column_privilege('authenticated', 'public.essays', 'meeting_id', 'UPDATE'),
  '58. content and meeting assignment remain editable through the API'
);

-- ---------------------------------------------------------------------------
-- 59–62: projection grants
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.public_essays', 'INSERT')
  and not has_table_privilege('anon', 'public.public_essays', 'UPDATE')
  and not has_table_privilege('anon', 'public.public_essays', 'DELETE')
  and not has_table_privilege('authenticated', 'public.public_essays', 'INSERT')
  and not has_table_privilege('authenticated', 'public.public_essays', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.public_essays', 'DELETE'),
  '59. the public projection grants no write capability'
);

select ok(
  has_table_privilege('anon', 'public.public_essays', 'SELECT')
  and has_table_privilege('authenticated', 'public.public_essays', 'SELECT'),
  '60. visitors and authenticated users may read the public projection'
);

select has_function('public', 'transition_essay',
  array['uuid', 'text', 'text', 'boolean'],
  '61. the validated publication transition function exists'
);

select ok(
  not has_function_privilege('anon',
    'public.transition_essay(uuid, text, text, boolean)', 'EXECUTE'),
  '62. anonymous visitors cannot execute publication transitions'
);

-- ---------------------------------------------------------------------------
-- 63–64: transition execute grant and slug immutability across edits
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated',
    'public.transition_essay(uuid, text, text, boolean)', 'EXECUTE'),
  '63. authenticated members may call the transition function (it ' ||
  'revalidates authority itself)'
);

select is(
  (select slug from public.essays
    where id = '00000000-0000-4000-c000-000000000001'),
  'what-we-owe-the-future',
  '64. the slug never changed across title edits and meeting reassignment'
);

select * from finish();
rollback;
