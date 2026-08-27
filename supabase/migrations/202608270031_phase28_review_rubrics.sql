-- Phase 28 — Reviews module. Owner: Reviews. Reason: controlled, project-specific rubric authoring and versioning before any review queue or decision workflow.
-- Risk: unauthorized organization edits, private reviewer guidance/calibration exposure, silent rewrite of active review criteria, and universal-score inference.
-- Rollback: forward compensation only; revoke Phase 28 RPCs and hide private routes while retaining organization-scoped rubric versions, workspace locks, and append-only audit history.

create type public.project_rubric_state as enum (
  'draft', 'ready_for_review', 'published', 'locked', 'archived'
);
create type public.project_rubric_version_state as enum (
  'draft', 'published', 'locked', 'archived'
);
create type public.project_rubric_dimension_priority as enum (
  'essential', 'important', 'supporting'
);
create type public.project_rubric_feedback_visibility as enum (
  'talent_and_company', 'company_only', 'reviewer_private'
);
create type public.project_rubric_descriptor_level as enum (
  'not_demonstrated', 'emerging', 'working_in_context',
  'independent_in_context', 'advanced_in_context'
);

create table public.project_rubrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  state public.project_rubric_state not null default 'draft',
  current_version_id uuid,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'archived') = (archived_at is not null))
);

create table public.project_rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.project_rubrics(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  state public.project_rubric_version_state not null default 'draft',
  title text not null default '' check (char_length(title) <= 120),
  project_context text not null default '' check (char_length(project_context) <= 900),
  template_key text not null default 'custom' check (template_key ~ '^[a-z0-9-]{2,60}$'),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rubric_id, version_number),
  check ((state in ('published', 'locked', 'archived')) = (published_at is not null)),
  check ((state = 'locked') = (locked_at is not null))
);

alter table public.project_rubrics
  add constraint project_rubrics_current_version_id_fkey
  foreign key (current_version_id) references public.project_rubric_versions(id) on delete restrict;

create table public.project_rubric_dimensions (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  rubric_id uuid not null references public.project_rubrics(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  position integer not null check (position between 1 and 8),
  name text not null check (char_length(name) between 3 and 120),
  description text not null check (char_length(description) between 12 and 700),
  skill_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(skill_keys) = 'array' and jsonb_array_length(skill_keys) between 1 and 5 and public.company_project_skills_are_canonical(skill_keys)),
  weight integer not null check (weight between 1 and 100),
  priority public.project_rubric_dimension_priority not null,
  observable_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(observable_criteria) = 'array' and jsonb_array_length(observable_criteria) between 1 and 6),
  evidence_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_examples) = 'array' and jsonb_array_length(evidence_examples) <= 5),
  common_failure_modes jsonb not null default '[]'::jsonb check (jsonb_typeof(common_failure_modes) = 'array' and jsonb_array_length(common_failure_modes) <= 5),
  reviewer_guidance text not null check (char_length(reviewer_guidance) between 20 and 900),
  feedback_visibility public.project_rubric_feedback_visibility not null default 'talent_and_company',
  created_at timestamptz not null default now(),
  unique (rubric_version_id, position),
  unique (rubric_version_id, name)
);

create table public.project_rubric_descriptors (
  id uuid primary key default gen_random_uuid(),
  rubric_dimension_id uuid not null references public.project_rubric_dimensions(id) on delete restrict,
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  level public.project_rubric_descriptor_level not null,
  description text not null check (char_length(description) between 12 and 500),
  created_at timestamptz not null default now(),
  unique (rubric_dimension_id, level)
);

create table public.project_rubric_calibration_examples (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  rubric_id uuid not null references public.project_rubrics(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  position integer not null check (position between 1 and 5),
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 12 and 700),
  source_url text not null default '' check (char_length(source_url) <= 500 and (source_url = '' or source_url ~ '^https://')),
  source_submission_version_id uuid references public.project_workspace_submission_versions(id) on delete restrict,
  reviewer_guidance text not null check (char_length(reviewer_guidance) between 12 and 700),
  created_at timestamptz not null default now(),
  unique (rubric_version_id, position),
  check (source_url <> '' or source_submission_version_id is not null)
);

