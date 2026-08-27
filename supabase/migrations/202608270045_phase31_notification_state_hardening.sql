-- Phase 31 hardening — a notification recipient may change read or dismissal state only while the
-- notification's exact source remains authorized. This complements reader-side filtering.

create or replace function public.mark_communication_notification_read(requested_notification_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare notification public.communication_notifications;
begin
  update public.communication_notifications target set read_at = coalesce(target.read_at, now())
  where target.id = requested_notification_id
    and target.recipient_user_id = auth.uid()
    and private.communication_notification_still_authorized(
      target.recipient_user_id, target.source_entity_type, target.source_entity_id, target.required_notice
    )
  returning * into notification;
  if notification.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.append_communication_event(null, null, notification.id, null, notification.organization_id, 'notification.read', requested_idempotency_key);
  return jsonb_build_object('notification_id', notification.id, 'read', true);
end;
$$;

create or replace function public.dismiss_communication_notification(requested_notification_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare notification public.communication_notifications;
begin
  update public.communication_notifications target set dismissed_at = coalesce(target.dismissed_at, now())
  where target.id = requested_notification_id
    and target.recipient_user_id = auth.uid()
    and not target.required_notice
    and private.communication_notification_still_authorized(
      target.recipient_user_id, target.source_entity_type, target.source_entity_id, target.required_notice
    )
  returning * into notification;
  if notification.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.append_communication_event(null, null, notification.id, null, notification.organization_id, 'notification.dismissed', requested_idempotency_key);
  return jsonb_build_object('notification_id', notification.id, 'dismissed', true);
end;
$$;

revoke all on function public.mark_communication_notification_read(uuid, uuid), public.dismiss_communication_notification(uuid, uuid) from public, anon;
grant execute on function public.mark_communication_notification_read(uuid, uuid), public.dismiss_communication_notification(uuid, uuid) to authenticated;
