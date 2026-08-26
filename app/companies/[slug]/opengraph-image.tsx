/** Phase 21 style: truthful shared company context, never a claim of verification, an open role, or a hiring outcome. */
import { ImageResponse } from "next/og";

import { getPublicCompanyProfile } from "@/lib/company/context";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PublicCompanyProfileOpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const profile = await getPublicCompanyProfile(slug);
  const name = profile?.name || "Company context";
  const description =
    profile?.shortDescription ||
    "Work context, shown with clear trust boundaries.";
  const focus =
    profile?.hiringFocus ||
    "Company-provided context, not a published opportunity";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px",
        background: "#f3f6f8",
        color: "#1e252b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #285dde",
            borderRadius: "6px",
            color: "#285dde",
            fontSize: "32px",
          }}
        >
          │
        </div>
        <div style={{ display: "flex", fontSize: "30px", fontWeight: 700 }}>
          Proofly
        </div>
        <div style={{ display: "flex", color: "#5e6872", fontSize: "18px" }}>
          / company context
        </div>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", maxWidth: "940px" }}
      >
        <div style={{ display: "flex", color: "#285dde", fontSize: "19px" }}>
          PUBLIC COMPANY CONTEXT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "20px",
            fontSize: "70px",
            lineHeight: 1,
            letterSpacing: "-0.05em",
            fontWeight: 700,
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "18px",
            color: "#5e6872",
            fontSize: "28px",
            lineHeight: 1.25,
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #d4dde4",
          paddingTop: "22px",
          color: "#5e6872",
          fontSize: "20px",
        }}
      >
        {focus} · No role, decision, or verification claim
      </div>
    </div>,
    size
  );
}
