import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { TodayBlock } from "@/components/home/today";
import { ManagementDashboard } from "@/components/home/management-dashboard";

/**
 * Accueil du personnel.
 * - Coach et head coach : « Ma journée » (séances du jour, à confirmer, à clôturer, créneaux libres, alertes).
 * - Admin : le même bloc « Aujourd'hui » en haut, puis le tableau de bord de pilotage de la salle.
 */
export default async function Home() {
  const me = await getProfile();
  if (me.role === "client") redirect("/moi");
  return (
    <>
      <TodayBlock me={me} compact={me.role === "admin"} />
      {me.role === "admin" && <ManagementDashboard />}
    </>
  );
}
