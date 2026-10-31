import { ImageResponse } from "next/og";

export const alt = "RunLattice workflow automation workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          background: "#0c0d0f",
          color: "#f4f5f6",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ff8a36",
              color: "#201207",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            RL
          </div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>runlattice</div>
        </div>
        <div style={{ marginTop: 54, fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
          Workflow automation
        </div>
        <div style={{ marginTop: 22, color: "#a0a7b0", fontSize: 28 }}>
          Design, validate and monitor workflows.
        </div>
        <div style={{ position: "absolute", bottom: 58, right: 88, color: "#ff8a36", fontSize: 20 }}>
          Connect. Execute. Orchestrate.
        </div>
      </div>
    ),
    size,
  );
}
