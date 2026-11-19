import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { BrandColors } from "@/components/modules/brand-style";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Admin Moov'Up" },
  robots: { index: false, follow: false },
};

/**
 * Espace admin : application séparée de l'espace coach (hors du groupe (app), donc sans la coque coach).
 * Accès réservé au rôle « admin » — chaque page appelle aussi requireAdmin() (défense en profondeur :
 * les actions serveur et les pages ne dépendent pas du layout).
 * Le middleware impose déjà la connexion (/admin n'est pas dans les chemins publics).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <>
      <BrandColors />
      <AdminShell name={me.full_name} email={me.email}>
        {children}
      </AdminShell>
    </>
  );
}
