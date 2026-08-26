-- Phase 21 — Company Profiles
-- Owner: Organizations module. Risk: public company context and member-attribution privacy.
-- Rollback: forward compensation only; hide public company snapshots while retaining organization and event history.

create type public.company_profile_draft_state as enum ('draft', 'ready_to_preview');
create type public.company_profile_publication_state as enum ('published', 'hidden');

create function public.is_reserved_company_profile_handle(candidate text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select lower(trim(candidate)) = any (array[
    'about','account','admin','api','auth','companies','company','dashboard','discover',
    'evidence','explore','favicon','get-started','help','login','logout',
    'onboarding','p','privacy','profile','robots','settings','sign-in',
    'sign-up','sitemap','talent','terms','verify-email'
  ]::text[])
$$;

create table public.company_profile_drafts (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  logo_url text not null default '' check (char_length(logo_url) <= 500),
  short_description text not null default '' check (char_length(short_description) <= 280),
  website_url text not null default '' check (char_length(website_url) <= 500),
  industry text not null default '' check (char_length(industry) <= 100),
  company_size text not null default '' check (char_length(company_size) <= 80),
  founded_year text not null default '' check (founded_year = '' or founded_year ~ '^(18[0-9]{2}|19[0-9]{2}|20[0-9]{2})$'),
  what_we_build text not null default '' check (char_length(what_we_build) <= 1200),
  engineering_practices jsonb not null default '[]'::jsonb check (jsonb_typeof(engineering_practices) = 'array' and jsonb_array_length(engineering_practices) <= 8),
  technology_areas jsonb not null default '[]'::jsonb check (jsonb_typeof(technology_areas) = 'array' and jsonb_array_length(technology_areas) <= 8),
  collaboration_style text not null default '' check (char_length(collaboration_style) <= 240),
  timezone_overlap text not null default '' check (char_length(timezone_overlap) <= 160),
  work_location_preference text not null default '' check (char_length(work_location_preference) <= 120),
  typical_project_types jsonb not null default '[]'::jsonb check (jsonb_typeof(typical_project_types) = 'array' and jsonb_array_length(typical_project_types) <= 8),
  hiring_focus text not null default '' check (char_length(hiring_focus) <= 240),
  engagement_types jsonb not null default '[]'::jsonb check (jsonb_typeof(engagement_types) = 'array' and jsonb_array_length(engagement_types) <= 8),
  review_trial_philosophy text not null default '' check (char_length(review_trial_philosophy) <= 600),
  active_opportunities boolean not null default false,
  response_expectations text not null default '' check (char_length(response_expectations) <= 240),
  draft_state public.company_profile_draft_state not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_profile_member_attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_label text not null default '' check (char_length(role_label) <= 80),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.company_profile_publications (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  state public.company_profile_publication_state not null default 'hidden',
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  source_profile_version integer not null check (source_profile_version > 0),
  published_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((state = 'published' and published_at is not null and hidden_at is null) or (state = 'hidden' and hidden_at is not null))
);

create table public.company_profile_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('company_profile.draft_saved','company_profile.member_attribution_saved','company_profile.ready_to_preview','company_profile.published','company_profile.hidden')),
  occurred_at timestamptz not null default now()
);

create index company_profile_publications_slug_state_idx on public.company_profile_publications(slug, state);
create index company_profile_attributions_organization_idx on public.company_profile_member_attributions(organization_id);
create index company_profile_events_organization_occurred_idx on public.company_profile_events(organization_id, occurred_at desc);

alter table public.company_profile_drafts enable row level security;
alter table public.company_profile_member_attributions enable row level security;
alter table public.company_profile_publications enable row level security;
alter table public.company_profile_events enable row level security;

create policy "organization members can view private company profile drafts"
  on public.company_profile_drafts for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "organization members can view their own company profile attribution"
  on public.company_profile_member_attributions for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "organization members can view company profile publication state"
  on public.company_profile_publications for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "organization members can view company profile events"
  on public.company_profile_events for select to authenticated
  using (public.is_active_organization_member(organization_id));

