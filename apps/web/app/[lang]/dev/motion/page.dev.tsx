import type { Metadata } from "next";
import { MotionLab } from "@/components/dev/motion-lab";

/**
 * /es/dev/motion: every motion token side by side, to tune them and to review a change to them.
 * A developer tool: the `.dev.tsx` extension keeps it out of production builds (next.config.ts),
 * nothing links to it, and its copy is English only.
 */
export const metadata: Metadata = {
  title: "Motion tokens",
  robots: { index: false, follow: false },
};

export default function MotionPage() {
  return <MotionLab />;
}
