import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Moov'Up Coach", template: "%s · Moov'Up Coach" },
  description: "Suivi des séances, progression et bilans de santé — Complexe Moov'Up Sports Agadir",
};

export const viewport: Viewport = { themeColor: "#1a6d8e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
