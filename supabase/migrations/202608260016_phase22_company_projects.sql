-- Phase 22 — Authorized Project/Challenge Creation
-- Owner: Projects module. Risk: organization scope, private draft exposure, unfair evaluation work, and accidental anonymous mutation.
-- Rollback: forward compensation only; disable routes and public readers, retaining auditable drafts and events without deleting project history.

create type public.company_project_type as enum (
  'public_challenge',
  'private_invite_only',
  'portfolio_prompt',
  'hiring_evaluation',
  'future_paid_trial'
);
create type public.company_project_state as enum (
  'draft', 'preview', 'published', 'accepting_applications', 'paused', 'in_progress', 'closed', 'archived'
);
create type public.company_project_visibility as enum ('public', 'restricted');
create type public.company_project_compensation_status as enum ('paid_defined', 'paid_to_be_agreed', 'unpaid_evaluation');
create type public.company_project_work_purpose as enum ('production_need', 'evaluation_exercise');
create type public.company_project_rubric_setup as enum ('defined', 'later');

create table public.company_project_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  public_id text not null unique check (public_id ~ '^prj_[a-f0-9]{20,40}$'),
  project_type public.company_project_type not null,
  state public.company_project_state not null default 'draft',
  visibility public.company_project_visibility not null,
  taxonomy_version text not null default '1.0.0' check (taxonomy_version = '1.0.0'),
  title text not null default '' check (char_length(title) <= 120),
  one_sentence_goal text not null default '' check (char_length(one_sentence_goal) <= 280),
  context_and_problem text not null default '' check (char_length(context_and_problem) <= 1800),
  why_it_matters text not null default '' check (char_length(why_it_matters) <= 900),
  expected_role text not null default '' check (char_length(expected_role) <= 160),
  experience_context text not null default '' check (char_length(experience_context) <= 500),
  required_skills jsonb not null default '[]'::jsonb check (jsonb_typeof(required_skills) = 'array' and jsonb_array_length(required_skills) <= 12),
  helpful_skills jsonb not null default '[]'::jsonb check (jsonb_typeof(helpful_skills) = 'array' and jsonb_array_length(helpful_skills) <= 12),
  required_output text not null default '' check (char_length(required_output) <= 1200),
  acceptance_criteria text not null default '' check (char_length(acceptance_criteria) <= 1400),
  submission_format text not null default '' check (char_length(submission_format) <= 600),
  timebox_hours integer check (timebox_hours between 1 and 160),
  milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 8),
  out_of_scope text not null default '' check (char_length(out_of_scope) <= 900),
  rubric_setup public.company_project_rubric_setup not null default 'defined',
  evaluation_dimensions jsonb not null default '[]'::jsonb check (jsonb_typeof(evaluation_dimensions) = 'array' and jsonb_array_length(evaluation_dimensions) <= 6),
  review_method text not null default '' check (char_length(review_method) <= 600),
  reviewer_expectations text not null default '' check (char_length(reviewer_expectations) <= 600),
  revision_policy text not null default '' check (char_length(revision_policy) <= 600),
  decision_timeline text not null default '' check (char_length(decision_timeline) <= 320),
  compensation_status public.company_project_compensation_status not null default 'paid_to_be_agreed',
  work_purpose public.company_project_work_purpose not null default 'evaluation_exercise',
  ownership_terms text not null default '' check (char_length(ownership_terms) <= 900),
  data_access_restrictions text not null default '' check (char_length(data_access_restrictions) <= 900),
  participant_limit integer check (participant_limit between 1 and 100),
  application_deadline date,
  participant_expectations text not null default '' check (char_length(participant_expectations) <= 900),
  expected_response_time text not null default '' check (char_length(expected_response_time) <= 320),
  no_production_reuse boolean not null default false,
  attachment_policy text not null default 'no_uploads_enabled' check (attachment_policy = 'no_uploads_enabled'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, public_id),
  check (
    (project_type = 'private_invite_only' and visibility = 'restricted')
    or (project_type <> 'private_invite_only' and visibility = 'public')
  ),
  check (not (work_purpose = 'production_need' and compensation_status = 'unpaid_evaluation')),
  check (not (work_purpose = 'evaluation_exercise' and timebox_hours > 20))
);

