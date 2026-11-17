import Image from "next/image";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { BrandColors } from "@/components/modules/brand-style";

export async function generateMetadata() {
  const s = await getSettings();
  return { title: { absolute: `Réserver une séance · ${s.brand_name}` }, description: `Réservez votre séance en ligne au ${s.brand_name}.` };
}

export default async function ReserverLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="min-h-dvh bg-canvas">
      <BrandColors />
      <header className="relative overflow-hidden bg-brand-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(232,120,42,.35),transparent_45%),radial-gradient(circle_at_95%_100%,rgba(63,143,174,.6),transparent_55%)]" />
        <svg className="absolute inset-y-0 right-0 h-full w-2/3 opacity-50 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <rect
              key={i}
              x={`${(i * 53) % 100}%`}
              y={`${(i * 37) % 100}%`}
              width={6 + ((i * 7) % 12)}
              height={6 + ((i * 7) % 12)}
              fill={i % 5 === 0 ? "#e8782a" : i % 3 === 0 ? "#3f8fae" : "rgba(255,255,255,.2)"}
              transform={`rotate(${(i * 13) % 30})`}
            />
          ))}
        </svg>
        <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt={s.brand_name} className="h-8 w-auto" />
              ) : (
                <Image src="/logo.png" alt={s.brand_name} width={473} height={136} priority className="h-8 w-auto" />
              )}
            </span>
            {s.address && (
              <span className="hidden items-center gap-1.5 text-xs font-medium text-brand-100 sm:inline-flex">
                <MapPin className="size-3.5 text-accent-300" /> {s.address}
              </span>
            )}
          </div>
          <h1 className="mt-8 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Réservez votre séance
            <span className="block text-accent-400">en moins d&apos;une minute.</span>
          </h1>
          <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
              <CalendarCheck className="size-3.5 text-accent-300" /> Confirmation rapide par un coach
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
              <Clock className="size-3.5 text-accent-300" /> Créneaux de {s.booking_hours.slot} min
            </li>
          </ul>
        </div>
      </header>
      <main className="relative mx-auto -mt-16 max-w-3xl px-4 pb-12 sm:px-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} {s.brand_name}
        {s.phone && <> · {s.phone}</>}
      </footer>
    </div>
  );
}
