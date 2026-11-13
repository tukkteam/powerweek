import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDictionary, hasLocale } from "@/lib/i18n";

export const alt = "PowerWeek";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [0.55, 0.38, 0.85, 0.3, 0.7, 0.22, 0.48];

/** Social card: the headline on the left, the Week Pulse cut out of a volt slab on the right. */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const dict = getDictionary(hasLocale(lang) ? lang : "es");
  const font = await readFile(join(process.cwd(), "assets/fonts/Archivo-ExpandedBlack.ttf"));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0b0b0c",
        color: "#f5f3ee",
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 600,
        }}
      >
        <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 30, letterSpacing: -0.5 }}>
          POWER<span style={{ color: "#d4ff3a" }}>WEEK</span>
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Archivo",
            fontSize: 68,
            lineHeight: 0.95,
            letterSpacing: -1.5,
            textTransform: "uppercase",
          }}
        >
          {dict.landing.headline}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#a8a59e" }}>
          {dict.landing.eyebrow}
        </div>
      </div>
      <div
        style={{
          marginLeft: "auto",
          width: 420,
          height: "100%",
          background: "#d4ff3a",
          borderRadius: 36,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: 36,
        }}
      >
        {BARS.map((h, i) => (
          <div
            key={i}
            style={{ width: 38, height: `${h * 100}%`, borderRadius: 19, background: "#0b0b0c" }}
          />
        ))}
      </div>
    </div>,
    { ...size, fonts: [{ name: "Archivo", data: font, style: "normal", weight: 900 }] },
  );
}
