import { Download, Eye, EyeOff, File, FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen, Lock, Trash2, Upload, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import type { DocumentRow } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { ConfirmIcon } from "@/components/phase1/confirm-icon";
import { UploadForm } from "@/components/phase1/upload-form";
import { docKind, fmtSize, type DocKind } from "@/components/phase1/shared";
import { deleteDocumentAction, toggleDocumentSharedAction } from "@/actions/phase1";

const KIND: Record<DocKind, { icon: typeof File; cls: string; label: string }> = {
  pdf: { icon: FileText, cls: "bg-red-50 text-red-500", label: "PDF" },
  image: { icon: FileImage, cls: "bg-violet-50 text-violet-500", label: "Image" },
  sheet: { icon: FileSpreadsheet, cls: "bg-emerald-50 text-emerald-600", label: "Tableur" },
  video: { icon: FileVideo, cls: "bg-sky-50 text-sky-600", label: "Vidéo" },
  doc: { icon: FileText, cls: "bg-brand-50 text-brand-500", label: "Document" },
  other: { icon: File, cls: "bg-slate-100 text-slate-500", label: "Fichier" },
};
const CAT_TONE: Record<string, "brand" | "accent" | "green" | "amber" | "red" | "gray"> = {
  "Certificat médical": "red",
  Bilan: "amber",
  Programme: "brand",
  Nutrition: "green",
  Contrat: "accent",
  Photo: "gray",
};

export async function DocumentsTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  let q = supabase.from("documents").select("*").eq("client_id", clientId);
  if (!canEdit) q = q.eq("shared", true);
  const { data } = await q.order("created_at", { ascending: false });
  const docs = (data ?? []) as DocumentRow[];
  const totalSize = docs.reduce((s, d) => s + (d.size_bytes ?? 0), 0);

  const list =
    docs.length === 0 ? (
      <Card>
        <Empty
          icon={<FolderOpen className="size-6" />}
          title="Aucun document"
          text={
            canEdit
              ? "Centralise ici les certificats médicaux, bilans, programmes, contrats et photos de suivi."
              : "Ton coach n'a pas encore partagé de document avec toi. Ils apparaîtront ici."
          }
        />
      </Card>
    ) : (
      <Card className="overflow-hidden">
        <CardHeader
          title={canEdit ? "Documents du client" : "Mes documents"}
          subtitle={`${docs.length} fichier${docs.length > 1 ? "s" : ""} · ${fmtSize(totalSize)}`}
          icon={<FolderOpen className="size-4" />}
        />
        <ul className="divide-y divide-line border-t border-line">
          {docs.map((d) => {
            const k = KIND[docKind(d.mime, d.name)];
            const Icon = k.icon;
            return (
              <li key={d.id} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-canvas/60 sm:px-5">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", k.cls)}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="block truncate text-sm font-semibold text-ink hover:text-brand-600">
                    {d.name}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <Badge tone={CAT_TONE[d.category] ?? "gray"}>{d.category}</Badge>
                    <span>{fmtSize(d.size_bytes)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{fmtDate(d.created_at)}</span>
                    {canEdit &&
                      (d.shared ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Users className="size-3" /> Partagé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Lock className="size-3" /> Privé
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {canEdit && (
                    <form action={toggleDocumentSharedAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="shared" value={d.shared ? "0" : "1"} />
                      <button
                        title={d.shared ? "Rendre privé" : "Partager avec le client"}
                        aria-label={d.shared ? "Rendre privé" : "Partager avec le client"}
                        className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-canvas hover:text-ink"
                      >
                        {d.shared ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </form>
                  )}
                  <a
                    href={`/api/documents/${d.id}`}
                    target="_blank"
                    rel="noopener"
                    title="Télécharger"
                    aria-label="Télécharger"
                    className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Download className="size-4" />
                  </a>
                  {canEdit && (
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <ConfirmIcon message={`Supprimer « ${d.name} » ? Le fichier sera définitivement effacé.`} label="Supprimer">
                        <Trash2 className="size-4" />
                      </ConfirmIcon>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    );

  if (!canEdit) return list;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {list}
      <Card className="lg:sticky lg:top-6">
        <CardHeader title="Ajouter un document" icon={<Upload className="size-4" />} />
        <div className="px-5 pb-5">
          <UploadForm clientId={clientId} demo={DEMO} />
        </div>
      </Card>
    </div>
  );
}
