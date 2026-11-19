import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Montserrat, Noto_Sans_Arabic } from "next/font/google";
import { LangProvider } from "@/lib/i18n/client";
import { asLang, dir } from "@/lib/i18n/core";
import "./globals.css";
import "./tablet.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600", "700", "800"] });
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: { default: "Moov'Up Coach", template: "%s · Moov'Up Coach" },
  description: "Suivi des séances, progression et bilans de santé — Complexe Moov'Up Sports Agadir",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a6d8e" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Langue (cookie « lang » : fr / en / ar en rtl), thème (cookie « theme » : light / dark)
 * et mode tablette (cookie « ui=tablet ») sont posés côté serveur sur <html> : aucun flash au chargement.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const lang = asLang(jar.get("lang")?.value);
  const dark = jar.get("theme")?.value === "dark";
  const tablet = jar.get("ui")?.value === "tablet";
  return (
    <html
      lang={lang}
      dir={dir(lang)}
      className={[dark ? "dark" : "", tablet ? "tablet" : ""].filter(Boolean).join(" ") || undefined}
      style={dark ? { colorScheme: "dark" } : undefined}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${montserrat.variable} ${arabic.variable} font-sans antialiased`}>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
