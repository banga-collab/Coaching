import { CalendarOff, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import { Card } from "@/components/ui";
import { WhatsAppButton } from "@/components/modules/whatsapp-button";
import { buildDays } from "@/components/platform/slots";
import { BookingForm } from "./booking-form";

export default async function ReserverPage() {
  const s = await getSettings();

  if (!s.booking_enabled || !s.booking_types.length) {
    return (
      <Card className="p-8 text-center animate-fade-up">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <CalendarOff className="size-6" />
        </span>
        <h2 className="mt-4 font-display text-xl font-extrabold text-ink">Réservation en ligne fermée</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">La prise de rendez-vous en ligne est momentanément indisponible. Contactez-nous directement, nous vous répondons rapidement.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <WhatsAppButton phone={s.whatsapp} name="" message={`Bonjour, je souhaite réserver une séance au ${s.brand_name}.`} />
          {s.phone && (
            <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-canvas">
              <Phone className="size-4" /> {s.phone}
            </a>
          )}
        </div>
      </Card>
    );
  }

  // Séances déjà prévues : lisibles en démo ; en production les visiteurs anonymes n'y ont pas accès (RLS)
  let busy: { start: string; minutes: number }[] = [];
  if (DEMO) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("sessions")
        .select("starts_at, duration_min, status")
        .gte("starts_at", new Date().toISOString())
        .lte("starts_at", new Date(Date.now() + 15 * 86400000).toISOString());
      busy = (data ?? []).filter((x) => x.status !== "annulee").map((x) => ({ start: x.starts_at as string, minutes: Number(x.duration_min) || 60 }));
    } catch {
      busy = [];
    }
  }
  const days = buildDays(s.booking_hours, busy);

  return <BookingForm types={s.booking_types} days={days} brand={s.brand_name} whatsapp={s.whatsapp} slot={s.booking_hours.slot} />;
}
