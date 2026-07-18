-- T02: Row Level Security and grants for identity and membership tables.
-- RLS is the authorization boundary (docs/architecture/authorization.md §13):
-- active junto_members rows — never invitations or UI state — authorize each
-- Junto independently, and admin authority is scoped to the Junto where the
-- active membership carries the admin role.

-- Helpers run as the definer (table owner) so policies can consult
-- junto_members without recursive RLS evaluation. They derive identity solely
-- from auth.uid().
create function public.is_active_member(target_junto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.junto_members m
    where m.junto_id = target_junto_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function public.is_junto_admin(target_junto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.junto_members m
    where m.junto_id = target_junto_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

create function public.shares_active_junto(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.junto_members mine
    join public.junto_members theirs on theirs.junto_id = mine.junto_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = other_user_id
      and theirs.status = 'active'
  );
$$;

revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.is_junto_admin(uuid) from public;
revoke all on function public.shares_active_junto(uuid) from public;
grant execute on function public.is_active_member(uuid) to anon, authenticated, service_role;
grant execute on function public.is_junto_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.shares_active_junto(uuid) to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.juntos enable row level security;
alter table public.junto_invitations enable row level security;
alter table public.junto_members enable row level security;

-- profiles: own profile plus co-members of a shared active Junto
-- (docs/membership/user-roles.md §2 "view other active members").
-- Public profile exposure is tied to public essays and arrives with the
-- essays schema (T05).
create policy profiles_select_own_or_co_member
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.shares_active_junto(id)
  );

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- juntos: visitors read active public Juntos; active members read their own
-- Junto regardless of archive visibility; only Junto admins update settings.
create policy juntos_select_public_or_member
  on public.juntos
  for select
  to anon, authenticated
  using (
    (status = 'active' and archive_visibility = 'public')
    or public.is_active_member(id)
  );

create policy juntos_update_admin
  on public.juntos
  for update
  to authenticated
  using (public.is_junto_admin(id))
  with check (public.is_junto_admin(id));

-- junto_invitations: admin-scoped per Junto. Claim evidence can never be
-- written directly by clients; it is recorded only by claim_invitations().
create policy junto_invitations_select_admin
  on public.junto_invitations
  for select
  to authenticated
  using (public.is_junto_admin(junto_id));

create policy junto_invitations_insert_admin
  on public.junto_invitations
  for insert
  to authenticated
  with check (
    public.is_junto_admin(junto_id)
    and status = 'pending'
    and claimed_by is null
    and claimed_at is null
  );

create policy junto_invitations_revoke_admin
  on public.junto_invitations
  for update
  to authenticated
  using (
    public.is_junto_admin(junto_id)
    and status = 'pending'
  )
  with check (
    public.is_junto_admin(junto_id)
    and status in ('pending', 'revoked')
  );

-- junto_members: users always see their own memberships; active members see
-- active co-members; admins see and manage every membership of their Junto.
create policy junto_members_select_own_or_junto
  on public.junto_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (status = 'active' and public.is_active_member(junto_id))
    or public.is_junto_admin(junto_id)
  );

create policy junto_members_update_admin
  on public.junto_members
  for update
  to authenticated
  using (public.is_junto_admin(junto_id))
  with check (public.is_junto_admin(junto_id));

-- Explicit grants (the Data API does not auto-expose new tables). Column
-- lists keep identity and scope columns (id, junto_id, user_id, claim
-- evidence) immutable to API roles; there are deliberately no insert grants
-- for memberships or profiles — those rows are created only by
-- claim_invitations() — and no delete grants: memberships and invitations
-- are durable records.
grant select on public.juntos to anon, authenticated;
grant update (name, description, location, archive_visibility, status)
  on public.juntos to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, slug, bio, avatar_url)
  on public.profiles to authenticated;

grant select on public.junto_invitations to authenticated;
grant insert (junto_id, email_normalized, role, expires_at)
  on public.junto_invitations to authenticated;
grant update (status, expires_at) on public.junto_invitations to authenticated;

grant select on public.junto_members to authenticated;
grant update (role, status) on public.junto_members to authenticated;

-- The server-side service role manages fixtures and privileged operations;
-- it bypasses RLS but still needs table privileges.
grant all on public.profiles, public.juntos, public.junto_invitations,
  public.junto_members to service_role;
