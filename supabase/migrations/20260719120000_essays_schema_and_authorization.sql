-- T05: essays — schema, author-scoped authorization, the validated
-- publication transition path, and the safe public projection.
--
-- Essays are the center of the product (docs/overview/product-principles.md
-- §1.1). Every essay carries junto_id (multi-Junto invariant) and one author;
-- Markdown is the canonical stored format (docs/planning/product-decisions.md
-- §14) — rendered HTML is never persisted, it is always derived through the
-- application's sanitized renderer. Publication status (draft|published) and
-- visibility (public|members_only) are separate concepts
-- (docs/content/essays.md §6.3); unpublishing is the revocation path — there
-- is no delete or archive flow for essays in this slice.

create table public.essays (
  id uuid primary key default gen_random_uuid(),
  junto_id uuid not null references public.juntos (id),
  -- Derived from auth.uid() on insert (see prepare_essay) and immutable
  -- afterwards. No cascade and no set-null: essays are the durable center of
  -- the archive, so an author's auth record cannot be hard-deleted while
  -- their essays exist. Removing a member is a membership-status change
  -- (docs/planning/product-decisions.md, "Removed members") and leaves
  -- already-public history intact.
  author_id uuid not null references auth.users (id),
  -- Nullable for future standalone essays (docs/content/essays.md §6.2). The
  -- composite foreign key below pins any assigned meeting to the essay's own
  -- Junto through T04's (junto_id, id) seam, so an essay can never reference
  -- another Junto's meeting — on creation or by later reassignment.
  meeting_id uuid,
  title text not null check (btrim(title) <> ''),
  -- Globally unique because public essay URLs are /essays/[slug]
  -- (docs/content/essays.md §6.4). Immutable through the API (no update
  -- grant): title edits never break an established link (§6.7).
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle text check (subtitle is null or btrim(subtitle) <> ''),
  body_markdown text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  visibility text not null default 'members_only'
    check (visibility in ('public', 'members_only')),
  -- published_at reflects the CURRENT publication: stamped when a draft is
  -- published, preserved across visibility-only changes, cleared on
  -- unpublish, and stamped fresh on republish — a withdrawal is honest
  -- history, not a hidden continuation. The two-way check keeps status and
  -- timestamp coherent by construction.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint essays_slug_unique unique (slug),
  constraint essays_junto_meeting_fkey
    foreign key (junto_id, meeting_id)
    references public.meetings (junto_id, id),
  constraint essays_publication_evidence check (
    (status = 'published') = (published_at is not null)
  ),
  -- Drafts may hold work in progress (even an empty body), but nothing
  -- incomplete can ever be published (docs/content/essays.md §6.3).
  constraint essays_published_complete check (
    status = 'draft' or btrim(body_markdown) <> ''
  )
);

create index essays_junto_status_idx
  on public.essays (junto_id, status);
create index essays_author_idx on public.essays (author_id);
create index essays_junto_meeting_idx
  on public.essays (junto_id, meeting_id);
-- The public archive lists published public essays by recency.
create index essays_public_published_idx
  on public.essays (published_at desc)
  where status = 'published' and visibility = 'public';

-- author_id always derives from the authenticated identity; client-supplied
-- authorship is never trusted (and the column is not even insertable by API
-- roles — see grants below).
create function public.prepare_essay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger essays_prepare
  before insert on public.essays
  for each row execute function public.prepare_essay();

-- Admin moderation is not ghostwriting (docs/planning/product-decisions.md
-- §14, "Essay ownership"): an admin may moderate metadata and publication,
-- but only the author changes the words. Column grants cannot draw this line
-- (author and admin share the `authenticated` role), so the trigger enforces
-- it for API roles; the table owner and service_role fixtures are unaffected.
create function public.guard_essay_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.body_markdown is distinct from old.body_markdown
     and old.author_id is distinct from (select auth.uid()) then
    raise exception 'Only the author may change the essay body'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger essays_guard_update
  before update on public.essays
  for each row execute function public.guard_essay_update();

create trigger essays_set_updated_at
  before update on public.essays
  for each row execute function public.set_updated_at();

alter table public.essays enable row level security;

-- Reads (docs/architecture/authorization.md §13, docs/content/essays.md
-- §6.3/§6.5): published essays of either visibility are readable by active
-- same-Junto members; drafts only by their active author or the Junto's own
-- active admin. Deactivation therefore revokes draft access immediately —
-- including the author's own. Anonymous and cross-Junto readers have no path
-- to the base table at all; public reading goes exclusively through the
-- public_essays projection.
create policy essays_select_member_scoped
  on public.essays
  for select
  to authenticated
  using (
    (status = 'published' and public.is_active_member(junto_id))
    or (author_id = (select auth.uid()) and public.is_active_member(junto_id))
    or public.is_junto_admin(junto_id)
  );

