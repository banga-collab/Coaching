import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Retour navigateur après paiement CMI refusé ou abandonné (failUrl). */
function handle(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("invoice") ?? "";
  const target = UUID.test(id) ? `/paiement/${id}/echec?raison=refuse` : "/paiement";
  return NextResponse.redirect(new URL(target, request.url), 303);
}

export const GET = handle;
export const POST = handle;
