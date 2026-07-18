-- T02: identity, Juntos, invitations, and memberships.
-- Schema per docs/architecture/data-model.md §12; invitation lifecycle per
-- docs/membership/authentication-and-membership.md §3.

-- §3.1: email matching ignores capitalization and trims whitespace.
create function public.normalize_email(email text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(btrim(email, E' \t\r\n\f\v'));
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profiles are created only when an invitation is claimed (strict
-- invitation-gated model): there is deliberately no auth.users trigger that
-- creates one on signup.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.juntos (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  location text,
  archive_visibility text not null default 'private'
    check (archive_visibility in ('public', 'private')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invitations are historical claim evidence, not the durable authorization
-- source (§3.2); junto_members is.
create table public.junto_invitations (
  id uuid primary key default gen_random_uuid(),
  junto_id uuid not null references public.juntos (id),
  email_normalized text not null
    check (
      email_normalized = public.normalize_email(email_normalized)
      and position('@' in email_normalized) > 1
    ),
  invited_by uuid references auth.users (id) on delete set null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'revoked', 'expired')),
  expires_at timestamptz,
  -- claimed_by has no cascade: a claimed invitation is durable evidence.
  claimed_by uuid references auth.users (id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint junto_invitations_claim_evidence check (
    (status = 'claimed' and claimed_by is not null and claimed_at is not null)
    or (status <> 'claimed' and claimed_by is null and claimed_at is null)
  )
);

create unique index junto_invitations_one_pending_per_email
  on public.junto_invitations (junto_id, email_normalized)
  where status = 'pending';
create index junto_invitations_pending_email_idx
  on public.junto_invitations (email_normalized)
  where status = 'pending';

create table public.junto_members (
  id uuid primary key default gen_random_uuid(),
  junto_id uuid not null references public.juntos (id),
  user_id uuid not null references auth.users (id),
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (junto_id, user_id),
  constraint junto_members_deactivation_evidence check (
    (status = 'inactive') = (deactivated_at is not null)
  )
);

create index junto_members_user_id_idx on public.junto_members (user_id);

-- Normalize the invitation email and derive invited_by from the
-- authenticated identity; client-supplied inviter identity is never trusted.
create function public.prepare_invitation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email_normalized := public.normalize_email(new.email_normalized);
  if auth.uid() is not null then
    new.invited_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger junto_invitations_prepare
  before insert on public.junto_invitations
  for each row execute function public.prepare_invitation();

-- Keep deactivation evidence consistent with status transitions (§3.4).
create function public.sync_membership_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'inactive' and new.deactivated_at is null then
    new.deactivated_at := now();
  elsif new.status = 'active' then
    new.deactivated_at := null;
  end if;
  return new;
end;
$$;

create trigger junto_members_sync_deactivation
  before insert or update on public.junto_members
  for each row execute function public.sync_membership_deactivation();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger juntos_set_updated_at
  before update on public.juntos
  for each row execute function public.set_updated_at();
create trigger junto_members_set_updated_at
  before update on public.junto_members
  for each row execute function public.set_updated_at();
