import { CalendarClock, CodeXml, Dumbbell, Utensils } from "lucide-react";
import { notFound } from "next/navigation";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { HeroDemo } from "@/components/landing/hero-demo";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { publicEnv } from "@/lib/env";
import { getDictionary, hasLocale } from "@/lib/i18n";

const CATEGORY_STYLE = {
  agenda: { icon: CalendarClock, color: "text-agenda" },
  train: { icon: Dumbbell, color: "text-train" },
  fuel: { icon: Utensils, color: "text-fuel" },
} as const;

const PLATFORMS = ["web", "Android", "iOS", "macOS", "Windows"] as const;

export default async function LandingPage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.landing;

  return (
    <div className="overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-volt focus:px-4 focus:py-2 focus:text-on-volt"
      >
        {dict.common.skipToContent}
      </a>

      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Wordmark className="text-lg" />
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1 sm:gap-2">
          <a
            href="#how"
            className="hidden h-11 items-center px-3 text-[0.9375rem] font-bold text-ink-muted hover:text-ink sm:flex"
          >
            {t.navHow}
          </a>
          <a
            href="#code"
            className="hidden h-11 items-center px-3 text-[0.9375rem] font-bold text-ink-muted hover:text-ink sm:flex"
          >
            {t.navCode}
          </a>
          <ButtonLink href={`/${lang}/app`} variant="primary">
            {dict.common.openApp}
          </ButtonLink>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto flex max-w-7xl flex-wrap items-center gap-12 px-4 pt-16 pb-24 sm:px-6 lg:gap-14 lg:pt-20">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-7">
            <p className="type-label text-ink-muted">{t.eyebrow}</p>
            <h1 className="type-display-xl text-balance">{t.headline}</h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-muted sm:text-[1.1875rem]">
              {t.lead}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`/${lang}/login`} variant="primary" size="lg">
                {t.ctaPrimary}
              </ButtonLink>
              <a href={publicEnv.repoUrl} className={buttonClass("secondary", "lg")}>
                <CodeXml size={20} strokeWidth={1.75} aria-hidden="true" />
                {t.ctaSecondary}
              </a>
            </div>
            <p className="text-sm text-ink-muted">{t.heroNote}</p>
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <HeroDemo />
          </div>
        </section>

        <section id="how" className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 sm:px-6">
            <h2 className="type-display max-w-3xl">{t.howTitle}</h2>
            <ol className="grid gap-8 md:grid-cols-3">
              {t.steps.map((step, i) => (
                <li
                  key={step.title}
                  className={`flex flex-col gap-3 border-t-2 pt-5 ${i === 0 ? "border-volt" : "border-line-strong"}`}
                >
                  <span className={`type-numeric ${i === 0 ? "text-volt-ink" : "text-ink-muted"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="type-title">{step.title}</h3>
                  <p className="text-base leading-relaxed text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 sm:px-6">
            <h2 className="type-display max-w-3xl">{t.categoriesTitle}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {(["agenda", "train", "fuel"] as const).map((category) => {
                const { icon: Icon, color } = CATEGORY_STYLE[category];
                return (
                  <article
                    key={category}
                    className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-6"
                  >
                    <span
                      className={`type-label inline-flex items-center gap-2 self-start rounded-sm border border-current px-2 py-1 ${color}`}
                    >
                      <Icon size={14} strokeWidth={2} aria-hidden="true" />
                      {dict.categories[category]}
                    </span>
                    <p className="font-display stretch-semi text-[1.375rem] leading-tight font-extrabold">
                      {t.categoriesExample[category]}
                    </p>
                    <p className="type-body text-ink-muted">{t.categoriesBody[category]}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-12 px-4 py-24 sm:px-6">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
              <h2 className="type-display">{t.platformsTitle}</h2>
              <p className="max-w-xl text-[1.0625rem] leading-relaxed text-ink-muted">
                {t.platformsBody}
              </p>
            </div>
            <ul className="flex min-w-0 flex-[1_1_360px] flex-col">
              {PLATFORMS.map((platform) => (
                <li
                  key={platform}
                  className="flex items-center justify-between gap-4 border-t border-line py-4 last:border-b"
                >
                  <span className="text-[1.0625rem] font-bold">
                    {platform === "web" ? t.platformWeb : platform}
                  </span>
                  <span
                    className={`type-label ${platform === "web" ? "text-volt-ink" : "text-ink-muted"}`}
                  >
                    {platform === "web" ? t.available : t.soon}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="code" className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-24 sm:px-6">
            <h2 className="type-display">{t.openSourceTitle}</h2>
            <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">
              {t.openSourceBody}
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Stack">
              {["Next.js", "Supabase", "Vercel", "TypeScript", "Tailwind CSS"].map((tech) => (
                <li
                  key={tech}
                  className="type-numeric rounded-full border border-line-strong px-3.5 py-2"
                >
                  {tech}
                </li>
              ))}
            </ul>
            <a href={publicEnv.repoUrl} className={buttonClass("secondary", "lg", "self-start")}>
              <CodeXml size={20} strokeWidth={1.75} aria-hidden="true" />
              github.com/tukkteam/powerweek
            </a>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 rounded-3xl bg-volt px-6 py-14 text-on-volt sm:px-12 sm:py-16">
            <p className="font-display stretch-wide max-w-3xl text-[clamp(2rem,4.4vw,4rem)] leading-[0.92] font-black tracking-[-0.02em] uppercase">
              {t.finalCta}
            </p>
            <ButtonLink href={`/${lang}/login`} variant="inverse" size="lg">
              {t.ctaPrimary}
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted sm:px-6">
          <span>
            © 2026 {t.footer} · {t.license}
          </span>
          <LanguageSwitch />
        </div>
      </footer>
    </div>
  );
}
