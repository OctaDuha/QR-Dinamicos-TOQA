import { qrTargetUrl, siteUrl } from "./qr";

export type Chequeo = {
  clave: string;
  titulo: string;
  ok: boolean;
  detalle: string;
  comoArreglar: string | null;
};

/**
 * Lo que hay que confirmar antes de mandar el primer lote a imprenta.
 *
 * Existe porque una placa impresa no se corrige: la direccion que lleva
 * adentro es definitiva. Todo lo que se revisa aca es gratis de arreglar
 * hoy e imposible de arreglar despues.
 */
export function chequeosPreImprenta({ cantidadDisenos }: { cantidadDisenos: number }): Chequeo[] {
  const base = siteUrl();
  const host = hostDe(base);

  const prestado = host.endsWith(".vercel.app");
  const local = host === "localhost" || host.startsWith("127.") || host.endsWith(".local");
  const respaldo = process.env.QR_FALLBACK_URL?.trim();

  return [
    {
      clave: "dominio",
      titulo: "El dominio impreso es definitivo",
      ok: !prestado && !local,
      detalle: local
        ? `Estás apuntando a ${host}, que sólo existe en esta computadora. Las placas no funcionarían para nadie.`
        : prestado
          ? `Estás usando ${host}, la dirección prestada de Vercel. Si algún día renombrás el proyecto, te mudás de servicio o perdés la cuenta, todas estas placas mueren y no hay forma de arreglarlas.`
          : `Las placas van a decir ${host}. Es tu dominio: podés cambiar de servicio cuando quieras sin romper nada.`,
      comoArreglar: prestado || local
        ? "Conectá tu dominio en Vercel, poné esa dirección en NEXT_PUBLIC_SITE_URL y volvé a desplegar."
        : null,
    },
    {
      clave: "respaldo",
      titulo: "Red de seguridad si la base falla",
      ok: Boolean(respaldo),
      detalle: respaldo
        ? `Si alguna vez no se puede resolver un QR, quien escanee va a caer en ${hostDe(respaldo)} en vez de ver un error.`
        : "Sin destino de respaldo, una caída de la base le muestra una página de error a quien escanee la placa de tu cliente.",
      comoArreglar: respaldo
        ? null
        : "Agregá la variable QR_FALLBACK_URL en Vercel con tu Instagram y volvé a desplegar.",
    },
    {
      clave: "disenos",
      titulo: "Diseños cargados",
      ok: cantidadDisenos > 0,
      detalle:
        cantidadDisenos > 0
          ? `Tenés ${cantidadDisenos} ${cantidadDisenos === 1 ? "diseño cargado" : "diseños cargados"}.`
          : "Todavía no cargaste ningún diseño, así que no hay placas para generar.",
      comoArreglar: cantidadDisenos > 0 ? null : "Subí acá abajo el PDF que exportaste de Canva.",
    },
  ];
}

/** La direccion exacta que va a quedar impresa, para verla antes de mandar. */
export function urlDeMuestra(): string {
  return qrTargetUrl(1);
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
