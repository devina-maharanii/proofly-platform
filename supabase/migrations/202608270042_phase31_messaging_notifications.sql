-- Phase 31 — Object-linked messaging and notifications.
-- Owner: Communication module. Risk: private-context leakage, spam, abusive uploads,
-- notification inference, irreversible moderation, and social-network scope expansion.
-- Rollback: forward compensation only; disable routes/RPC grants while retaining restricted
-- audit, moderation, and redacted-message records for safety and dispute handling.

create type public.communication_conversation_type as enum (
  'application', 'project', 'workspace', 'review', 'trial', 'support'
);
create type public.communication_conversation_state as enum ('open', 'closed');
create type public.communication_participant_role as enum (
  'talent', 'company_member', 'reviewer', 'administrator'
);
create type public.communication_message_delivery_state as enum ('created', 'delivered', 'failed');
create type public.communication_moderation_state as enum ('visible', 'reported', 'restricted');
create type public.communication_attachment_scan_state as enum ('pending', 'clean', 'rejected');
create type public.communication_report_category as enum (
  'spam', 'harassment', 'unsafe_link', 'sensitive_information', 'other'
);
create type public.communication_report_state as enum ('open', 'triaged', 'resolved', 'dismissed');
create type public.communication_moderation_action as enum ('none', 'restrict_message');
create type public.communication_notification_type as enum (
  'message_new', 'message_mention', 'application_status', 'workspace_update',
  'review_update', 'verification_update', 'paid_trial_update', 'milestone_update',
  'payment_update', 'dispute_update', 'account_security', 'consent_change', 'required_notice'
);
create type public.communication_notification_category as enum (
  'message', 'workflow', 'review', 'verification', 'financial', 'security', 'account', 'consent', 'required'
);
create type public.communication_notification_priority as enum ('low', 'normal', 'high', 'required');
create type public.communication_delivery_channel as enum ('in_app', 'email', 'push', 'digest');
create type public.communication_delivery_attempt_state as enum ('delivered', 'failed', 'suppressed', 'pending');
create type public.communication_digest_frequency as enum ('immediate', 'daily', 'off');

create table public.communication_conversations (
  id uuid primary key default gen_random_uuid(),
  context_type public.communication_conversation_type not null,
  context_entity_id uuid not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  state public.communication_conversation_state not null default 'open',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((context_type = 'support') = (organization_id is null)),
  check ((state = 'closed') = (closed_at is not null)),
  unique (context_type, context_entity_id)
);

create table public.communication_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.communication_conversations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  participant_role public.communication_participant_role not null,
  is_required boolean not null default false,
  muted_at timestamptz,
  archived_at timestamptz,
  left_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.communication_conversations(id) on delete restrict,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  body text not null check (char_length(body) between 1 and 4000),
  delivery_state public.communication_message_delivery_state not null default 'delivered',
  moderation_state public.communication_moderation_state not null default 'visible',
  edited_at timestamptz,
  deleted_at timestamptz,
  body_redacted boolean not null default false,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, sequence_number),
  unique (conversation_id, sender_user_id, idempotency_key),
  check ((deleted_at is not null) = body_redacted)
);

create table public.communication_message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id) on delete restrict,
  conversation_id uuid not null references public.communication_conversations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  revision_kind text not null check (revision_kind in ('edited', 'redacted', 'restricted')),
  previous_body text not null check (char_length(previous_body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.communication_message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.communication_conversations(id) on delete restrict,
  message_id uuid references public.communication_messages(id) on delete restrict,
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_bucket text not null default 'proofly-message-private' check (storage_bucket = 'proofly-message-private'),
  object_key text not null unique check (
    char_length(object_key) between 1 and 400
    and object_key not like '/%' and object_key not like '%..%' and object_key not like '%\\%'
  ),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  scan_state public.communication_attachment_scan_state not null default 'pending',
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  rejected_at timestamptz,
  check ((scan_state = 'clean') = (validated_at is not null)),
  check ((scan_state = 'rejected') = (rejected_at is not null))
);

create table public.communication_message_mentions (
  message_id uuid not null references public.communication_messages(id) on delete restrict,
  mentioned_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

create table public.communication_user_blocks (
  blocked_by_user_id uuid not null references auth.users(id) on delete restrict,
  blocked_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (blocked_by_user_id, blocked_user_id),
  check (blocked_by_user_id <> blocked_user_id)
);

create table public.communication_message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.communication_conversations(id) on delete restrict,
  message_id uuid not null references public.communication_messages(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  category public.communication_report_category not null,
  detail text not null default '' check (char_length(detail) <= 1000),
  state public.communication_report_state not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  unique (message_id, reporter_user_id),
  check ((state in ('resolved', 'dismissed')) = (resolved_at is not null and resolved_by_user_id is not null))
);

create table public.communication_moderation_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.communication_message_reports(id) on delete restrict,
  message_id uuid not null references public.communication_messages(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action public.communication_moderation_action not null,
  reason text not null check (char_length(reason) between 20 and 1000),
  created_at timestamptz not null default now()
);

create table public.communication_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete restrict,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  message_alerts_enabled boolean not null default true,
  mention_alerts_enabled boolean not null default true,
  digest_frequency public.communication_digest_frequency not null default 'immediate',
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 80),
  updated_at timestamptz not null default now()
);

create table public.communication_organization_notification_preferences (
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table public.communication_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  notification_type public.communication_notification_type not null,
  category public.communication_notification_category not null,
  priority public.communication_notification_priority not null default 'normal',
  source_entity_type text not null check (char_length(source_entity_type) between 3 and 100),
  source_entity_id uuid not null,
  deep_link text not null check (deep_link ~ '^/[A-Za-z0-9_/?=&-]{1,500}$'),
  summary text not null check (char_length(summary) between 1 and 280),
  deduplication_key text not null check (char_length(deduplication_key) between 8 and 240),
  read_at timestamptz,
  dismissed_at timestamptz,
  required_notice boolean not null default false,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, deduplication_key),
  check ((priority = 'required') = required_notice)
);

create table public.communication_notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.communication_notifications(id) on delete restrict,
  channel public.communication_delivery_channel not null,
  attempt_number integer not null check (attempt_number between 1 and 20),
  state public.communication_delivery_attempt_state not null,
  failure_code text check (failure_code is null or char_length(failure_code) <= 80),
  attempted_at timestamptz not null default now(),
  unique (notification_id, channel, attempt_number)
);

