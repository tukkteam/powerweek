import type { MetadataRoute } from "next";

/** Installable PWA. Native shells load the same web app (see docs/native-strategy.md). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PowerWeek",
    short_name: "PowerWeek",
    description:
      "Talk your week into shape. A voice-first weekly planner for your agenda, training and meals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    categories: ["productivity", "health", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
