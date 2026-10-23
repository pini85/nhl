import { ImageResponse } from "next/og";

// "DDD" monogram on Arena Night, used for the app icons.
export function monogram(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(90% 90% at 50% 20%, #12305a 0%, #070b14 75%)",
          color: "#5cc8ff",
          fontSize: px * 0.36,
          fontWeight: 900,
          letterSpacing: -px * 0.015,
          textShadow: `0 0 ${px * 0.06}px rgba(92,200,255,0.7)`,
          fontFamily: "sans-serif",
        }}
      >
        DDD
      </div>
    ),
    { width: px, height: px },
  );
}
