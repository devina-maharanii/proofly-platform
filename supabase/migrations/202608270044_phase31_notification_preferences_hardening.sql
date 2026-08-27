-- Phase 31 hardening — category-specific preferences and quiet-hour suppression are applied
-- to delivery-ledger decisions. No provider is called from this database function.

create or replace function public.save_communication_notification_preferences(
  requested_in_app_enabled boolean, requested_email_enabled boolean, requested_message_alerts_enabled boolean,
  requested_mention_alerts_enabled boolean, requested_digest_frequency public.communication_digest_frequency,
  requested_quiet_hours_start time, requested_quiet_hours_end time, requested_timezone text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null
    or char_length(trim(coalesce(requested_timezone, ''))) not between 1 and 80
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = trim(requested_timezone))
    or ((requested_quiet_hours_start is null) <> (requested_quiet_hours_end is null)) then
    raise exception 'VALIDATION_FAILED';
  end if;
  insert into public.communication_notification_preferences (
    user_id, in_app_enabled, email_enabled, message_alerts_enabled, mention_alerts_enabled,
    digest_frequency, quiet_hours_start, quiet_hours_end, timezone
  ) values (
    auth.uid(), requested_in_app_enabled, requested_email_enabled, requested_message_alerts_enabled,
    requested_mention_alerts_enabled, requested_digest_frequency, requested_quiet_hours_start,
    requested_quiet_hours_end, trim(requested_timezone)
  ) on conflict (user_id) do update set
    in_app_enabled = excluded.in_app_enabled,
    email_enabled = excluded.email_enabled,
    message_alerts_enabled = excluded.message_alerts_enabled,
    mention_alerts_enabled = excluded.mention_alerts_enabled,
    digest_frequency = excluded.digest_frequency,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    timezone = excluded.timezone,
    updated_at = now();
  perform private.append_communication_event(null, null, null, null, null, 'notification.preferences_saved', requested_idempotency_key);
  return jsonb_build_object('saved', true, 'required_notice_explained', true);
end;
$$;

create or replace function private.create_communication_notification(
  target_recipient_user_id uuid, target_organization_id uuid, target_type public.communication_notification_type,
  target_category public.communication_notification_category, target_priority public.communication_notification_priority,
  target_source_entity_type text, target_source_entity_id uuid, target_deep_link text, target_summary text,
  target_deduplication_key text
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare notification_id uuid; preference public.communication_notification_preferences; muted_organization boolean := false;
  category_allowed boolean := true; quiet_active boolean := false; local_time time;
  allow_in_app boolean; allow_email boolean; allow_digest boolean; suppression_reason text;
begin
  select * into preference from public.communication_notification_preferences where user_id = target_recipient_user_id;
  if target_organization_id is not null then
    select organization_preference.muted into muted_organization
    from public.communication_organization_notification_preferences organization_preference
    where organization_preference.user_id = target_recipient_user_id
      and organization_preference.organization_id = target_organization_id;
  end if;
  category_allowed := case target_type
    when 'message_new' then coalesce(preference.message_alerts_enabled, true)
    when 'message_mention' then coalesce(preference.mention_alerts_enabled, true)
    else true
  end;
  if preference.quiet_hours_start is not null and preference.quiet_hours_end is not null then
    local_time := (now() at time zone preference.timezone)::time;
    quiet_active := case
      when preference.quiet_hours_start < preference.quiet_hours_end then local_time >= preference.quiet_hours_start and local_time < preference.quiet_hours_end
      when preference.quiet_hours_start > preference.quiet_hours_end then local_time >= preference.quiet_hours_start or local_time < preference.quiet_hours_end
      else false
    end;
  end if;
  insert into public.communication_notifications (
    recipient_user_id, organization_id, notification_type, category, priority, source_entity_type, source_entity_id,
    deep_link, summary, deduplication_key, required_notice
  ) values (
    target_recipient_user_id, target_organization_id, target_type, target_category, target_priority,
    target_source_entity_type, target_source_entity_id, target_deep_link, target_summary, target_deduplication_key,
    target_priority = 'required'
  ) on conflict (recipient_user_id, deduplication_key) do nothing returning id into notification_id;
  if notification_id is null then return null; end if;
  allow_in_app := target_priority = 'required' or (
    coalesce(preference.in_app_enabled, true) and category_allowed and not coalesce(muted_organization, false) and not quiet_active
  );
  allow_email := target_priority = 'required' or (
    coalesce(preference.email_enabled, true) and category_allowed and not coalesce(muted_organization, false) and not quiet_active
  );
  allow_digest := target_priority <> 'required' and category_allowed
    and not coalesce(muted_organization, false)
    and coalesce(preference.email_enabled, true)
    and coalesce(preference.digest_frequency, 'immediate'::public.communication_digest_frequency) = 'daily';
  suppression_reason := case
    when target_priority = 'required' then 'provider_not_configured'
    when quiet_active then 'quiet_hours'
    when not category_allowed then 'category_preference_disabled'
    when coalesce(muted_organization, false) then 'organization_preference_disabled'
    else 'provider_not_configured'
  end;
  insert into public.communication_notification_delivery_attempts (notification_id, channel, attempt_number, state, failure_code)
  values
    (notification_id, 'in_app', 1, case when allow_in_app then 'delivered' else 'suppressed' end, case when allow_in_app then null else suppression_reason end),
    (notification_id, 'email', 1, 'suppressed', suppression_reason),
    (notification_id, 'digest', 1, case when allow_digest then 'pending' else 'suppressed' end, case when allow_digest then null else suppression_reason end),
    (notification_id, 'push', 1, 'suppressed', 'provider_not_configured');
  perform private.append_communication_event(null, null, notification_id, null, target_organization_id, 'notification.created');
  perform private.append_communication_event(null, null, notification_id, null, target_organization_id, 'notification.delivery_recorded');
  return notification_id;
end;
$$;

revoke all on function public.save_communication_notification_preferences(boolean, boolean, boolean, boolean, public.communication_digest_frequency, time, time, text, uuid) from public, anon;
grant execute on function public.save_communication_notification_preferences(boolean, boolean, boolean, boolean, public.communication_digest_frequency, time, time, text, uuid) to authenticated;
