/** Phase 21 server-only readers: derive the active organization on the server and expose public company data only from a published snapshot. */
import "server-only";

import { authorizeActiveContext, getRoleContext } from "@/lib/roles/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { isReservedCompanyHandle, isValidCompanyHandle } from "./handle";
import {
  emptyCompanyProfile,
  type CompanyProfile,
  type CompanyProfileAttribution,
  type CompanyProfileContext,
  type CompanyProfilePublication,
} from "./types";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown, maximum = 8) {
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
  fallback: ReturnType<typeof emptyCompanyProfile>
): CompanyProfile {
  if (!row) return fallback;
  return {
    ...fallback,
    logoUrl: text(row.logo_url),
    shortDescription: text(row.short_description),
    websiteUrl: text(row.website_url),
    industry: text(row.industry),
    companySize: text(row.company_size),
    foundedYear: text(row.founded_year),
    whatWeBuild: text(row.what_we_build),
    engineeringPractices: stringList(row.engineering_practices),
    technologyAreas: stringList(row.technology_areas),
    collaborationStyle: text(row.collaboration_style),
    timezoneOverlap: text(row.timezone_overlap),
    workLocationPreference: text(row.work_location_preference),
    typicalProjectTypes: stringList(row.typical_project_types),
    hiringFocus: text(row.hiring_focus),
    engagementTypes: stringList(row.engagement_types),
    reviewTrialPhilosophy: text(row.review_trial_philosophy),
    activeOpportunities: row.active_opportunities === true,
    responseExpectations: text(row.response_expectations),
    draftState:
      row.draft_state === "ready_to_preview" ? "ready_to_preview" : "draft",
    version: typeof row.version === "number" ? row.version : 1,
  };
}

function normalizePublication(
  row: Record<string, unknown> | null
): CompanyProfilePublication | null {
  if (!row) return null;
  return {
    state: row.state === "published" ? "published" : "hidden",
    slug: text(row.slug),
    publishedAt: text(row.published_at) || null,
    hiddenAt: text(row.hidden_at) || null,
    sourceProfileVersion:
      typeof row.source_profile_version === "number"
        ? row.source_profile_version
        : 1,
  };
}

export async function getCompanyProfileContext(): Promise<CompanyProfileContext | null> {
  const [supabase, authorization, roleContext] = await Promise.all([
    createServerSupabaseClient(),
    authorizeActiveContext({ role: "company_member" }),
    getRoleContext(),
  ]);
  if (!supabase || !roleContext) return null;
  const organizationId = authorization.ok
    ? authorization.context.active?.organizationId
    : null;
  const membership = organizationId
    ? roleContext.memberships.find(
        candidate => candidate.organizationId === organizationId
      )
    : undefined;
  if (!organizationId || !membership) {
    return {
      profile: emptyCompanyProfile("", "", ""),
      publication: null,
      attribution: {
        roleLabel: "",
        isPublic: false,
        canEdit: false,
        canPublish: false,
      },
      activeCompanyContext: false,
    };
  }

  const [draftResult, publicationResult, attributionResult] = await Promise.all(
    [
      supabase
        .from("company_profile_drafts")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("company_profile_publications")
        .select("state, slug, published_at, hidden_at, source_profile_version")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("company_profile_member_attributions")
        .select("role_label, is_public")
        .eq("organization_id", organizationId)
        .eq("user_id", roleContext.userId)
        .maybeSingle(),
    ]
  );
  const canPublish = membership.permissions.includes("owner");
  const canEdit =
    canPublish || membership.permissions.includes("hiring_member");
  return {
    profile: normalizeProfile(
      draftResult.data as Record<string, unknown> | null,
      emptyCompanyProfile(
        membership.organizationId,
        membership.organizationName,
        membership.organizationSlug
      )
    ),
    publication: normalizePublication(
      publicationResult.data as Record<string, unknown> | null
    ),
    attribution: {
      roleLabel: text(attributionResult.data?.role_label),
      isPublic: attributionResult.data?.is_public === true,
      canEdit,
      canPublish,
    } satisfies CompanyProfileAttribution,
    activeCompanyContext: true,
  };
}

export type PublicCompanyProfile = Readonly<{
  slug: string;
  name: string;
  logoUrl: string;
  shortDescription: string;
  websiteUrl: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  whatWeBuild: string;
  engineeringPractices: string[];
  technologyAreas: string[];
  collaborationStyle: string;
  timezoneOverlap: string;
  workLocationPreference: string;
  typicalProjectTypes: string[];
  hiringFocus: string;
  engagementTypes: string[];
  reviewTrialPhilosophy: string;
  activeOpportunities: boolean;
  responseExpectations: string;
  members: Array<{
    displayName: string;
    roleLabel: string;
    status: "active" | "historical";
  }>;
  organizationConfirmation: "not_confirmed";
  publishedAt: string | null;
  updatedAt: string | null;
}>;

export function publicCompanyProfilePath(slug: string) {
  return `/companies/${encodeURIComponent(slug)}`;
}

export async function getPublicCompanyProfile(
  slug: string
): Promise<PublicCompanyProfile | null> {
  const supabase = await createServerSupabaseClient();
  if (
    !supabase ||
    !isValidCompanyHandle(slug) ||
    isReservedCompanyHandle(slug)
  ) {
    return null;
  }
  const { data, error } = await supabase.rpc("get_public_company_profile", {
    requested_slug: slug,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const members = Array.isArray(row.members)
    ? row.members.flatMap(member => {
        if (!member || typeof member !== "object" || Array.isArray(member))
          return [];
        const item = member as Record<string, unknown>;
        const status: "active" | "historical" =
          item.status === "historical" ? "historical" : "active";
        const displayName = text(item.display_name);
        return displayName
          ? [{ displayName, roleLabel: text(item.role_label), status }]
          : [];
      })
    : [];
  return {
    slug: text(row.slug),
    name: text(row.name),
    logoUrl: text(row.logo_url),
    shortDescription: text(row.short_description),
    websiteUrl: text(row.website_url),
    industry: text(row.industry),
    companySize: text(row.company_size),
    foundedYear: text(row.founded_year),
    whatWeBuild: text(row.what_we_build),
    engineeringPractices: stringList(row.engineering_practices),
    technologyAreas: stringList(row.technology_areas),
    collaborationStyle: text(row.collaboration_style),
    timezoneOverlap: text(row.timezone_overlap),
    workLocationPreference: text(row.work_location_preference),
    typicalProjectTypes: stringList(row.typical_project_types),
    hiringFocus: text(row.hiring_focus),
    engagementTypes: stringList(row.engagement_types),
    reviewTrialPhilosophy: text(row.review_trial_philosophy),
    activeOpportunities: row.active_opportunities === true,
    responseExpectations: text(row.response_expectations),
    members,
    organizationConfirmation: "not_confirmed",
    publishedAt: text(row.published_at) || null,
    updatedAt: text(row.updated_at) || null,
  };
}

export async function getPublicCompanyProfileSitemap() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_public_company_profile_sitemap",
    { maximum_count: 5000 }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const slug = text(row.slug);
    return isValidCompanyHandle(slug) && !isReservedCompanyHandle(slug)
      ? [{ slug, updatedAt: text(row.updated_at) || null }]
      : [];
  });
}
