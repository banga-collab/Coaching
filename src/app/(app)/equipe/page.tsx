import { redirect } from "next/navigation";

/** Ancienne page « Équipe » : la gestion de l'équipe se fait uniquement dans l'Espace admin. */
export default function TeamPage() {
  redirect("/admin/coachs");
}
