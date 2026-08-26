-- Phase 20 — Public Proof Profiles
-- Owner: Proofly Platform. Risk: public route visibility and proof provenance.
-- Rollback: forward compensation only; hide/revoke public profiles or proof records without deleting evidence, review, or audit history.

create function public.is_reserved_talent_profile_handle(candidate text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select lower(trim(candidate)) = any (array[
    'about','account','admin','api','auth','company','dashboard','discover',
    'evidence','explore','favicon','get-started','help','login','logout',
    'onboarding','p','privacy','profile','robots','settings','sign-in',
    'sign-up','sitemap','talent','terms','verify-email'
  ]::text[])
$$;

alter table public.talent_profile_drafts
  add constraint talent_profile_drafts_handle_not_reserved_check
  check (handle is null or not public.is_reserved_talent_profile_handle(handle));

alter table public.talent_profile_publications
  add constraint talent_profile_publications_handle_not_reserved_check
  check (not public.is_reserved_talent_profile_handle(handle));

create type public.talent_public_proof_status as enum ('verified', 'revoked', 'expired');

create table public.talent_public_proofs (
  id uuid primary key default gen_random_uuid(),
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  evidence_id uuid not null references public.work_evidence_items(id) on delete restrict,
  skill_key text not null check (char_length(skill_key) between 1 and 80),
  verification_method text not null check (char_length(verification_method) between 3 and 240),
  reviewer_attribution text not null default '' check (char_length(reviewer_attribution) <= 160),
  reviewer_attribution_is_public boolean not null default false,
  status public.talent_public_proof_status not null default 'verified',
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'verified' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
    or (status = 'expired' and expires_at is not null)
  )
);

create table public.talent_public_proof_events (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.talent_public_proofs(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('proof.verified', 'proof.revoked', 'proof.expired')),
  occurred_at timestamptz not null default now()
);

create index talent_public_proofs_profile_status_idx
  on public.talent_public_proofs(talent_user_id, status, verified_at desc);
create index talent_public_proofs_evidence_idx
  on public.talent_public_proofs(evidence_id);
create index talent_public_proof_events_proof_occurred_idx
  on public.talent_public_proof_events(proof_id, occurred_at desc);

alter table public.talent_public_proofs enable row level security;
alter table public.talent_public_proof_events enable row level security;

create or replace function public.get_public_talent_profile(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select snapshot || jsonb_build_object('published_at', published_at, 'updated_at', updated_at)
  from public.talent_profile_publications
  where handle = lower(trim(requested_handle))
    and not public.is_reserved_talent_profile_handle(requested_handle)
    and state = 'published'
$$;

create function public.get_public_talent_profile_sitemap(maximum_count integer default 5000)
returns table(handle text, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select profile.handle, profile.updated_at
  from public.talent_profile_publications profile
  where profile.state = 'published'
    and not public.is_reserved_talent_profile_handle(profile.handle)
  order by profile.updated_at desc, profile.handle
  limit least(greatest(coalesce(maximum_count, 0), 0), 5000)
$$;

create function public.get_public_talent_proofs(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', proof.id,
    'skill_key', proof.skill_key,
    'verification_method', proof.verification_method,
    'review_status', 'verified',
    'verified_at', proof.verified_at,
    'reviewer_attribution', case when proof.reviewer_attribution_is_public then proof.reviewer_attribution else '' end,
    'evidence_public_id', evidence.public_id,
    'evidence_title', evidence.snapshot->>'title'
  ) order by proof.verified_at desc, proof.id), '[]'::jsonb)
  from public.talent_profile_publications profile
  join public.talent_public_proofs proof
    on proof.talent_user_id = profile.user_id
   and proof.status = 'verified'
   and proof.revoked_at is null
   and (proof.expires_at is null or proof.expires_at > now())
  join public.work_evidence_publications evidence
    on evidence.evidence_id = proof.evidence_id
   and evidence.user_id = profile.user_id
   and evidence.state = 'published'
  where profile.handle = lower(trim(requested_handle))
    and not public.is_reserved_talent_profile_handle(requested_handle)
    and profile.state = 'published'
$$;

revoke all on function public.is_reserved_talent_profile_handle(text) from public, anon, authenticated;
revoke all on table public.talent_public_proofs, public.talent_public_proof_events from anon, authenticated;
revoke all on function public.get_public_talent_profile_sitemap(integer) from public;
revoke all on function public.get_public_talent_proofs(text) from public;
grant execute on function public.get_public_talent_profile_sitemap(integer) to anon, authenticated;
grant execute on function public.get_public_talent_proofs(text) to anon, authenticated;
