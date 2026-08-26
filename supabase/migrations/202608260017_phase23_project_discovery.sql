-- Phase 23 — Deterministic Project Discovery and Search
-- Owner: Projects module. Risk: private project leakage through search, opaque ranking, and cross-user saved-search access.
-- Rollback: forward compensation only; disable discovery readers and retain user-owned saves/history plus append-only events for audit and deletion workflows.

create table public.talent_saved_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.talent_project_search_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  search_key text not null check (search_key ~ '^[a-f0-9]{32}$'),
  query text not null default '' check (char_length(query) <= 160),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (user_id, search_key)
);

create table public.talent_project_discovery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid references public.company_project_drafts(id) on delete restrict,
  event_type text not null check (event_type in ('project.saved', 'project.unsaved', 'project.search_recorded')),
  occurred_at timestamptz not null default now()
);

create index talent_saved_projects_user_created_idx
  on public.talent_saved_projects(user_id, created_at desc);
create index talent_project_search_history_user_recent_idx
  on public.talent_project_search_history(user_id, last_used_at desc);
create index talent_project_discovery_events_user_occurred_idx
  on public.talent_project_discovery_events(user_id, occurred_at desc);
create index company_project_drafts_discovery_text_idx
  on public.company_project_drafts using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(one_sentence_goal, '') || ' ' ||
      coalesce(context_and_problem, '') || ' ' || coalesce(expected_role, '') || ' ' ||
      coalesce(experience_context, '') || ' ' || coalesce(required_skills::text, '') || ' ' ||
      coalesce(helpful_skills::text, '')
    )
  );
create index company_project_drafts_discovery_skills_idx
  on public.company_project_drafts using gin (required_skills jsonb_path_ops);
create index company_project_drafts_discovery_helpful_skills_idx
  on public.company_project_drafts using gin (helpful_skills jsonb_path_ops);

alter table public.talent_saved_projects enable row level security;
alter table public.talent_project_search_history enable row level security;
alter table public.talent_project_discovery_events enable row level security;

create policy "talent can view own saved projects"
  on public.talent_saved_projects for select to authenticated using (user_id = auth.uid());
create policy "talent can view own recent project searches"
  on public.talent_project_search_history for select to authenticated using (user_id = auth.uid());
create policy "talent can view own project discovery events"
  on public.talent_project_discovery_events for select to authenticated using (user_id = auth.uid());

create or replace function public.company_project_skill_family(skill_key text)
returns text
language sql immutable strict set search_path = pg_catalog as $$
  select case
    when skill_key = any (array['javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git']) then 'foundations'
    when skill_key = any (array['react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing']) then 'frontend'
    when skill_key = any (array['nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability']) then 'backend'
    when skill_key = any (array['postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals']) then 'data-infrastructure'
    when skill_key = any (array['requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration']) then 'product-engineering'
    else ''
  end
$$;

create or replace function public.company_project_discovery_filters_are_valid(value jsonb)
returns boolean
language plpgsql immutable set search_path = public as $$
declare allowed_keys text[] := array['skill','family','level','type','timebox','compensation','mode','timezone','deadline','company_size','sort'];
begin
  if jsonb_typeof(value) <> 'object'
     or exists (select 1 from jsonb_object_keys(value) key where key <> all(allowed_keys))
     or exists (select 1 from jsonb_each(value) entry where jsonb_typeof(entry.value) <> 'string')
     or char_length(coalesce(value->>'skill','')) > 64
     or char_length(coalesce(value->>'family','')) > 64
     or char_length(coalesce(value->>'level','')) > 32
     or char_length(coalesce(value->>'type','')) > 64
     or char_length(coalesce(value->>'timebox','')) > 32
     or char_length(coalesce(value->>'compensation','')) > 64
     or char_length(coalesce(value->>'mode','')) > 32
     or char_length(coalesce(value->>'timezone','')) > 80
     or char_length(coalesce(value->>'deadline','')) > 32
     or char_length(coalesce(value->>'company_size','')) > 80
     or char_length(coalesce(value->>'sort','')) > 32
     or (coalesce(value->>'skill','') <> '' and not public.company_project_skills_are_canonical(jsonb_build_array(value->>'skill')))
     or (coalesce(value->>'family','') <> '' and coalesce(value->>'family','') not in ('foundations','frontend','backend','data-infrastructure','product-engineering'))
     or (coalesce(value->>'level','') <> '' and coalesce(value->>'level','') not in ('familiar','working','independent','advanced','reviewer'))
     or (coalesce(value->>'type','') <> '' and coalesce(value->>'type','') not in ('public_challenge','portfolio_prompt','hiring_evaluation','future_paid_trial'))
     or (coalesce(value->>'timebox','') <> '' and coalesce(value->>'timebox','') not in ('up_to_8','up_to_20','up_to_40','over_40'))
     or (coalesce(value->>'compensation','') <> '' and coalesce(value->>'compensation','') not in ('paid_defined','paid_to_be_agreed','unpaid_evaluation'))
     or coalesce(value->>'mode','any') not in ('any','remote','hybrid','onsite')
     or coalesce(value->>'deadline','any') not in ('any','next_7_days','next_30_days')
     or coalesce(value->>'sort','relevance') not in ('relevance','newest') then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.require_active_talent_project_context()
