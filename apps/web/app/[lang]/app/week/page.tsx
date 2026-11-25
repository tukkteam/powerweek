import type { Metadata } from "next";
import { PageSlide } from "@/components/app/page-slide";
import { WeekView } from "@/components/app/week-view";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/app/week">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).app.navWeek : "PowerWeek" };
}

export default function WeekPage() {
  return (
    <PageSlide>
      <WeekView />
    </PageSlide>
  );
}