create table public.company_project_publications (
  project_id uuid primary key references public.company_project_drafts(id) on delete restrict,
  public_id text not null unique check (public_id ~ '^prj_[a-f0-9]{20,40}$'),
  state public.company_project_state not null,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  source_project_version integer not null check (source_project_version > 0),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'project.draft_created', 'project.draft_saved', 'project.preview_prepared',
    'project.published', 'project.state_changed'
  )),
  previous_state public.company_project_state,
  next_state public.company_project_state,
  occurred_at timestamptz not null default now(),
  check ((event_type = 'project.state_changed') = (previous_state is not null and next_state is not null))
);

create index company_project_drafts_organization_updated_idx on public.company_project_drafts(organization_id, updated_at desc);
create index company_project_drafts_public_id_idx on public.company_project_drafts(public_id);
create index company_project_publications_state_updated_idx on public.company_project_publications(state, updated_at desc);
create index company_project_events_project_occurred_idx on public.company_project_events(project_id, occurred_at desc);

alter table public.company_project_drafts enable row level security;
alter table public.company_project_publications enable row level security;
alter table public.company_project_events enable row level security;

create policy "organization members can view private project drafts"
  on public.company_project_drafts for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "organization members can view project publication state"
  on public.company_project_publications for select to authenticated
  using (exists (
    select 1 from public.company_project_drafts project
    where project.id = project_id and public.is_active_organization_member(project.organization_id)
  ));
create policy "organization members can view project lifecycle events"
  on public.company_project_events for select to authenticated
  using (public.is_active_organization_member(organization_id));

create or replace function public.require_active_company_project_context(required_owner boolean default false)
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

create or replace function public.company_project_skills_are_canonical(value jsonb)
returns boolean
language sql immutable strict set search_path = pg_catalog as $$
  select jsonb_typeof(value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(value) skill(key)
      where skill.key not in (
        'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
        'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
        'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
        'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
        'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
      )
    );
$$;