create table public.project_rubric_calibration_disagreements (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  calibration_example_id uuid not null references public.project_rubric_calibration_examples(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  viewpoint text not null check (char_length(viewpoint) between 12 and 900),
  created_at timestamptz not null default now(),
  unique (calibration_example_id, reviewer_user_id)
);

create table public.project_workspace_rubric_locks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.project_workspaces(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rubric_id uuid not null references public.project_rubrics(id) on delete restrict,
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  locked_by_user_id uuid not null references auth.users(id) on delete restrict,
  locked_at timestamptz not null default now(),
  unique (workspace_id, rubric_version_id)
);

create table public.project_rubric_events (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.project_rubrics(id) on delete restrict,
  rubric_version_id uuid references public.project_rubric_versions(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'rubric.created', 'rubric.version_draft_saved', 'rubric.state_changed',
    'rubric.version_published', 'rubric.version_locked', 'rubric.archived',
    'rubric.calibration_disagreement_recorded'
  )),
  previous_state public.project_rubric_state,
  next_state public.project_rubric_state,
  version_number integer check (version_number > 0),
  occurred_at timestamptz not null default now(),
  check ((event_type = 'rubric.state_changed') = (previous_state is not null and next_state is not null))
);

create index project_rubrics_project_idx on public.project_rubrics(project_id);
create index project_rubrics_organization_updated_idx on public.project_rubrics(organization_id, updated_at desc);
create index project_rubric_versions_rubric_number_idx on public.project_rubric_versions(rubric_id, version_number desc);
create index project_rubric_dimensions_version_position_idx on public.project_rubric_dimensions(rubric_version_id, position);
create index project_rubric_descriptors_dimension_idx on public.project_rubric_descriptors(rubric_dimension_id);
create index project_rubric_calibration_version_position_idx on public.project_rubric_calibration_examples(rubric_version_id, position);
create index project_rubric_disagreements_version_idx on public.project_rubric_calibration_disagreements(rubric_version_id, created_at asc);
create index project_workspace_rubric_locks_version_idx on public.project_workspace_rubric_locks(rubric_version_id, locked_at asc);
create index project_rubric_events_rubric_occurred_idx on public.project_rubric_events(rubric_id, occurred_at asc);

alter table public.project_rubrics enable row level security;
alter table public.project_rubric_versions enable row level security;
alter table public.project_rubric_dimensions enable row level security;
alter table public.project_rubric_descriptors enable row level security;
alter table public.project_rubric_calibration_examples enable row level security;
alter table public.project_rubric_calibration_disagreements enable row level security;
alter table public.project_workspace_rubric_locks enable row level security;
alter table public.project_rubric_events enable row level security;

create policy "company members can view project rubrics"
  on public.project_rubrics for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "company members can view rubric versions"
  on public.project_rubric_versions for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "company members can view rubric dimensions"
  on public.project_rubric_dimensions for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "company members can view rubric descriptors"
  on public.project_rubric_descriptors for select to authenticated
  using (exists (
    select 1 from public.project_rubric_dimensions dimension
    where dimension.id = rubric_dimension_id
      and public.is_active_organization_member(dimension.organization_id)
  ));
create policy "company members can view calibration examples"
  on public.project_rubric_calibration_examples for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "reviewers can view own private calibration disagreement"
  on public.project_rubric_calibration_disagreements for select to authenticated
  using (reviewer_user_id = auth.uid());
create policy "company members can view rubric locks"
  on public.project_workspace_rubric_locks for select to authenticated
  using (public.is_active_organization_member(organization_id));
create policy "company members can view rubric audit"
  on public.project_rubric_events for select to authenticated
  using (public.is_active_organization_member(organization_id));

create or replace function public.project_rubric_payload_is_valid(
  requested_rubric jsonb
)
returns boolean
language plpgsql immutable set search_path = public as $$
declare
  dimension jsonb;
  descriptor jsonb;
  calibration jsonb;
  total_weight integer := 0;
  descriptor_count integer;
