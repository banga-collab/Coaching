import Image from "next/image";
import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui";
import { QrCode } from "@/components/qr-code";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Affiche QR réclamations" };

/** Affiche A4 à imprimer : QR code vers /signaler (avec le lieu en option, ex. ?lieu=Vestiaires) */
export default async function PosterPage({ searchParams }: { searchParams: Promise<{ lieu?: string }> }) {
  await requireStaff();
  const [{ lieu = "" }, s, h] = await Promise.all([searchParams, getSettings(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const place = lieu.trim().slice(0, 60);
  const url = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${proto}://${host}`}/signaler${place ? `?lieu=${encodeURIComponent(place)}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <BackLink href="/reclamations" label="Réclamations" />
        <form className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Lieu (facultatif)</span>
            <input name="lieu" defaultValue={place} placeholder="Ex. Vestiaires, Plateau cardio…" className="h-10 w-60 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-400 focus:outline-none" />
          </label>
          <button className="h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas">Mettre à jour</button>
          <PrintButton />
        </form>
      </div>
      <Card className="flex aspect-[1/1.414] flex-col items-center justify-between p-10 text-center sm:p-14 print:border-0 print:shadow-none">
        {s.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logo_url} alt={s.brand_name} className="h-16 w-auto" />
        ) : (
          <Image src="/logo.png" alt={s.brand_name} width={473} height={136} className="h-16 w-auto" />
        )}
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-brand-700 sm:text-5xl">Un problème ?</h1>
          <p className="mt-3 text-lg font-semibold text-accent-600">Panne · Propreté · Sécurité · Service</p>
          <p className="mt-1 text-base text-slate-600" dir="rtl" lang="ar">مشكلة؟ امسح الرمز وأخبرنا</p>
          <p className="text-base text-slate-600" lang="en">A problem? Scan and tell us</p>
        </div>
        <QrCode value={url} className="size-64 sm:size-72" label="QR code de signalement" />
        <div>
          <p className="text-lg font-bold text-ink">Scannez avec votre téléphone</p>
          <p className="mt-1 text-sm text-muted">L&apos;équipe est prévenue immédiatement{place ? ` · ${place}` : ""}</p>
          <p className="mt-3 break-all font-mono text-xs text-slate-400">{url}</p>
        </div>
      </Card>
    </div>
  );
}