returns uuid
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null
     or not exists (
       select 1 from public.active_contexts context
       where context.user_id = actor_id and context.active_role = 'talent'
     )
     or not exists (
       select 1 from public.role_capabilities capabilities
       where capabilities.user_id = actor_id and 'talent' = any(capabilities.capabilities)
     ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return actor_id;
end;
$$;

create or replace function public.get_public_project_discovery(
  requested_query text default '',
  requested_filters jsonb default '{}'::jsonb,
  requested_cursor_rank numeric default null,
  requested_cursor_updated_at timestamptz default null,
  requested_cursor_public_id text default null,
  requested_limit integer default 12,
  requested_saved_only boolean default false
)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  normalized_query text := lower(left(trim(coalesce(requested_query, '')), 160));
  filters jsonb := coalesce(requested_filters, '{}'::jsonb);
  page_size integer := least(greatest(coalesce(requested_limit, 12), 1), 24);
  saved_user_id uuid;
  result jsonb;
begin
  if not public.company_project_discovery_filters_are_valid(filters)
     or requested_cursor_public_id is not null and requested_cursor_public_id !~ '^prj_[a-f0-9]{20,40}$' then
    raise exception 'VALIDATION_FAILED';
  end if;
  if requested_saved_only then
    saved_user_id := public.require_active_talent_project_context();
  end if;

  with parameters as (
    select
      nullif(filters->>'skill','') as skill_key,
      nullif(filters->>'family','') as family_key,
      nullif(filters->>'level','') as level_context,
      nullif(filters->>'type','') as project_type,
      nullif(filters->>'timebox','') as timebox,
      nullif(filters->>'compensation','') as compensation,
      coalesce(nullif(filters->>'mode',''), 'any') as work_mode,
      lower(nullif(filters->>'timezone','')) as timezone,
      coalesce(nullif(filters->>'deadline',''), 'any') as deadline_window,
      lower(nullif(filters->>'company_size','')) as company_size,
      coalesce(nullif(filters->>'sort',''), 'relevance') as sort_mode,
      case when normalized_query = '' then null else websearch_to_tsquery('simple', normalized_query) end as query_terms
  ), ranked as (
    select
      publication.public_id, publication.state, publication.published_at, publication.updated_at,
      project.project_type, project.title, project.one_sentence_goal, project.required_skills, project.helpful_skills,
      project.timebox_hours, project.compensation_status, project.work_purpose, project.ownership_terms,
      project.application_deadline, project.experience_context, organization.name as organization_name,
      organization.slug as organization_slug, coalesce(company.snapshot->>'company_size','') as company_size,
      coalesce(company.snapshot->>'timezone_overlap','') as timezone_overlap,
      coalesce(company.snapshot->>'work_location_preference','') as work_location_preference,
      case when parameters.query_terms is null then 0::numeric else
        ts_rank(
          to_tsvector('simple', coalesce(project.title, '') || ' ' || coalesce(project.one_sentence_goal, '') || ' ' ||
            coalesce(project.context_and_problem, '') || ' ' || coalesce(project.expected_role, '') || ' ' ||
            coalesce(project.experience_context, '') || ' ' || coalesce(project.required_skills::text, '') || ' ' ||
            coalesce(project.helpful_skills::text, '')),
          parameters.query_terms
        )::numeric + case when lower(organization.name) like '%' || normalized_query || '%' then 0.25 else 0 end
      end as relevance,
      parameters.sort_mode
    from public.company_project_publications publication
    join public.company_project_drafts project on project.id = publication.project_id
    join public.organizations organization on organization.id = project.organization_id
    left join public.company_profile_publications company
      on company.organization_id = project.organization_id and company.state = 'published'
    left join public.talent_saved_projects saved
      on saved.project_id = project.id and saved.user_id = saved_user_id
    cross join parameters
    where publication.state in ('published','accepting_applications')
      and project.visibility = 'public'
      and project.application_deadline >= current_date
      and (not requested_saved_only or saved.project_id is not null)
      and (parameters.query_terms is null
        or to_tsvector('simple', coalesce(project.title, '') || ' ' || coalesce(project.one_sentence_goal, '') || ' ' ||
          coalesce(project.context_and_problem, '') || ' ' || coalesce(project.expected_role, '') || ' ' ||
          coalesce(project.experience_context, '') || ' ' || coalesce(project.required_skills::text, '') || ' ' ||
          coalesce(project.helpful_skills::text, '')) @@ parameters.query_terms
        or lower(organization.name) like '%' || normalized_query || '%')
      and (parameters.skill_key is null or project.required_skills ? parameters.skill_key or project.helpful_skills ? parameters.skill_key)
      and (parameters.family_key is null or exists (
        select 1 from jsonb_array_elements_text(project.required_skills || project.helpful_skills) skill
        where public.company_project_skill_family(skill) = parameters.family_key
      ))
      and (parameters.level_context is null or lower(project.experience_context) like '%' || parameters.level_context || '%')
      and (parameters.project_type is null or project.project_type::text = parameters.project_type)
      and (parameters.timebox is null
        or (parameters.timebox = 'up_to_8' and project.timebox_hours <= 8)
        or (parameters.timebox = 'up_to_20' and project.timebox_hours <= 20)
        or (parameters.timebox = 'up_to_40' and project.timebox_hours <= 40)
        or (parameters.timebox = 'over_40' and project.timebox_hours > 40))
      and (parameters.compensation is null or project.compensation_status::text = parameters.compensation)
      and (parameters.work_mode = 'any' or lower(coalesce(company.snapshot->>'work_location_preference','')) like '%' || parameters.work_mode || '%')
      and (parameters.timezone is null or lower(coalesce(company.snapshot->>'timezone_overlap','')) like '%' || parameters.timezone || '%')
      and (parameters.deadline_window = 'any'
        or (parameters.deadline_window = 'next_7_days' and project.application_deadline <= current_date + 7)
        or (parameters.deadline_window = 'next_30_days' and project.application_deadline <= current_date + 30))
      and (parameters.company_size is null or lower(coalesce(company.snapshot->>'company_size','')) like '%' || parameters.company_size || '%')
  ), paged as (
    select * from ranked
    where requested_cursor_public_id is null
      or (sort_mode = 'newest' and (updated_at, public_id) < (requested_cursor_updated_at, requested_cursor_public_id))
      or (sort_mode = 'relevance' and (relevance, updated_at, public_id) < (coalesce(requested_cursor_rank, 0), requested_cursor_updated_at, requested_cursor_public_id))
    order by
      case when sort_mode = 'relevance' then relevance else 0 end desc,
      updated_at desc,
      public_id asc
    limit page_size + 1
  ), visible as (
    select * from paged limit page_size
  ), next_row as (
    select * from paged offset page_size limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'public_id', visible.public_id, 'project_type', visible.project_type, 'state', visible.state,
      'title', visible.title, 'one_sentence_goal', visible.one_sentence_goal,
      'required_skills', visible.required_skills, 'helpful_skills', visible.helpful_skills,
      'timebox_hours', visible.timebox_hours, 'compensation_status', visible.compensation_status,
      'work_purpose', visible.work_purpose, 'ownership_terms', visible.ownership_terms,
      'application_deadline', visible.application_deadline, 'experience_context', visible.experience_context,
      'organization_name', visible.organization_name, 'organization_slug', visible.organization_slug,
      'company_size', visible.company_size, 'timezone_overlap', visible.timezone_overlap,
      'work_location_preference', visible.work_location_preference, 'published_at', visible.published_at,
      'updated_at', visible.updated_at, 'relevance', visible.relevance
    ) order by case when visible.sort_mode = 'relevance' then visible.relevance else 0 end desc, visible.updated_at desc, visible.public_id asc)), '[]'::jsonb),
    'next_cursor', (select jsonb_build_object('rank', next_row.relevance, 'updated_at', next_row.updated_at, 'public_id', next_row.public_id) from next_row)
  ) into result;
  return result;
