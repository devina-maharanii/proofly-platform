-- Phase 21 — Company profile RPC grant hardening
-- Owner: Organizations module. Risk: mutation endpoint exposure. Rollback: not applicable; explicit revocation is a required security forward fix.

revoke all on function public.save_company_profile(jsonb, text, boolean) from public, anon;
revoke all on function public.mark_company_profile_ready() from public, anon;
revoke all on function public.publish_company_profile() from public, anon;
revoke all on function public.hide_company_profile() from public, anon;
revoke all on function public.get_public_company_profile(text) from public, anon;
revoke all on function public.get_public_company_profile_sitemap(integer) from public, anon;

grant execute on function public.save_company_profile(jsonb, text, boolean) to authenticated;
grant execute on function public.mark_company_profile_ready() to authenticated;
grant execute on function public.publish_company_profile() to authenticated;
grant execute on function public.hide_company_profile() to authenticated;
grant execute on function public.get_public_company_profile(text) to anon, authenticated;
grant execute on function public.get_public_company_profile_sitemap(integer) to anon, authenticated;
