/** Phase 22 share image: a truthful project-context record, never an application, invitation, verified proof, payment, contract, or hiring outcome. */
import { ImageResponse } from "next/og";

import { getPublicProject } from "@/lib/project/context";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PublicProjectOpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const project = await getPublicProject(publicId);
  const title = project?.title || "Project context";
  const description =
    project?.oneSentenceGoal || "A published project context record.";
  const organization =
    project?.organizationName || "Organization-provided context";
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
          / project context
        </div>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", maxWidth: "940px" }}
      >
        <div style={{ display: "flex", color: "#285dde", fontSize: "19px" }}>
          PUBLISHED PROJECT CONTEXT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "20px",
            fontSize: "66px",
            lineHeight: 1,
            letterSpacing: "-0.05em",
            fontWeight: 700,
          }}
        >
          {title}
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
        {organization} · No application, invitation, payment, or decision claim
      </div>
    </div>,
    size
  );
}
