import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Canva Connect API.
 * Docs: https://www.canva.dev/docs/connect/
 *
 * Flujo por cada QR:
 *   PNG del QR -> asset en Canva -> autofill de la plantilla "NFC y QR"
 *   (campo `qr_code`) -> export a PDF.
 */

export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_API = "https://api.canva.com/rest/v1";

export const CANVA_SCOPES = [
  "asset:read",
  "asset:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "design:content:read",
  "design:content:write",
  "design:meta:read",
].join(" ");

/** Nombre del campo de imagen etiquetado en la plantilla de Canva. */
export const QR_FIELD = "qr_code";

export function canvaCredentials() {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan CANVA_CLIENT_ID / CANVA_CLIENT_SECRET. Creá la integración en developers.canva.com.",
    );
  }
  return { clientId, clientSecret };
}

export function canvaRedirectUri(base: string) {
  return `${base.replace(/\/+$/, "")}/api/canva/callback`;
}

// ---------------------------------------------------------------- tokens

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = canvaCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${CANVA_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Canva rechazó el token (${response.status}): ${payload.error_description ?? payload.error ?? "sin detalle"}`,
    );
  }

  return payload as TokenResponse;
}

export async function saveConnection(supabase: SupabaseClient, token: TokenResponse) {
  const { error } = await supabase.from("canva_connections").upsert({
    id: 1,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scopes: token.scope ?? CANVA_SCOPES,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No pude guardar la conexión con Canva: ${error.message}`);
}

/** Devuelve un access token valido, renovandolo si esta por vencer. */
export async function getAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("canva_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at as string).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return data.access_token as string;
  }

  const refreshed = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: data.refresh_token as string,
  });
  await saveConnection(supabase, refreshed);
  return refreshed.access_token;
}

export async function disconnect(supabase: SupabaseClient) {
  await supabase.from("canva_connections").delete().eq("id", 1);
}

// ---------------------------------------------------------------- API

async function canvaFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(`${CANVA_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ??
      (payload as { error?: string }).error ??
      response.statusText;
    throw new Error(`Canva ${response.status}: ${message}`);
  }

  return payload as Record<string, unknown>;
}

type Job = { id?: string; status?: string; error?: { message?: string } } & Record<string, unknown>;

/** Los tres endpoints que usamos son asincronicos: crean un job y hay que esperarlo. */
async function waitForJob(
  token: string,
  path: string,
  jobId: string,
  timeoutMs = 25_000,
): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  let delay = 700;

  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(delay * 1.4, 3000);

    const payload = await canvaFetch(token, `${path}/${jobId}`);
    const job = (payload.job ?? {}) as Job;

    if (job.status === "success") return job;
    if (job.status === "failed") {
      throw new Error(job.error?.message ?? "El job de Canva falló sin detalle.");
    }
  }

  throw new Error("El job de Canva tardó demasiado. Reintentá el lote.");
}

export async function listBrandTemplates(token: string) {
  const payload = await canvaFetch(token, "/brand-templates?limit=100");
  return (payload.items ?? []) as { id: string; title: string }[];
}

/** Sube el PNG del QR como asset y devuelve su id. */
export async function uploadQrAsset(token: string, name: string, png: Buffer): Promise<string> {
  const payload = await canvaFetch(token, "/asset-uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({
        name_base64: Buffer.from(name, "utf8").toString("base64"),
      }),
    },
    body: new Uint8Array(png),
  });

  let job = (payload.job ?? {}) as Job;
  if (job.status !== "success") {
    job = await waitForJob(token, "/asset-uploads", String(job.id));
  }

  const assetId = (job.asset as { id?: string } | undefined)?.id;
  if (!assetId) throw new Error("Canva no devolvió el id del asset.");
  return assetId;
}

/** Rellena la plantilla con el QR y devuelve el id del diseño generado. */
export async function autofillDesign(
  token: string,
  brandTemplateId: string,
  assetId: string,
  title: string,
): Promise<string> {
  const payload = await canvaFetch(token, "/autofills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand_template_id: brandTemplateId,
      title,
      data: { [QR_FIELD]: { type: "image", asset_id: assetId } },
    }),
  });

  let job = (payload.job ?? {}) as Job;
  if (job.status !== "success") {
    job = await waitForJob(token, "/autofills", String(job.id));
  }

  const designId = ((job.result as { design?: { id?: string } } | undefined)?.design ?? {}).id;
  if (!designId) throw new Error("Canva no devolvió el id del diseño.");
  return designId;
}

/** Exporta el diseño a PDF de impresion y devuelve la URL de descarga. */
export async function exportDesignPdf(token: string, designId: string): Promise<string> {
  const payload = await canvaFetch(token, "/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      design_id: designId,
      format: { type: "pdf", export_quality: "pro" },
    }),
  });

  let job = (payload.job ?? {}) as Job;
  if (job.status !== "success") {
    job = await waitForJob(token, "/exports", String(job.id), 40_000);
  }

  const urls = (job.urls ?? []) as string[];
  if (!urls[0]) throw new Error("Canva no devolvió la URL del PDF.");
  return urls[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- PKCE

export function randomString(bytes = 48): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return base64url(array);
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
