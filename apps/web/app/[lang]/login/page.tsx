import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/app/login-form";
import { Wordmark } from "@/components/ui/wordmark";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).login.title, robots: { index: false } };
}

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).login;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center px-4 pt-6 sm:px-6">
        <Link href={`/${lang}`} aria-label="PowerWeek">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-4 py-16">
        <div aria-hidden="true" className="grid h-24 grid-cols-7 items-end gap-2">
          {[0.5, 0.35, 0.9, 0.3, 0.7, 0.2, 0.45].map((h, i) => (
            <span
              key={i}
              className={`block rounded-full ${i === 2 ? "bg-volt-ink" : "bg-line-strong"}`}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="type-display">{t.title}</h1>
          <p className="type-body text-ink-muted">{t.lead}</p>
        </div>
        <LoginForm />
      </main>
    </div>
  );
}