create or replace function public.require_active_company_profile_context(required_owner boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); organization_id uuid;
begin
  select active_organization_id into organization_id
  from public.active_contexts
  where user_id = actor_id and active_role = 'company_member';
  if actor_id is null or organization_id is null
     or not public.is_active_organization_member(organization_id)
     or (required_owner and not public.has_organization_permission(organization_id, 'owner')) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return organization_id;
end;
$$;

create or replace function public.save_company_profile(
  requested_profile jsonb,
  requested_member_role text,
  requested_member_is_public boolean
)
returns public.company_profile_drafts
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  organization_id uuid := public.require_active_company_profile_context(false);
  result public.company_profile_drafts;
  may_edit boolean;
  allowed_keys text[] := array[
    'logo_url','short_description','website_url','industry','company_size','founded_year',
    'what_we_build','engineering_practices','technology_areas','collaboration_style',
    'timezone_overlap','work_location_preference','typical_project_types','hiring_focus',
    'engagement_types','review_trial_philosophy','active_opportunities','response_expectations'
  ];
begin
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = organization_id and membership.user_id = actor_id
      and membership.status = 'active'
      and ('owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions))
  ) into may_edit;
  if not may_edit or jsonb_typeof(requested_profile) <> 'object'
     or exists (select 1 from jsonb_object_keys(requested_profile) key where key <> all(allowed_keys))
     or octet_length(requested_profile::text) > 16000
     or jsonb_typeof(coalesce(requested_profile->'engineering_practices','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_profile->'technology_areas','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_profile->'typical_project_types','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_profile->'engagement_types','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(requested_profile->'engineering_practices','[]'::jsonb)) > 8
     or jsonb_array_length(coalesce(requested_profile->'technology_areas','[]'::jsonb)) > 8
     or jsonb_array_length(coalesce(requested_profile->'typical_project_types','[]'::jsonb)) > 8
     or jsonb_array_length(coalesce(requested_profile->'engagement_types','[]'::jsonb)) > 8
     or char_length(coalesce(requested_member_role,'')) > 80 then
    raise exception 'VALIDATION_FAILED';
  end if;

  insert into public.company_profile_drafts (
    organization_id, logo_url, short_description, website_url, industry, company_size, founded_year,
    what_we_build, engineering_practices, technology_areas, collaboration_style, timezone_overlap,
    work_location_preference, typical_project_types, hiring_focus, engagement_types,
    review_trial_philosophy, active_opportunities, response_expectations, draft_state
  ) values (
    organization_id, left(trim(coalesce(requested_profile->>'logo_url','')),500),
    left(trim(coalesce(requested_profile->>'short_description','')),280),
    left(trim(coalesce(requested_profile->>'website_url','')),500), left(trim(coalesce(requested_profile->>'industry','')),100),
    left(trim(coalesce(requested_profile->>'company_size','')),80), left(trim(coalesce(requested_profile->>'founded_year','')),4),
    left(trim(coalesce(requested_profile->>'what_we_build','')),1200), coalesce(requested_profile->'engineering_practices','[]'::jsonb),
    coalesce(requested_profile->'technology_areas','[]'::jsonb), left(trim(coalesce(requested_profile->>'collaboration_style','')),240),
    left(trim(coalesce(requested_profile->>'timezone_overlap','')),160), left(trim(coalesce(requested_profile->>'work_location_preference','')),120),
    coalesce(requested_profile->'typical_project_types','[]'::jsonb), left(trim(coalesce(requested_profile->>'hiring_focus','')),240),
    coalesce(requested_profile->'engagement_types','[]'::jsonb), left(trim(coalesce(requested_profile->>'review_trial_philosophy','')),600),
    coalesce((requested_profile->>'active_opportunities')::boolean,false), left(trim(coalesce(requested_profile->>'response_expectations','')),240), 'draft'
  ) on conflict (organization_id) do update set
    logo_url = excluded.logo_url, short_description = excluded.short_description, website_url = excluded.website_url,
    industry = excluded.industry, company_size = excluded.company_size, founded_year = excluded.founded_year,
    what_we_build = excluded.what_we_build, engineering_practices = excluded.engineering_practices,
    technology_areas = excluded.technology_areas, collaboration_style = excluded.collaboration_style,
    timezone_overlap = excluded.timezone_overlap, work_location_preference = excluded.work_location_preference,
    typical_project_types = excluded.typical_project_types, hiring_focus = excluded.hiring_focus,
    engagement_types = excluded.engagement_types, review_trial_philosophy = excluded.review_trial_philosophy,
    active_opportunities = excluded.active_opportunities, response_expectations = excluded.response_expectations,
    draft_state = 'draft', version = public.company_profile_drafts.version + 1, updated_at = now()
  returning * into result;

  insert into public.company_profile_member_attributions (organization_id, user_id, role_label, is_public)
  values (organization_id, actor_id, left(trim(coalesce(requested_member_role,'')),80), requested_member_is_public)
  on conflict (organization_id, user_id) do update set
    role_label = excluded.role_label, is_public = excluded.is_public, updated_at = now();

  insert into public.company_profile_events (organization_id, actor_user_id, event_type)
  values (organization_id, actor_id, 'company_profile.draft_saved'),
         (organization_id, actor_id, 'company_profile.member_attribution_saved');
  return result;
end;
$$;

create or replace function public.mark_company_profile_ready()
returns public.company_profile_drafts
language plpgsql security definer set search_path = public as $$
declare active_organization_id uuid := public.require_active_company_profile_context(true); result public.company_profile_drafts; organization_slug text;
begin
  select slug into organization_slug from public.organizations where id = active_organization_id;
  if public.is_reserved_company_profile_handle(organization_slug)
     or not exists (
       select 1 from public.company_profile_drafts
       where company_profile_drafts.organization_id = active_organization_id
         and char_length(trim(short_description)) >= 8 and char_length(trim(what_we_build)) >= 8
         and char_length(trim(hiring_focus)) >= 3
     ) then
    raise exception 'VALIDATION_FAILED';
  end if;
  update public.company_profile_drafts set draft_state = 'ready_to_preview', updated_at = now()
    where company_profile_drafts.organization_id = active_organization_id returning * into result;
  insert into public.company_profile_events (organization_id, actor_user_id, event_type)
  values (active_organization_id, auth.uid(), 'company_profile.ready_to_preview');
  return result;
end;
$$;

create or replace function public.publish_company_profile()
returns public.company_profile_publications
language plpgsql security definer set search_path = public as $$
declare organization_id uuid := public.require_active_company_profile_context(true); draft public.company_profile_drafts; organization_record public.organizations; result public.company_profile_publications; publication_snapshot jsonb;
begin
  select * into draft from public.company_profile_drafts where company_profile_drafts.organization_id = organization_id;
  select * into organization_record from public.organizations where organizations.id = organization_id;
  if draft.organization_id is null or draft.draft_state <> 'ready_to_preview'
     or public.is_reserved_company_profile_handle(organization_record.slug) then
    raise exception 'VALIDATION_FAILED';
  end if;
  publication_snapshot := jsonb_build_object(
    'slug', organization_record.slug, 'name', organization_record.name, 'logo_url', draft.logo_url,
    'short_description', draft.short_description, 'website_url', draft.website_url, 'industry', draft.industry,
    'company_size', draft.company_size, 'founded_year', draft.founded_year, 'what_we_build', draft.what_we_build,
    'engineering_practices', draft.engineering_practices, 'technology_areas', draft.technology_areas,
    'collaboration_style', draft.collaboration_style, 'timezone_overlap', draft.timezone_overlap,
    'work_location_preference', draft.work_location_preference, 'typical_project_types', draft.typical_project_types,
    'hiring_focus', draft.hiring_focus, 'engagement_types', draft.engagement_types,
    'review_trial_philosophy', draft.review_trial_philosophy, 'active_opportunities', draft.active_opportunities,
    'response_expectations', draft.response_expectations, 'organization_confirmation', 'not_confirmed'
  );
  insert into public.company_profile_publications (organization_id, slug, state, snapshot, source_profile_version, published_at, hidden_at, updated_at)
  values (organization_id, organization_record.slug, 'published', publication_snapshot, draft.version, now(), null, now())
  on conflict (organization_id) do update set slug = excluded.slug, state = 'published', snapshot = excluded.snapshot,
    source_profile_version = excluded.source_profile_version, published_at = now(), hidden_at = null, updated_at = now()
  returning * into result;
  insert into public.company_profile_events (organization_id, actor_user_id, event_type)
  values (organization_id, auth.uid(), 'company_profile.published');
  return result;
end;
$$;

create or replace function public.hide_company_profile()
returns public.company_profile_publications
language plpgsql security definer set search_path = public as $$
declare organization_id uuid := public.require_active_company_profile_context(true); result public.company_profile_publications;
begin
  update public.company_profile_publications set state = 'hidden', hidden_at = now(), updated_at = now()
    where company_profile_publications.organization_id = organization_id and state = 'published'
    returning * into result;
  if result.organization_id is null then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.company_profile_events (organization_id, actor_user_id, event_type)
  values (organization_id, auth.uid(), 'company_profile.hidden');
  return result;
end;
$$;

create or replace function public.get_public_company_profile(requested_slug text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select publication.snapshot || jsonb_build_object(
    'published_at', publication.published_at, 'updated_at', publication.updated_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_label', attribution.role_label,
        'status', case when membership.status = 'active' then 'active' else 'historical' end
      ) order by attribution.created_at)
      from public.company_profile_member_attributions attribution
      join public.organization_memberships membership
        on membership.organization_id = attribution.organization_id and membership.user_id = attribution.user_id
      join public.personal_settings person_settings on person_settings.user_id = attribution.user_id
      where attribution.organization_id = publication.organization_id
        and attribution.is_public
        and person_settings.membership_visibility = 'public'
    ), '[]'::jsonb)
  )
  from public.company_profile_publications publication
  where publication.slug = lower(trim(requested_slug))
    and publication.state = 'published'
    and not public.is_reserved_company_profile_handle(requested_slug)
