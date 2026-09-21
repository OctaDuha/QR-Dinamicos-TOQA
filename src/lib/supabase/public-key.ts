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
export type CanalEscaneo = "qr" | "nfc";

export async function resolveQr(
  config: { url: string; key: string },
  id: number,
  userAgent: string | null,
  via: CanalEscaneo = "qr",
  timeoutMs = 2500,
): Promise<string | null> {
  const conCanal = await llamar(config, { p_id: id, p_user_agent: userAgent, p_via: via }, timeoutMs);

  // 404 significa que la base todavia no tiene la version de tres argumentos
  // (falta correr la migracion). En ese caso se usa la de siempre: el escaneo
  // se cuenta igual, como qr. Vale la pena: perder un escaneo es peor que
  // perder el dato de por donde entro.
  if (conCanal.estado === 404) {
    const clasica = await llamar(config, { p_id: id, p_user_agent: userAgent }, timeoutMs);
    if (!clasica.ok) throw new Error(`supabase ${clasica.estado}`);
    return clasica.destino;
  }

  if (!conCanal.ok) throw new Error(`supabase ${conCanal.estado}`);
  return conCanal.destino;
}

async function llamar(
  { url, key }: { url: string; key: string },
  cuerpo: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: boolean; estado: number; destino: string | null }> {
  const response = await fetch(`${url}/rest/v1/rpc/resolve_qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...publicKeyHeaders(key) },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    return { ok: false, estado: response.status, destino: null };
  }

  const value: unknown = await response.json();
  return {
    ok: true,
    estado: response.status,
    destino: typeof value === "string" && value.length > 0 ? value : null,
  };
}
