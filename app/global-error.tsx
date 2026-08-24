"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f3f6f8", color: "#1e252b" }}>
        <main
          style={{
            maxWidth: "44rem",
            minHeight: "100dvh",
            margin: "0 auto",
            padding: "4rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p
            style={{
              color: "#5e6872",
              fontSize: "0.8rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            A recoverable loading error
          </p>
          <h1
            style={{
              maxWidth: "13ch",
              margin: "0 0 1rem",
              fontSize: "clamp(2.5rem, 8vw, 5rem)",
              lineHeight: "0.98",
            }}
          >
            We could not load this proof context.
          </h1>
          <p style={{ maxWidth: "52ch", color: "#5e6872", lineHeight: 1.6 }}>
            Nothing has been changed. Try again to reload the public
            explanation.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: "max-content",
              marginTop: "1rem",
              padding: "0.8rem 1rem",
              border: 0,
              borderRadius: "8px",
              background: "#285dde",
              color: "#fff",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
