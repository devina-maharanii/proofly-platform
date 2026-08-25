create type public.work_evidence_state as enum (
  'draft',
  'private',
  'unlisted',
  'published',
  'archived',
  'under_review',
  'verified'
);

create type public.work_evidence_type as enum (
  'personal_project',
  'open_source_contribution',
  'coursework_project',
  'company_project',
  'freelance_project',
  'challenge_submission',
  'technical_article_or_case_study'
);

create type public.work_evidence_ownership_status as enum (
  'owns',
  'permission_to_share',
  'public_reference',
  'restricted'
);

create type public.work_evidence_link_type as enum (
  'repository',
  'demo',
  'media',
  'case_study',
  'other'
);

create type public.work_evidence_link_availability as enum (
  'available',
  'unavailable',
  'private'
);

create table public.work_evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '' check (char_length(title) <= 120),
  short_summary text not null default '' check (char_length(short_summary) <= 360),
  evidence_type public.work_evidence_type not null default 'personal_project',
  problem_goal text not null default '' check (char_length(problem_goal) <= 1200),
  user_role text not null default '' check (char_length(user_role) <= 120),
  personal_contribution text not null default '' check (char_length(personal_contribution) <= 1600),
  contribution_scope text not null default '' check (char_length(contribution_scope) <= 700),
  context_constraints text not null default '' check (char_length(context_constraints) <= 1200),
  decisions_tradeoffs text not null default '' check (char_length(decisions_tradeoffs) <= 1400),
  outcome_status text not null default '' check (char_length(outcome_status) <= 900),
  team_work boolean not null default false,
  ownership_status public.work_evidence_ownership_status not null default 'owns',
  permission_note text not null default '' check (char_length(permission_note) <= 500),
  started_on date,
  duration_text text not null default '' check (char_length(duration_text) <= 120),
  state public.work_evidence_state not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_evidence_skills (
  evidence_id uuid not null references public.work_evidence_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  skill_key text not null check (skill_key in (
    'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
    'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
    'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
    'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
    'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
  )),
  taxonomy_version text not null default '1.0.0' check (taxonomy_version = '1.0.0'),
  context text not null default '' check (char_length(context) <= 360),
  primary key (evidence_id, skill_key)
);

create table public.work_evidence_links (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.work_evidence_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  link_type public.work_evidence_link_type not null,
  label text not null default '' check (char_length(label) <= 100),
  url text not null default '' check (char_length(url) <= 500 and (url = '' or url ~ '^https://')),
  availability public.work_evidence_link_availability not null default 'available',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evidence_id, url)
);

create table public.work_evidence_attributions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.work_evidence_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  contributor_name text not null check (char_length(contributor_name) between 1 and 120),
  contributor_role text not null default '' check (char_length(contributor_role) <= 120),
  source_reference_url text not null default '' check (char_length(source_reference_url) <= 500 and (source_reference_url = '' or source_reference_url ~ '^https://')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evidence_id, contributor_name)
);

create table public.work_evidence_versions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.work_evidence_items(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (evidence_id, version)
);

create table public.work_evidence_publications (
  evidence_id uuid primary key references public.work_evidence_items(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  public_id uuid not null unique default gen_random_uuid(),
  state public.work_evidence_state not null default 'private' check (state in ('private', 'unlisted', 'published', 'archived')),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  source_version integer not null check (source_version > 0),
  published_at timestamptz,
  hidden_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.work_evidence_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.work_evidence_items(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'work_evidence.draft_saved',
    'work_evidence.ready_to_preview',
    'work_evidence.published',
    'work_evidence.unlisted',
    'work_evidence.hidden',
    'work_evidence.archived'
  )),
  occurred_at timestamptz not null default now()
);

create index work_evidence_items_user_updated_idx on public.work_evidence_items(user_id, updated_at desc);
create index work_evidence_skills_evidence_idx on public.work_evidence_skills(evidence_id);
create index work_evidence_links_evidence_idx on public.work_evidence_links(evidence_id);
create index work_evidence_attributions_evidence_idx on public.work_evidence_attributions(evidence_id);
create index work_evidence_versions_owner_idx on public.work_evidence_versions(user_id, evidence_id, version desc);
create index work_evidence_publications_user_state_idx on public.work_evidence_publications(user_id, state, published_at desc);
create index work_evidence_events_actor_idx on public.work_evidence_events(actor_user_id, occurred_at desc);

