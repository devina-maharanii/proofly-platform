-- Proofly Phase 12 follow-up: explicit RPC grants prevent default Supabase function privileges from exposing elevation helpers.
-- Owner: Organizations and memberships module. Risk: privilege elevation. Rollback: restore only documented authenticated self-service grants.

revoke all on function public.is_active_organization_member(uuid) from anon, authenticated;
revoke all on function public.has_organization_permission(uuid, public.company_permission) from anon, authenticated;
revoke all on function public.is_platform_administrator() from anon, authenticated;
revoke all on function public.grant_administrator_capability(uuid) from anon, authenticated;
revoke all on function public.resolve_reviewer_capability(uuid, boolean, text) from anon, authenticated;
revoke all on function public.request_reviewer_capability() from anon;
revoke all on function public.set_active_context(public.active_context_role, uuid) from anon;

grant execute on function public.request_reviewer_capability() to authenticated;
grant execute on function public.set_active_context(public.active_context_role, uuid) to authenticated;
