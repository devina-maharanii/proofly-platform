-- Proofly Phase 12 follow-up: reviewer approval must resolve an existing pending request.
-- Owner: Organizations and memberships module. Risk: privilege elevation. Rollback: retain function version and disable reviewer-resolution path.

create or replace function public.resolve_reviewer_capability(
  target_user_id uuid,
  approve boolean,
  resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_administrator() then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  update public.capability_requests
  set status = case when approve then 'approved'::public.capability_request_status else 'declined'::public.capability_request_status end,
      resolved_at = now(),
      resolved_by = actor_id,
      resolution_note = left(nullif(trim(resolution_note), ''), 500)
  where user_id = target_user_id
    and requested_role = 'reviewer'
    and status = 'pending';

  if not found then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  if approve then
    insert into public.role_capabilities (user_id, capabilities, reviewer_approved_at, granted_by)
    values (target_user_id, array['reviewer']::public.platform_role[], now(), actor_id)
    on conflict (user_id) do update
      set capabilities = array(select distinct role from unnest(public.role_capabilities.capabilities || excluded.capabilities) as role),
          reviewer_approved_at = excluded.reviewer_approved_at,
          granted_by = excluded.granted_by,
          updated_at = now();
  end if;

  insert into public.authorization_events (actor_user_id, target_user_id, event_type, metadata)
  values (actor_id, target_user_id, 'reviewer.resolved', jsonb_build_object('approved', approve));
end;
$$;