begin
  if jsonb_typeof(requested_rubric) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_rubric) key where key not in ('title', 'project_context', 'template_key', 'dimensions', 'calibration_examples'))
    or octet_length(requested_rubric::text) > 48000
    or char_length(trim(coalesce(requested_rubric->>'title', ''))) not between 6 and 120
    or char_length(trim(coalesce(requested_rubric->>'project_context', ''))) not between 12 and 900
    or coalesce(requested_rubric->>'template_key', '') !~ '^[a-z0-9-]{2,60}$'
    or jsonb_typeof(coalesce(requested_rubric->'dimensions', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_rubric->'dimensions', '[]'::jsonb)) not between 1 and 8
    or jsonb_typeof(coalesce(requested_rubric->'calibration_examples', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_rubric->'calibration_examples', '[]'::jsonb)) > 5
    or lower(requested_rubric::text) ~ '(male|female|men|women|white|black|asian|muslim|christian|hindu|religion|disabled|disability|pregnant|married|single|nationality|citizenship|under[[:space:]]+[0-9]{2}|over[[:space:]]+[0-9]{2}|[0-9]{2}[[:space:]]*(years|yrs)[[:space:]]*old)'
  then return false; end if;

  for dimension in select value from jsonb_array_elements(requested_rubric->'dimensions') loop
    if jsonb_typeof(dimension) <> 'object'
      or exists (select 1 from jsonb_object_keys(dimension) key where key not in ('name', 'description', 'skill_keys', 'weight', 'priority', 'observable_criteria', 'evidence_examples', 'common_failure_modes', 'reviewer_guidance', 'feedback_visibility', 'descriptors'))
      or char_length(trim(coalesce(dimension->>'name', ''))) not between 3 and 120
      or char_length(trim(coalesce(dimension->>'description', ''))) not between 12 and 700
      or not public.company_project_skills_are_canonical(coalesce(dimension->'skill_keys', '[]'::jsonb))
      or jsonb_array_length(coalesce(dimension->'skill_keys', '[]'::jsonb)) not between 1 and 5
      or jsonb_typeof(dimension->'weight') <> 'number'
      or (dimension->>'weight') !~ '^[0-9]+$'
      or (dimension->>'weight')::integer not between 1 and 100
      or coalesce(dimension->>'priority', '') not in ('essential', 'important', 'supporting')
      or jsonb_typeof(coalesce(dimension->'observable_criteria', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(dimension->'observable_criteria', '[]'::jsonb)) not between 1 and 6
      or jsonb_typeof(coalesce(dimension->'evidence_examples', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(dimension->'evidence_examples', '[]'::jsonb)) > 5
      or jsonb_typeof(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) > 5
      or char_length(trim(coalesce(dimension->>'reviewer_guidance', ''))) not between 20 and 900
      or lower(coalesce(dimension->>'reviewer_guidance', '')) ~ '(style[-[:space:]]?only|personal preference only|single correct solution)'
      or coalesce(dimension->>'feedback_visibility', '') not in ('talent_and_company', 'company_only', 'reviewer_private')
      or jsonb_typeof(coalesce(dimension->'descriptors', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(dimension->'descriptors', '[]'::jsonb)) <> 5
      or exists (
        select 1 from jsonb_array_elements(coalesce(dimension->'observable_criteria', '[]'::jsonb)) item
        where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 280
      )
      or exists (
        select 1 from jsonb_array_elements(coalesce(dimension->'evidence_examples', '[]'::jsonb)) item
        where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 400
      )
      or exists (
        select 1 from jsonb_array_elements(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) item
        where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 400
      )
    then return false; end if;

    descriptor_count := 0;
    for descriptor in select value from jsonb_array_elements(dimension->'descriptors') loop
      if jsonb_typeof(descriptor) <> 'object'
        or exists (select 1 from jsonb_object_keys(descriptor) key where key not in ('level', 'description'))
        or coalesce(descriptor->>'level', '') not in ('not_demonstrated', 'emerging', 'working_in_context', 'independent_in_context', 'advanced_in_context')
        or char_length(trim(coalesce(descriptor->>'description', ''))) not between 12 and 500
      then return false; end if;
      descriptor_count := descriptor_count + 1;
    end loop;
    if descriptor_count <> 5
      or (select count(distinct descriptor->>'level') from jsonb_array_elements(dimension->'descriptors') descriptor) <> 5
    then return false; end if;
    total_weight := total_weight + (dimension->>'weight')::integer;
  end loop;
  if total_weight <> 100 then return false; end if;

  if (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(requested_rubric->'dimensions') value)
    <> jsonb_array_length(requested_rubric->'dimensions') then return false; end if;

  for calibration in select value from jsonb_array_elements(requested_rubric->'calibration_examples') loop
    if jsonb_typeof(calibration) <> 'object'
      or exists (select 1 from jsonb_object_keys(calibration) key where key not in ('title', 'description', 'source_url', 'source_submission_version_id', 'reviewer_guidance'))
      or char_length(trim(coalesce(calibration->>'title', ''))) not between 3 and 140
      or char_length(trim(coalesce(calibration->>'description', ''))) not between 12 and 700
      or (coalesce(calibration->>'source_url', '') <> '' and (char_length(calibration->>'source_url') > 500 or calibration->>'source_url' !~ '^https://'))
      or (nullif(trim(coalesce(calibration->>'source_submission_version_id', '')), '') is not null and nullif(trim(coalesce(calibration->>'source_submission_version_id', '')), '') !~ '^[0-9a-fA-F-]{36}$')
      or (coalesce(calibration->>'source_url', '') = '' and nullif(trim(coalesce(calibration->>'source_submission_version_id', '')), '') is null)
      or char_length(trim(coalesce(calibration->>'reviewer_guidance', ''))) not between 12 and 700
    then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.require_active_company_rubric_author(requested_project_id uuid)
returns public.company_project_drafts
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); organization_id uuid := public.require_active_company_project_context(false); project_record public.company_project_drafts;
begin
  select * into project_record
  from public.company_project_drafts project
  join public.organization_memberships membership on membership.organization_id = project.organization_id
  where project.id = requested_project_id
    and project.organization_id = organization_id
    and membership.user_id = actor_id
    and membership.status = 'active'
    and ('owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions));
  if actor_id is null or project_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return project_record;
end;
$$;

create or replace function public.project_rubric_version_is_complete(requested_version_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_rubric_versions version
    where version.id = requested_version_id
      and char_length(trim(version.title)) between 6 and 120
      and char_length(trim(version.project_context)) between 12 and 900
      and exists (select 1 from public.project_rubric_dimensions dimension where dimension.rubric_version_id = version.id)
      and (select coalesce(sum(dimension.weight), 0) from public.project_rubric_dimensions dimension where dimension.rubric_version_id = version.id) = 100
      and not exists (
        select 1 from public.project_rubric_dimensions dimension
        where dimension.rubric_version_id = version.id
          and (select count(*) from public.project_rubric_descriptors descriptor where descriptor.rubric_dimension_id = dimension.id) <> 5
      )
  )
$$;

create or replace function public.assert_project_rubric_version_immutable()
returns trigger
language plpgsql set search_path = public as $$
begin
  if old.state in ('published', 'locked', 'archived') then
    if old.state = 'published' and new.state = 'locked'
      and (to_jsonb(new) - 'state' - 'locked_at' - 'updated_at') = (to_jsonb(old) - 'state' - 'locked_at' - 'updated_at')
    then return new; end if;
    raise exception 'IMMUTABLE_HISTORICAL_VERSION';
  end if;
  return new;
end;
$$;

create trigger project_rubric_versions_are_immutable
before update on public.project_rubric_versions
for each row execute function public.assert_project_rubric_version_immutable();

create or replace function public.save_project_rubric(
  requested_project_id uuid,
  requested_rubric_id uuid,
  requested_rubric jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  project_record public.company_project_drafts := public.require_active_company_rubric_author(requested_project_id);
  rubric_record public.project_rubrics;
  version_record public.project_rubric_versions;
  current_version public.project_rubric_versions;
  requested_dimension jsonb;
  requested_descriptor jsonb;
  requested_calibration jsonb;
  dimension_record public.project_rubric_dimensions;
  calibration_submission_version_id uuid;
  next_version_number integer := 1;
  dimension_position integer := 1;
  calibration_position integer := 1;
begin
  if not public.project_rubric_payload_is_valid(requested_rubric) then raise exception 'VALIDATION_FAILED'; end if;
  if requested_rubric_id is null then
    select * into rubric_record from public.project_rubrics where project_id = project_record.id for update;
  else
    select * into rubric_record from public.project_rubrics
    where id = requested_rubric_id and project_id = project_record.id and organization_id = project_record.organization_id
    for update;
  end if;
  if rubric_record.id is null then
    insert into public.project_rubrics (project_id, organization_id, created_by_user_id)
    values (project_record.id, project_record.organization_id, actor_id)
    returning * into rubric_record;
    insert into public.project_rubric_events (rubric_id, project_id, organization_id, actor_user_id, event_type)
    values (rubric_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.created');
  elsif rubric_record.state = 'archived' then
    raise exception 'INVALID_STATE';
  end if;

  if rubric_record.current_version_id is not null then
    select * into current_version from public.project_rubric_versions
    where id = rubric_record.current_version_id for update;
  end if;
  if current_version.id is null or current_version.state <> 'draft' then
    if current_version.id is not null then
      select coalesce(max(version_number), 0) + 1 into next_version_number
      from public.project_rubric_versions where rubric_id = rubric_record.id;
    end if;
    insert into public.project_rubric_versions (
      rubric_id, project_id, organization_id, version_number, state, title, project_context, template_key, created_by_user_id
    ) values (
      rubric_record.id, project_record.id, project_record.organization_id, next_version_number, 'draft',
      trim(requested_rubric->>'title'), trim(requested_rubric->>'project_context'), trim(requested_rubric->>'template_key'), actor_id
    ) returning * into version_record;
  else
    update public.project_rubric_versions
    set title = trim(requested_rubric->>'title'), project_context = trim(requested_rubric->>'project_context'),
        template_key = trim(requested_rubric->>'template_key'), updated_at = now()
    where id = current_version.id returning * into version_record;
    delete from public.project_rubric_descriptors descriptor using public.project_rubric_dimensions dimension
    where descriptor.rubric_dimension_id = dimension.id and dimension.rubric_version_id = version_record.id;
    delete from public.project_rubric_calibration_examples where rubric_version_id = version_record.id;
    delete from public.project_rubric_dimensions where rubric_version_id = version_record.id;
  end if;

  for requested_dimension in select value from jsonb_array_elements(requested_rubric->'dimensions') loop
    insert into public.project_rubric_dimensions (
      rubric_version_id, rubric_id, project_id, organization_id, position, name, description, skill_keys, weight,
      priority, observable_criteria, evidence_examples, common_failure_modes, reviewer_guidance, feedback_visibility
    ) values (
      version_record.id, rubric_record.id, project_record.id, project_record.organization_id, dimension_position,
      trim(requested_dimension->>'name'), trim(requested_dimension->>'description'), requested_dimension->'skill_keys',
      (requested_dimension->>'weight')::integer, (requested_dimension->>'priority')::public.project_rubric_dimension_priority,
      requested_dimension->'observable_criteria', requested_dimension->'evidence_examples', requested_dimension->'common_failure_modes',
      trim(requested_dimension->>'reviewer_guidance'), (requested_dimension->>'feedback_visibility')::public.project_rubric_feedback_visibility
    ) returning * into dimension_record;
    for requested_descriptor in select value from jsonb_array_elements(requested_dimension->'descriptors') loop
      insert into public.project_rubric_descriptors (rubric_dimension_id, rubric_version_id, level, description)
      values (
        dimension_record.id, version_record.id, (requested_descriptor->>'level')::public.project_rubric_descriptor_level,
        trim(requested_descriptor->>'description')
      );
    end loop;
    dimension_position := dimension_position + 1;
  end loop;

  for requested_calibration in select value from jsonb_array_elements(requested_rubric->'calibration_examples') loop
    begin
      calibration_submission_version_id := nullif(trim(coalesce(requested_calibration->>'source_submission_version_id', '')), '')::uuid;
    exception when others then raise exception 'VALIDATION_FAILED'; end;
    if calibration_submission_version_id is not null and not exists (
      select 1 from public.project_workspace_submission_versions version
      join public.project_workspace_submissions submission on submission.id = version.submission_id
      join public.project_workspaces workspace on workspace.id = submission.workspace_id
      where version.id = calibration_submission_version_id
        and workspace.project_id = project_record.id
        and workspace.organization_id = project_record.organization_id
    ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    insert into public.project_rubric_calibration_examples (
      rubric_version_id, rubric_id, project_id, organization_id, position, title, description, source_url,
      source_submission_version_id, reviewer_guidance
    ) values (
      version_record.id, rubric_record.id, project_record.id, project_record.organization_id, calibration_position,
      trim(requested_calibration->>'title'), trim(requested_calibration->>'description'), trim(coalesce(requested_calibration->>'source_url', '')),
      calibration_submission_version_id, trim(requested_calibration->>'reviewer_guidance')
    );
    calibration_position := calibration_position + 1;
  end loop;

  update public.project_rubrics
  set current_version_id = version_record.id, state = 'draft', archived_at = null, updated_at = now()
  where id = rubric_record.id returning * into rubric_record;
  insert into public.project_rubric_events (
    rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number
  ) values (
    rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id,
    'rubric.version_draft_saved', version_record.version_number
  );
  return jsonb_build_object('id', rubric_record.id, 'state', rubric_record.state, 'version_number', version_record.version_number);
end;
$$;

create or replace function public.transition_project_rubric(
  requested_project_id uuid,
  requested_rubric_id uuid,
  requested_state public.project_rubric_state
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  project_record public.company_project_drafts := public.require_active_company_rubric_author(requested_project_id);
  rubric_record public.project_rubrics;
  version_record public.project_rubric_versions;
  previous_state public.project_rubric_state;
begin
  select * into rubric_record from public.project_rubrics
  where id = requested_rubric_id and project_id = project_record.id and organization_id = project_record.organization_id
  for update;
  if rubric_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  previous_state := rubric_record.state;
  select * into version_record from public.project_rubric_versions where id = rubric_record.current_version_id for update;
  if version_record.id is null then raise exception 'INVALID_STATE'; end if;
  if not (
    (previous_state = 'draft' and requested_state in ('ready_for_review', 'archived'))
    or (previous_state = 'ready_for_review' and requested_state in ('draft', 'published', 'archived'))
    or (previous_state = 'published' and requested_state in ('archived'))
    or (previous_state = 'locked' and requested_state in ('archived'))
  ) then raise exception 'INVALID_STATE'; end if;
  if requested_state in ('ready_for_review', 'published') and not public.project_rubric_version_is_complete(version_record.id) then
    raise exception 'VALIDATION_FAILED';
  end if;
  if requested_state = 'published' then
    update public.project_rubric_versions
    set state = 'published', published_at = now(), updated_at = now()
    where id = version_record.id returning * into version_record;
  end if;
  update public.project_rubrics
  set state = requested_state,
      archived_at = case when requested_state = 'archived' then now() else null end,
      updated_at = now()
  where id = rubric_record.id returning * into rubric_record;
  insert into public.project_rubric_events (
    rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type,
    previous_state, next_state, version_number
  ) values (
    rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id,
    'rubric.state_changed', previous_state, requested_state, version_record.version_number
  );
  if requested_state = 'published' then
    insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
    values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.version_published', version_record.version_number);
  elsif requested_state = 'archived' then
    insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
    values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.archived', version_record.version_number);
  end if;
  return jsonb_build_object('id', rubric_record.id, 'state', rubric_record.state, 'version_number', version_record.version_number);
end;
$$;

create or replace function public.lock_project_workspace_rubric(
  requested_workspace_id uuid,
  locking_actor_user_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare workspace_record public.project_workspaces; rubric_record public.project_rubrics; version_record public.project_rubric_versions; existing_lock public.project_workspace_rubric_locks;
begin
  select * into existing_lock from public.project_workspace_rubric_locks where workspace_id = requested_workspace_id;
  if existing_lock.id is not null then return existing_lock.rubric_version_id; end if;
  select * into workspace_record from public.project_workspaces where id = requested_workspace_id;
  if workspace_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into rubric_record from public.project_rubrics
  where project_id = workspace_record.project_id and organization_id = workspace_record.organization_id and state in ('published', 'locked')
  for update;
  if rubric_record.id is null or rubric_record.current_version_id is null then raise exception 'INVALID_STATE'; end if;
  select * into version_record from public.project_rubric_versions where id = rubric_record.current_version_id for update;
  if version_record.id is null or version_record.state not in ('published', 'locked') then raise exception 'INVALID_STATE'; end if;
  insert into public.project_workspace_rubric_locks (workspace_id, project_id, organization_id, rubric_id, rubric_version_id, locked_by_user_id)
  values (workspace_record.id, workspace_record.project_id, workspace_record.organization_id, rubric_record.id, version_record.id, locking_actor_user_id)
  returning * into existing_lock;
  if version_record.state = 'published' then
    update public.project_rubric_versions set state = 'locked', locked_at = now(), updated_at = now()
    where id = version_record.id returning * into version_record;
  end if;
  if rubric_record.current_version_id = version_record.id and rubric_record.state = 'published' then
    update public.project_rubrics set state = 'locked', updated_at = now() where id = rubric_record.id;
  end if;
  insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
  values (rubric_record.id, version_record.id, workspace_record.project_id, workspace_record.organization_id, locking_actor_user_id, 'rubric.version_locked', version_record.version_number);
  return version_record.id;
end;
$$;

create or replace function public.transition_project_workspace(
  requested_workspace_id uuid,
  requested_state public.project_workspace_state
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.project_workspaces; previous public.project_workspace_state;
begin
  result := public.require_active_company_workspace_owner(requested_workspace_id);
  select * into result from public.project_workspaces where id = result.id for update;
  previous := result.state;
  if not (
    (previous = 'preparing' and requested_state in ('active', 'paused', 'closed'))
    or (previous = 'active' and requested_state in ('paused', 'awaiting_submission', 'closed'))
    or (previous = 'paused' and requested_state in ('active', 'closed'))
    or (previous = 'awaiting_submission' and requested_state in ('active', 'under_review', 'closed'))
    or (previous = 'under_review' and requested_state in ('active', 'completed', 'closed'))
    or (previous = 'completed' and requested_state = 'closed')
  ) then raise exception 'INVALID_STATE'; end if;
  if requested_state = 'under_review' then
    perform public.lock_project_workspace_rubric(result.id, actor_id);
  end if;
  update public.project_workspaces set state = requested_state, updated_at = now()
  where id = result.id returning * into result;
  insert into public.project_workspace_activity (
    workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state
  ) values (
    result.id, result.organization_id, actor_id, 'workspace.state_changed', previous, requested_state
  );
  return jsonb_build_object('id', result.id, 'state', result.state);
end;
$$;

create or replace function public.get_company_project_rubric(
  requested_project_id uuid
)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare project_record public.company_project_drafts := public.require_active_company_rubric_author(requested_project_id);
begin
  return coalesce((
    select jsonb_build_object(
      'id', rubric.id, 'project_id', rubric.project_id, 'organization_id', rubric.organization_id,
      'state', rubric.state, 'archived_at', rubric.archived_at, 'updated_at', rubric.updated_at,
      'current_version_id', rubric.current_version_id,
      'versions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', version.id, 'version_number', version.version_number, 'state', version.state,
          'title', version.title, 'project_context', version.project_context, 'template_key', version.template_key,
          'created_at', version.created_at, 'published_at', version.published_at, 'locked_at', version.locked_at,
          'dimensions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', dimension.id, 'position', dimension.position, 'name', dimension.name,
              'description', dimension.description, 'skill_keys', dimension.skill_keys, 'weight', dimension.weight,
              'priority', dimension.priority, 'observable_criteria', dimension.observable_criteria,
              'evidence_examples', dimension.evidence_examples, 'common_failure_modes', dimension.common_failure_modes,
              'reviewer_guidance', dimension.reviewer_guidance, 'feedback_visibility', dimension.feedback_visibility,
              'descriptors', coalesce((
                select jsonb_agg(jsonb_build_object('id', descriptor.id, 'level', descriptor.level, 'description', descriptor.description) order by descriptor.level)
                from public.project_rubric_descriptors descriptor where descriptor.rubric_dimension_id = dimension.id
              ), '[]'::jsonb)
            ) order by dimension.position)
            from public.project_rubric_dimensions dimension where dimension.rubric_version_id = version.id
          ), '[]'::jsonb),
          'calibration_examples', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', calibration.id, 'position', calibration.position, 'title', calibration.title,
              'description', calibration.description, 'source_url', calibration.source_url,
              'source_submission_version_id', calibration.source_submission_version_id,
              'reviewer_guidance', calibration.reviewer_guidance
            ) order by calibration.position)
            from public.project_rubric_calibration_examples calibration where calibration.rubric_version_id = version.id
          ), '[]'::jsonb)
        ) order by version.version_number desc)
        from public.project_rubric_versions version where version.rubric_id = rubric.id
      ), '[]'::jsonb)
    )
    from public.project_rubrics rubric
    where rubric.project_id = project_record.id and rubric.organization_id = project_record.organization_id
  ), '{}'::jsonb);
