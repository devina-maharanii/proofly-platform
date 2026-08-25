create or replace function public.is_bounded_profile_text_list(
  candidate jsonb,
  maximum_items integer,
  maximum_characters integer
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select jsonb_typeof(candidate) = 'array'
    and jsonb_array_length(candidate) <= maximum_items
    and not exists (
      select 1
      from jsonb_array_elements(candidate) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or char_length(item.value #>> '{}') = 0
        or char_length(item.value #>> '{}') > maximum_characters
    );
$$;

alter table public.talent_profile_drafts
  add constraint talent_profile_drafts_languages_text_list_check
    check (public.is_bounded_profile_text_list(languages, 8, 80)),
  add constraint talent_profile_drafts_project_types_text_list_check
    check (public.is_bounded_profile_text_list(preferred_project_types, 8, 80));

revoke all on function public.is_bounded_profile_text_list(jsonb, integer, integer)
  from public, anon, authenticated;

revoke all on function public.publish_talent_profile() from authenticated;
drop function public.publish_talent_profile();

create function public.publish_talent_profile(
  acknowledged_public_fields boolean
)
returns public.talent_profile_publications
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_profile_actor();
  draft public.talent_profile_drafts;
  skill_snapshot jsonb;
  link_snapshot jsonb;
  publication_snapshot jsonb;
  result public.talent_profile_publications;
begin
  if acknowledged_public_fields is distinct from true then
    raise exception 'CONFIRMATION_REQUIRED';
  end if;

  select * into draft
  from public.talent_profile_drafts
  where user_id = actor_id;

  if draft.user_id is null or draft.draft_state <> 'ready_to_preview' then
    raise exception 'VALIDATION_FAILED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'skill_key', skill_key,
        'claimed_level', claimed_level,
        'context', context,
        'status', 'claimed'
      )
      order by skill_key
    ),
    '[]'::jsonb
  )
  into skill_snapshot
  from public.talent_profile_skills
  where user_id = actor_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('link_type', link_type, 'label', label, 'url', url)
      order by created_at
    ),
    '[]'::jsonb
  )
  into link_snapshot
  from public.talent_profile_links
  where user_id = actor_id and is_public;

  publication_snapshot := jsonb_build_object(
    'handle', draft.handle,
    'display_name', draft.display_name,
    'profile_image_url', case when draft.profile_image_visibility = 'public' then draft.profile_image_url else '' end,
    'headline', draft.headline,
    'introduction', draft.introduction,
    'location_name', case when draft.location_visibility = 'public' then draft.location_name else '' end,
    'timezone', case when draft.timezone_visibility = 'public' then draft.timezone else '' end,
    'developer_focus', draft.developer_focus,
    'current_experience_level', draft.current_experience_level,
    'preferred_project_types', draft.preferred_project_types,
    'availability_window', draft.availability_window,
    'engagement_preference', draft.engagement_preference,
    'timezone_overlap_preference', draft.timezone_overlap_preference,
    'remote_collaboration_preference', draft.remote_collaboration_preference,
    'target_opportunity_type', draft.target_opportunity_type,
    'skills', skill_snapshot,
    'links', link_snapshot,
    'proof_status', 'No verified proof yet'
  );

  insert into public.talent_profile_publications (
    user_id,
    handle,
    state,
    snapshot,
    source_profile_version,
    published_at,
    hidden_at,
    updated_at
  )
  values (
    actor_id,
    draft.handle,
    'published',
    publication_snapshot,
    draft.version,
    now(),
    null,
    now()
  )
  on conflict (user_id) do update
  set
    handle = excluded.handle,
    state = 'published',
    snapshot = excluded.snapshot,
    source_profile_version = excluded.source_profile_version,
    published_at = now(),
    hidden_at = null,
    updated_at = now()
  returning * into result;

  insert into public.talent_profile_events (actor_user_id, event_type)
  values (actor_id, 'talent_profile.published');

  return result;
end;
$$;

revoke all on function public.publish_talent_profile(boolean) from public, anon;
grant execute on function public.publish_talent_profile(boolean) to authenticated;