alter table public.work_evidence_items enable row level security;
alter table public.work_evidence_skills enable row level security;
alter table public.work_evidence_links enable row level security;
alter table public.work_evidence_attributions enable row level security;
alter table public.work_evidence_versions enable row level security;
alter table public.work_evidence_publications enable row level security;
alter table public.work_evidence_events enable row level security;

create policy "talent can view own work evidence" on public.work_evidence_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence skills" on public.work_evidence_skills
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence links" on public.work_evidence_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence attributions" on public.work_evidence_attributions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence versions" on public.work_evidence_versions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence publication" on public.work_evidence_publications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "talent can view own work evidence events" on public.work_evidence_events
  for select to authenticated using ((select auth.uid()) = actor_user_id);

create or replace function public.require_active_talent_evidence_actor()
returns uuid
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1
    from public.active_contexts
    where user_id = actor_id
      and active_role = 'talent'
      and active_organization_id is null
  ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return actor_id;
end;
$$;

create or replace function public.save_work_evidence(
  requested_evidence_id uuid,
  requested_evidence jsonb,
  requested_skills jsonb,
  requested_links jsonb,
  requested_attributions jsonb
)
returns public.work_evidence_items
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_evidence_actor();
  result public.work_evidence_items;
  target_evidence_id uuid := coalesce(requested_evidence_id, gen_random_uuid());
  requested_version integer := 1;
  requested_started_on date;
  requested_skill jsonb;
  requested_link jsonb;
  requested_attribution jsonb;
  private_snapshot jsonb;
  allowed_evidence_keys text[] := array[
    'title','short_summary','evidence_type','problem_goal','user_role','personal_contribution',
    'contribution_scope','context_constraints','decisions_tradeoffs','outcome_status','team_work',
    'ownership_status','permission_note','started_on','duration_text'
  ];