-- A member creates essays only for themselves, only in a Junto where they
-- hold an active membership, and only as drafts (publication is a deliberate
-- transition, never an insert).
create policy essays_insert_own_draft
  on public.essays
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_active_member(junto_id)
    and status = 'draft'
    and published_at is null
  );

-- Content updates: the active author edits their own essay; the Junto's own
-- admin moderates. The guard trigger above keeps admin hands off the body,
-- and column grants keep identity, slug, and publication state out of reach.
create policy essays_update_author_or_admin
  on public.essays
  for update
  to authenticated
  using (
    (author_id = (select auth.uid()) and public.is_active_member(junto_id))
    or public.is_junto_admin(junto_id)
  )
  with check (
    (author_id = (select auth.uid()) and public.is_active_member(junto_id))
    or public.is_junto_admin(junto_id)
  );

-- Deliberately no delete policy and no delete grant for API user roles:
-- unpublishing is the revocation path, and the record itself survives.

-- Column-scoped grants: id, author_id, status, and published_at can never be
-- client-supplied; junto_id is insert-only (RLS requires an active
-- membership there); slug is insert-only so links stay stable; publication
-- state changes only through transition_essay().
grant select on public.essays to authenticated;
grant insert (junto_id, meeting_id, title, slug, subtitle, body_markdown,
  visibility)
  on public.essays to authenticated;
grant update (title, subtitle, body_markdown, meeting_id)
  on public.essays to authenticated;

-- Privileged fixtures/tests only; never application code.
grant all on public.essays to service_role;

-- The validated publication transition path (docs/content/essays.md §6.6).
-- Ordinary updates cannot touch status/visibility/published_at, so every
-- publish, unpublish, and visibility change flows through here:
--   * identity is rederived from auth.uid();
--   * authority requires the active author or the Junto's own active admin,
--     and denial is uniform (42501) whether the essay is missing or merely
--     not theirs;
--   * any transition that would make an essay internet-visible when it is
--     not already requires explicit confirmation;
--   * published_at is stamped on publish, preserved across visibility-only
--     changes, cleared on unpublish, and stamped fresh on republish;
--   * every effect is immediate — the projection's WHERE clause reads the
--     new state on the very next query.
create function public.transition_essay(
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
  if new_status not in ('draft', 'published') then
    raise exception 'invalid-status' using errcode = '22023';
  end if;
  if new_visibility not in ('public', 'members_only') then
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

  if new_status = 'published' and new_visibility = 'public'
     and not (v_row.status = 'published' and v_row.visibility = 'public')
     and not confirm_public_exposure then
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

revoke all on function public.transition_essay(uuid, text, text, boolean)
  from public;
grant execute on function public.transition_essay(uuid, text, text, boolean)
  to authenticated, service_role;

-- The public projection: visitors read published public essays of active
-- public-archive Juntos, and nothing else. Private and internal columns —
-- ids, status/visibility machinery, membership data, emails, meeting
-- location and deadline — simply do not exist here, and no foreign-key
-- column is exposed, so PostgREST cannot embed sensitive relations around
-- it. The view runs with its owner's rights (security_invoker = false) as
-- the deliberate, narrow exception to base-table RLS; its WHERE clause is
-- the entire public boundary, and security_barrier keeps caller predicates
-- from being pushed beneath it. The inner profile join is total by
-- construction (author_id restricts auth-user deletion, whose profile
-- cascade is therefore unreachable while essays exist).
create view public.public_essays
  with (security_invoker = false, security_barrier = true)
  as
select
  e.slug,
  e.title,
  e.subtitle,
  e.body_markdown,
  e.published_at,
  p.display_name as author_name,
  p.slug as author_slug,
  j.name as junto_name,
  j.slug as junto_slug,
  m.meeting_date,
  m.title as meeting_title
from public.essays e
join public.juntos j on j.id = e.junto_id
join public.profiles p on p.id = e.author_id
left join public.meetings m
  on m.junto_id = e.junto_id and m.id = e.meeting_id
where e.status = 'published'
  and e.visibility = 'public'
  and j.status = 'active'
  and j.archive_visibility = 'public';

revoke all on public.public_essays from public;
grant select on public.public_essays to anon, authenticated, service_role;