end;
$$;

create or replace function public.toggle_talent_saved_project(requested_public_id text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_project_context(); project_record public.company_project_drafts; was_saved boolean;
begin
  select project.* into project_record
  from public.company_project_drafts project
  join public.company_project_publications publication on publication.project_id = project.id
  where publication.public_id = lower(trim(requested_public_id))
    and publication.state in ('published','accepting_applications')
    and project.visibility = 'public' and project.application_deadline >= current_date;
  if project_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  delete from public.talent_saved_projects
    where user_id = actor_id and project_id = project_record.id
    returning true into was_saved;
  if was_saved then
    insert into public.talent_project_discovery_events (user_id, project_id, event_type)
    values (actor_id, project_record.id, 'project.unsaved');
    return false;
  end if;
  insert into public.talent_saved_projects (user_id, project_id) values (actor_id, project_record.id);
  insert into public.talent_project_discovery_events (user_id, project_id, event_type)
  values (actor_id, project_record.id, 'project.saved');
  return true;
end;
$$;

create or replace function public.record_talent_project_search(requested_query text, requested_filters jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_project_context(); normalized_query text := left(trim(coalesce(requested_query,'')),160); filters jsonb := coalesce(requested_filters,'{}'::jsonb); key text;
begin
  if not public.company_project_discovery_filters_are_valid(filters) then raise exception 'VALIDATION_FAILED'; end if;
  if normalized_query = '' and filters = '{}'::jsonb then return true; end if;
  key := md5(lower(normalized_query) || ':' || filters::text);
  insert into public.talent_project_search_history (user_id, search_key, query, filters)
  values (actor_id, key, normalized_query, filters)
  on conflict (user_id, search_key) do update set query = excluded.query, filters = excluded.filters, last_used_at = now();
  delete from public.talent_project_search_history history
  where history.user_id = actor_id and history.search_key in (
    select stale.search_key from public.talent_project_search_history stale
    where stale.user_id = actor_id order by stale.last_used_at desc offset 8
  );
  insert into public.talent_project_discovery_events (user_id, event_type)
  values (actor_id, 'project.search_recorded');
  return true;
end;
$$;

create or replace function public.get_talent_saved_project_ids(maximum_count integer default 100)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(saved_public_id.public_id order by saved_public_id.created_at desc), '[]'::jsonb)
  from (
    select publication.public_id, saved.created_at
    from public.talent_saved_projects saved
    join public.company_project_publications publication on publication.project_id = saved.project_id
    join public.company_project_drafts project on project.id = saved.project_id
    where saved.user_id = public.require_active_talent_project_context()
      and publication.state in ('published','accepting_applications')
      and project.visibility = 'public' and project.application_deadline >= current_date
    order by saved.created_at desc
    limit least(greatest(coalesce(maximum_count, 0), 0), 100)
  ) saved_public_id
$$;

create or replace function public.get_talent_recent_project_searches(maximum_count integer default 8)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('query', recent.query, 'filters', recent.filters, 'last_used_at', recent.last_used_at) order by recent.last_used_at desc), '[]'::jsonb)
  from (
    select query, filters, last_used_at
    from public.talent_project_search_history
    where user_id = public.require_active_talent_project_context()
    order by last_used_at desc
    limit least(greatest(coalesce(maximum_count, 0), 0), 8)
  ) recent
$$;

revoke all on table public.talent_saved_projects, public.talent_project_search_history, public.talent_project_discovery_events from anon, authenticated;
grant select on table public.talent_saved_projects, public.talent_project_search_history, public.talent_project_discovery_events to authenticated;
revoke all on function public.company_project_skill_family(text), public.company_project_discovery_filters_are_valid(jsonb), public.require_active_talent_project_context() from public, anon, authenticated;
revoke all on function public.get_public_project_discovery(text, jsonb, numeric, timestamptz, text, integer, boolean), public.toggle_talent_saved_project(text), public.record_talent_project_search(text, jsonb), public.get_talent_saved_project_ids(integer), public.get_talent_recent_project_searches(integer) from public, anon;
grant execute on function public.get_public_project_discovery(text, jsonb, numeric, timestamptz, text, integer, boolean) to anon, authenticated;
grant execute on function public.toggle_talent_saved_project(text), public.record_talent_project_search(text, jsonb), public.get_talent_saved_project_ids(integer), public.get_talent_recent_project_searches(integer) to authenticated;
