-- Phase 21 — Public company member-attribution display names
-- Owner: Organizations module. Risk: member privacy. Rollback: forward fix that hides the company profile; no private membership data is exposed.

create or replace function public.get_public_company_profile(requested_slug text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select publication.snapshot || jsonb_build_object(
    'published_at', publication.published_at, 'updated_at', publication.updated_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'display_name', person_settings.display_name,
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
        and nullif(trim(person_settings.display_name), '') is not null
    ), '[]'::jsonb)
  )
  from public.company_profile_publications publication
  where publication.slug = lower(trim(requested_slug))
    and publication.state = 'published'
    and not public.is_reserved_company_profile_handle(requested_slug)
$$;

revoke all on function public.get_public_company_profile(text) from public, anon;
grant execute on function public.get_public_company_profile(text) to anon, authenticated;