create table public.communication_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.communication_conversations(id) on delete restrict,
  message_id uuid references public.communication_messages(id) on delete restrict,
  notification_id uuid references public.communication_notifications(id) on delete restrict,
  report_id uuid references public.communication_message_reports(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'conversation.created', 'conversation.archived', 'conversation.muted', 'conversation.left',
    'participant.blocked', 'message.sent', 'message.edited', 'message.redacted', 'message.reported',
    'message.restricted', 'attachment.prepared', 'attachment.cleaned', 'attachment.rejected',
    'notification.created', 'notification.read', 'notification.dismissed', 'notification.preferences_saved',
    'notification.delivery_recorded', 'report.moderated'
  )),
  idempotency_key uuid,
  occurred_at timestamptz not null default now(),
  unique (actor_user_id, event_type, idempotency_key)
);

create table public.communication_rate_limit_windows (
  user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('conversation', 'message', 'attachment', 'mention')),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  primary key (user_id, action)
);

create index communication_conversations_context_idx on public.communication_conversations(context_type, context_entity_id);
create index communication_participants_user_active_idx on public.communication_conversation_participants(user_id, conversation_id) where left_at is null;
create index communication_messages_conversation_created_idx on public.communication_messages(conversation_id, created_at desc, sequence_number desc);
create index communication_attachments_conversation_idx on public.communication_message_attachments(conversation_id, created_at desc);
create index communication_reports_state_created_idx on public.communication_message_reports(state, created_at asc);
create index communication_notifications_recipient_created_idx on public.communication_notifications(recipient_user_id, created_at desc) where dismissed_at is null;
create index communication_events_conversation_occurred_idx on public.communication_events(conversation_id, occurred_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofly-message-private', 'proofly-message-private', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.communication_conversations enable row level security;
alter table public.communication_conversation_participants enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_message_revisions enable row level security;
alter table public.communication_message_attachments enable row level security;
alter table public.communication_message_mentions enable row level security;
alter table public.communication_user_blocks enable row level security;
alter table public.communication_message_reports enable row level security;
alter table public.communication_moderation_events enable row level security;
alter table public.communication_notification_preferences enable row level security;
alter table public.communication_organization_notification_preferences enable row level security;
alter table public.communication_notifications enable row level security;
alter table public.communication_notification_delivery_attempts enable row level security;
alter table public.communication_events enable row level security;
alter table public.communication_rate_limit_windows enable row level security;

create or replace function private.communication_message_body_is_safe(target_body text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select char_length(trim(coalesce(target_body, ''))) between 1 and 4000
    and target_body !~* '<[[:space:]]*script'
    and target_body !~* 'javascript[[:space:]]*:'
    and target_body !~* '(^|[[:space:]])http://'
    and target_body !~* '(api[_ -]?key|secret[[:space:]]*key|password)[[:space:]]*[:=]'
$$;

create or replace function private.communication_actor_has_context_access(
  target_context_type public.communication_conversation_type,
  target_context_entity_id uuid
) returns boolean language plpgsql stable security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then return false; end if;
  if target_context_type = 'application' then
    return exists (
      select 1 from public.project_applications application
      where application.id = target_context_entity_id
        and application.state in ('submitted', 'shortlisted', 'invited_to_trial', 'accepted')
        and (
          (application.talent_user_id = actor_id and exists (
            select 1 from public.active_contexts context where context.user_id = actor_id and context.active_role = 'talent'
          ))
          or (
            exists (select 1 from public.active_contexts context where context.user_id = actor_id and context.active_role = 'company_member' and context.active_organization_id = application.organization_id)
            and public.has_organization_permission(application.organization_id, 'hiring_member')
          )
        )
    );
  elsif target_context_type = 'project' then
    return exists (
      select 1 from public.company_project_drafts project
      where project.id = target_context_entity_id and project.state <> 'archived'
        and exists (select 1 from public.active_contexts context where context.user_id = actor_id and context.active_role = 'company_member' and context.active_organization_id = project.organization_id)
        and public.has_organization_permission(project.organization_id, 'hiring_member')
    );
  elsif target_context_type = 'workspace' then
    return exists (select 1 from public.project_workspaces workspace where workspace.id = target_context_entity_id and workspace.state <> 'closed')
      and public.project_workspace_access_role(target_context_entity_id) is not null;
  elsif target_context_type = 'review' then
    return exists (
      select 1 from public.project_verifications verification
      where verification.id = target_context_entity_id and verification.state <> 'revoked'
        and (
          (verification.talent_user_id = actor_id and exists (
            select 1 from public.active_contexts context where context.user_id = actor_id and context.active_role = 'talent'
          ))
          or (
            exists (select 1 from public.active_contexts context where context.user_id = actor_id and context.active_role = 'company_member' and context.active_organization_id = verification.organization_id)
            and public.has_organization_permission(verification.organization_id, 'hiring_member')
          )
          or (
            exists (select 1 from public.project_verification_reviews review where review.verification_id = verification.id and review.reviewer_user_id = actor_id)
            and public.project_workspace_access_role(verification.workspace_id) = 'reviewer'
          )
        )
    );
  elsif target_context_type = 'support' then
    return target_context_entity_id = actor_id and exists (
      select 1 from public.active_contexts context where context.user_id = actor_id
    );
  end if;
  return false;
end;
$$;

create or replace function private.communication_context_organization(
  target_context_type public.communication_conversation_type,
  target_context_entity_id uuid
) returns uuid language sql stable security definer set search_path = public as $$
  select case target_context_type
    when 'application' then (select organization_id from public.project_applications where id = target_context_entity_id)
    when 'project' then (select organization_id from public.company_project_drafts where id = target_context_entity_id)
    when 'workspace' then (select organization_id from public.project_workspaces where id = target_context_entity_id)
    when 'review' then (select organization_id from public.project_verifications where id = target_context_entity_id)
    else null
  end
$$;

create or replace function private.communication_context_participants(
  target_context_type public.communication_conversation_type,
  target_context_entity_id uuid
) returns table(user_id uuid, participant_role public.communication_participant_role)
language plpgsql stable security definer set search_path = public as $$
begin
  if target_context_type = 'application' then
    return query
      select application.talent_user_id, 'talent'::public.communication_participant_role
      from public.project_applications application where application.id = target_context_entity_id
      union
      select membership.user_id, 'company_member'::public.communication_participant_role
      from public.project_applications application
      join public.organization_memberships membership on membership.organization_id = application.organization_id
      where application.id = target_context_entity_id and membership.status = 'active'
        and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'project' then
    return query
      select membership.user_id, 'company_member'::public.communication_participant_role
      from public.company_project_drafts project
      join public.organization_memberships membership on membership.organization_id = project.organization_id
      where project.id = target_context_entity_id and membership.status = 'active'
        and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'workspace' then
    return query
      select member.user_id,
        case when member.role = 'talent_participant' then 'talent'::public.communication_participant_role
             when member.role = 'reviewer' then 'reviewer'::public.communication_participant_role
             else 'company_member'::public.communication_participant_role end
      from public.project_workspace_members member
      where member.workspace_id = target_context_entity_id and member.status = 'active'
        and (member.role <> 'reviewer' or member.review_material_granted = true)
      union
      select membership.user_id, 'company_member'::public.communication_participant_role
      from public.project_workspaces workspace
      join public.organization_memberships membership on membership.organization_id = workspace.organization_id
      where workspace.id = target_context_entity_id and membership.status = 'active'
        and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'review' then
    return query
      select verification.talent_user_id, 'talent'::public.communication_participant_role
      from public.project_verifications verification where verification.id = target_context_entity_id
      union
      select review.reviewer_user_id, 'reviewer'::public.communication_participant_role
      from public.project_verification_reviews review where review.verification_id = target_context_entity_id
        and review.state in ('assigned', 'under_review', 'changes_requested', 'verified', 'not_verified')
      union
      select membership.user_id, 'company_member'::public.communication_participant_role
      from public.project_verifications verification
      join public.organization_memberships membership on membership.organization_id = verification.organization_id
      where verification.id = target_context_entity_id and membership.status = 'active'
        and membership.permissions && array['owner','hiring_member']::public.company_permission[];
  elsif target_context_type = 'support' then
    return query
      select target_context_entity_id, 'talent'::public.communication_participant_role
      union
      select capability.user_id, 'administrator'::public.communication_participant_role
      from public.role_capabilities capability
      where 'administrator' = any(capability.capabilities) and capability.administrator_granted_at is not null;
  end if;
end;
$$;

create or replace function private.communication_participant_still_authorized(
  target_user_id uuid,
  target_context_type public.communication_conversation_type,
  target_context_entity_id uuid
) returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if target_context_type = 'application' then
    return exists (select 1 from public.project_applications application where application.id = target_context_entity_id and application.state in ('submitted','shortlisted','invited_to_trial','accepted') and application.talent_user_id = target_user_id)
      or exists (select 1 from public.project_applications application join public.organization_memberships membership on membership.organization_id = application.organization_id where application.id = target_context_entity_id and membership.user_id = target_user_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[]);
  elsif target_context_type = 'project' then
    return exists (select 1 from public.company_project_drafts project join public.organization_memberships membership on membership.organization_id = project.organization_id where project.id = target_context_entity_id and project.state <> 'archived' and membership.user_id = target_user_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[]);
  elsif target_context_type = 'workspace' then
    return exists (select 1 from public.project_workspace_members member where member.workspace_id = target_context_entity_id and member.user_id = target_user_id and member.status = 'active' and (member.role <> 'reviewer' or (member.review_material_granted and public.is_reviewer_active_user(target_user_id))))
      or exists (select 1 from public.project_workspaces workspace join public.organization_memberships membership on membership.organization_id = workspace.organization_id where workspace.id = target_context_entity_id and workspace.state <> 'closed' and membership.user_id = target_user_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[]);
  elsif target_context_type = 'review' then
    return exists (select 1 from public.project_verifications verification where verification.id = target_context_entity_id and verification.state <> 'revoked' and verification.talent_user_id = target_user_id)
      or exists (select 1 from public.project_verification_reviews review join public.project_verifications verification on verification.id = review.verification_id where review.verification_id = target_context_entity_id and review.reviewer_user_id = target_user_id and verification.state <> 'revoked' and public.is_reviewer_active_user(target_user_id))
      or exists (select 1 from public.project_verifications verification join public.organization_memberships membership on membership.organization_id = verification.organization_id where verification.id = target_context_entity_id and verification.state <> 'revoked' and membership.user_id = target_user_id and membership.status = 'active' and membership.permissions && array['owner','hiring_member']::public.company_permission[]);
  elsif target_context_type = 'support' then
    return target_user_id = target_context_entity_id or exists (select 1 from public.role_capabilities capability where capability.user_id = target_user_id and 'administrator' = any(capability.capabilities) and capability.administrator_granted_at is not null);
  end if;
  return false;
end;
$$;

create or replace function private.require_communication_participant(target_conversation_id uuid)
returns public.communication_conversations language plpgsql security definer set search_path = public, private as $$
declare result public.communication_conversations;
begin
  select conversation.* into result from public.communication_conversations conversation
  where conversation.id = target_conversation_id and conversation.state = 'open'
    and exists (select 1 from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.user_id = auth.uid() and participant.left_at is null)
    and private.communication_actor_has_context_access(conversation.context_type, conversation.context_entity_id);
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.enforce_communication_rate_limit(target_action text)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); record public.communication_rate_limit_windows;
  maximum integer; window_interval interval;
begin
  if actor_id is null or target_action not in ('conversation','message','attachment','mention') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  maximum := case target_action when 'conversation' then 10 when 'message' then 20 when 'attachment' then 10 else 40 end;
  window_interval := case target_action when 'conversation' then interval '1 hour' when 'message' then interval '10 minutes' when 'attachment' then interval '1 hour' else interval '10 minutes' end;
  insert into public.communication_rate_limit_windows (user_id, action, attempt_count) values (actor_id, target_action, 0) on conflict do nothing;
  select * into record from public.communication_rate_limit_windows where user_id = actor_id and action = target_action for update;
  if record.window_started_at + window_interval <= now() then
    update public.communication_rate_limit_windows set window_started_at = now(), attempt_count = 1 where user_id = actor_id and action = target_action;
  elsif record.attempt_count >= maximum then
    raise exception 'RATE_LIMITED';
  else
    update public.communication_rate_limit_windows set attempt_count = attempt_count + 1 where user_id = actor_id and action = target_action;
  end if;
end;
$$;

create or replace function private.append_communication_event(
  target_conversation_id uuid, target_message_id uuid, target_notification_id uuid, target_report_id uuid,
  target_organization_id uuid, target_event_type text, target_idempotency_key uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.communication_events (conversation_id, message_id, notification_id, report_id, organization_id, actor_user_id, event_type, idempotency_key)
  values (target_conversation_id, target_message_id, target_notification_id, target_report_id, target_organization_id, auth.uid(), target_event_type, target_idempotency_key)
  on conflict (actor_user_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

create or replace function private.create_communication_notification(
  target_recipient_user_id uuid, target_organization_id uuid, target_type public.communication_notification_type,
  target_category public.communication_notification_category, target_priority public.communication_notification_priority,
  target_source_entity_type text, target_source_entity_id uuid, target_deep_link text, target_summary text,
  target_deduplication_key text
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare notification_id uuid; preference public.communication_notification_preferences; muted_organization boolean := false;
begin
  select * into preference from public.communication_notification_preferences where user_id = target_recipient_user_id;
  if target_organization_id is not null then
    select organization_preference.muted into muted_organization from public.communication_organization_notification_preferences organization_preference
    where organization_preference.user_id = target_recipient_user_id and organization_preference.organization_id = target_organization_id;
  end if;
  insert into public.communication_notifications (
    recipient_user_id, organization_id, notification_type, category, priority, source_entity_type, source_entity_id,
    deep_link, summary, deduplication_key, required_notice
  ) values (
    target_recipient_user_id, target_organization_id, target_type, target_category, target_priority,
    target_source_entity_type, target_source_entity_id, target_deep_link, target_summary, target_deduplication_key,
    target_priority = 'required'
  ) on conflict (recipient_user_id, deduplication_key) do nothing returning id into notification_id;
  if notification_id is not null then
    insert into public.communication_notification_delivery_attempts (notification_id, channel, attempt_number, state)
    values (notification_id, 'in_app', 1, case when target_priority = 'required' or (coalesce(preference.in_app_enabled, true) and not coalesce(muted_organization, false)) then 'delivered'::public.communication_delivery_attempt_state else 'suppressed'::public.communication_delivery_attempt_state end);
    perform private.append_communication_event(null, null, notification_id, null, target_organization_id, 'notification.created');
  end if;
  return notification_id;
end;
$$;

create or replace function private.prevent_communication_ledger_rewrite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'IMMUTABLE_RECORD';
end;
$$;

create trigger communication_message_revisions_immutable before update or delete on public.communication_message_revisions
for each row execute function private.prevent_communication_ledger_rewrite();
create trigger communication_moderation_events_immutable before update or delete on public.communication_moderation_events
for each row execute function private.prevent_communication_ledger_rewrite();
create trigger communication_events_immutable before update or delete on public.communication_events
for each row execute function private.prevent_communication_ledger_rewrite();
create trigger communication_delivery_attempts_immutable before update or delete on public.communication_notification_delivery_attempts
for each row execute function private.prevent_communication_ledger_rewrite();

create or replace function public.create_object_linked_conversation(
  requested_context_type public.communication_conversation_type,
  requested_context_entity_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); result public.communication_conversations; participant record; context_org uuid;
begin
  if actor_id is null or requested_context_type = 'trial' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if not private.communication_actor_has_context_access(requested_context_type, requested_context_entity_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into result from public.communication_conversations where context_type = requested_context_type and context_entity_id = requested_context_entity_id for update;
  if result.id is not null then
    perform private.require_communication_participant(result.id);
    return jsonb_build_object('conversation_id', result.id, 'created', false);
  end if;
  perform private.enforce_communication_rate_limit('conversation');
  context_org := private.communication_context_organization(requested_context_type, requested_context_entity_id);
  insert into public.communication_conversations (context_type, context_entity_id, organization_id, created_by_user_id)
  values (requested_context_type, requested_context_entity_id, context_org, actor_id) returning * into result;
  for participant in select * from private.communication_context_participants(requested_context_type, requested_context_entity_id) loop
    insert into public.communication_conversation_participants (conversation_id, user_id, participant_role, is_required)
    values (result.id, participant.user_id, participant.participant_role, participant.user_id = actor_id)
    on conflict (conversation_id, user_id) do nothing;
  end loop;
  if not exists (select 1 from public.communication_conversation_participants where conversation_id = result.id and user_id = actor_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.append_communication_event(result.id, null, null, null, result.organization_id, 'conversation.created', requested_idempotency_key);
  return jsonb_build_object('conversation_id', result.id, 'created', true);
end;
$$;

create or replace function public.send_communication_message(
  requested_conversation_id uuid, requested_body text, requested_mentioned_user_ids uuid[],
  requested_attachment_ids uuid[], requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); conversation public.communication_conversations; message_record public.communication_messages;
  existing public.communication_messages; next_sequence integer; recipient record; attachment_count integer;
begin
  if actor_id is null or not private.communication_message_body_is_safe(requested_body)
    or cardinality(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) > 8
    or cardinality(coalesce(requested_attachment_ids, '{}'::uuid[])) > 4
    or cardinality(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) <> cardinality(array(select distinct value from unnest(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) value))
    or cardinality(coalesce(requested_attachment_ids, '{}'::uuid[])) <> cardinality(array(select distinct value from unnest(coalesce(requested_attachment_ids, '{}'::uuid[])) value))
  then raise exception 'VALIDATION_FAILED'; end if;
  conversation := private.require_communication_participant(requested_conversation_id);
  if exists (select 1 from public.communication_user_blocks block where (block.blocked_by_user_id = actor_id and block.blocked_user_id in (select participant.user_id from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.left_at is null)) or (block.blocked_user_id = actor_id and block.blocked_by_user_id in (select participant.user_id from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.left_at is null))) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into existing from public.communication_messages where conversation_id = conversation.id and sender_user_id = actor_id and idempotency_key = requested_idempotency_key;
  if existing.id is not null then return jsonb_build_object('message_id', existing.id, 'idempotent', true, 'created_at', existing.created_at); end if;
  perform private.enforce_communication_rate_limit('message');
  if cardinality(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) > 0 then perform private.enforce_communication_rate_limit('mention'); end if;
  select count(*) into attachment_count from public.communication_message_attachments attachment
  where attachment.id = any(coalesce(requested_attachment_ids, '{}'::uuid[])) and attachment.conversation_id = conversation.id
    and attachment.uploaded_by_user_id = actor_id and attachment.message_id is null and attachment.scan_state = 'clean';
  if attachment_count <> cardinality(coalesce(requested_attachment_ids, '{}'::uuid[]))
    or exists (select 1 from unnest(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) mention_id where not exists (select 1 from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.user_id = mention_id and participant.left_at is null))
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select coalesce(max(sequence_number), 0) + 1 into next_sequence from public.communication_messages where conversation_id = conversation.id;
  insert into public.communication_messages (conversation_id, sender_user_id, sequence_number, body, idempotency_key)
  values (conversation.id, actor_id, next_sequence, trim(requested_body), requested_idempotency_key) returning * into message_record;
  update public.communication_message_attachments set message_id = message_record.id where id = any(coalesce(requested_attachment_ids, '{}'::uuid[]));
  insert into public.communication_message_mentions (message_id, mentioned_user_id)
  select message_record.id, mention_id from unnest(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) mention_id;
  perform private.append_communication_event(conversation.id, message_record.id, null, null, conversation.organization_id, 'message.sent', requested_idempotency_key);
  for recipient in select participant.* from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.user_id <> actor_id and participant.left_at is null and participant.muted_at is null and private.communication_participant_still_authorized(participant.user_id, conversation.context_type, conversation.context_entity_id) loop
    perform private.create_communication_notification(recipient.user_id, conversation.organization_id, 'message_new', 'message', 'normal', 'communication_message', message_record.id, '/messages/' || conversation.id::text, 'New message in a linked conversation.', 'message:' || message_record.id::text || ':' || recipient.user_id::text);
    if recipient.user_id = any(coalesce(requested_mentioned_user_ids, '{}'::uuid[])) then
      perform private.create_communication_notification(recipient.user_id, conversation.organization_id, 'message_mention', 'message', 'high', 'communication_message', message_record.id, '/messages/' || conversation.id::text, 'You were mentioned in a linked conversation.', 'mention:' || message_record.id::text || ':' || recipient.user_id::text);
    end if;
  end loop;
  return jsonb_build_object('message_id', message_record.id, 'idempotent', false, 'created_at', message_record.created_at);
end;
$$;

create or replace function public.edit_communication_message(
  requested_message_id uuid, requested_body text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); message_record public.communication_messages; conversation public.communication_conversations;
begin
  if actor_id is null or not private.communication_message_body_is_safe(requested_body) then raise exception 'VALIDATION_FAILED'; end if;
  select * into message_record from public.communication_messages where id = requested_message_id for update;
  conversation := private.require_communication_participant(message_record.conversation_id);
  if message_record.id is null or message_record.sender_user_id <> actor_id or message_record.body_redacted then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if message_record.body = trim(requested_body) then return jsonb_build_object('message_id', message_record.id, 'unchanged', true); end if;
  insert into public.communication_message_revisions (message_id, conversation_id, actor_user_id, revision_kind, previous_body) values (message_record.id, conversation.id, actor_id, 'edited', message_record.body);
  update public.communication_messages set body = trim(requested_body), edited_at = now() where id = message_record.id;
  perform private.append_communication_event(conversation.id, message_record.id, null, null, conversation.organization_id, 'message.edited', requested_idempotency_key);
  return jsonb_build_object('message_id', message_record.id, 'edited', true);
end;
$$;

create or replace function public.redact_communication_message(
  requested_message_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); message_record public.communication_messages; conversation public.communication_conversations;
begin
  select * into message_record from public.communication_messages where id = requested_message_id for update;
  conversation := private.require_communication_participant(message_record.conversation_id);
  if message_record.id is null or message_record.sender_user_id <> actor_id then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if message_record.body_redacted then return jsonb_build_object('message_id', message_record.id, 'idempotent', true); end if;
  insert into public.communication_message_revisions (message_id, conversation_id, actor_user_id, revision_kind, previous_body) values (message_record.id, conversation.id, actor_id, 'redacted', message_record.body);
  update public.communication_messages set body = 'This message was deleted by its sender.', body_redacted = true, deleted_at = now(), delivery_state = 'delivered' where id = message_record.id;
  perform private.append_communication_event(conversation.id, message_record.id, null, null, conversation.organization_id, 'message.redacted', requested_idempotency_key);
  return jsonb_build_object('message_id', message_record.id, 'redacted', true);
end;
$$;

create or replace function public.set_communication_conversation_control(
  requested_conversation_id uuid, requested_control text, requested_enabled boolean, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare conversation public.communication_conversations; event_name text;
begin
  if requested_control not in ('mute', 'archive') then raise exception 'VALIDATION_FAILED'; end if;
  conversation := private.require_communication_participant(requested_conversation_id);
  update public.communication_conversation_participants set
    muted_at = case when requested_control = 'mute' and requested_enabled then now() when requested_control = 'mute' then null else muted_at end,
    archived_at = case when requested_control = 'archive' and requested_enabled then now() when requested_control = 'archive' then null else archived_at end,
    updated_at = now()
  where conversation_id = conversation.id and user_id = auth.uid();
  event_name := case when requested_control = 'mute' then 'conversation.muted' else 'conversation.archived' end;
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, event_name, requested_idempotency_key);
  return jsonb_build_object('conversation_id', conversation.id, 'control', requested_control, 'enabled', requested_enabled);
end;
$$;

create or replace function public.leave_communication_conversation(
  requested_conversation_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare conversation public.communication_conversations;
begin
  conversation := private.require_communication_participant(requested_conversation_id);
  update public.communication_conversation_participants set left_at = coalesce(left_at, now()), updated_at = now() where conversation_id = conversation.id and user_id = auth.uid();
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'conversation.left', requested_idempotency_key);
  return jsonb_build_object('conversation_id', conversation.id, 'left', true);
end;
$$;

create or replace function public.block_communication_participant(
  requested_conversation_id uuid, requested_blocked_user_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare conversation public.communication_conversations;
begin
  conversation := private.require_communication_participant(requested_conversation_id);
  if requested_blocked_user_id = auth.uid() or not exists (select 1 from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.user_id = requested_blocked_user_id and participant.left_at is null) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.communication_user_blocks (blocked_by_user_id, blocked_user_id) values (auth.uid(), requested_blocked_user_id) on conflict do nothing;
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'participant.blocked', requested_idempotency_key);
  return jsonb_build_object('conversation_id', conversation.id, 'blocked', true);
end;
$$;

create or replace function public.report_communication_message(
  requested_message_id uuid, requested_category public.communication_report_category, requested_detail text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare message_record public.communication_messages; conversation public.communication_conversations; report_record public.communication_message_reports; administrator record;
begin
  if char_length(trim(coalesce(requested_detail, ''))) > 1000 then raise exception 'VALIDATION_FAILED'; end if;
  select * into message_record from public.communication_messages where id = requested_message_id for update;
  conversation := private.require_communication_participant(message_record.conversation_id);
  if message_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.communication_message_reports (conversation_id, message_id, reporter_user_id, category, detail)
  values (conversation.id, message_record.id, auth.uid(), requested_category, trim(coalesce(requested_detail, '')))
  on conflict (message_id, reporter_user_id) do update set detail = excluded.detail
  returning * into report_record;
  if message_record.moderation_state = 'visible' then update public.communication_messages set moderation_state = 'reported' where id = message_record.id; end if;
  perform private.append_communication_event(conversation.id, message_record.id, null, report_record.id, conversation.organization_id, 'message.reported', requested_idempotency_key);
  for administrator in select capability.user_id from public.role_capabilities capability where 'administrator' = any(capability.capabilities) and capability.administrator_granted_at is not null loop
    perform private.create_communication_notification(administrator.user_id, null, 'required_notice', 'required', 'required', 'communication_report', report_record.id, '/admin/communication/reports', 'A communication report requires authorized review.', 'report:' || report_record.id::text || ':' || administrator.user_id::text);
  end loop;
  return jsonb_build_object('report_id', report_record.id, 'state', report_record.state);
end;
$$;

create or replace function public.moderate_communication_report(
  requested_report_id uuid, requested_action public.communication_moderation_action, requested_reason text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare report_record public.communication_message_reports; message_record public.communication_messages; conversation public.communication_conversations;
begin
  if not public.has_active_platform_administrator_context() or char_length(trim(coalesce(requested_reason, ''))) not between 20 and 1000 then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into report_record from public.communication_message_reports where id = requested_report_id for update;
  select * into message_record from public.communication_messages where id = report_record.message_id for update;
  select * into conversation from public.communication_conversations where id = report_record.conversation_id;
  if report_record.id is null or report_record.state not in ('open','triaged') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if requested_action = 'restrict_message' and not message_record.body_redacted then
    insert into public.communication_message_revisions (message_id, conversation_id, actor_user_id, revision_kind, previous_body) values (message_record.id, conversation.id, auth.uid(), 'restricted', message_record.body);
    update public.communication_messages set body = 'This message has been restricted by the platform.', body_redacted = true, deleted_at = now(), moderation_state = 'restricted' where id = message_record.id;
    perform private.append_communication_event(conversation.id, message_record.id, null, report_record.id, conversation.organization_id, 'message.restricted', requested_idempotency_key);
  end if;
  update public.communication_message_reports set state = 'resolved', resolved_at = now(), resolved_by_user_id = auth.uid() where id = report_record.id;
  insert into public.communication_moderation_events (report_id, message_id, actor_user_id, action, reason) values (report_record.id, message_record.id, auth.uid(), requested_action, trim(requested_reason));
  perform private.append_communication_event(conversation.id, message_record.id, null, report_record.id, conversation.organization_id, 'report.moderated', requested_idempotency_key);
  return jsonb_build_object('report_id', report_record.id, 'state', 'resolved', 'action', requested_action);
end;
$$;

create or replace function public.prepare_communication_attachment_upload(
  requested_conversation_id uuid, requested_original_filename text, requested_content_type text,
  requested_size_bytes bigint, requested_sha256 text, requested_object_key text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare conversation public.communication_conversations; attachment public.communication_message_attachments;
begin
  conversation := private.require_communication_participant(requested_conversation_id);
  perform private.enforce_communication_rate_limit('attachment');
  if char_length(trim(coalesce(requested_original_filename, ''))) not between 1 and 255
    or requested_content_type not in ('application/pdf','image/jpeg','image/png','image/webp','text/plain')
    or requested_size_bytes not between 1 and 5242880 or requested_sha256 !~ '^[a-f0-9]{64}$'
    or requested_object_key !~ ('^' || auth.uid()::text || '/messages/' || conversation.id::text || '/[A-Za-z0-9._/-]+$')
    or requested_object_key like '%..%' or requested_object_key like '%\\%'
  then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.communication_message_attachments (conversation_id, uploaded_by_user_id, original_filename, object_key, content_type, size_bytes, sha256)
  values (conversation.id, auth.uid(), trim(requested_original_filename), requested_object_key, requested_content_type, requested_size_bytes, requested_sha256)
  returning * into attachment;
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'attachment.prepared', requested_idempotency_key);
  return jsonb_build_object('attachment_id', attachment.id, 'object_key', attachment.object_key, 'bucket', attachment.storage_bucket);
end;
$$;

create or replace function public.complete_communication_attachment_upload(requested_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare attachment public.communication_message_attachments; conversation public.communication_conversations;
begin
  select * into attachment from public.communication_message_attachments where id = requested_attachment_id for update;
  conversation := private.require_communication_participant(attachment.conversation_id);
  if attachment.id is null or attachment.uploaded_by_user_id <> auth.uid() or attachment.scan_state <> 'pending' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.communication_message_attachments set scan_state = 'clean', validated_at = now() where id = attachment.id;
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'attachment.cleaned');
  return jsonb_build_object('attachment_id', attachment.id, 'scan_state', 'clean');
end;
$$;

create or replace function public.get_communication_attachment_download_target(requested_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare attachment public.communication_message_attachments;
begin
  select * into attachment from public.communication_message_attachments where id = requested_attachment_id and message_id is not null and scan_state = 'clean';
  if attachment.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.require_communication_participant(attachment.conversation_id);
  return jsonb_build_object('bucket', attachment.storage_bucket, 'object_key', attachment.object_key, 'original_filename', attachment.original_filename);
end;
$$;

create or replace function public.can_insert_communication_attachment_storage_object(requested_object_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communication_message_attachments attachment where attachment.storage_bucket = 'proofly-message-private' and attachment.object_key = requested_object_key and attachment.uploaded_by_user_id = auth.uid() and attachment.scan_state = 'pending')
$$;

create or replace function public.can_read_communication_attachment_storage_object(requested_object_key text)
returns boolean language plpgsql stable security definer set search_path = public, private as $$
declare attachment public.communication_message_attachments;
begin
  select * into attachment from public.communication_message_attachments where storage_bucket = 'proofly-message-private' and object_key = requested_object_key and message_id is not null and scan_state = 'clean';
  if attachment.id is null then return false; end if;
  perform private.require_communication_participant(attachment.conversation_id);
  return true;
exception when others then return false;
end;
$$;

create or replace function public.mark_communication_conversation_read(requested_conversation_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare conversation public.communication_conversations;
begin
  conversation := private.require_communication_participant(requested_conversation_id);
  update public.communication_conversation_participants set last_read_at = now(), updated_at = now() where conversation_id = conversation.id and user_id = auth.uid();
  perform private.append_communication_event(conversation.id, null, null, null, conversation.organization_id, 'notification.read', requested_idempotency_key);
  return jsonb_build_object('conversation_id', conversation.id, 'read', true);
end;
$$;

create or replace function public.save_communication_notification_preferences(
  requested_in_app_enabled boolean, requested_email_enabled boolean, requested_message_alerts_enabled boolean,
  requested_mention_alerts_enabled boolean, requested_digest_frequency public.communication_digest_frequency,
  requested_quiet_hours_start time, requested_quiet_hours_end time, requested_timezone text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null or char_length(trim(coalesce(requested_timezone, ''))) not between 1 and 80 then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.communication_notification_preferences (user_id, in_app_enabled, email_enabled, message_alerts_enabled, mention_alerts_enabled, digest_frequency, quiet_hours_start, quiet_hours_end, timezone)
  values (auth.uid(), requested_in_app_enabled, requested_email_enabled, requested_message_alerts_enabled, requested_mention_alerts_enabled, requested_digest_frequency, requested_quiet_hours_start, requested_quiet_hours_end, trim(requested_timezone))
  on conflict (user_id) do update set in_app_enabled = excluded.in_app_enabled, email_enabled = excluded.email_enabled, message_alerts_enabled = excluded.message_alerts_enabled, mention_alerts_enabled = excluded.mention_alerts_enabled, digest_frequency = excluded.digest_frequency, quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end, timezone = excluded.timezone, updated_at = now();
  perform private.append_communication_event(null, null, null, null, null, 'notification.preferences_saved', requested_idempotency_key);
  return jsonb_build_object('saved', true, 'required_notice_explained', true);
end;
$$;

create or replace function public.save_communication_organization_notification_preference(
  requested_organization_id uuid, requested_muted boolean, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null or not public.is_active_organization_member(requested_organization_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.communication_organization_notification_preferences (user_id, organization_id, muted)
  values (auth.uid(), requested_organization_id, requested_muted)
  on conflict (user_id, organization_id) do update set muted = excluded.muted, updated_at = now();
  perform private.append_communication_event(null, null, null, null, requested_organization_id, 'notification.preferences_saved', requested_idempotency_key);
  return jsonb_build_object('saved', true, 'muted', requested_muted);
end;
$$;

create or replace function public.mark_communication_notification_read(requested_notification_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare notification public.communication_notifications;
begin
  update public.communication_notifications set read_at = coalesce(read_at, now()) where id = requested_notification_id and recipient_user_id = auth.uid() returning * into notification;
  if notification.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.append_communication_event(null, null, notification.id, null, notification.organization_id, 'notification.read', requested_idempotency_key);
  return jsonb_build_object('notification_id', notification.id, 'read', true);
end;
$$;

create or replace function public.dismiss_communication_notification(requested_notification_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare notification public.communication_notifications;
begin
  update public.communication_notifications set dismissed_at = coalesce(dismissed_at, now()) where id = requested_notification_id and recipient_user_id = auth.uid() and not required_notice returning * into notification;
  if notification.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  perform private.append_communication_event(null, null, notification.id, null, notification.organization_id, 'notification.dismissed', requested_idempotency_key);
  return jsonb_build_object('notification_id', notification.id, 'dismissed', true);
end;
$$;

create or replace function public.get_communication_inbox(maximum_count integer default 30)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', conversation.id, 'context_type', conversation.context_type, 'context_entity_id', conversation.context_entity_id,
    'organization_id', conversation.organization_id, 'archived', participant.archived_at is not null,
    'muted', participant.muted_at is not null, 'last_read_at', participant.last_read_at,
    'latest_message_at', latest_message.created_at, 'latest_message_preview', left(coalesce(latest_message.body, ''), 240),
    'unread_count', unread.count
  ) order by latest_message.created_at desc nulls last, conversation.created_at desc), '[]'::jsonb)
  from (
    select conversation.*, participant.archived_at, participant.muted_at, participant.last_read_at
    from public.communication_conversations conversation
    join public.communication_conversation_participants participant on participant.conversation_id = conversation.id
    where participant.user_id = auth.uid() and participant.left_at is null and conversation.state = 'open'
      and private.communication_actor_has_context_access(conversation.context_type, conversation.context_entity_id)
    order by conversation.created_at desc limit least(greatest(coalesce(maximum_count, 0), 0), 50)
  ) conversation
  join public.communication_conversation_participants participant on participant.conversation_id = conversation.id and participant.user_id = auth.uid()
  left join lateral (select message.body, message.created_at from public.communication_messages message where message.conversation_id = conversation.id order by message.sequence_number desc limit 1) latest_message on true
  left join lateral (select count(*)::integer as count from public.communication_messages message where message.conversation_id = conversation.id and message.sender_user_id <> auth.uid() and (participant.last_read_at is null or message.created_at > participant.last_read_at)) unread on true
$$;

create or replace function public.get_communication_conversation(
  requested_conversation_id uuid, requested_before timestamptz default null, maximum_count integer default 50
) returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare conversation public.communication_conversations;
begin
  conversation := private.require_communication_participant(requested_conversation_id);
  return jsonb_build_object(
    'id', conversation.id, 'context_type', conversation.context_type, 'context_entity_id', conversation.context_entity_id,
    'organization_id', conversation.organization_id, 'state', conversation.state,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('role', participant.participant_role, 'is_current_actor', participant.user_id = auth.uid(), 'left_at', participant.left_at) order by participant.created_at) from public.communication_conversation_participants participant where participant.conversation_id = conversation.id and participant.left_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', message.id, 'sequence_number', message.sequence_number, 'sender_is_current_actor', message.sender_user_id = auth.uid(),
      'body', message.body, 'delivery_state', message.delivery_state, 'moderation_state', message.moderation_state,
      'edited_at', message.edited_at, 'deleted_at', message.deleted_at, 'created_at', message.created_at,
      'attachments', coalesce((select jsonb_agg(jsonb_build_object('id', attachment.id, 'original_filename', attachment.original_filename, 'content_type', attachment.content_type, 'size_bytes', attachment.size_bytes) order by attachment.created_at) from public.communication_message_attachments attachment where attachment.message_id = message.id and attachment.scan_state = 'clean'), '[]'::jsonb),
      'mentioned_current_actor', exists (select 1 from public.communication_message_mentions mention where mention.message_id = message.id and mention.mentioned_user_id = auth.uid())
    ) order by message.sequence_number asc) from (
      select * from public.communication_messages message where message.conversation_id = conversation.id and (requested_before is null or message.created_at < requested_before) order by message.sequence_number desc limit least(greatest(coalesce(maximum_count, 0), 0), 50)
    ) message), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_communication_notifications(maximum_count integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', notification.id, 'notification_type', notification.notification_type, 'category', notification.category,
    'priority', notification.priority, 'source_entity_type', notification.source_entity_type, 'source_entity_id', notification.source_entity_id,
    'deep_link', notification.deep_link, 'summary', notification.summary, 'read_at', notification.read_at,
    'dismissed_at', notification.dismissed_at, 'required_notice', notification.required_notice, 'created_at', notification.created_at
  ) order by notification.created_at desc), '[]'::jsonb)
  from (
    select notification.* from public.communication_notifications notification
    where notification.recipient_user_id = auth.uid() and notification.dismissed_at is null
      and exists (select 1 from public.communication_notification_delivery_attempts attempt where attempt.notification_id = notification.id and attempt.channel = 'in_app' and attempt.state = 'delivered')
    order by notification.created_at desc limit least(greatest(coalesce(maximum_count, 0), 0), 50)
  ) notification
$$;

create or replace function public.get_communication_notification_preferences()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'in_app_enabled', coalesce(preference.in_app_enabled, true), 'email_enabled', coalesce(preference.email_enabled, true),
    'message_alerts_enabled', coalesce(preference.message_alerts_enabled, true), 'mention_alerts_enabled', coalesce(preference.mention_alerts_enabled, true),
    'digest_frequency', coalesce(preference.digest_frequency::text, 'immediate'), 'quiet_hours_start', preference.quiet_hours_start,
    'quiet_hours_end', preference.quiet_hours_end, 'timezone', coalesce(preference.timezone, 'UTC'),
    'required_notice_explanation', 'Security, payment, and legally required notices remain available even when optional alerts are off.'
  ) from (select 1) singleton left join public.communication_notification_preferences preference on preference.user_id = auth.uid()
$$;

create or replace function public.get_communication_moderation_queue(maximum_count integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_active_platform_administrator_context() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'report_id', report.id, 'category', report.category, 'detail', report.detail, 'created_at', report.created_at,
    'message_id', message.id, 'message_body', message.body, 'message_state', message.moderation_state,
    'conversation_id', conversation.id, 'context_type', conversation.context_type
  ) order by report.created_at asc) from (
    select * from public.communication_message_reports where state in ('open','triaged') order by created_at asc limit least(greatest(coalesce(maximum_count, 0), 0), 50)
  ) report join public.communication_messages message on message.id = report.message_id join public.communication_conversations conversation on conversation.id = report.conversation_id), '[]'::jsonb);
end;
$$;

create policy "communication participants can view conversation metadata" on public.communication_conversations for select to authenticated using (
  exists (select 1 from public.communication_conversation_participants participant where participant.conversation_id = id and participant.user_id = auth.uid() and participant.left_at is null)
);
create policy "recipients can view their communication notifications" on public.communication_notifications for select to authenticated using (recipient_user_id = auth.uid());

drop policy if exists "communication message objects private on insert" on storage.objects;
create policy "communication message objects private on insert" on storage.objects for insert to authenticated with check (bucket_id = 'proofly-message-private' and public.can_insert_communication_attachment_storage_object(name));
drop policy if exists "communication message objects private on read" on storage.objects;
create policy "communication message objects private on read" on storage.objects for select to authenticated using (bucket_id = 'proofly-message-private' and public.can_read_communication_attachment_storage_object(name));

revoke all on table public.communication_conversations, public.communication_conversation_participants, public.communication_messages, public.communication_message_revisions, public.communication_message_attachments, public.communication_message_mentions, public.communication_user_blocks, public.communication_message_reports, public.communication_moderation_events, public.communication_notification_preferences, public.communication_organization_notification_preferences, public.communication_notifications, public.communication_notification_delivery_attempts, public.communication_events, public.communication_rate_limit_windows from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.create_object_linked_conversation(public.communication_conversation_type, uuid, uuid), public.send_communication_message(uuid, text, uuid[], uuid[], uuid), public.edit_communication_message(uuid, text, uuid), public.redact_communication_message(uuid, uuid), public.set_communication_conversation_control(uuid, text, boolean, uuid), public.leave_communication_conversation(uuid, uuid), public.block_communication_participant(uuid, uuid, uuid), public.report_communication_message(uuid, public.communication_report_category, text, uuid), public.moderate_communication_report(uuid, public.communication_moderation_action, text, uuid), public.prepare_communication_attachment_upload(uuid, text, text, bigint, text, text, uuid), public.complete_communication_attachment_upload(uuid), public.get_communication_attachment_download_target(uuid), public.can_insert_communication_attachment_storage_object(text), public.can_read_communication_attachment_storage_object(text), public.mark_communication_conversation_read(uuid, uuid), public.save_communication_notification_preferences(boolean, boolean, boolean, boolean, public.communication_digest_frequency, time, time, text, uuid), public.save_communication_organization_notification_preference(uuid, boolean, uuid), public.mark_communication_notification_read(uuid, uuid), public.dismiss_communication_notification(uuid, uuid), public.get_communication_inbox(integer), public.get_communication_conversation(uuid, timestamptz, integer), public.get_communication_notifications(integer), public.get_communication_notification_preferences(), public.get_communication_moderation_queue(integer) from public, anon;
grant execute on function public.create_object_linked_conversation(public.communication_conversation_type, uuid, uuid), public.send_communication_message(uuid, text, uuid[], uuid[], uuid), public.edit_communication_message(uuid, text, uuid), public.redact_communication_message(uuid, uuid), public.set_communication_conversation_control(uuid, text, boolean, uuid), public.leave_communication_conversation(uuid, uuid), public.block_communication_participant(uuid, uuid, uuid), public.report_communication_message(uuid, public.communication_report_category, text, uuid), public.moderate_communication_report(uuid, public.communication_moderation_action, text, uuid), public.prepare_communication_attachment_upload(uuid, text, text, bigint, text, text, uuid), public.complete_communication_attachment_upload(uuid), public.get_communication_attachment_download_target(uuid), public.mark_communication_conversation_read(uuid, uuid), public.save_communication_notification_preferences(boolean, boolean, boolean, boolean, public.communication_digest_frequency, time, time, text, uuid), public.save_communication_organization_notification_preference(uuid, boolean, uuid), public.mark_communication_notification_read(uuid, uuid), public.dismiss_communication_notification(uuid, uuid), public.get_communication_inbox(integer), public.get_communication_conversation(uuid, timestamptz, integer), public.get_communication_notifications(integer), public.get_communication_notification_preferences(), public.get_communication_moderation_queue(integer) to authenticated;