create or replace function public.company_project_payload_is_valid(requested_project jsonb)
returns boolean
language plpgsql immutable set search_path = public as $$
declare allowed_keys text[] := array[
  'project_type','title','one_sentence_goal','context_and_problem','why_it_matters','expected_role','experience_context',
  'required_skills','helpful_skills','required_output','acceptance_criteria','submission_format','timebox_hours','milestones',
  'out_of_scope','rubric_setup','evaluation_dimensions','review_method','reviewer_expectations','revision_policy','decision_timeline',
  'compensation_status','work_purpose','ownership_terms','data_access_restrictions','participant_limit','application_deadline',
  'participant_expectations','expected_response_time','no_production_reuse'
];
begin
  if jsonb_typeof(requested_project) <> 'object'
     or exists (select 1 from jsonb_object_keys(requested_project) key where key <> all(allowed_keys))
     or octet_length(requested_project::text) > 24000
     or jsonb_typeof(coalesce(requested_project->'required_skills','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_project->'helpful_skills','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_project->'milestones','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_project->'evaluation_dimensions','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(requested_project->'required_skills','[]'::jsonb)) > 12
     or jsonb_array_length(coalesce(requested_project->'helpful_skills','[]'::jsonb)) > 12
     or jsonb_array_length(coalesce(requested_project->'milestones','[]'::jsonb)) > 8
     or jsonb_array_length(coalesce(requested_project->'evaluation_dimensions','[]'::jsonb)) > 6
     or not public.company_project_skills_are_canonical(coalesce(requested_project->'required_skills','[]'::jsonb))
     or not public.company_project_skills_are_canonical(coalesce(requested_project->'helpful_skills','[]'::jsonb))
     or exists (
       select 1 from jsonb_array_elements(coalesce(requested_project->'milestones','[]'::jsonb)) item
       where jsonb_typeof(item) <> 'object'
          or char_length(trim(coalesce(item->>'name',''))) > 100
          or char_length(trim(coalesce(item->>'description',''))) > 480
     )
     or exists (
       select 1 from jsonb_array_elements(coalesce(requested_project->'evaluation_dimensions','[]'::jsonb)) item
       where jsonb_typeof(item) <> 'object'
          or char_length(trim(coalesce(item->>'criterion',''))) > 280
          or jsonb_typeof(item->'priority') <> 'number'
          or (item->>'priority') !~ '^[0-9]+$'
          or (item->>'priority')::integer not between 1 and 100
     )
     or lower(requested_project::text) ~ '(male|female|men|women|white|black|asian|muslim|christian|hindu|religion|disabled|disability|pregnant|married|single|nationality|citizenship|under[[:space:]]+[0-9]{2}|over[[:space:]]+[0-9]{2}|[0-9]{2}[[:space:]]*(years|yrs)[[:space:]]*old)'
  then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.company_project_is_publishable(project public.company_project_drafts)
returns boolean
language plpgsql stable set search_path = public as $$
declare dimension_total integer;
begin
  if char_length(trim(project.title)) < 6
     or char_length(trim(project.one_sentence_goal)) < 12
     or char_length(trim(project.context_and_problem)) < 40
     or char_length(trim(project.why_it_matters)) < 20
     or char_length(trim(project.expected_role)) < 3
     or char_length(trim(project.experience_context)) < 10
     or jsonb_array_length(project.required_skills) = 0
     or char_length(trim(project.required_output)) < 10
     or char_length(trim(project.acceptance_criteria)) < 20
     or char_length(trim(project.submission_format)) < 5
     or project.timebox_hours is null
     or char_length(trim(project.out_of_scope)) < 10
     or char_length(trim(project.review_method)) < 10
     or char_length(trim(project.reviewer_expectations)) < 10
     or char_length(trim(project.revision_policy)) < 10
     or char_length(trim(project.decision_timeline)) < 5
     or char_length(trim(project.ownership_terms)) < 10
     or char_length(trim(project.data_access_restrictions)) < 10
     or project.participant_limit is null
     or project.application_deadline is null
     or project.application_deadline < current_date
     or char_length(trim(project.participant_expectations)) < 10
     or char_length(trim(project.expected_response_time)) < 5
     or (project.work_purpose = 'production_need' and project.compensation_status = 'unpaid_evaluation')
     or (project.work_purpose = 'evaluation_exercise' and (project.timebox_hours > 20 or not project.no_production_reuse))
     or (project.project_type = 'future_paid_trial' and project.compensation_status = 'unpaid_evaluation')
  then
    return false;
  end if;
  if project.rubric_setup = 'defined' then
    if jsonb_array_length(project.evaluation_dimensions) = 0 then return false; end if;
    select coalesce(sum((item->>'priority')::integer), 0) into dimension_total
    from jsonb_array_elements(project.evaluation_dimensions) item;
    if dimension_total <> 100 then return false; end if;
  end if;
  return true;
end;
$$;

create or replace function public.company_project_snapshot(project public.company_project_drafts)
returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'public_id', project.public_id, 'project_type', project.project_type, 'state', project.state,
    'taxonomy_version', project.taxonomy_version, 'title', project.title, 'one_sentence_goal', project.one_sentence_goal,
    'context_and_problem', project.context_and_problem, 'why_it_matters', project.why_it_matters,
    'expected_role', project.expected_role, 'experience_context', project.experience_context,
    'required_skills', project.required_skills, 'helpful_skills', project.helpful_skills,
    'required_output', project.required_output, 'acceptance_criteria', project.acceptance_criteria,
    'submission_format', project.submission_format, 'timebox_hours', project.timebox_hours,
    'milestones', project.milestones, 'out_of_scope', project.out_of_scope, 'rubric_setup', project.rubric_setup,
    'evaluation_dimensions', project.evaluation_dimensions, 'review_method', project.review_method,
    'reviewer_expectations', project.reviewer_expectations, 'revision_policy', project.revision_policy,
    'decision_timeline', project.decision_timeline, 'compensation_status', project.compensation_status,
    'work_purpose', project.work_purpose, 'ownership_terms', project.ownership_terms,
    'data_access_restrictions', project.data_access_restrictions, 'participant_limit', project.participant_limit,
    'application_deadline', project.application_deadline, 'participant_expectations', project.participant_expectations,
    'expected_response_time', project.expected_response_time, 'no_production_reuse', project.no_production_reuse,
    'attachment_policy', project.attachment_policy
  );
$$;

create or replace function public.save_company_project(
  requested_project_id uuid,
  requested_project jsonb
)
returns public.company_project_drafts
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  active_organization_id uuid := public.require_active_company_project_context(false);
  result public.company_project_drafts;
  existing public.company_project_drafts;
  may_edit boolean;
  requested_type public.company_project_type;
  generated_public_id text;
