import { type NextRequest } from "next/server";
import { recordFailedPayment, recordOnlinePayment, SERVICE_ROLE_MISSING, serviceClient, verifyCmiHash } from "@/lib/payments";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Notification serveur-à-serveur de CMI (callbackUrl). CMI attend une réponse texte :
 * `ACTION=POSTAUTH` pour valider (capturer) la pré-autorisation, `FAILURE` sinon.
 */
export async function POST(request: NextRequest) {
  const storeKey = process.env.CMI_STORE_KEY;
  if (!storeKey) return text("FAILURE", 500);

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });

  if (!verifyCmiHash(params, storeKey)) return text("FAILURE");

  const db = serviceClient();
  if (!db) return text(`FAILURE ${SERVICE_ROLE_MISSING}`, 500);

  const oid = params.oid ?? params.OID ?? "";
  const { data } = await db.from("invoices").select("*").eq("number", oid).maybeSingle();
  const invoice = data as Invoice | null;
  if (!invoice) return text("FAILURE");

  const ref = params.TransId || params.transId || params.AuthCode || null;
  if (params.ProcReturnCode !== "00") {
    await recordFailedPayment(db, { invoice, provider: "cmi", providerRef: ref });
    return text("APPROVED");
  }

  const res = await recordOnlinePayment(db, { invoiceId: invoice.id, provider: "cmi", providerRef: ref, expectedAmount: Number(params.amount) });
  if (!res.ok) return text("FAILURE");
  return text("ACTION=POSTAUTH");
}
