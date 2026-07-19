-- C11 correction (R11 finding 1): transition_essay() confirmed public
-- exposure with `... and not confirm_public_exposure`. Under SQL
-- three-valued logic `NOT NULL` evaluates to NULL and a PL/pgSQL IF does not
-- enter, so an explicit NULL — exactly what a JSON `null` through the
-- PostgREST RPC becomes — fell open: an authorized author or same-Junto
-- admin could make an essay published-public without explicit confirmation.
--
-- This replacement keeps the function's exact signature, grants, and every
-- accepted T05 property (identity rederivation, active author or same-Junto
-- admin authority with uniform denial, row locking, empty fixed search path,
-- publication-timestamp coherence, immediate effect, safe return shape) and
-- changes only the input semantics, fail-closed:
--   * only literal boolean TRUE is confirmation
--     (`confirm_public_exposure is not true` rejects NULL, FALSE, and
--     omitted alike — for authors and admins equally);
--   * NULL new_status / new_visibility are rejected deliberately as invalid
--     input (22023, the same stable SQLSTATE as the unknown-vocabulary
--     rejections) instead of drifting through three-valued comparisons into
--     later not-null constraint errors. The check is row-independent, so it
--     discloses nothing about row existence to unauthorized callers.
create or replace function public.transition_essay(
  target_essay_id uuid,
  new_status text,
  new_visibility text,
  confirm_public_exposure boolean default false
)
returns table (id uuid, status text, visibility text, published_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.essays%rowtype;
  v_published_at timestamptz;
begin
  if v_user is null then
    raise exception 'not-permitted' using errcode = '42501';
  end if;
  -- NULL never passes an IN test (it makes the condition NULL, not true),
  -- so it must be rejected by name.
  if new_status is null or new_status not in ('draft', 'published') then
    raise exception 'invalid-status' using errcode = '22023';
  end if;
  if new_visibility is null
     or new_visibility not in ('public', 'members_only') then
    raise exception 'invalid-visibility' using errcode = '22023';
  end if;

  select e.* into v_row
    from public.essays e
   where e.id = target_essay_id
     for update;
  if not found or not (
    (v_row.author_id = v_user and public.is_active_member(v_row.junto_id))
    or public.is_junto_admin(v_row.junto_id)
  ) then
    raise exception 'not-permitted' using errcode = '42501';
  end if;

  -- Only literal TRUE confirms: `is not true` is true for FALSE and for
  -- NULL, so both fail closed whenever the resulting state would be
  -- published-public and the essay is not already.
  if new_status = 'published' and new_visibility = 'public'
     and not (v_row.status = 'published' and v_row.visibility = 'public')
     and confirm_public_exposure is not true then
    raise exception 'confirmation-required';
  end if;

  if new_status = 'published' and btrim(v_row.body_markdown) = '' then
    raise exception 'essay-incomplete' using errcode = '23514';
  end if;

  if new_status = 'published' then
    -- Already published: the timestamp survives visibility changes.
    -- Publishing from draft (fresh or after an unpublish): stamp now.
    v_published_at := coalesce(v_row.published_at, now());
  else
    v_published_at := null;
  end if;

  update public.essays e
     set status = new_status,
         visibility = new_visibility,
         published_at = v_published_at
   where e.id = v_row.id;

  return query
    select e.id, e.status, e.visibility, e.published_at
      from public.essays e
     where e.id = v_row.id;
end;
$$;

-- create or replace preserves existing privileges; restated so the intended
-- least-privilege grant set is explicit in this migration too.
revoke all on function public.transition_essay(uuid, text, text, boolean)
  from public;
grant execute on function public.transition_essay(uuid, text, text, boolean)
  to authenticated, service_role;
