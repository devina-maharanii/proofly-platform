import "server-only";

import { authorizeActiveContext } from "@/lib/roles/context";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  emptyTalentProfile,
  type ProfileFieldVisibility,
  type TalentClaimLevel,
  type TalentProfile,
  type TalentProfileContext,
  type TalentProfileLink,
  type TalentProfilePublication,
  type TalentProfileSkill,
} from "./types";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function profileVisibility(value: unknown): ProfileFieldVisibility {
  return value === "public" ? "public" : "private";
}

function stringList(value: unknown, maximum: number) {
  return Array.isArray(value)
    ? value
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, maximum)
    : [];
}

function normalizeProfile(
  row: Record<string, unknown> | null,
  skills: TalentProfileSkill[],
  links: TalentProfileLink[],
  fallback: { displayName: string; avatarUrl: string; timezone: string }
): TalentProfile {
  if (!row) {
    return {
      ...emptyTalentProfile(),
      displayName: fallback.displayName,
      profileImageUrl: fallback.avatarUrl,
      timezone: fallback.timezone || "UTC",
      skills,
      links,
    };
  }

  return {
    handle: text(row.handle),
    displayName: text(row.display_name),
    profileImageUrl: text(row.profile_image_url),
    profileImageVisibility: profileVisibility(row.profile_image_visibility),
    headline: text(row.headline),
    introduction: text(row.introduction),
    locationName: text(row.location_name),
    locationVisibility: profileVisibility(row.location_visibility),
    timezone: text(row.timezone, "UTC"),
    timezoneVisibility: profileVisibility(row.timezone_visibility),
    languages: stringList(row.languages, 8),
    developerFocus: text(row.developer_focus),
    currentExperienceLevel: text(row.current_experience_level),
    preferredProjectTypes: stringList(row.preferred_project_types, 8),
    availabilityWindow: text(row.availability_window),
    engagementPreference: text(row.engagement_preference),
    rateRange: text(row.rate_range),
    timezoneOverlapPreference: text(row.timezone_overlap_preference),
    remoteCollaborationPreference: text(row.remote_collaboration_preference),
    targetOpportunityType: text(row.target_opportunity_type),
    draftState:
      row.draft_state === "ready_to_preview" ? "ready_to_preview" : "draft",
    version: typeof row.version === "number" ? row.version : 1,
    skills,
    links,
  };
}

function normalizeSkills(
  rows: Record<string, unknown>[]
): TalentProfileSkill[] {
  const levels: TalentClaimLevel[] = [
    "familiar",
    "working",
    "independent",
    "advanced",
    "reviewer",
  ];
  return rows.flatMap(row => {
    const skillKey = text(row.skill_key);
    const claimedLevel = text(row.claimed_level) as TalentClaimLevel;
    return skillKey && levels.includes(claimedLevel)
      ? [
          {
            skillKey: skillKey as TalentProfileSkill["skillKey"],
            claimedLevel,
            context: text(row.context),
          },
        ]
      : [];
  });
}

function normalizeLinks(rows: Record<string, unknown>[]): TalentProfileLink[] {
  return rows.flatMap(row => {
    const linkType = text(row.link_type);
    const url = text(row.url);
    return (linkType === "website" || linkType === "portfolio") && url
      ? [
          {
            linkType,
            label: text(row.label),
            url,
            isPublic: row.is_public === true,
          },
        ]
      : [];
  });
}

function normalizePublication(
  row: Record<string, unknown> | null
): TalentProfilePublication | null {
  if (!row) return null;
  return {
    state: row.state === "published" ? "published" : "hidden",
    handle: text(row.handle),
    publishedAt: text(row.published_at) || null,
    hiddenAt: text(row.hidden_at) || null,
    sourceProfileVersion:
      typeof row.source_profile_version === "number"
        ? row.source_profile_version
        : 1,
  };
}

