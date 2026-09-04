import { NextResponse } from "next/server";

import {
  CANVA_AUTH_URL,
  CANVA_SCOPES,
  canvaCredentials,
  canvaRedirectUri,
  codeChallenge,
  randomString,
} from "@/lib/canva";
import { requireAdmin } from "@/lib/canva-guard";
import { siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let clientId: string;
  try {
    ({ clientId } = canvaCredentials());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const verifier = randomString();
  const state = randomString(16);
  const redirectUri = canvaRedirectUri(siteUrl());

  const authorize = new URL(CANVA_AUTH_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", CANVA_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", await codeChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize.toString());
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  };
  response.cookies.set("canva_verifier", verifier, cookieOptions);
  response.cookies.set("canva_state", state, cookieOptions);

  return response;
}
