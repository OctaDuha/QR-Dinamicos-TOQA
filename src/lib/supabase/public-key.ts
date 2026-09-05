/**
 * Supabase tiene dos formatos de clave publica y se mandan distinto.
 *
 * La vieja es un JWT (empieza con "eyJ") y va en los dos headers. La nueva
 * (sb_publishable_...) va SOLO en `apikey`: si va tambien como Bearer, la
 * plataforma intenta leerla como JWT y rechaza la llamada. Distinguirlas por
 * el prefijo evita depender de la compatibilidad hacia atras.
 */
export function publicKeyHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

/** Config publica de Supabase, o null si falta algo. */
export function publicConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/**
 * Llama a resolve_qr con la clave publica. Es el mismo camino exacto que
 * recorre un escaneo real, asi que sirve tanto para redirigir como para
 * comprobar que la base esta despierta.
 *
 * Devuelve el destino, null si el QR no existe, o lanza si la base no
 * contesta (para poder distinguir "no hay destino" de "no hay base").
 */
export async function resolveQr(
  { url, key }: { url: string; key: string },
  id: number,
  userAgent: string | null,
  timeoutMs = 2500,
): Promise<string | null> {
  const response = await fetch(`${url}/rest/v1/rpc/resolve_qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...publicKeyHeaders(key) },
    body: JSON.stringify({ p_id: id, p_user_agent: userAgent }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`supabase ${response.status}`);
  }

  const value: unknown = await response.json();
  return typeof value === "string" && value.length > 0 ? value : null;
}
