create type public.talent_profile_draft_state as enum ('draft', 'ready_to_preview');
create type public.talent_profile_publication_state as enum ('published', 'hidden');
create type public.profile_field_visibility as enum ('private', 'public');
create type public.talent_skill_claim_level as enum ('familiar', 'working', 'independent', 'advanced', 'reviewer');
create type public.talent_profile_link_type as enum ('website', 'portfolio');

create table public.talent_profile_drafts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  handle text unique check (handle is null or handle ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  profile_image_url text not null default '' check (char_length(profile_image_url) <= 500),
  profile_image_visibility public.profile_field_visibility not null default 'private',
  headline text not null default '' check (char_length(headline) <= 140),
  introduction text not null default '' check (char_length(introduction) <= 1200),
  location_name text not null default '' check (char_length(location_name) <= 120),
  location_visibility public.profile_field_visibility not null default 'private',
  timezone text not null default 'UTC' check (char_length(timezone) <= 80),
  timezone_visibility public.profile_field_visibility not null default 'private',
  languages jsonb not null default '[]'::jsonb check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 8),
  developer_focus text not null default '' check (char_length(developer_focus) <= 160),
  current_experience_level text not null default '' check (char_length(current_experience_level) <= 80),
  preferred_project_types jsonb not null default '[]'::jsonb check (jsonb_typeof(preferred_project_types) = 'array' and jsonb_array_length(preferred_project_types) <= 8),
  availability_window text not null default '' check (char_length(availability_window) <= 120),
  engagement_preference text not null default '' check (char_length(engagement_preference) <= 120),
  rate_range text not null default '' check (char_length(rate_range) <= 80),
  timezone_overlap_preference text not null default '' check (char_length(timezone_overlap_preference) <= 120),
  remote_collaboration_preference text not null default '' check (char_length(remote_collaboration_preference) <= 120),
  target_opportunity_type text not null default '' check (char_length(target_opportunity_type) <= 120),
  draft_state public.talent_profile_draft_state not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.talent_profile_skills (
  user_id uuid not null references public.talent_profile_drafts(user_id) on delete cascade,
  skill_key text not null check (skill_key in (
    'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
    'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
    'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
    'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
    'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
  )),
  claimed_level public.talent_skill_claim_level not null,
  context text not null default '' check (char_length(context) <= 360),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_key)
);

create table public.talent_profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.talent_profile_drafts(user_id) on delete cascade,
  link_type public.talent_profile_link_type not null,
  label text not null default '' check (char_length(label) <= 80),
  url text not null check (char_length(url) <= 500 and url ~ '^https://'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url)
);

create table public.talent_profile_publications (
  user_id uuid primary key references public.talent_profile_drafts(user_id) on delete restrict,
  handle text not null unique check (handle ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  state public.talent_profile_publication_state not null default 'hidden',
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  source_profile_version integer not null check (source_profile_version > 0),
  published_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((state = 'published' and published_at is not null and hidden_at is null) or (state = 'hidden' and hidden_at is not null))
);

create table public.talent_profile_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('talent_profile.draft_saved', 'talent_profile.ready_to_preview', 'talent_profile.published', 'talent_profile.hidden')),
  occurred_at timestamptz not null default now()
);

create index talent_profile_skills_user_idx on public.talent_profile_skills(user_id);
create index talent_profile_links_user_idx on public.talent_profile_links(user_id);
create index talent_profile_publications_handle_state_idx on public.talent_profile_publications(handle, state);
create index talent_profile_events_actor_occurred_idx on public.talent_profile_events(actor_user_id, occurred_at desc);

alter table public.talent_profile_drafts enable row level security;
alter table public.talent_profile_skills enable row level security;
alter table public.talent_profile_links enable row level security;
alter table public.talent_profile_publications enable row level security;
alter table public.talent_profile_events enable row level security;