$$;

create function public.get_public_company_profile_sitemap(maximum_count integer default 5000)
returns table(slug text, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select publication.slug, publication.updated_at
  from public.company_profile_publications publication
  where publication.state = 'published'
    and not public.is_reserved_company_profile_handle(publication.slug)
  order by publication.updated_at desc, publication.slug
  limit least(greatest(coalesce(maximum_count, 0), 0), 5000)
$$;

revoke all on table public.company_profile_drafts, public.company_profile_member_attributions, public.company_profile_publications, public.company_profile_events from anon, authenticated;
grant select on table public.company_profile_drafts, public.company_profile_member_attributions, public.company_profile_publications, public.company_profile_events to authenticated;
revoke all on function public.is_reserved_company_profile_handle(text), public.require_active_company_profile_context(boolean) from public, anon, authenticated;
revoke all on function public.save_company_profile(jsonb, text, boolean), public.mark_company_profile_ready(), public.publish_company_profile(), public.hide_company_profile(), public.get_public_company_profile(text), public.get_public_company_profile_sitemap(integer) from public, anon;
grant execute on function public.save_company_profile(jsonb, text, boolean), public.mark_company_profile_ready(), public.publish_company_profile(), public.hide_company_profile() to authenticated;
grant execute on function public.get_public_company_profile(text), public.get_public_company_profile_sitemap(integer) to anon, authenticated;