begin
  if jsonb_typeof(requested_evidence) <> 'object'
    or jsonb_typeof(requested_skills) <> 'array'
    or jsonb_typeof(requested_links) <> 'array'
    or jsonb_typeof(requested_attributions) <> 'array'
    or octet_length(requested_evidence::text) > 14000
    or octet_length(requested_skills::text) > 12000
    or octet_length(requested_links::text) > 12000
    or octet_length(requested_attributions::text) > 12000
    or jsonb_array_length(requested_skills) > 12
    or jsonb_array_length(requested_links) > 8
    or jsonb_array_length(requested_attributions) > 12
    or exists (select 1 from jsonb_object_keys(requested_evidence) key where key <> all(allowed_evidence_keys))
    or coalesce(requested_evidence->>'evidence_type', 'personal_project') not in (
      'personal_project','open_source_contribution','coursework_project','company_project',
      'freelance_project','challenge_submission','technical_article_or_case_study'
    )
    or coalesce(requested_evidence->>'team_work', 'false') not in ('true', 'false')
    or coalesce(requested_evidence->>'ownership_status', 'owns') not in ('owns','permission_to_share','public_reference','restricted')
    or char_length(coalesce(requested_evidence->>'title', '')) > 120
    or char_length(coalesce(requested_evidence->>'short_summary', '')) > 360
    or char_length(coalesce(requested_evidence->>'problem_goal', '')) > 1200
    or char_length(coalesce(requested_evidence->>'user_role', '')) > 120
    or char_length(coalesce(requested_evidence->>'personal_contribution', '')) > 1600
    or char_length(coalesce(requested_evidence->>'contribution_scope', '')) > 700
    or char_length(coalesce(requested_evidence->>'context_constraints', '')) > 1200
    or char_length(coalesce(requested_evidence->>'decisions_tradeoffs', '')) > 1400
    or char_length(coalesce(requested_evidence->>'outcome_status', '')) > 900
    or char_length(coalesce(requested_evidence->>'permission_note', '')) > 500
    or char_length(coalesce(requested_evidence->>'duration_text', '')) > 120 then
    raise exception 'VALIDATION_FAILED';
  end if;

  if requested_evidence_id is not null then
    select version + 1 into requested_version
    from public.work_evidence_items
    where id = requested_evidence_id and user_id = actor_id and state <> 'archived';
    if requested_version is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  end if;

  begin
    requested_started_on := nullif(trim(coalesce(requested_evidence->>'started_on', '')), '')::date;
  exception when others then
    raise exception 'VALIDATION_FAILED';
  end;

  insert into public.work_evidence_items (
    id, user_id, title, short_summary, evidence_type, problem_goal, user_role,
    personal_contribution, contribution_scope, context_constraints, decisions_tradeoffs,
    outcome_status, team_work, ownership_status, permission_note, started_on, duration_text,
    state, version, updated_at
  ) values (
    target_evidence_id, actor_id, left(trim(coalesce(requested_evidence->>'title', '')), 120),
    left(trim(coalesce(requested_evidence->>'short_summary', '')), 360),
    coalesce(requested_evidence->>'evidence_type', 'personal_project')::public.work_evidence_type,
    left(trim(coalesce(requested_evidence->>'problem_goal', '')), 1200),
    left(trim(coalesce(requested_evidence->>'user_role', '')), 120),
    left(trim(coalesce(requested_evidence->>'personal_contribution', '')), 1600),
    left(trim(coalesce(requested_evidence->>'contribution_scope', '')), 700),
    left(trim(coalesce(requested_evidence->>'context_constraints', '')), 1200),
    left(trim(coalesce(requested_evidence->>'decisions_tradeoffs', '')), 1400),
    left(trim(coalesce(requested_evidence->>'outcome_status', '')), 900),
    coalesce(requested_evidence->>'team_work', 'false')::boolean,
    coalesce(requested_evidence->>'ownership_status', 'owns')::public.work_evidence_ownership_status,
    left(trim(coalesce(requested_evidence->>'permission_note', '')), 500),
    requested_started_on,
    left(trim(coalesce(requested_evidence->>'duration_text', '')), 120),
    'draft', requested_version, now()
  ) on conflict (id) do update set
    title = excluded.title, short_summary = excluded.short_summary, evidence_type = excluded.evidence_type,
    problem_goal = excluded.problem_goal, user_role = excluded.user_role,
    personal_contribution = excluded.personal_contribution, contribution_scope = excluded.contribution_scope,
    context_constraints = excluded.context_constraints, decisions_tradeoffs = excluded.decisions_tradeoffs,
    outcome_status = excluded.outcome_status, team_work = excluded.team_work,
    ownership_status = excluded.ownership_status, permission_note = excluded.permission_note,
    started_on = excluded.started_on, duration_text = excluded.duration_text, state = 'draft',
    version = excluded.version, updated_at = now()
  returning * into result;

  delete from public.work_evidence_skills
  where evidence_id = target_evidence_id and user_id = actor_id;
  for requested_skill in select value from jsonb_array_elements(requested_skills) loop
    if jsonb_typeof(requested_skill) <> 'object'
      or requested_skill->>'skill_key' not in (
        'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
        'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
        'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
        'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
        'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
      )
      or char_length(coalesce(requested_skill->>'context', '')) > 360 then
      raise exception 'VALIDATION_FAILED';
    end if;
    insert into public.work_evidence_skills (evidence_id, user_id, skill_key, taxonomy_version, context)
    values (target_evidence_id, actor_id, requested_skill->>'skill_key', '1.0.0', left(trim(coalesce(requested_skill->>'context', '')), 360));
  end loop;

  delete from public.work_evidence_links
  where evidence_id = target_evidence_id and user_id = actor_id;
  for requested_link in select value from jsonb_array_elements(requested_links) loop
    if jsonb_typeof(requested_link) <> 'object'
      or requested_link->>'link_type' not in ('repository','demo','media','case_study','other')
      or requested_link->>'availability' not in ('available','unavailable','private')
      or requested_link->>'is_public' not in ('true','false')
      or char_length(coalesce(requested_link->>'label', '')) > 100
      or char_length(coalesce(requested_link->>'url', '')) > 500
      or (coalesce(requested_link->>'url', '') <> '' and requested_link->>'url' !~ '^https://')
      or (requested_link->>'availability' = 'available' and coalesce(requested_link->>'url', '') = '') then
      raise exception 'VALIDATION_FAILED';
    end if;
    insert into public.work_evidence_links (evidence_id, user_id, link_type, label, url, availability, is_public)
    values (
      target_evidence_id, actor_id, (requested_link->>'link_type')::public.work_evidence_link_type,
      left(trim(coalesce(requested_link->>'label', '')), 100), trim(coalesce(requested_link->>'url', '')),
      (requested_link->>'availability')::public.work_evidence_link_availability,
      (requested_link->>'is_public')::boolean
    );
  end loop;

  delete from public.work_evidence_attributions
  where evidence_id = target_evidence_id and user_id = actor_id;
  for requested_attribution in select value from jsonb_array_elements(requested_attributions) loop
    if jsonb_typeof(requested_attribution) <> 'object'
      or char_length(trim(coalesce(requested_attribution->>'contributor_name', ''))) = 0
      or char_length(coalesce(requested_attribution->>'contributor_name', '')) > 120
      or char_length(coalesce(requested_attribution->>'contributor_role', '')) > 120
      or char_length(coalesce(requested_attribution->>'source_reference_url', '')) > 500
      or (coalesce(requested_attribution->>'source_reference_url', '') <> '' and requested_attribution->>'source_reference_url' !~ '^https://')
      or requested_attribution->>'is_public' not in ('true','false') then
      raise exception 'VALIDATION_FAILED';
    end if;
    insert into public.work_evidence_attributions (
      evidence_id, user_id, contributor_name, contributor_role, source_reference_url, is_public
    ) values (
      target_evidence_id, actor_id, left(trim(requested_attribution->>'contributor_name'), 120),
      left(trim(coalesce(requested_attribution->>'contributor_role', '')), 120),
      trim(coalesce(requested_attribution->>'source_reference_url', '')),
      (requested_attribution->>'is_public')::boolean
    );
  end loop;

  select jsonb_build_object(
    'title', result.title, 'short_summary', result.short_summary, 'evidence_type', result.evidence_type,
    'problem_goal', result.problem_goal, 'user_role', result.user_role,
    'personal_contribution', result.personal_contribution, 'contribution_scope', result.contribution_scope,
    'context_constraints', result.context_constraints, 'decisions_tradeoffs', result.decisions_tradeoffs,
    'outcome_status', result.outcome_status, 'team_work', result.team_work,
    'ownership_status', result.ownership_status, 'permission_note', result.permission_note,
    'started_on', result.started_on, 'duration_text', result.duration_text, 'state', result.state,
    'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_key', skill_key, 'taxonomy_version', taxonomy_version, 'context', context) order by skill_key) from public.work_evidence_skills where evidence_id = result.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('link_type', link_type, 'label', label, 'url', url, 'availability', availability, 'is_public', is_public) order by created_at) from public.work_evidence_links where evidence_id = result.id), '[]'::jsonb),
    'attributions', coalesce((select jsonb_agg(jsonb_build_object('contributor_name', contributor_name, 'contributor_role', contributor_role, 'source_reference_url', source_reference_url, 'is_public', is_public) order by created_at) from public.work_evidence_attributions where evidence_id = result.id), '[]'::jsonb)
  ) into private_snapshot;

  insert into public.work_evidence_versions (evidence_id, user_id, version, snapshot)
  values (result.id, actor_id, result.version, private_snapshot);
  insert into public.work_evidence_events (evidence_id, actor_user_id, event_type)
  values (result.id, actor_id, 'work_evidence.draft_saved');
  return result;