begin
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = active_organization_id and membership.user_id = actor_id
      and membership.status = 'active'
      and ('owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions))
  ) into may_edit;
  if not may_edit or not public.company_project_payload_is_valid(requested_project) then
    raise exception 'VALIDATION_FAILED';
  end if;
  begin
    requested_type := (requested_project->>'project_type')::public.company_project_type;
  exception when others then
    raise exception 'VALIDATION_FAILED';
  end;
  if requested_project_id is not null then
    select * into existing from public.company_project_drafts
      where company_project_drafts.id = requested_project_id
        and company_project_drafts.organization_id = active_organization_id;
    if existing.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    if existing.state not in ('draft', 'preview') then raise exception 'INVALID_STATE'; end if;
    update public.company_project_drafts set
      project_type = requested_type,
      visibility = case when requested_type = 'private_invite_only' then 'restricted'::public.company_project_visibility else 'public'::public.company_project_visibility end,
      title = left(trim(coalesce(requested_project->>'title','')),120), one_sentence_goal = left(trim(coalesce(requested_project->>'one_sentence_goal','')),280),
      context_and_problem = left(trim(coalesce(requested_project->>'context_and_problem','')),1800), why_it_matters = left(trim(coalesce(requested_project->>'why_it_matters','')),900),
      expected_role = left(trim(coalesce(requested_project->>'expected_role','')),160), experience_context = left(trim(coalesce(requested_project->>'experience_context','')),500),
      required_skills = coalesce(requested_project->'required_skills','[]'::jsonb), helpful_skills = coalesce(requested_project->'helpful_skills','[]'::jsonb),
      required_output = left(trim(coalesce(requested_project->>'required_output','')),1200), acceptance_criteria = left(trim(coalesce(requested_project->>'acceptance_criteria','')),1400),
      submission_format = left(trim(coalesce(requested_project->>'submission_format','')),600), timebox_hours = nullif(trim(coalesce(requested_project->>'timebox_hours','')),'')::integer,
      milestones = coalesce(requested_project->'milestones','[]'::jsonb), out_of_scope = left(trim(coalesce(requested_project->>'out_of_scope','')),900),
      rubric_setup = coalesce((requested_project->>'rubric_setup')::public.company_project_rubric_setup, 'defined'), evaluation_dimensions = coalesce(requested_project->'evaluation_dimensions','[]'::jsonb),
      review_method = left(trim(coalesce(requested_project->>'review_method','')),600), reviewer_expectations = left(trim(coalesce(requested_project->>'reviewer_expectations','')),600),
      revision_policy = left(trim(coalesce(requested_project->>'revision_policy','')),600), decision_timeline = left(trim(coalesce(requested_project->>'decision_timeline','')),320),
      compensation_status = (requested_project->>'compensation_status')::public.company_project_compensation_status, work_purpose = (requested_project->>'work_purpose')::public.company_project_work_purpose,
      ownership_terms = left(trim(coalesce(requested_project->>'ownership_terms','')),900), data_access_restrictions = left(trim(coalesce(requested_project->>'data_access_restrictions','')),900),
      participant_limit = nullif(trim(coalesce(requested_project->>'participant_limit','')),'')::integer, application_deadline = nullif(trim(coalesce(requested_project->>'application_deadline','')),'')::date,
      participant_expectations = left(trim(coalesce(requested_project->>'participant_expectations','')),900), expected_response_time = left(trim(coalesce(requested_project->>'expected_response_time','')),320),
      no_production_reuse = coalesce((requested_project->>'no_production_reuse')::boolean,false), state = 'draft', version = version + 1, updated_at = now()
    where id = existing.id returning * into result;
    insert into public.company_project_events (project_id, organization_id, actor_user_id, event_type)
    values (result.id, active_organization_id, actor_id, 'project.draft_saved');
    return result;
  end if;
  generated_public_id := 'prj_' || substring(encode(gen_random_bytes(16), 'hex') from 1 for 24);
  insert into public.company_project_drafts (
    organization_id, public_id, project_type, visibility, title, one_sentence_goal, context_and_problem, why_it_matters,
    expected_role, experience_context, required_skills, helpful_skills, required_output, acceptance_criteria, submission_format,
    timebox_hours, milestones, out_of_scope, rubric_setup, evaluation_dimensions, review_method, reviewer_expectations, revision_policy,
    decision_timeline, compensation_status, work_purpose, ownership_terms, data_access_restrictions, participant_limit,
    application_deadline, participant_expectations, expected_response_time, no_production_reuse
  ) values (
    active_organization_id, generated_public_id, requested_type,
    case when requested_type = 'private_invite_only' then 'restricted'::public.company_project_visibility else 'public'::public.company_project_visibility end,
    left(trim(coalesce(requested_project->>'title','')),120), left(trim(coalesce(requested_project->>'one_sentence_goal','')),280),
    left(trim(coalesce(requested_project->>'context_and_problem','')),1800), left(trim(coalesce(requested_project->>'why_it_matters','')),900),
    left(trim(coalesce(requested_project->>'expected_role','')),160), left(trim(coalesce(requested_project->>'experience_context','')),500),
    coalesce(requested_project->'required_skills','[]'::jsonb), coalesce(requested_project->'helpful_skills','[]'::jsonb),
    left(trim(coalesce(requested_project->>'required_output','')),1200), left(trim(coalesce(requested_project->>'acceptance_criteria','')),1400),
    left(trim(coalesce(requested_project->>'submission_format','')),600), nullif(trim(coalesce(requested_project->>'timebox_hours','')),'')::integer,
    coalesce(requested_project->'milestones','[]'::jsonb), left(trim(coalesce(requested_project->>'out_of_scope','')),900),
    coalesce((requested_project->>'rubric_setup')::public.company_project_rubric_setup, 'defined'), coalesce(requested_project->'evaluation_dimensions','[]'::jsonb),
    left(trim(coalesce(requested_project->>'review_method','')),600), left(trim(coalesce(requested_project->>'reviewer_expectations','')),600),
    left(trim(coalesce(requested_project->>'revision_policy','')),600), left(trim(coalesce(requested_project->>'decision_timeline','')),320),
    (requested_project->>'compensation_status')::public.company_project_compensation_status, (requested_project->>'work_purpose')::public.company_project_work_purpose,
    left(trim(coalesce(requested_project->>'ownership_terms','')),900), left(trim(coalesce(requested_project->>'data_access_restrictions','')),900),
    nullif(trim(coalesce(requested_project->>'participant_limit','')),'')::integer, nullif(trim(coalesce(requested_project->>'application_deadline','')),'')::date,
    left(trim(coalesce(requested_project->>'participant_expectations','')),900), left(trim(coalesce(requested_project->>'expected_response_time','')),320),
    coalesce((requested_project->>'no_production_reuse')::boolean,false)
  ) returning * into result;
  insert into public.company_project_events (project_id, organization_id, actor_user_id, event_type)
  values (result.id, active_organization_id, actor_id, 'project.draft_created');
  return result;
