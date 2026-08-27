-- Phase 31 hardening — forward-only corrections for notification revocation, immutable reports,
-- attachment completion checks, and provider-neutral delivery accounting. This migration does not
-- weaken existing RLS or recreate the initial Phase 31 schema.

alter table public.communication_message_reports
  add column idempotency_key uuid;

create unique index communication_reports_reporter_idempotency_idx
  on public.communication_message_reports (reporter_user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function private.communication_user_has_active_administrator_context(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.active_contexts context
    join public.role_capabilities capability on capability.user_id = context.user_id
    where context.user_id = target_user_id
      and context.active_role = 'administrator'
      and 'administrator' = any(capability.capabilities)
      and capability.administrator_granted_at is not null
  )
$$;

create or replace function private.communication_notification_still_authorized(
  target_recipient_user_id uuid,
  target_source_entity_type text,
  target_source_entity_id uuid,
  target_required_notice boolean
) returns boolean language plpgsql stable security definer set search_path = public, private as $$
declare conversation public.communication_conversations;
begin
  if target_source_entity_type = 'communication_message' then
    select conversation_record.* into conversation
    from public.communication_messages message
    join public.communication_conversations conversation_record on conversation_record.id = message.conversation_id
    where message.id = target_source_entity_id;
    return conversation.id is not null
      and private.communication_participant_still_authorized(
        target_recipient_user_id, conversation.context_type, conversation.context_entity_id
      )
      and exists (
        select 1 from public.communication_conversation_participants participant
        where participant.conversation_id = conversation.id
          and participant.user_id = target_recipient_user_id
          and participant.left_at is null
      );
  elsif target_source_entity_type = 'communication_report' then
    return private.communication_user_has_active_administrator_context(target_recipient_user_id);
  end if;
  -- Future source types must add an explicit case. Required alone never bypasses resource access.
  return false;
end;
$$;

drop policy if exists "recipients can view their communication notifications" on public.communication_notifications;
create policy "recipients can view currently authorized communication notifications"
  on public.communication_notifications for select to authenticated using (
    recipient_user_id = auth.uid()
    and private.communication_notification_still_authorized(
      recipient_user_id, source_entity_type, source_entity_id, required_notice
    )
  );

create or replace function private.create_communication_notification(
  target_recipient_user_id uuid, target_organization_id uuid, target_type public.communication_notification_type,
  target_category public.communication_notification_category, target_priority public.communication_notification_priority,
  target_source_entity_type text, target_source_entity_id uuid, target_deep_link text, target_summary text,
  target_deduplication_key text
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare notification_id uuid; preference public.communication_notification_preferences; muted_organization boolean := false;
  allow_in_app boolean; allow_email boolean; allow_digest boolean;
begin
  select * into preference from public.communication_notification_preferences where user_id = target_recipient_user_id;
  if target_organization_id is not null then
    select organization_preference.muted into muted_organization
    from public.communication_organization_notification_preferences organization_preference
    where organization_preference.user_id = target_recipient_user_id
      and organization_preference.organization_id = target_organization_id;
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
    coalesce(preference.in_app_enabled, true) and not coalesce(muted_organization, false)
  );
  allow_email := target_priority = 'required' or (
    coalesce(preference.email_enabled, true) and not coalesce(muted_organization, false)
  );
  allow_digest := coalesce(preference.digest_frequency, 'immediate'::public.communication_digest_frequency) = 'daily'
    and allow_email and target_priority <> 'required';
  insert into public.communication_notification_delivery_attempts (notification_id, channel, attempt_number, state, failure_code)
  values
    (notification_id, 'in_app', 1, case when allow_in_app then 'delivered' else 'suppressed' end, case when allow_in_app then null else 'recipient_or_organization_preference' end),
    (notification_id, 'email', 1, case when allow_email then 'suppressed' else 'suppressed' end, case when allow_email then 'provider_not_configured' else 'recipient_or_organization_preference' end),
    (notification_id, 'digest', 1, case when allow_digest then 'pending' else 'suppressed' end, case when allow_digest then null else 'digest_not_selected' end);
  perform private.append_communication_event(null, null, notification_id, null, target_organization_id, 'notification.created');
  perform private.append_communication_event(null, null, notification_id, null, target_organization_id, 'notification.delivery_recorded');
  return notification_id;
end;
$$;

create or replace function public.report_communication_message(
  requested_message_id uuid, requested_category public.communication_report_category, requested_detail text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare message_record public.communication_messages; conversation public.communication_conversations;
  report_record public.communication_message_reports; administrator record;
begin
  if auth.uid() is null or requested_idempotency_key is null
    or char_length(trim(coalesce(requested_detail, ''))) > 1000 then
    raise exception 'VALIDATION_FAILED';
  end if;
  select * into message_record from public.communication_messages where id = requested_message_id for update;
  conversation := private.require_communication_participant(message_record.conversation_id);
  if message_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into report_record from public.communication_message_reports
  where reporter_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if report_record.id is not null then
    return jsonb_build_object('report_id', report_record.id, 'state', report_record.state, 'idempotent', true);
  end if;
  insert into public.communication_message_reports (
    conversation_id, message_id, reporter_user_id, category, detail, idempotency_key
  ) values (
    conversation.id, message_record.id, auth.uid(), requested_category,
    trim(coalesce(requested_detail, '')), requested_idempotency_key
  ) on conflict (message_id, reporter_user_id) do nothing returning * into report_record;
  if report_record.id is null then
    select * into report_record from public.communication_message_reports
    where message_id = message_record.id and reporter_user_id = auth.uid();
    return jsonb_build_object('report_id', report_record.id, 'state', report_record.state, 'idempotent', true);
  end if;
  if message_record.moderation_state = 'visible' then
    update public.communication_messages set moderation_state = 'reported' where id = message_record.id;
  end if;
  perform private.append_communication_event(conversation.id, message_record.id, null, report_record.id, conversation.organization_id, 'message.reported', requested_idempotency_key);
  for administrator in select capability.user_id from public.role_capabilities capability where 'administrator' = any(capability.capabilities) and capability.administrator_granted_at is not null loop
    if private.communication_user_has_active_administrator_context(administrator.user_id) then
      perform private.create_communication_notification(administrator.user_id, null, 'required_notice', 'required', 'required', 'communication_report', report_record.id, '/admin/communication/reports', 'A communication report requires authorized review.', 'report:' || report_record.id::text || ':' || administrator.user_id::text);
    end if;
  end loop;
  return jsonb_build_object('report_id', report_record.id, 'state', report_record.state, 'idempotent', false);
end;
$$;

create or replace function public.complete_communication_attachment_upload(requested_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, storage as $$
declare attachment public.communication_message_attachments; conversation public.communication_conversations;
  stored_object storage.objects;
begin
  select * into attachment from public.communication_message_attachments where id = requested_attachment_id for update;
  conversation := private.require_communication_participant(attachment.conversation_id);
  if attachment.id is null or attachment.uploaded_by_user_id <> auth.uid() or attachment.scan_state <> 'pending' then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into stored_object from storage.objects
  where bucket_id = attachment.storage_bucket and name = attachment.object_key;
  if stored_object.id is null
    or coalesce((stored_object.metadata ->> 'size')::bigint, -1) <> attachment.size_bytes
    or coalesce(stored_object.metadata ->> 'mimetype', '') <> attachment.content_type then
    update public.communication_message_attachments
      set scan_state = 'rejected', rejected_at = now()
      where id = attachment.id;
    perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'attachment.rejected');
    raise exception 'VALIDATION_FAILED';
  end if;
  update public.communication_message_attachments set scan_state = 'clean', validated_at = now() where id = attachment.id;
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'attachment.cleaned');
  return jsonb_build_object('attachment_id', attachment.id, 'scan_state', 'clean');
end;
$$;

create or replace function private.communication_context_participants(
  target_context_type public.communication_conversation_type,
  target_context_entity_id uuid
) returns table(user_id uuid, participant_role public.communication_participant_role)
language plpgsql stable security definer set search_path = public as $$
begin
  if target_context_type = 'application' then
    return query select application.talent_user_id, 'talent'::public.communication_participant_role from public.project_applications application where application.id = target_context_entity_id
    union select membership.user_id, 'company_member'::public.communication_participant_role from public.project_applications application join public.organization_memberships membership on membership.organization_id = application.organization_id where application.id = target_context_entity_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'project' then
    return query select membership.user_id, 'company_member'::public.communication_participant_role from public.company_project_drafts project join public.organization_memberships membership on membership.organization_id = project.organization_id where project.id = target_context_entity_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'workspace' then
    return query select member.user_id, case when member.role = 'talent_participant' then 'talent'::public.communication_participant_role when member.role = 'reviewer' then 'reviewer'::public.communication_participant_role else 'company_member'::public.communication_participant_role end from public.project_workspace_members member where member.workspace_id = target_context_entity_id and member.status = 'active' and (member.role <> 'reviewer' or (member.review_material_granted = true and public.is_reviewer_active_user(member.user_id)))
    union select membership.user_id, 'company_member'::public.communication_participant_role from public.project_workspaces workspace join public.organization_memberships membership on membership.organization_id = workspace.organization_id where workspace.id = target_context_entity_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'review' then
    return query select verification.talent_user_id, 'talent'::public.communication_participant_role from public.project_verifications verification where verification.id = target_context_entity_id
    union select review.reviewer_user_id, 'reviewer'::public.communication_participant_role from public.project_verification_reviews review where review.verification_id = target_context_entity_id and review.state in ('assigned', 'under_review', 'changes_requested', 'verified', 'not_verified') and public.is_reviewer_active_user(review.reviewer_user_id)
    union select membership.user_id, 'company_member'::public.communication_participant_role from public.project_verifications verification join public.organization_memberships membership on membership.organization_id = verification.organization_id where verification.id = target_context_entity_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'support' then
    return query select target_context_entity_id, 'talent'::public.communication_participant_role
    union select capability.user_id, 'administrator'::public.communication_participant_role from public.role_capabilities capability where 'administrator' = any(capability.capabilities) and capability.administrator_granted_at is not null;
  end if;
end;
$$;

create or replace function public.get_communication_notifications(maximum_count integer default 30)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', notification.id, 'notification_type', notification.notification_type, 'category', notification.category,
    'priority', notification.priority, 'source_entity_type', notification.source_entity_type, 'source_entity_id', notification.source_entity_id,
    'deep_link', notification.deep_link, 'summary', notification.summary, 'read_at', notification.read_at,
    'dismissed_at', notification.dismissed_at, 'required_notice', notification.required_notice, 'created_at', notification.created_at
  ) order by notification.created_at desc), '[]'::jsonb)
  from (
    select notification.* from public.communication_notifications notification
    where notification.recipient_user_id = auth.uid() and notification.dismissed_at is null
      and private.communication_notification_still_authorized(notification.recipient_user_id, notification.source_entity_type, notification.source_entity_id, notification.required_notice)
      and exists (select 1 from public.communication_notification_delivery_attempts attempt where attempt.notification_id = notification.id and attempt.channel = 'in_app' and attempt.state = 'delivered')
    order by notification.created_at desc limit least(greatest(coalesce(maximum_count, 0), 0), 50)
  ) notification
$$;

revoke all on function private.communication_user_has_active_administrator_context(uuid), private.communication_notification_still_authorized(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.report_communication_message(uuid, public.communication_report_category, text, uuid), public.complete_communication_attachment_upload(uuid), public.get_communication_notifications(integer) from public, anon;
grant execute on function public.report_communication_message(uuid, public.communication_report_category, text, uuid), public.complete_communication_attachment_upload(uuid), public.get_communication_notifications(integer) to authenticated;
