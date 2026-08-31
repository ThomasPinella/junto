-- Public chapter applications are durable private records. Anonymous callers
-- receive only the bounded submit RPC; the exact verified reviewer receives
-- only the list/decision RPCs (docs/architecture/authorization.md,
-- "Chapter applications").
-- The new static reviewer route also reserves its exact first path segment.
-- NOT VALID protects new writes immediately; explicit validation makes the
-- migration fail rather than preserve a pre-existing conflicting chapter.
alter table public.juntos
  add constraint juntos_slug_not_applications
  check (slug <> 'applications') not valid;

alter table public.juntos
  validate constraint juntos_slug_not_applications;

create table public.chapter_applications (
  id uuid primary key default gen_random_uuid(),
  chapter_name text not null
    check (char_length(btrim(chapter_name)) between 1 and 120),
  location text not null
    check (char_length(btrim(location)) between 1 and 240),
  applicant_email_normalized text not null
    check (
      applicant_email_normalized = public.normalize_email(applicant_email_normalized)
      and char_length(applicant_email_normalized) between 3 and 254
      and applicant_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  intent_note text not null
    check (char_length(btrim(intent_note)) between 1 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  junto_id uuid references public.juntos (id),
  created_at timestamptz not null default now(),
  constraint chapter_applications_decision_evidence check (
    (status = 'pending'
      and reviewed_by is null and reviewed_at is null and junto_id is null)
    or (status = 'declined'
      and reviewed_by is not null and reviewed_at is not null and junto_id is null)
    or (status = 'approved'
      and reviewed_by is not null and reviewed_at is not null and junto_id is not null)
  )
);

create unique index chapter_applications_one_pending_per_email
  on public.chapter_applications (applicant_email_normalized)
  where status = 'pending';

create index chapter_applications_review_order
  on public.chapter_applications (status, created_at desc);

alter table public.chapter_applications enable row level security;

-- No table policy is intentional. Even the reviewer uses narrow RPCs, so
-- direct Data API reads/writes cannot grow into an accidental private-data API.
revoke all on table public.chapter_applications from public, anon, authenticated;
grant all on table public.chapter_applications to service_role;

create function public.submit_chapter_application(
  application_chapter_name text,
  application_location text,
  application_email text,
  application_intent_note text,
  application_website text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_name text := btrim(application_chapter_name);
  v_location text := btrim(application_location);
  v_email text := public.normalize_email(application_email);
  v_note text := btrim(application_intent_note);
begin
  if application_chapter_name is null
     or char_length(v_name) not between 1 and 120 then
    raise exception 'Invalid chapter name' using errcode = '22023';
  end if;
  if application_location is null
     or char_length(v_location) not between 1 and 240 then
    raise exception 'Invalid chapter location' using errcode = '22023';
  end if;
  if application_email is null
     or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid applicant email' using errcode = '22023';
  end if;
  if application_intent_note is null
     or char_length(v_note) not between 1 and 1000 then
    raise exception 'Invalid intent note' using errcode = '22023';
  end if;
  if application_website is null or char_length(application_website) > 200 then
    raise exception 'Invalid website field' using errcode = '22023';
  end if;

  -- Filled honeypots, fresh submissions, and duplicate pending submissions
  -- all return void so anonymous callers cannot infer application state.
  if btrim(application_website) <> '' then
    return;
  end if;

  insert into public.chapter_applications (
    chapter_name,
    location,
    applicant_email_normalized,
    intent_note
  ) values (v_name, v_location, v_email, v_note)
  on conflict (applicant_email_normalized) where status = 'pending'
  do nothing;
end;
$$;

create function public.list_chapter_applications()
returns table (
  application_id uuid,
  chapter_name text,
  application_location text,
  applicant_email text,
  intent_note text,
  application_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  junto_id uuid,
  junto_slug text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not exists (
    select 1
      from auth.users u
     where u.id = v_user_id
       and u.email_confirmed_at is not null
       and public.normalize_email(u.email) = 'txpinella@gmail.com'
  ) then
    raise exception 'Chapter application reviewer access is required'
      using errcode = '42501';
  end if;

  return query
  select a.id,
         a.chapter_name,
         a.location,
         a.applicant_email_normalized,
         a.intent_note,
         a.status,
         a.created_at,
         a.reviewed_at,
         a.junto_id,
         j.slug
    from public.chapter_applications a
    left join public.juntos j on j.id = a.junto_id
   order by (a.status = 'pending') desc, a.created_at desc, a.id;
end;
$$;

create function public.decide_chapter_application(
  target_application_id uuid,
  application_decision text,
  approved_chapter_slug text default null
)
returns table (
  application_id uuid,
  application_status text,
  applicant_email text,
  chapter_name text,
  chapter_id uuid,
  chapter_slug text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := (select auth.uid());
  v_application public.chapter_applications%rowtype;
  v_junto_id uuid;
begin
  -- Authorization deliberately precedes decision and slug validation, so an
  -- ordinary authenticated caller cannot probe private application state or
  -- chapter-slug availability through error differences.
  if v_user_id is null or not exists (
    select 1
      from auth.users u
     where u.id = v_user_id
       and u.email_confirmed_at is not null
       and public.normalize_email(u.email) = 'txpinella@gmail.com'
  ) then
    raise exception 'Chapter application reviewer access is required'
      using errcode = '42501';
  end if;

  if target_application_id is null
     or application_decision is null
     or application_decision not in ('approve', 'decline') then
    raise exception 'Invalid application decision' using errcode = '22023';
  end if;

  if application_decision = 'approve' and (
    approved_chapter_slug is null
    or approved_chapter_slug <> btrim(approved_chapter_slug)
    or char_length(approved_chapter_slug) not between 1 and 63
    or approved_chapter_slug in ('sign-in', 'applications')
    or approved_chapter_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ) then
    raise exception 'Invalid chapter slug' using errcode = '22023';
  end if;
  if application_decision = 'decline'
     and nullif(btrim(approved_chapter_slug), '') is not null then
    raise exception 'Declines cannot create a chapter' using errcode = '22023';
  end if;

  select a.*
    into v_application
    from public.chapter_applications a
   where a.id = target_application_id
     and a.status = 'pending'
     for update;

  if not found then
    raise exception 'Application is not pending' using errcode = '22023';
  end if;

  if application_decision = 'approve' then
    insert into public.juntos (
      name,
      slug,
      location,
      archive_visibility,
      status
    ) values (
      v_application.chapter_name,
      approved_chapter_slug,
      v_application.location,
      'private',
      'active'
    ) returning id into v_junto_id;

    insert into public.junto_invitations (
      junto_id,
      email_normalized,
      invited_by,
      role,
      status
    ) values (
      v_junto_id,
      v_application.applicant_email_normalized,
      v_user_id,
      'admin',
      'pending'
    );

    update public.chapter_applications a
       set status = 'approved',
           reviewed_by = v_user_id,
           reviewed_at = now(),
           junto_id = v_junto_id
     where a.id = v_application.id;
  else
    update public.chapter_applications a
       set status = 'declined',
           reviewed_by = v_user_id,
           reviewed_at = now()
     where a.id = v_application.id;
  end if;

  return query
  select v_application.id,
         case when application_decision = 'approve' then 'approved' else 'declined' end,
         v_application.applicant_email_normalized,
         v_application.chapter_name,
         v_junto_id,
         approved_chapter_slug;
end;
$$;

-- PostgreSQL grants function EXECUTE to PUBLIC by default. Each exposed
-- SECURITY DEFINER RPC is closed first, then reopened only to its intended
-- Data API role.
revoke all on function public.submit_chapter_application(text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_chapter_application(text, text, text, text, text)
  to anon, authenticated;

revoke all on function public.list_chapter_applications()
  from public, anon, authenticated, service_role;
grant execute on function public.list_chapter_applications()
  to authenticated;

revoke all on function public.decide_chapter_application(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.decide_chapter_application(uuid, text, text)
  to authenticated;