end;
$$;

create or replace function public.prepare_company_project_preview(requested_project_id uuid)
returns public.company_project_drafts
language plpgsql security definer set search_path = public as $$
declare active_organization_id uuid := public.require_active_company_project_context(true); result public.company_project_drafts;
begin
  select * into result from public.company_project_drafts
    where company_project_drafts.id = requested_project_id
      and company_project_drafts.organization_id = active_organization_id;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.state <> 'draft' or not public.company_project_is_publishable(result) then raise exception 'VALIDATION_FAILED'; end if;
  update public.company_project_drafts set state = 'preview', updated_at = now() where id = result.id returning * into result;
  insert into public.company_project_events (project_id, organization_id, actor_user_id, event_type)
  values (result.id, active_organization_id, auth.uid(), 'project.preview_prepared');
  return result;
end;
$$;

create or replace function public.publish_company_project(requested_project_id uuid)
returns public.company_project_drafts
language plpgsql security definer set search_path = public as $$
declare active_organization_id uuid := public.require_active_company_project_context(true); result public.company_project_drafts;
begin
  select * into result from public.company_project_drafts
    where company_project_drafts.id = requested_project_id
      and company_project_drafts.organization_id = active_organization_id;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.state <> 'preview' or not public.company_project_is_publishable(result) then raise exception 'VALIDATION_FAILED'; end if;
  update public.company_project_drafts set state = 'published', updated_at = now() where id = result.id returning * into result;
  if result.visibility = 'public' then
    insert into public.company_project_publications (project_id, public_id, state, snapshot, source_project_version, published_at, updated_at)
    values (result.id, result.public_id, result.state, public.company_project_snapshot(result), result.version, now(), now())
    on conflict (project_id) do update set public_id = excluded.public_id, state = excluded.state, snapshot = excluded.snapshot,
      source_project_version = excluded.source_project_version, updated_at = now();
  end if;
  insert into public.company_project_events (project_id, organization_id, actor_user_id, event_type)
  values (result.id, active_organization_id, auth.uid(), 'project.published');
  return result;
