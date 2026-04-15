import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 42,
            fontWeight: 800,
            background: "linear-gradient(180deg, #00e5a0, #00b377)",
            backgroundClip: "text",
            color: "#00d992",
          }}
        >
          $
        </span>
      </div>
    ),
    { ...size }
  );
}