end;
$$;

create or replace function public.mark_work_evidence_ready(requested_evidence_id uuid)
returns public.work_evidence_items
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_evidence_actor(); result public.work_evidence_items;
begin
  if not exists (
    select 1 from public.work_evidence_items
    where id = requested_evidence_id and user_id = actor_id and state <> 'archived'
      and char_length(trim(title)) >= 3 and char_length(trim(short_summary)) >= 10
      and char_length(trim(problem_goal)) >= 10 and char_length(trim(user_role)) >= 2
      and char_length(trim(personal_contribution)) >= 10 and char_length(trim(contribution_scope)) >= 3
  ) or not exists (
    select 1 from public.work_evidence_skills where evidence_id = requested_evidence_id and user_id = actor_id
  ) or exists (
    select 1 from public.work_evidence_items item
    where item.id = requested_evidence_id and item.user_id = actor_id and item.team_work
      and not exists (select 1 from public.work_evidence_attributions attribution where attribution.evidence_id = item.id and attribution.user_id = actor_id)
  ) then
    raise exception 'VALIDATION_FAILED';
  end if;
  update public.work_evidence_items set state = 'private', updated_at = now()
  where id = requested_evidence_id and user_id = actor_id returning * into result;
  insert into public.work_evidence_events (evidence_id, actor_user_id, event_type)
  values (result.id, actor_id, 'work_evidence.ready_to_preview');
  return result;
