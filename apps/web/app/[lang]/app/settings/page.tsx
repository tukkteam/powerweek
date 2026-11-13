import type { Metadata } from "next";
import { SettingsView } from "@/components/app/settings-view";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/app/settings">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).settings.title : "PowerWeek" };
}

export default function SettingsPage() {
  return <SettingsView />;
}