end;
$$;

create or replace function public.get_workspace_locked_rubric(
  requested_workspace_id uuid
)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); access_role public.project_workspace_member_role; lock_record public.project_workspace_rubric_locks;
begin
  access_role := public.project_workspace_access_role(requested_workspace_id);
  select * into lock_record from public.project_workspace_rubric_locks where workspace_id = requested_workspace_id;
  if actor_id is null or access_role is null or lock_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if access_role = 'reviewer' and not public.reviewer_is_eligible_for_workspace(requested_workspace_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'rubric_version_id', lock_record.rubric_version_id,
    'locked_at', lock_record.locked_at,
    'version_number', (select version.version_number from public.project_rubric_versions version where version.id = lock_record.rubric_version_id),
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dimension.id, 'position', dimension.position, 'name', dimension.name,
        'description', dimension.description, 'skill_keys', dimension.skill_keys, 'weight', dimension.weight,
        'priority', dimension.priority, 'observable_criteria', dimension.observable_criteria,
        'evidence_examples', dimension.evidence_examples, 'common_failure_modes', dimension.common_failure_modes,
        'feedback_visibility', dimension.feedback_visibility,
        'reviewer_guidance', case when access_role = 'talent_participant' then null else dimension.reviewer_guidance end,
        'descriptors', coalesce((
          select jsonb_agg(jsonb_build_object('level', descriptor.level, 'description', descriptor.description) order by descriptor.level)
          from public.project_rubric_descriptors descriptor where descriptor.rubric_dimension_id = dimension.id
        ), '[]'::jsonb)
      ) order by dimension.position)
      from public.project_rubric_dimensions dimension
      where dimension.rubric_version_id = lock_record.rubric_version_id
        and (access_role <> 'talent_participant' or dimension.feedback_visibility = 'talent_and_company')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_project_rubric_calibration_disagreement(
  requested_workspace_id uuid,
  requested_calibration_example_id uuid,
  requested_viewpoint text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); lock_record public.project_workspace_rubric_locks; calibration public.project_rubric_calibration_examples; result public.project_rubric_calibration_disagreements;