end;
$$;

create or replace function public.publish_work_evidence(
  requested_evidence_id uuid,
  requested_visibility public.work_evidence_state,
  acknowledged_public_fields boolean
)
returns public.work_evidence_publications
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_evidence_actor();
  item public.work_evidence_items;
  skill_snapshot jsonb;
  link_snapshot jsonb;
  attribution_snapshot jsonb;
  public_snapshot jsonb;
  result public.work_evidence_publications;
begin
  if acknowledged_public_fields is distinct from true
    or requested_visibility not in ('published', 'unlisted') then
    raise exception 'VALIDATION_FAILED';
  end if;

  select * into item from public.work_evidence_items
  where id = requested_evidence_id and user_id = actor_id and state = 'private';
  if item.id is null or item.ownership_status = 'restricted'
    or (item.ownership_status <> 'owns' and char_length(trim(item.permission_note)) < 10)
    or (item.team_work and not exists (
      select 1
      from public.work_evidence_attributions attribution
      where attribution.evidence_id = item.id
        and attribution.user_id = actor_id
        and attribution.is_public
    )) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('skill_key', skill_key, 'taxonomy_version', taxonomy_version, 'context', context) order by skill_key), '[]'::jsonb)
    into skill_snapshot from public.work_evidence_skills where evidence_id = item.id and user_id = actor_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'link_type', link_type, 'label', label,
    'url', case when availability = 'available' then url else '' end,
    'availability', availability
  ) order by created_at), '[]'::jsonb)
    into link_snapshot from public.work_evidence_links
    where evidence_id = item.id and user_id = actor_id and is_public;
  select coalesce(jsonb_agg(jsonb_build_object(
    'contributor_name', contributor_name, 'contributor_role', contributor_role,
    'source_reference_url', source_reference_url
  ) order by created_at), '[]'::jsonb)
    into attribution_snapshot from public.work_evidence_attributions
    where evidence_id = item.id and user_id = actor_id and is_public;

  public_snapshot := jsonb_build_object(
    'title', item.title, 'short_summary', item.short_summary, 'evidence_type', item.evidence_type,
    'problem_goal', item.problem_goal, 'user_role', item.user_role,
    'personal_contribution', item.personal_contribution, 'contribution_scope', item.contribution_scope,
    'context_constraints', item.context_constraints, 'decisions_tradeoffs', item.decisions_tradeoffs,
    'outcome_status', item.outcome_status, 'team_work', item.team_work,
    'ownership_status', item.ownership_status, 'started_on', item.started_on,
    'duration_text', item.duration_text, 'skills', skill_snapshot, 'links', link_snapshot,
    'attributions', attribution_snapshot, 'verification_status', 'not_verified'
  );

  insert into public.work_evidence_publications (
    evidence_id, user_id, state, snapshot, source_version, published_at, hidden_at, archived_at, updated_at
  ) values (
    item.id, actor_id, requested_visibility, public_snapshot, item.version, now(), null, null, now()
  ) on conflict (evidence_id) do update set
    state = excluded.state, snapshot = excluded.snapshot, source_version = excluded.source_version,
    published_at = now(), hidden_at = null, archived_at = null, updated_at = now()
  returning * into result;
  update public.work_evidence_items set state = requested_visibility, updated_at = now()
  where id = item.id and user_id = actor_id;
  insert into public.work_evidence_events (evidence_id, actor_user_id, event_type)
  values (item.id, actor_id, case when requested_visibility = 'published' then 'work_evidence.published' else 'work_evidence.unlisted' end);
  return result;
