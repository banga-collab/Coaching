import { CalendarOff, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { publicBookingDays } from "@/lib/planning";
import { Card } from "@/components/ui";
import { WhatsAppButton } from "@/components/modules/whatsapp-button";
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

  // Horaires où au moins un coach est libre (calcul côté serveur). Un visiteur anonyme ne lit pas le planning
  // sous RLS : on utilise le client « service » (clé SUPABASE_SERVICE_ROLE_KEY) ; sans elle, horaires d'ouverture seuls.
  const days = await publicBookingDays(serviceClient() ?? (await createClient()), s.booking_hours);

  return <BookingForm types={s.booking_types} days={days} brand={s.brand_name} whatsapp={s.whatsapp} slot={s.booking_hours.slot} />;
}