export async function getTalentProfileContext(): Promise<TalentProfileContext | null> {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) return null;

  const activeTalentContext = authorization.ok;
  const [
    draftResult,
    skillsResult,
    linksResult,
    publicationResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("talent_profile_drafts")
      .select("*")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("talent_profile_skills")
      .select("skill_key, claimed_level, context")
      .eq("user_id", session.userId)
      .order("skill_key"),
    supabase
      .from("talent_profile_links")
      .select("link_type, label, url, is_public")
      .eq("user_id", session.userId)
      .order("created_at"),
    supabase
      .from("talent_profile_publications")
      .select("state, handle, published_at, hidden_at, source_profile_version")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("personal_settings")
      .select("display_name, avatar_url, timezone")
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const settings = settingsResult.data as Record<string, unknown> | null;
  const fallback = {
    displayName: text(settings?.display_name),
    avatarUrl: text(settings?.avatar_url),
    timezone: text(settings?.timezone, "UTC"),
  };
  return {
    profile: normalizeProfile(
      draftResult.data as Record<string, unknown> | null,
      normalizeSkills((skillsResult.data ?? []) as Record<string, unknown>[]),
      normalizeLinks((linksResult.data ?? []) as Record<string, unknown>[]),
      fallback
    ),
    publication: normalizePublication(
      publicationResult.data as Record<string, unknown> | null
    ),
    activeTalentContext,
  };
}

export type PublicTalentProfile = Readonly<{
  handle: string;
  displayName: string;
  profileImageUrl: string;
  headline: string;
  introduction: string;
  locationName: string;
  timezone: string;
  languages: string[];
  developerFocus: string;
  currentExperienceLevel: string;
  preferredProjectTypes: string[];
  availabilityWindow: string;
  engagementPreference: string;
  timezoneOverlapPreference: string;
  remoteCollaborationPreference: string;
  targetOpportunityType: string;
  skills: Array<{
    skillKey: string;
    claimedLevel: string;
    context: string;
    status: "claimed";
  }>;
  links: Array<{ linkType: string; label: string; url: string }>;
  proofStatus: "No verified proof yet";
  publishedAt: string | null;
}>;

export async function getPublicTalentProfile(
  handle: string
): Promise<PublicTalentProfile | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(handle)) {
    return null;
  }
  const { data, error } = await supabase.rpc("get_public_talent_profile", {
    requested_handle: handle,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return null;
  const row = data as Record<string, unknown>;
  const skills = Array.isArray(row.skills)
    ? row.skills.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const skill = item as Record<string, unknown>;
        return typeof skill.skill_key === "string" &&
          typeof skill.claimed_level === "string"
          ? [
              {
                skillKey: skill.skill_key,
                claimedLevel: skill.claimed_level,
                context: text(skill.context),
                status: "claimed" as const,
              },
            ]
          : [];
      })
    : [];
  const links = Array.isArray(row.links)
    ? row.links.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const link = item as Record<string, unknown>;
        return typeof link.url === "string"
          ? [
              {
                linkType: text(link.link_type),
                label: text(link.label),
                url: link.url,
              },
            ]
          : [];
      })
    : [];
  return {
    handle: text(row.handle),
    displayName: text(row.display_name),
    profileImageUrl: text(row.profile_image_url),
    headline: text(row.headline),
    introduction: text(row.introduction),
    locationName: text(row.location_name),
    timezone: text(row.timezone),
    languages: stringList(row.languages, 8),
    developerFocus: text(row.developer_focus),
    currentExperienceLevel: text(row.current_experience_level),
    preferredProjectTypes: stringList(row.preferred_project_types, 8),
    availabilityWindow: text(row.availability_window),
    engagementPreference: text(row.engagement_preference),
    timezoneOverlapPreference: text(row.timezone_overlap_preference),
    remoteCollaborationPreference: text(row.remote_collaboration_preference),
    targetOpportunityType: text(row.target_opportunity_type),
    skills,
    links,
    proofStatus: "No verified proof yet",
    publishedAt: text(row.published_at) || null,
  };
}
