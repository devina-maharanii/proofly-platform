import { ImageResponse } from "next/og";

export const alt = "Proofly — trusted opportunities through real work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "#f3f6f8",
        color: "#1e252b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #285dde",
            borderRadius: "6px",
            color: "#285dde",
            fontSize: "34px",
            lineHeight: 1,
          }}
        >
          │
        </div>
        <div style={{ display: "flex", fontSize: "34px", fontWeight: 700 }}>
          Proofly
        </div>
        <div style={{ display: "flex", color: "#5e6872", fontSize: "18px" }}>
          / evidence
        </div>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", maxWidth: "890px" }}
      >
        <div style={{ display: "flex", color: "#285dde", fontSize: "20px" }}>
          REAL WORK, MADE LEGIBLE
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "24px",
            fontSize: "76px",
            lineHeight: 1,
            letterSpacing: "-0.055em",
            fontWeight: 700,
          }}
        >
          Build work people can trust.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #d4dde4",
          paddingTop: "22px",
          color: "#5e6872",
          fontSize: "21px",
        }}
      >
        Real work · qualified human review · explainable proof
      </div>
    </div>,
    size
  );
}