create policy "talent can view own profile draft" on public.talent_profile_drafts for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own profile skills" on public.talent_profile_skills for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own profile links" on public.talent_profile_links for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own profile publication" on public.talent_profile_publications for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own profile events" on public.talent_profile_events for select to authenticated using ((select auth.uid()) = actor_user_id);

create or replace function public.require_active_talent_profile_actor()
returns uuid
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from public.active_contexts
    where user_id = actor_id and active_role = 'talent' and active_organization_id is null
  ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return actor_id;
end;
$$;

create or replace function public.save_talent_profile(
  requested_profile jsonb,
  requested_skills jsonb,
  requested_links jsonb
)
returns public.talent_profile_drafts
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_profile_actor();
  result public.talent_profile_drafts;
  skill jsonb;
  profile_link jsonb;
  allowed_profile_keys text[] := array[
    'handle','display_name','profile_image_url','profile_image_visibility','headline','introduction',
    'location_name','location_visibility','timezone','timezone_visibility','languages','developer_focus',
    'current_experience_level','preferred_project_types','availability_window','engagement_preference',
    'rate_range','timezone_overlap_preference','remote_collaboration_preference','target_opportunity_type'
  ];
begin
  if jsonb_typeof(requested_profile) <> 'object'
    or jsonb_typeof(requested_skills) <> 'array'
    or jsonb_typeof(requested_links) <> 'array'
    or octet_length(requested_profile::text) > 12000
    or octet_length(requested_skills::text) > 12000
    or octet_length(requested_links::text) > 6000
    or jsonb_array_length(requested_skills) > 12
    or jsonb_array_length(requested_links) > 5
    or exists (select 1 from jsonb_object_keys(requested_profile) key where key <> all(allowed_profile_keys))
    or coalesce(requested_profile->>'profile_image_visibility', 'private') not in ('private', 'public')
    or coalesce(requested_profile->>'location_visibility', 'private') not in ('private', 'public')
    or coalesce(requested_profile->>'timezone_visibility', 'private') not in ('private', 'public')
    or jsonb_typeof(coalesce(requested_profile->'languages', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(requested_profile->'preferred_project_types', '[]'::jsonb)) <> 'array' then
    raise exception 'VALIDATION_FAILED';
  end if;

  insert into public.talent_profile_drafts (
    user_id, handle, display_name, profile_image_url, profile_image_visibility, headline, introduction,
    location_name, location_visibility, timezone, timezone_visibility, languages, developer_focus,
    current_experience_level, preferred_project_types, availability_window, engagement_preference, rate_range,
    timezone_overlap_preference, remote_collaboration_preference, target_opportunity_type, draft_state
  ) values (
    actor_id, nullif(lower(trim(coalesce(requested_profile->>'handle', ''))), ''),
    left(trim(coalesce(requested_profile->>'display_name', '')), 80), left(trim(coalesce(requested_profile->>'profile_image_url', '')), 500),
    coalesce(requested_profile->>'profile_image_visibility', 'private')::public.profile_field_visibility,
    left(trim(coalesce(requested_profile->>'headline', '')), 140), left(trim(coalesce(requested_profile->>'introduction', '')), 1200),
    left(trim(coalesce(requested_profile->>'location_name', '')), 120), coalesce(requested_profile->>'location_visibility', 'private')::public.profile_field_visibility,
    left(trim(coalesce(requested_profile->>'timezone', 'UTC')), 80), coalesce(requested_profile->>'timezone_visibility', 'private')::public.profile_field_visibility,
    coalesce(requested_profile->'languages', '[]'::jsonb), left(trim(coalesce(requested_profile->>'developer_focus', '')), 160),
    left(trim(coalesce(requested_profile->>'current_experience_level', '')), 80), coalesce(requested_profile->'preferred_project_types', '[]'::jsonb),
    left(trim(coalesce(requested_profile->>'availability_window', '')), 120), left(trim(coalesce(requested_profile->>'engagement_preference', '')), 120),
    left(trim(coalesce(requested_profile->>'rate_range', '')), 80), left(trim(coalesce(requested_profile->>'timezone_overlap_preference', '')), 120),
    left(trim(coalesce(requested_profile->>'remote_collaboration_preference', '')), 120), left(trim(coalesce(requested_profile->>'target_opportunity_type', '')), 120), 'draft'
  ) on conflict (user_id) do update set
    handle = excluded.handle, display_name = excluded.display_name, profile_image_url = excluded.profile_image_url,
    profile_image_visibility = excluded.profile_image_visibility, headline = excluded.headline, introduction = excluded.introduction,
    location_name = excluded.location_name, location_visibility = excluded.location_visibility, timezone = excluded.timezone,
    timezone_visibility = excluded.timezone_visibility, languages = excluded.languages, developer_focus = excluded.developer_focus,
    current_experience_level = excluded.current_experience_level, preferred_project_types = excluded.preferred_project_types,
    availability_window = excluded.availability_window, engagement_preference = excluded.engagement_preference,
    rate_range = excluded.rate_range, timezone_overlap_preference = excluded.timezone_overlap_preference,
    remote_collaboration_preference = excluded.remote_collaboration_preference, target_opportunity_type = excluded.target_opportunity_type,
    draft_state = 'draft', version = public.talent_profile_drafts.version + 1, updated_at = now()
  returning * into result;

  delete from public.talent_profile_skills where user_id = actor_id;
  for skill in select value from jsonb_array_elements(requested_skills) loop
    if jsonb_typeof(skill) <> 'object'
      or skill->>'skill_key' not in (
        'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
        'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
        'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
        'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
        'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
      )
      or skill->>'claimed_level' not in ('familiar','working','independent','advanced','reviewer')
      or char_length(coalesce(skill->>'context', '')) > 360 then
      raise exception 'VALIDATION_FAILED';
    end if;
    insert into public.talent_profile_skills (user_id, skill_key, claimed_level, context)
    values (actor_id, skill->>'skill_key', (skill->>'claimed_level')::public.talent_skill_claim_level, left(trim(coalesce(skill->>'context', '')), 360));
  end loop;

  delete from public.talent_profile_links where user_id = actor_id;
  for profile_link in select value from jsonb_array_elements(requested_links) loop
    if jsonb_typeof(profile_link) <> 'object'
      or profile_link->>'link_type' not in ('website','portfolio')
      or coalesce(profile_link->>'url', '') !~ '^https://'
      or char_length(coalesce(profile_link->>'url', '')) > 500
      or char_length(coalesce(profile_link->>'label', '')) > 80
      or profile_link->>'is_public' not in ('true','false') then
      raise exception 'VALIDATION_FAILED';
    end if;
    insert into public.talent_profile_links (user_id, link_type, label, url, is_public)
    values (actor_id, (profile_link->>'link_type')::public.talent_profile_link_type, left(trim(coalesce(profile_link->>'label', '')), 80), trim(profile_link->>'url'), (profile_link->>'is_public')::boolean);
  end loop;

  insert into public.talent_profile_events (actor_user_id, event_type) values (actor_id, 'talent_profile.draft_saved');
  return result;
end;
$$;

create or replace function public.mark_talent_profile_ready()
returns public.talent_profile_drafts
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_profile_actor(); result public.talent_profile_drafts;
begin
  if not exists (
    select 1 from public.talent_profile_drafts where user_id = actor_id and handle is not null
      and char_length(trim(display_name)) >= 2 and char_length(trim(headline)) >= 3
      and char_length(trim(developer_focus)) >= 2
  ) or not exists (select 1 from public.talent_profile_skills where user_id = actor_id) then
    raise exception 'VALIDATION_FAILED';
  end if;
  update public.talent_profile_drafts set draft_state = 'ready_to_preview', updated_at = now()
    where user_id = actor_id returning * into result;
  insert into public.talent_profile_events (actor_user_id, event_type) values (actor_id, 'talent_profile.ready_to_preview');
  return result;
end;
$$;

create or replace function public.publish_talent_profile()
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
  select * into draft from public.talent_profile_drafts where user_id = actor_id;
  if draft.user_id is null or draft.draft_state <> 'ready_to_preview' then raise exception 'VALIDATION_FAILED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('skill_key', skill_key, 'claimed_level', claimed_level, 'context', context, 'status', 'claimed') order by skill_key), '[]'::jsonb)
    into skill_snapshot from public.talent_profile_skills where user_id = actor_id;
  select coalesce(jsonb_agg(jsonb_build_object('link_type', link_type, 'label', label, 'url', url) order by created_at), '[]'::jsonb)
    into link_snapshot from public.talent_profile_links where user_id = actor_id and is_public;
  publication_snapshot := jsonb_build_object(
    'handle', draft.handle, 'display_name', draft.display_name,
    'profile_image_url', case when draft.profile_image_visibility = 'public' then draft.profile_image_url else '' end,
    'headline', draft.headline, 'introduction', draft.introduction,
    'location_name', case when draft.location_visibility = 'public' then draft.location_name else '' end,
    'timezone', case when draft.timezone_visibility = 'public' then draft.timezone else '' end,
    'languages', draft.languages, 'developer_focus', draft.developer_focus,
    'current_experience_level', draft.current_experience_level, 'preferred_project_types', draft.preferred_project_types,
    'availability_window', draft.availability_window, 'engagement_preference', draft.engagement_preference,
    'timezone_overlap_preference', draft.timezone_overlap_preference,
    'remote_collaboration_preference', draft.remote_collaboration_preference,
    'target_opportunity_type', draft.target_opportunity_type, 'skills', skill_snapshot, 'links', link_snapshot,
    'proof_status', 'No verified proof yet'
  );
  insert into public.talent_profile_publications (user_id, handle, state, snapshot, source_profile_version, published_at, hidden_at, updated_at)
  values (actor_id, draft.handle, 'published', publication_snapshot, draft.version, now(), null, now())
  on conflict (user_id) do update set handle = excluded.handle, state = 'published', snapshot = excluded.snapshot,
    source_profile_version = excluded.source_profile_version, published_at = now(), hidden_at = null, updated_at = now()
  returning * into result;
  insert into public.talent_profile_events (actor_user_id, event_type) values (actor_id, 'talent_profile.published');
  return result;
end;
$$;

create or replace function public.hide_talent_profile()
returns public.talent_profile_publications
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_profile_actor(); result public.talent_profile_publications;
begin
  update public.talent_profile_publications set state = 'hidden', hidden_at = now(), updated_at = now()
    where user_id = actor_id and state = 'published' returning * into result;
  if result.user_id is null then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.talent_profile_events (actor_user_id, event_type) values (actor_id, 'talent_profile.hidden');
  return result;
end;
$$;

create or replace function public.get_public_talent_profile(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select snapshot || jsonb_build_object('published_at', published_at, 'updated_at', updated_at)
  from public.talent_profile_publications
  where handle = lower(trim(requested_handle)) and state = 'published'
$$;

revoke all on table public.talent_profile_drafts, public.talent_profile_skills, public.talent_profile_links, public.talent_profile_publications, public.talent_profile_events from anon, authenticated;
grant select on table public.talent_profile_drafts, public.talent_profile_skills, public.talent_profile_links, public.talent_profile_publications, public.talent_profile_events to authenticated;
revoke all on function public.require_active_talent_profile_actor() from public, anon, authenticated;
revoke all on function public.save_talent_profile(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.mark_talent_profile_ready() from public, anon;
revoke all on function public.publish_talent_profile() from public, anon;
revoke all on function public.hide_talent_profile() from public, anon;
revoke all on function public.get_public_talent_profile(text) from public;
grant execute on function public.save_talent_profile(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mark_talent_profile_ready() to authenticated;
grant execute on function public.publish_talent_profile() to authenticated;
grant execute on function public.hide_talent_profile() to authenticated;
grant execute on function public.get_public_talent_profile(text) to anon, authenticated;