end;
$$;

create or replace function public.transition_company_project(
  requested_project_id uuid,
  requested_state public.company_project_state
)
returns public.company_project_drafts
language plpgsql security definer set search_path = public as $$
declare active_organization_id uuid := public.require_active_company_project_context(true); result public.company_project_drafts; old_state public.company_project_state;
begin
  select * into result from public.company_project_drafts
    where company_project_drafts.id = requested_project_id
      and company_project_drafts.organization_id = active_organization_id;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  old_state := result.state;
  if not (
    (old_state = 'published' and requested_state in ('accepting_applications', 'paused', 'closed'))
    or (old_state = 'accepting_applications' and requested_state in ('paused', 'in_progress', 'closed'))
    or (old_state = 'paused' and requested_state in ('published', 'accepting_applications', 'closed'))
    or (old_state = 'in_progress' and requested_state = 'closed')
    or (old_state = 'closed' and requested_state = 'archived')
  ) then raise exception 'INVALID_STATE'; end if;
  update public.company_project_drafts set state = requested_state, updated_at = now() where id = result.id returning * into result;
  if result.visibility = 'public' then
    insert into public.company_project_publications (project_id, public_id, state, snapshot, source_project_version, published_at, updated_at)
    values (result.id, result.public_id, result.state, public.company_project_snapshot(result), result.version, now(), now())
    on conflict (project_id) do update set state = excluded.state, snapshot = excluded.snapshot,
      source_project_version = excluded.source_project_version, updated_at = now();
  end if;
  insert into public.company_project_events (project_id, organization_id, actor_user_id, event_type, previous_state, next_state)
  values (result.id, active_organization_id, auth.uid(), 'project.state_changed', old_state, requested_state);
  return result;
end;
$$;

create or replace function public.get_public_project(requested_public_id text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select publication.snapshot || jsonb_build_object(
    'state', publication.state, 'published_at', publication.published_at, 'updated_at', publication.updated_at,
    'organization_name', organization.name, 'organization_slug', organization.slug
  )
  from public.company_project_publications publication
  join public.company_project_drafts project on project.id = publication.project_id
  join public.organizations organization on organization.id = project.organization_id
  where publication.public_id = lower(trim(requested_public_id))
    and publication.state in ('published', 'accepting_applications', 'paused')
    and project.visibility = 'public'
$$;

create or replace function public.get_public_project_sitemap(maximum_count integer default 5000)
returns table(public_id text, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select publication.public_id, publication.updated_at
  from public.company_project_publications publication
  join public.company_project_drafts project on project.id = publication.project_id
  where publication.state in ('published', 'accepting_applications')
    and project.visibility = 'public'
  order by publication.updated_at desc, publication.public_id
  limit least(greatest(coalesce(maximum_count, 0), 0), 5000)
$$;

revoke all on table public.company_project_drafts, public.company_project_publications, public.company_project_events from anon, authenticated;
grant select on table public.company_project_drafts, public.company_project_publications, public.company_project_events to authenticated;
revoke all on function public.require_active_company_project_context(boolean), public.company_project_skills_are_canonical(jsonb), public.company_project_payload_is_valid(jsonb), public.company_project_is_publishable(public.company_project_drafts), public.company_project_snapshot(public.company_project_drafts) from public, anon, authenticated;
revoke all on function public.save_company_project(uuid, jsonb), public.prepare_company_project_preview(uuid), public.publish_company_project(uuid), public.transition_company_project(uuid, public.company_project_state), public.get_public_project(text), public.get_public_project_sitemap(integer) from public, anon;
grant execute on function public.save_company_project(uuid, jsonb), public.prepare_company_project_preview(uuid), public.publish_company_project(uuid), public.transition_company_project(uuid, public.company_project_state) to authenticated;
grant execute on function public.get_public_project(text), public.get_public_project_sitemap(integer) to anon, authenticated;
