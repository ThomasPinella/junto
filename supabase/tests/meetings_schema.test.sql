-- T04 structural coverage: the meetings table, its constraints and triggers,
-- the absence of any destructive delete path, and the safe public projection.
-- Sources: docs/content/meetings.md §5, docs/architecture/data-model.md §12,
-- docs/architecture/authorization.md §13.
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

-- ---------------------------------------------------------------------------
-- 1–2: table and RLS
-- ---------------------------------------------------------------------------

select has_table('public', 'meetings', '1. meetings table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.meetings'::regclass),
  '2. RLS enabled on meetings'
);

-- ---------------------------------------------------------------------------
-- 3–14: approved model columns (docs/architecture/data-model.md §12)
-- ---------------------------------------------------------------------------

select has_column('public', 'meetings', 'id', '3. id column');
select has_column('public', 'meetings', 'junto_id', '4. junto_id column');
select has_column('public', 'meetings', 'meeting_date', '5. meeting_date column');
select has_column('public', 'meetings', 'title', '6. title column');
select has_column('public', 'meetings', 'theme', '7. theme column');
select has_column('public', 'meetings', 'description', '8. description column');
select has_column('public', 'meetings', 'location', '9. location column');
select has_column('public', 'meetings', 'essay_deadline', '10. essay_deadline column');
select has_column('public', 'meetings', 'status', '11. status column');
select has_column('public', 'meetings', 'created_by', '12. created_by column');
select has_column('public', 'meetings', 'created_at', '13. created_at column');
select has_column('public', 'meetings', 'updated_at', '14. updated_at column');

-- ---------------------------------------------------------------------------
-- 15–20: types and required fields
-- ---------------------------------------------------------------------------

select col_type_is('public', 'meetings', 'meeting_date', 'date',
  '15. meeting_date is a date');
select col_type_is('public', 'meetings', 'essay_deadline',
  'timestamp with time zone', '16. essay_deadline is a timestamptz');
select col_type_is('public', 'meetings', 'status', 'text',
  '17. status is text');
select col_not_null('public', 'meetings', 'junto_id',
  '18. junto_id is required (every meeting carries its Junto)');
select col_not_null('public', 'meetings', 'meeting_date',
  '19. meeting_date is required');
select col_not_null('public', 'meetings', 'status',
  '20. status is required');

-- ---------------------------------------------------------------------------
-- 21–24: uniqueness, the T05 integrity seam, and foreign keys
-- ---------------------------------------------------------------------------

select col_is_unique('public', 'meetings', array['junto_id', 'meeting_date'],
  '21. one meeting per Junto per date (deterministic public date URLs)');
select col_is_unique('public', 'meetings', array['junto_id', 'id'],
  '22. (junto_id, id) unique — composite FK seam for same-Junto essays (T05)');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.meetings'::regclass
      and contype = 'f'
      and confrelid = 'public.juntos'::regclass
  ),
  '23. meetings.junto_id references juntos'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.meetings'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ),
  '24. meetings.created_by references auth.users'
);

-- ---------------------------------------------------------------------------
-- 25–27: provenance and timestamp triggers
-- ---------------------------------------------------------------------------

select has_function('public', 'prepare_meeting', array[]::text[],
  '25. prepare_meeting exists (created_by derives from auth.uid())');
select has_trigger('public', 'meetings', 'meetings_prepare',
  '26. meetings_prepare trigger installed');
select has_trigger('public', 'meetings', 'meetings_set_updated_at',
  '27. meetings_set_updated_at trigger installed');

-- ---------------------------------------------------------------------------
-- 28–36: defaults, status domain, and integrity behavior (as table owner)
-- ---------------------------------------------------------------------------

insert into public.juntos (id, name, slug, status, archive_visibility)
values
  ('00000000-0000-4000-a000-00000000aaaa', 'Junto Philadelphia', 'philadelphia', 'active', 'public'),
  ('00000000-0000-4000-a000-00000000bbbb', 'Junto San Diego', 'san-diego', 'active', 'private');

insert into public.meetings (id, junto_id, meeting_date)
values ('00000000-0000-4000-b000-0000000000f1',
        '00000000-0000-4000-a000-00000000aaaa', '2026-06-22');

select ok(
  (select status = 'upcoming'
      and id is not null
      and created_at is not null
      and updated_at is not null
     from public.meetings
    where id = '00000000-0000-4000-b000-0000000000f1'),
  '28. defaults: status upcoming, generated id, creation timestamps'
);

