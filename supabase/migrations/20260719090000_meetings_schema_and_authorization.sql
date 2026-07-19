-- T04: meetings — schema, Junto-scoped authorization, and the safe public
-- projection.
--
-- Meetings organize essays around a gathering (docs/content/meetings.md §5).
-- Every meeting carries junto_id (multi-Junto invariant), active members of
-- that Junto read full details, only that Junto's admins create/edit them,
-- and the public sees a deliberately narrow projection for active public
-- Juntos only. Meetings are archived — never hard-deleted — so essays and
-- the historical public record survive (docs/content/meetings.md,
-- "Deleting meetings").

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  junto_id uuid not null references public.juntos (id),
  meeting_date date not null,
  title text check (title is null or btrim(title) <> ''),
  theme text check (theme is null or btrim(theme) <> ''),
  description text,
  -- Private to active members: never exposed through the public projection.
  location text,
  essay_deadline timestamptz,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'completed', 'cancelled', 'archived')),
  -- Derived from auth.uid() on insert (see prepare_meeting); on delete set
  -- null keeps the meeting as a durable chapter record if the creator's
  -- account is ever removed.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The documented public date URL (/juntos/[slug]/meetings/[date]) must
  -- resolve deterministically: one meeting per Junto per date.
  constraint meetings_junto_date_unique unique (junto_id, meeting_date),
  -- Integrity seam for T05: essays will carry (junto_id, meeting_id) and
  -- reference this pair, so an essay can never attach to a meeting of
  -- another Junto.
  constraint meetings_junto_id_id_unique unique (junto_id, id)
);

create index meetings_junto_status_date_idx
  on public.meetings (junto_id, status, meeting_date);

-- created_by always derives from the authenticated identity; client-supplied
-- creator identity is never trusted (and the column is not even insertable
-- by API roles — see grants below).
create function public.prepare_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger meetings_prepare
  before insert on public.meetings
  for each row execute function public.prepare_meeting();

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

-- Full meeting rows (including location and essay_deadline) are for active
-- same-Junto members only; the anon role has no path to the base table.
create policy meetings_select_member
  on public.meetings
  for select
  to authenticated
  using (public.is_active_member(junto_id));

-- Only the selected Junto's own active admins create and edit meetings.
-- Authority derives from the live junto_members record via auth.uid()
-- (docs/architecture/authorization.md §13); admin rights in one Junto grant
-- nothing in another.
create policy meetings_insert_admin
  on public.meetings
  for insert
  to authenticated
  with check (public.is_junto_admin(junto_id));

create policy meetings_update_admin
  on public.meetings
  for update
  to authenticated
  using (public.is_junto_admin(junto_id))
  with check (public.is_junto_admin(junto_id));

-- Deliberately no delete policy and no delete grant for API user roles:
-- archiving (status = 'archived') is the only way a meeting leaves the
-- upcoming program, and the record itself always survives.

-- Column-scoped grants keep identity and provenance immutable to API roles:
-- id, junto_id, and created_by can never be supplied or reassigned through
-- the Data API, so a meeting cannot be moved to another Junto or re-attributed.
grant select on public.meetings to authenticated;
grant insert (junto_id, meeting_date, title, theme, description, location,
  essay_deadline, status)
  on public.meetings to authenticated;
grant update (meeting_date, title, theme, description, location,
  essay_deadline, status)
  on public.meetings to authenticated;

-- Privileged fixtures/tests only; never application code.
grant all on public.meetings to service_role;

-- The public projection: visitors browse meeting records of active public
-- Juntos without location, essay deadline, creator identity, or any other
-- private column — those fields simply do not exist here. The view runs with
-- its owner's rights (security_invoker = false) as the deliberate, narrow
-- exception to base-table RLS; its WHERE clause is the entire public
-- boundary, and security_barrier keeps caller predicates from being pushed
-- beneath it. Archived, cancelled, and completed meetings remain part of the
-- honest historical record.
create view public.public_meetings
  with (security_invoker = false, security_barrier = true)
  as
select
  j.slug as junto_slug,
  m.meeting_date,
  m.title,
  m.theme,
  m.description,
  m.status
from public.meetings m
join public.juntos j on j.id = m.junto_id
where j.status = 'active'
  and j.archive_visibility = 'public';

revoke all on public.public_meetings from public;
grant select on public.public_meetings to anon, authenticated, service_role;
