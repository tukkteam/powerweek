import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { publicEnv } from "@/lib/env";
import { getDictionary, hasLocale, locales } from "@/lib/i18n";
import "../globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: dict.meta.title, template: "%s · PowerWeek" },
    description: dict.meta.description,
    applicationName: "PowerWeek",
    alternates: { canonical: `/${lang}`, languages: { es: "/es", en: "/en" } },
    openGraph: {
      type: "website",
      siteName: "PowerWeek",
      title: dict.meta.title,
      description: dict.meta.description,
      locale: lang === "es" ? "es_ES" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: "PowerWeek", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#0b0b0c" },
  ],
};

/** Applies the saved theme before first paint so there is no flash of the wrong colours. */
const themeScript = `(function(){try{var t=localStorage.getItem("pw-theme");document.documentElement.dataset.theme=(t==="light"||t==="system")?t:"dark"}catch(e){}})();`;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      data-theme="dark"
      className={`${archivo.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LocaleProvider lang={lang}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
