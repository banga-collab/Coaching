import Image from "next/image";
import { headers } from "next/headers";
import { ShieldAlert, ScanLine, Smartphone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { ESPACE_LABEL } from "@/lib/espace";
import { WINDOW_S, currentCode, espaceFromBorneKey } from "@/lib/pointage";
import { BrandColors } from "@/components/modules/brand-style";
import { QrCode } from "@/components/qr-code";
import { BorneTicker } from "@/components/controle/borne-ticker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Borne de pointage", robots: { index: false, follow: false } };

/**
 * Borne de pointage : tablette posée à l'accueil (Moov'Up Lady ou salle mixte), écran toujours allumé.
 * Affiche un QR code et un code à 6 chiffres qui changent toutes les 30 secondes.
 * Page publique protégée par la clé de la borne (?k=…) donnée dans Admin → Contrôle à distance.
 */
export default async function BornePage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const [{ k }, s, h] = await Promise.all([searchParams, getSettings(), headers()]);
  const espace = espaceFromBorneKey(k);

  if (!espace) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-800 p-6 text-center text-white">
        <BrandColors />
        <div className="max-w-md">
          <ShieldAlert className="mx-auto size-12 text-accent-400" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">Lien de borne invalide</h1>
          <p className="mt-2 text-brand-100/90">Ouvrez l&apos;écran de pointage depuis l&apos;espace admin : Contrôle à distance → « Ouvrir la borne ».</p>
        </div>
      </div>
    );
  }

  const { code, secondsLeft } = currentCode(espace);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const url = `${proto}://${host}/pointage?c=${code}`;
  const lady = espace === "lady";

  return (
    <div className={`relative min-h-dvh overflow-hidden text-white ${lady ? "bg-[#5b2346]" : "bg-brand-800"}`}>
      <BrandColors />
      <div
        className={`absolute inset-0 ${lady ? "bg-[radial-gradient(circle_at_10%_0%,rgba(244,114,182,.35),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(232,120,42,.35),transparent_50%)]" : "bg-[radial-gradient(circle_at_15%_0%,rgba(232,120,42,.35),transparent_45%),radial-gradient(circle_at_95%_100%,rgba(63,143,174,.6),transparent_55%)]"}`}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt={s.brand_name} className="h-8 w-auto" />
            ) : (
              <Image src="/logo.png" alt={s.brand_name} width={473} height={136} priority className="h-8 w-auto" />
            )}
          </span>
          <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.14em]">{ESPACE_LABEL[espace]}</span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 py-8 lg:flex-row lg:gap-16">
          <div className="rounded-[28px] bg-white p-5 shadow-2xl">
            <QrCode value={url} className="size-[min(70vw,340px)]" label="QR code de pointage" />
          </div>
          <div className="flex max-w-md flex-col items-center text-center lg:items-start lg:text-left">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-300">Pointage des coachs</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Arrivée et départ</h1>
            <p className="mt-6 text-sm text-white/80">Code à taper dans l&apos;application</p>
            <p className="mt-1 font-mono text-6xl font-extrabold tracking-[0.12em] tabular-nums sm:text-7xl">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <div className="mt-6 w-full">
              <BorneTicker key={code} secondsLeft={secondsLeft} period={WINDOW_S} />
            </div>
            <ul className="mt-8 space-y-3 text-left text-[15px] text-white/90">
              <li className="flex items-start gap-3">
                <ScanLine className="mt-0.5 size-5 shrink-0 text-accent-300" /> Scannez le QR code avec l&apos;appareil photo de votre téléphone,
              </li>
              <li className="flex items-start gap-3">
                <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-300" /> ou ouvrez l&apos;application → « Pointage » et tapez le code.
              </li>
            </ul>
          </div>
        </main>
        <footer className="text-center text-xs text-white/60">Le code change toutes les {WINDOW_S} secondes · une photo du code ne fonctionne pas plus tard</footer>
      </div>
    </div>
  );
}
