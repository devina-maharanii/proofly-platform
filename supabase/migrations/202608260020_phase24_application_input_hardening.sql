-- Phase 24 follow-up hardening — retain bounded, allowlisted application input while avoiding overbroad rejection of applicant wording.
-- Owner: Applications module. Risk: legitimate applicant context being rejected by keyword matching rather than a question-design control.
-- Rollback: forward compensation only; retain submitted records and replace this validator only if a reviewed policy rule requires it.

create or replace function public.project_application_payload_is_valid(requested_application jsonb)
returns boolean
language plpgsql immutable set search_path = public as $$
declare allowed_keys text[] := array[
  'evidence_ids', 'availability', 'timezone_overlap', 'motivation', 'relevant_experience', 'project_response', 'approach'
];
begin
  if jsonb_typeof(requested_application) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_application) key where key <> all(allowed_keys))
    or jsonb_typeof(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) > 6
    or exists (
      select 1
      from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) evidence
      where jsonb_typeof(evidence.value) <> 'string' or (evidence.value #>> '{}') !~ '^[0-9a-fA-F-]{36}$'
    )
    or (select count(*) from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)))
       <> (select count(distinct evidence.value #>> '{}') from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) evidence)
    or octet_length(requested_application::text) > 7000
    or char_length(coalesce(requested_application->>'availability', '')) > 240
    or char_length(coalesce(requested_application->>'timezone_overlap', '')) > 160
    or char_length(coalesce(requested_application->>'motivation', '')) > 600
    or char_length(coalesce(requested_application->>'relevant_experience', '')) > 900
    or char_length(coalesce(requested_application->>'project_response', '')) > 800
    or char_length(coalesce(requested_application->>'approach', '')) > 1000
  then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.project_application_payload_is_valid(jsonb) from public, anon, authenticated;
