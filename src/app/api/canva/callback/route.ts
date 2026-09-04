import { NextResponse, type NextRequest } from "next/server";

import { canvaRedirectUri, exchangeCode, saveConnection } from "@/lib/canva";
import { requireAdmin } from "@/lib/canva-guard";
import { siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const verifier = request.cookies.get("canva_verifier")?.value;
  const expectedState = request.cookies.get("canva_state")?.value;

  const back = (message: string) =>
    NextResponse.redirect(`${siteUrl()}/dashboard/canva?msg=${encodeURIComponent(message)}`);

  if (oauthError) return back(`Canva canceló la conexión: ${oauthError}`);
  if (!code || !state || !verifier) return back("Faltan datos del intercambio con Canva.");
  if (state !== expectedState) return back("El state no coincide. Volvé a intentar la conexión.");

  try {
    const token = await exchangeCode(code, verifier, canvaRedirectUri(siteUrl()));
    await saveConnection(supabase, token);
  } catch (error) {
    return back((error as Error).message);
  }

  const response = back("Canva conectado.");
  response.cookies.delete("canva_verifier");
  response.cookies.delete("canva_state");
  return response;
}
