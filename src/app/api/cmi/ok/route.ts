import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Retour navigateur après paiement CMI accepté (okUrl). La validation réelle se fait dans /api/cmi/callback. */
function handle(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("invoice") ?? "";
  const target = UUID.test(id) ? `/paiement/${id}/succes?mode=cmi` : "/paiement";
  return NextResponse.redirect(new URL(target, request.url), 303);
}

export const GET = handle;
export const POST = handle;
