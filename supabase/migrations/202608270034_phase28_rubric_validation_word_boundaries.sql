-- Phase 28 forward validation fix. Owner: Reviews/Security. Reason: retain fairness validation without rejecting ordinary project words that merely contain a protected-term substring.

create or replace function private.project_rubric_payload_is_valid(requested_rubric jsonb)
returns boolean
language plpgsql immutable set search_path = public, private as $$
declare dimension jsonb; descriptor jsonb; calibration jsonb; total_weight integer := 0;
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
    or lower(requested_rubric::text) ~ '(^|[^[:alpha:]])(male|female|men|women|white|black|asian|muslim|christian|hindu|religion|disabled|disability|pregnant|married|single|nationality|citizenship|under[[:space:]]+[0-9]{2}|over[[:space:]]+[0-9]{2}|[0-9]{2}[[:space:]]*(years|yrs)[[:space:]]*old)($|[^[:alpha:]])'
  then return false; end if;
  for dimension in select value from jsonb_array_elements(requested_rubric->'dimensions') loop
    if jsonb_typeof(dimension) <> 'object'
      or exists (select 1 from jsonb_object_keys(dimension) key where key not in ('name', 'description', 'skill_keys', 'weight', 'priority', 'observable_criteria', 'evidence_examples', 'common_failure_modes', 'reviewer_guidance', 'feedback_visibility', 'descriptors'))
      or char_length(trim(coalesce(dimension->>'name', ''))) not between 3 and 120
      or char_length(trim(coalesce(dimension->>'description', ''))) not between 12 and 700
      or not public.company_project_skills_are_canonical(coalesce(dimension->'skill_keys', '[]'::jsonb))
      or jsonb_array_length(coalesce(dimension->'skill_keys', '[]'::jsonb)) not between 1 and 5
      or (select count(*) from jsonb_array_elements(dimension->'skill_keys')) <> (select count(distinct value #>> '{}') from jsonb_array_elements(dimension->'skill_keys'))
      or jsonb_typeof(dimension->'weight') <> 'number' or (dimension->>'weight') !~ '^[0-9]+$' or (dimension->>'weight')::integer not between 1 and 100
      or coalesce(dimension->>'priority', '') not in ('essential', 'important', 'supporting')
      or jsonb_typeof(coalesce(dimension->'observable_criteria', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(dimension->'observable_criteria', '[]'::jsonb)) not between 1 and 6
      or jsonb_typeof(coalesce(dimension->'evidence_examples', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(dimension->'evidence_examples', '[]'::jsonb)) > 5
      or jsonb_typeof(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) > 5
      or char_length(trim(coalesce(dimension->>'reviewer_guidance', ''))) not between 20 and 900
      or lower(coalesce(dimension->>'reviewer_guidance', '')) ~ '(style[-[:space:]]?only|personal preference only|single correct solution)'
      or coalesce(dimension->>'feedback_visibility', '') not in ('talent_and_company', 'company_only', 'reviewer_private')
      or jsonb_typeof(coalesce(dimension->'descriptors', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(dimension->'descriptors', '[]'::jsonb)) <> 5
      or exists (select 1 from jsonb_array_elements(coalesce(dimension->'observable_criteria', '[]'::jsonb)) item where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 280)
      or exists (select 1 from jsonb_array_elements(coalesce(dimension->'evidence_examples', '[]'::jsonb)) item where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 400)
      or exists (select 1 from jsonb_array_elements(coalesce(dimension->'common_failure_modes', '[]'::jsonb)) item where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 8 and 400)
    then return false; end if;
    for descriptor in select value from jsonb_array_elements(dimension->'descriptors') loop
      if jsonb_typeof(descriptor) <> 'object'
        or exists (select 1 from jsonb_object_keys(descriptor) key where key not in ('level', 'description'))
        or coalesce(descriptor->>'level', '') not in ('not_demonstrated', 'emerging', 'working_in_context', 'independent_in_context', 'advanced_in_context')
        or char_length(trim(coalesce(descriptor->>'description', ''))) not between 12 and 500
      then return false; end if;
    end loop;
    if (select count(distinct descriptor->>'level') from jsonb_array_elements(dimension->'descriptors') descriptor) <> 5 then return false; end if;
    total_weight := total_weight + (dimension->>'weight')::integer;
  end loop;
  if total_weight <> 100
    or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(requested_rubric->'dimensions') value) <> jsonb_array_length(requested_rubric->'dimensions')
  then return false; end if;
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

revoke all on function private.project_rubric_payload_is_valid(jsonb) from public, anon, authenticated;
