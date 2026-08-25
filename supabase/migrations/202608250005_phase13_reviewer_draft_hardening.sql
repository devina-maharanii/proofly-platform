-- Owner: Identity and onboarding module. Risk: draft data minimization and reviewer request state. Rollback: disable reviewer onboarding routes; retain private drafts and request audit history.

alter table public.onboarding_progress
  add constraint onboarding_progress_draft_size_check
  check (octet_length(draft::text) <= 12000);

create or replace function public.save_reviewer_onboarding_draft(
  requested_draft jsonb,
  requested_skipped_fields text[] default array[]::text[],
  requested_step_key text default null
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.onboarding_progress;
  valid_keys text[] := array[
    'full_name', 'display_name', 'primary_purpose', 'timezone', 'locale',
    'notification_email', 'notification_product', 'expertise_areas',
    'experience_evidence'
  ];
begin
  if actor_id is null
     or jsonb_typeof(requested_draft) <> 'object'
     or cardinality(requested_skipped_fields) > 8
     or (requested_step_key is not null and requested_step_key !~ '^[a-z_]{1,40}$')
     or exists (
       select 1
       from jsonb_object_keys(requested_draft) as key
       where key <> all(valid_keys)
     )
     or exists (
       select 1
       from unnest(requested_skipped_fields) as skipped_field
       where skipped_field <> 'portfolio_url'
     ) then
    raise exception 'VALIDATION_FAILED';
  end if;

  insert into public.onboarding_progress (
    user_id,
    role,
    organization_id,
    state,
    draft,
    skipped_fields
  )
  values (
    actor_id,
    'reviewer',
    null,
    'in_progress',
    requested_draft,
    requested_skipped_fields
  )
  on conflict (user_id, role, organization_id) do update
    set draft = excluded.draft,
        skipped_fields = excluded.skipped_fields,
        updated_at = now()
    where public.onboarding_progress.state = 'in_progress'
  returning * into result;

  if result.id is null then
    select * into result
    from public.onboarding_progress progress
    where progress.user_id = actor_id
      and progress.role = 'reviewer'
      and progress.organization_id is null;
    return result;
  end if;

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type,
    step_key
  )
  values (
    result.id,
    actor_id,
    'reviewer',
    null,
    'onboarding.draft_saved',
    requested_step_key
  );

  return result;
end;
$$;

create or replace function public.complete_reviewer_onboarding(
  requested_draft jsonb,
  requested_skipped_fields text[] default array[]::text[]
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.onboarding_progress;
begin
  if actor_id is null
     or nullif(trim(coalesce(requested_draft ->> 'full_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'display_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'primary_purpose', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'timezone', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'locale', '')), '') is null
     or jsonb_typeof(requested_draft -> 'expertise_areas') <> 'array'
     or jsonb_array_length(requested_draft -> 'expertise_areas') = 0
     or nullif(trim(coalesce(requested_draft ->> 'experience_evidence', '')), '') is null then
    raise exception 'VALIDATION_FAILED';
  end if;

  perform public.save_reviewer_onboarding_draft(
    requested_draft,
    requested_skipped_fields,
    'review'
  );

  update public.onboarding_progress
  set state = 'needs_review',
      completed_at = null,
      updated_at = now()
  where user_id = actor_id
    and role = 'reviewer'
    and organization_id is null
  returning * into result;

  insert into public.capability_requests (user_id, requested_role, status)
  values (actor_id, 'reviewer', 'pending')
  on conflict (user_id, requested_role) do update
    set status = case
      when public.capability_requests.status in ('declined', 'withdrawn') then 'pending'::public.capability_request_status
      else public.capability_requests.status
    end,
    requested_at = case
      when public.capability_requests.status in ('declined', 'withdrawn') then now()
      else public.capability_requests.requested_at
    end,
    resolved_at = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolved_at
    end,
    resolved_by = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolved_by
    end,
    resolution_note = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolution_note
    end;

  insert into public.authorization_events (actor_user_id, target_user_id, event_type)
  values (actor_id, actor_id, 'reviewer.requested');

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type
  )
  values (
    result.id,
    actor_id,
    'reviewer',
    null,
    'onboarding.reviewer_requested'
  );

  return result;
end;
$$;

revoke all on function public.save_reviewer_onboarding_draft(jsonb, text[], text) from public, anon;
grant execute on function public.save_reviewer_onboarding_draft(jsonb, text[], text) to authenticated;
