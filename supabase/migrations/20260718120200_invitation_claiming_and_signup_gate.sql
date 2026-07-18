-- T02: invitation claiming and the invitation-gated signup boundary.
--
-- Claiming (docs/membership/authentication-and-membership.md §3.2) derives
-- identity exclusively from auth.uid() and that user's verified email in
-- auth.users. Callers supply nothing, so an invitation can never be claimed
-- by a different verified identity.
create function public.claim_invitations()
returns table (junto_id uuid, membership_id uuid, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
-- Unqualified names in SQL below always mean table columns; locals are
-- v_-prefixed or explicitly assigned.
#variable_conflict use_column
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_display text;
  v_slug text;
  inv record;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to claim invitations'
      using errcode = '42501';
  end if;

  -- Only the verified email of the authenticated account may match (§3.1).
  select public.normalize_email(u.email)
    into v_email
    from auth.users u
   where u.id = v_user_id
     and u.email_confirmed_at is not null;

  if v_email is null then
    return;
  end if;

  for inv in
    select i.id, i.junto_id, i.role
      from public.junto_invitations i
     where i.status = 'pending'
       and i.email_normalized = v_email
       and (i.expires_at is null or i.expires_at > now())
     order by i.created_at, i.id
       for update
  loop
    -- First successful claim creates the profile; uninvited users never
    -- reach this point, so they never acquire one.
    if not exists (select 1 from public.profiles p where p.id = v_user_id) then
      v_display := split_part(v_email, '@', 1);
      v_slug := nullif(
        trim(both '-' from regexp_replace(lower(v_display), '[^a-z0-9]+', '-', 'g')),
        ''
      );
      if v_slug is null then
        v_slug := 'member';
      end if;
      if exists (select 1 from public.profiles p where p.slug = v_slug) then
        v_slug := v_slug || '-' || left(replace(v_user_id::text, '-', ''), 8);
      end if;
      insert into public.profiles (id, display_name, slug)
      values (v_user_id, v_display, v_slug)
      on conflict (id) do nothing;
    end if;

    -- Create or reactivate the durable membership record (§3.2 step 2);
    -- joined_at is preserved on reactivation.
    insert into public.junto_members as m (junto_id, user_id, role, status)
    values (inv.junto_id, v_user_id, inv.role, 'active')
    on conflict (junto_id, user_id) do update
      set status = 'active', role = excluded.role
    returning m.id into membership_id;

    -- Record historical claim evidence (§3.2 step 3).
    update public.junto_invitations i
       set status = 'claimed', claimed_by = v_user_id, claimed_at = now()
     where i.id = inv.id;

    junto_id := inv.junto_id;
    member_role := inv.role;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_invitations() from public;
grant execute on function public.claim_invitations() to authenticated, service_role;

-- Signup boundary: Supabase Auth's before-user-created hook (enabled in
-- supabase/config.toml) rejects any signup whose normalized email has no
-- pending, unexpired invitation. Combined with claim_invitations() and RLS,
-- an uninvited verified email acquires no auth user, no profile, no
-- membership, and no private data access.
-- security definer: the hook runs as supabase_auth_admin, which is subject
-- to RLS on junto_invitations and would otherwise see no rows.
create function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := public.normalize_email(
    coalesce(event -> 'user' ->> 'email', event ->> 'email', '')
  );
begin
  if v_email <> '' and exists (
    select 1
      from public.junto_invitations i
     where i.status = 'pending'
       and i.email_normalized = v_email
       and (i.expires_at is null or i.expires_at > now())
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sign-ups are by invitation only.'
    )
  );
end;
$$;

-- Only Supabase Auth may run the hook.
revoke all on function public.before_user_created_hook(jsonb) from public;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