select throws_ok(
  $$update public.meetings set status = 'deleted'
     where id = '00000000-0000-4000-b000-0000000000f1'$$,
  '23514', null,
  '29. status accepts only the approved lifecycle values'
);

select lives_ok(
  $$update public.meetings set status = 'completed'
     where id = '00000000-0000-4000-b000-0000000000f1'$$,
  '30. status supports completed'
);
select lives_ok(
  $$update public.meetings set status = 'cancelled'
     where id = '00000000-0000-4000-b000-0000000000f1'$$,
  '31. status supports cancelled'
);
select lives_ok(
  $$update public.meetings set status = 'archived'
     where id = '00000000-0000-4000-b000-0000000000f1'$$,
  '32. status supports archived'
);

select throws_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000aaaa', '2026-06-22')$$,
  '23505', null,
  '33. a second meeting on the same date in the same Junto is rejected'
);

select lives_ok(
  $$insert into public.meetings (junto_id, meeting_date)
    values ('00000000-0000-4000-a000-00000000bbbb', '2026-06-22')$$,
  '34. another Junto may hold its own meeting on the same date'
);

select throws_ok(
  $$update public.meetings set title = '   '
     where id = '00000000-0000-4000-b000-0000000000f1'$$,
  '23514', null,
  '35. a blank title is rejected (null is the honest empty value)'
);

update public.meetings
   set title = 'Trigger check', updated_at = '2000-01-01T00:00:00Z'
 where id = '00000000-0000-4000-b000-0000000000f1';
select ok(
  (select updated_at > '2001-01-01T00:00:00Z'
     from public.meetings
    where id = '00000000-0000-4000-b000-0000000000f1'),
  '36. updated_at is trigger-maintained and cannot be pinned by the writer'
);

-- ---------------------------------------------------------------------------
-- 37–38: the public projection exposes only safe columns
-- ---------------------------------------------------------------------------

select has_view('public', 'public_meetings', '37. public_meetings view exists');
select bag_eq(
  $$select column_name::text
      from information_schema.columns
     where table_schema = 'public' and table_name = 'public_meetings'$$,
  $$values ('junto_slug'::text), ('meeting_date'), ('title'), ('theme'),
           ('description'), ('status')$$,
  '38. projection carries exactly the safe columns — no location, ' ||
  'essay_deadline, created_by, or ids'
);

-- ---------------------------------------------------------------------------
-- 39–45: no destructive path, immutable provenance, and projection grants
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'meetings'
      and cmd = 'DELETE'),
  0,
  '39. no delete policy exists on meetings'
);

select ok(
  not has_table_privilege('anon', 'public.meetings', 'SELECT')
  and not has_any_column_privilege('anon', 'public.meetings', 'SELECT')
  and not has_any_column_privilege('anon', 'public.meetings', 'INSERT')
  and not has_any_column_privilege('anon', 'public.meetings', 'UPDATE'),
  '40. anon holds no privilege at all on the meetings base table'
);

select ok(
  not has_table_privilege('authenticated', 'public.meetings', 'DELETE')
  and not has_table_privilege('anon', 'public.meetings', 'DELETE'),
  '41. API user roles hold no DELETE privilege — archive is the only removal'
);

select ok(
  not has_column_privilege('authenticated', 'public.meetings', 'junto_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.meetings', 'created_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.meetings', 'id', 'UPDATE'),
  '42. junto_id, created_by, and id can never be reassigned through the API'
);

select ok(
  not has_column_privilege('authenticated', 'public.meetings', 'created_by', 'INSERT')
  and not has_column_privilege('authenticated', 'public.meetings', 'id', 'INSERT'),
  '43. created_by and id can never be client-supplied on insert'
);

select ok(
  not has_table_privilege('anon', 'public.public_meetings', 'INSERT')
  and not has_table_privilege('anon', 'public.public_meetings', 'UPDATE')
  and not has_table_privilege('anon', 'public.public_meetings', 'DELETE')
  and not has_table_privilege('authenticated', 'public.public_meetings', 'INSERT')
  and not has_table_privilege('authenticated', 'public.public_meetings', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.public_meetings', 'DELETE'),
  '44. the public projection grants no write capability'
);

select ok(
  has_table_privilege('anon', 'public.public_meetings', 'SELECT')
  and has_table_privilege('authenticated', 'public.public_meetings', 'SELECT'),
  '45. visitors and authenticated users may read the public projection'
);

select * from finish();
rollback;
