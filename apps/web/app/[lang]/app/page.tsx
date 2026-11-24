import type { Metadata } from "next";
import { PageSlide } from "@/components/app/page-slide";
import { TodayView } from "@/components/app/today-view";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/app">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).app.navToday : "PowerWeek" };
}

export default function TodayPage() {
  return (
    <PageSlide>
      <TodayView />
    </PageSlide>
  );
}