end;
$$;

create or replace function public.hide_work_evidence(requested_evidence_id uuid)
returns public.work_evidence_publications
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_evidence_actor(); result public.work_evidence_publications;
begin
  update public.work_evidence_publications set state = 'private', hidden_at = now(), updated_at = now()
  where evidence_id = requested_evidence_id and user_id = actor_id and state in ('published','unlisted')
  returning * into result;
  if result.evidence_id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.work_evidence_items set state = 'private', updated_at = now()
  where id = requested_evidence_id and user_id = actor_id;
  insert into public.work_evidence_events (evidence_id, actor_user_id, event_type)
  values (requested_evidence_id, actor_id, 'work_evidence.hidden');
  return result;
end;
$$;

create or replace function public.archive_work_evidence(requested_evidence_id uuid)
returns public.work_evidence_items
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_evidence_actor(); result public.work_evidence_items;
begin
  update public.work_evidence_items set state = 'archived', updated_at = now()
  where id = requested_evidence_id and user_id = actor_id and state <> 'archived'
  returning * into result;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.work_evidence_publications set state = 'archived', archived_at = now(), updated_at = now()
  where evidence_id = result.id and user_id = actor_id;
  insert into public.work_evidence_events (evidence_id, actor_user_id, event_type)
  values (result.id, actor_id, 'work_evidence.archived');
  return result;
end;
$$;

create or replace function public.get_public_work_evidence(requested_public_id uuid)
returns jsonb
language sql security definer stable set search_path = public as $$
  select snapshot || jsonb_build_object(
    'public_id', public_id,
    'state', state,
    'published_at', published_at,
    'source_version', source_version
  )
  from public.work_evidence_publications
  where public_id = requested_public_id and state in ('published', 'unlisted')
$$;

create or replace function public.get_public_talent_work_evidence(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'public_id', evidence.public_id,
    'title', evidence.snapshot->>'title',
    'short_summary', evidence.snapshot->>'short_summary',
    'evidence_type', evidence.snapshot->>'evidence_type',
    'user_role', evidence.snapshot->>'user_role',
    'skills', coalesce(evidence.snapshot->'skills', '[]'::jsonb),
    'verification_status', 'not_verified',
    'published_at', evidence.published_at,
    'source_version', evidence.source_version
  ) order by evidence.published_at desc, evidence.public_id), '[]'::jsonb)
  from public.talent_profile_publications profile
  join public.work_evidence_publications evidence
    on evidence.user_id = profile.user_id and evidence.state = 'published'
  where profile.handle = lower(trim(requested_handle)) and profile.state = 'published'
$$;

revoke all on table public.work_evidence_items, public.work_evidence_skills, public.work_evidence_links, public.work_evidence_attributions, public.work_evidence_versions, public.work_evidence_publications, public.work_evidence_events from anon, authenticated;
grant select on table public.work_evidence_items, public.work_evidence_skills, public.work_evidence_links, public.work_evidence_attributions, public.work_evidence_versions, public.work_evidence_publications, public.work_evidence_events to authenticated;
revoke all on function public.require_active_talent_evidence_actor() from public, anon, authenticated;
revoke all on function public.save_work_evidence(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.mark_work_evidence_ready(uuid) from public, anon;
revoke all on function public.publish_work_evidence(uuid, public.work_evidence_state, boolean) from public, anon;
revoke all on function public.hide_work_evidence(uuid) from public, anon;
revoke all on function public.archive_work_evidence(uuid) from public, anon;
revoke all on function public.get_public_work_evidence(uuid) from public;
revoke all on function public.get_public_talent_work_evidence(text) from public;
grant execute on function public.save_work_evidence(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mark_work_evidence_ready(uuid) to authenticated;
grant execute on function public.publish_work_evidence(uuid, public.work_evidence_state, boolean) to authenticated;
grant execute on function public.hide_work_evidence(uuid) to authenticated;
grant execute on function public.archive_work_evidence(uuid) to authenticated;
grant execute on function public.get_public_work_evidence(uuid) to anon, authenticated;
grant execute on function public.get_public_talent_work_evidence(text) to anon, authenticated;
