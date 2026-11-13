import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The app is a static shell. Signed-in data loads in the browser straight from Supabase
 * (protected by Row Level Security), so the same build works inside native shells.
 */
export default function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  return <AppShell>{children}</AppShell>;
}
