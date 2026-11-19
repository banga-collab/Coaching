import Image from "next/image";
import { Megaphone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";
import { BrandColors } from "@/components/modules/brand-style";
import { LangSwitcher } from "@/components/shell/controls";
import { ReportForm } from "@/components/reclamations/report-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("report.title") };
}

/** Page publique ouverte par le QR code affiché dans la salle : signaler une panne, un souci de propreté, de sécurité… */
export default async function SignalerPage({ searchParams }: { searchParams: Promise<{ lieu?: string }> }) {
  const [{ lieu }, s, t] = await Promise.all([searchParams, getSettings(), getT()]);
  const location = (lieu ?? "").slice(0, 120) || undefined;
  return (
    <div className="min-h-dvh bg-canvas">
      <BrandColors />
      <header className="relative overflow-hidden bg-brand-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(232,120,42,.35),transparent_45%),radial-gradient(circle_at_95%_100%,rgba(63,143,174,.6),transparent_55%)]" />
        <div className="relative mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt={s.brand_name} className="h-8 w-auto" />
              ) : (
                <Image src="/logo.png" alt={s.brand_name} width={473} height={136} priority className="h-8 w-auto" />
              )}
            </span>
            <LangSwitcher />
          </div>
          <h1 className="mt-8 flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight">
            <Megaphone className="size-8 text-accent-400 rtl:-scale-x-100" /> {t("report.title")}
          </h1>
          <p className="mt-2 max-w-lg text-brand-100/90">{t("report.sub")}</p>
        </div>
      </header>
      <main className="relative mx-auto -mt-16 max-w-2xl px-4 pb-12 sm:px-6">
        <ReportForm location={location} />
      </main>
      <footer className="pb-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} {s.brand_name}
      </footer>
    </div>
  );
}
