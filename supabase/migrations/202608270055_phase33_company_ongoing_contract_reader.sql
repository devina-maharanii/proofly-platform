-- Phase 33 private-reader extension — guides ongoing contract creation from an accountable completed paid trial only.

create or replace function public.get_company_engagements(maximum_count integer default 50)
returns jsonb language sql security definer stable set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', engagement.id, 'application_id', engagement.application_id,
    'engagement_type', engagement.engagement_type, 'state', engagement.state,
    'funding_state', engagement.funding_state, 'project_title', project.title,
    'updated_at', engagement.updated_at
  ) order by engagement.updated_at desc), '[]'::jsonb)
  from (
    select * from public.engagements
    where private.engagement_company_context(organization_id, 'hiring_member')
    order by updated_at desc
    limit least(greatest(coalesce(maximum_count, 0), 0), 100)
  ) engagement
  join public.company_project_drafts project on project.id = engagement.project_id
$$;

revoke all on function public.get_company_engagements(integer) from public, anon;
grant execute on function public.get_company_engagements(integer) to authenticated;