begin
  select * into lock_record from public.project_workspace_rubric_locks where workspace_id = requested_workspace_id;
  select * into calibration from public.project_rubric_calibration_examples where id = requested_calibration_example_id;
  if actor_id is null
    or lock_record.id is null
    or calibration.id is null
    or calibration.rubric_version_id <> lock_record.rubric_version_id
    or char_length(trim(coalesce(requested_viewpoint, ''))) not between 12 and 900
    or not public.reviewer_is_eligible_for_workspace(requested_workspace_id)
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.project_rubric_calibration_disagreements (
    rubric_version_id, calibration_example_id, reviewer_user_id, viewpoint
  ) values (
    lock_record.rubric_version_id, calibration.id, actor_id, trim(requested_viewpoint)
  ) returning * into result;
  insert into public.project_rubric_events (
    rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type
  ) values (
    lock_record.rubric_id, lock_record.rubric_version_id, lock_record.project_id,
    lock_record.organization_id, actor_id, 'rubric.calibration_disagreement_recorded'
  );
  return jsonb_build_object('id', result.id, 'rubric_version_id', result.rubric_version_id, 'created_at', result.created_at);
end;
$$;

revoke all on table public.project_rubrics, public.project_rubric_versions, public.project_rubric_dimensions, public.project_rubric_descriptors, public.project_rubric_calibration_examples, public.project_rubric_calibration_disagreements, public.project_workspace_rubric_locks, public.project_rubric_events from anon, authenticated;
revoke all on function public.project_rubric_payload_is_valid(jsonb), public.require_active_company_rubric_author(uuid), public.project_rubric_version_is_complete(uuid), public.assert_project_rubric_version_immutable(), public.lock_project_workspace_rubric(uuid, uuid), public.get_workspace_locked_rubric(uuid), public.record_project_rubric_calibration_disagreement(uuid, uuid, text) from public, anon;
revoke all on function public.save_project_rubric(uuid, uuid, jsonb), public.transition_project_rubric(uuid, uuid, public.project_rubric_state), public.get_company_project_rubric(uuid) from public, anon;
grant execute on function public.save_project_rubric(uuid, uuid, jsonb), public.transition_project_rubric(uuid, uuid, public.project_rubric_state), public.get_company_project_rubric(uuid), public.get_workspace_locked_rubric(uuid), public.record_project_rubric_calibration_disagreement(uuid, uuid, text) to authenticated;
