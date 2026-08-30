-- T01: atomic chapter bootstrap for an existing active Junto admin.
-- Existing rows are untouched: NOT VALID bounds apply to new writes without
-- scanning or rewriting production data.
alter table public.juntos
  add constraint juntos_name_length
    check (char_length(btrim(name)) between 1 and 120) not valid,
  add constraint juntos_slug_length
    check (char_length(slug) between 1 and 63) not valid,
  add constraint juntos_description_length
    check (description is null or char_length(description) <= 2000) not valid,
  add constraint juntos_location_length
    check (location is null or char_length(location) <= 240) not valid;

-- The Data API caller supplies chapter metadata only. Identity, eligibility,
-- the new row id, active status, and first-admin membership are all derived
-- inside this transaction (docs/architecture/authorization.md, "Admin
-- permissions").
create function public.bootstrap_junto(
  chapter_name text,
  chapter_slug text,
  chapter_description text default null,
  chapter_location text default null,
  chapter_archive_visibility text default 'private'
)
returns table (junto_id uuid, junto_slug text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := (select auth.uid());
  v_junto_id uuid;
  v_name text := btrim(chapter_name);
  v_description text := nullif(btrim(chapter_description), '');
  v_location text := nullif(btrim(chapter_location), '');
begin
  -- Authorization runs before input/uniqueness checks so an ineligible caller
  -- cannot use error differences to probe private chapter identifiers.
  if v_user_id is null or not exists (
    select 1
      from public.junto_members m
     where m.user_id = v_user_id
       and m.role = 'admin'
       and m.status = 'active'
  ) then
    raise exception 'An active Junto administrator membership is required'
      using errcode = '42501';
  end if;

  if chapter_name is null
     or char_length(v_name) < 1
     or char_length(v_name) > 120 then
    raise exception 'Invalid chapter name' using errcode = '22023';
  end if;

  if chapter_slug is null
     or chapter_slug <> btrim(chapter_slug)
     or char_length(chapter_slug) > 63
     or chapter_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid chapter slug' using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Invalid chapter description' using errcode = '22023';
  end if;

  if v_location is not null and char_length(v_location) > 240 then
    raise exception 'Invalid chapter location' using errcode = '22023';
  end if;

  if chapter_archive_visibility is null
     or chapter_archive_visibility not in ('private', 'public') then
    raise exception 'Invalid archive visibility' using errcode = '22023';
  end if;

  insert into public.juntos (
    name,
    slug,
    description,
    location,
    archive_visibility,
    status
  ) values (
    v_name,
    chapter_slug,
    v_description,
    v_location,
    chapter_archive_visibility,
    'active'
  ) returning id into v_junto_id;

  insert into public.junto_members as m (junto_id, user_id, role, status)
  values (v_junto_id, v_user_id, 'admin', 'active')
  on conflict (junto_id, user_id) do update
    set role = 'admin', status = 'active';

  return query select v_junto_id, chapter_slug;
end;
$$;

-- Functions are executable by PUBLIC by default. This privileged endpoint is
-- deliberately callable only by authenticated requests; its body still
-- independently proves the caller's live admin eligibility.
revoke all on function public.bootstrap_junto(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.bootstrap_junto(text, text, text, text, text)
  to authenticated;
