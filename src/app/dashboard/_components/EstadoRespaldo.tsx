"use client";

import { useEffect, useState } from "react";

type Estado = {
  configurado: boolean;
  fecha: string | null;
  tamano: number | null;
  url: string | null;
  clavesVisibles?: string[];
  error?: string | null;
  fotos?: { fecha: string; tamano: number }[];
  /** Cuándo se bajó una copia a una computadora por última vez. */
  descarga?: string | null;
};

/** A partir de acá el panel avisa que falta una copia afuera de Vercel. */
const DIAS_SIN_BAJAR = 30;

/**
 * Cuando fue la ultima copia de seguridad.
 *
 * Existe porque un respaldo automatico que falla en silencio es peor que no
 * tener ninguno: seguirias tranquilo creyendo que estas cubierto. Si esto
 * dice "hace 3 meses", te enteras.
 */
export function EstadoRespaldo({ hayQrs }: { hayQrs: boolean }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [busy, setBusy] = useState(false);

  const leer = () =>
    fetch("/api/respaldo")
      .then((r) => (r.ok ? r.json() : null))
      .then(setEstado)
      .catch(() => setEstado(null));

  useEffect(() => {
    void leer();
  }, []);

  const guardarAhora = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/respaldo", { method: "POST" });
      if (response.ok) setEstado(await response.json());
    } finally {
      setBusy(false);
    }
  };

  if (!estado) return null;

  if (!estado.configurado) {
    const claves = estado.clavesVisibles ?? [];
    return (
      <div className="flex flex-col gap-1 text-xs text-ink-3">
        <p>
          Respaldo automático sin configurar. Por ahora, bajá el CSV a mano cada vez que cambies
          algo.
        </p>
        <p>
          {claves.length === 0
            ? "No veo el almacén. Falta conectar el Blob store a este proyecto en Vercel, o volver a desplegar después de haberlo conectado."
            : `Veo ${claves.join(", ")}, pero falta BLOB_STORE_ID, que es lo que identifica el almacén.`}
        </p>
      </div>
    );
  }

  if (estado.error) {
    // El caso mas comun: el almacen esta conectado pero el sitio no tiene
    // con que autenticarse contra el. Se arregla pegando la clave del store
    // como variable, sin tocar codigo.
    const faltaClave = /credential|token/i.test(estado.error);
    return (
      <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--danger)" }}>
        <p>El almacén está conectado pero el sitio no puede escribir en él.</p>
        {faltaClave ? (
          <p>
            Falta la clave: en Vercel entrá al Blob store <strong>CSV-Respaldo</strong>, buscá la
            pestaña <strong>.env.local</strong>, copiá el valor de{" "}
            <strong>BLOB_READ_WRITE_TOKEN</strong> y agregalo con ese mismo nombre en Environment
            Variables. Después, Redeploy.
          </p>
        ) : (
          <p>{estado.error}</p>
        )}
      </div>
    );
  }

  // Se comprueba DESPUES del error: si la clave del almacen estuviera mal,
  // decir "listo" por tener la lista vacia taparia el problema.
  // Con la lista vacia no hay nada que guardar, y el respaldo no pisa la
  // copia anterior con un archivo vacio. Sin esta aclaracion pareceria que
  // el respaldo no funciona.
  if (estado.configurado && !hayQrs && !estado.fecha) {
    return (
      <p className="text-xs text-ink-3">
        Respaldo automático listo. Todavía no hay QR para guardar: la primera copia se hace sola
        cuando crees el primer lote.
      </p>
    );
  }


  // A los 7 dias la fecha se pone en rojo. Ojo con lo que significa: la copia
  // se guarda cuando la lista cambia, asi que "vieja" puede ser simplemente
  // que no tocaste nada en una semana. Lo que hay que mirar es si cambiaste
  // algo despues de esa fecha.
  const vieja = estado.fecha ? diasDesde(estado.fecha) >= 7 : true;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span style={{ color: vieja ? "var(--danger)" : "var(--ink-3)" }}>
        {estado.fecha
          ? `Última copia de seguridad: ${describir(estado.fecha)}`
          : "Todavía no se guardó ninguna copia"}
        {vieja && estado.fecha ? " · si cambiaste algo desde entonces, guardá una ahora" : ""}
      </span>
      <button
        type="button"
        className="btn btn-ghost text-xs"
        onClick={guardarAhora}
        disabled={busy}
      >
        {busy ? "Guardando…" : "Guardar una ahora"}
      </button>
      {estado.url ? (
        <a className="btn btn-ghost text-xs" href={estado.url}>
          Descargarla
        </a>
      ) : null}

      <AvisoCopiaAfuera descarga={estado.descarga ?? null} />

      {(estado.fotos?.length ?? 0) > 0 ? (
        <details className="w-full">
          <summary className="cursor-pointer text-xs text-ink-3">
            Volver a un día anterior ({estado.fotos!.length}{" "}
            {estado.fotos!.length === 1 ? "copia guardada" : "copias guardadas"})
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs text-ink-3">
              Una foto por día que no se pisa. Si algún día los destinos aparecen cambiados sin
              que hayas sido vos, bajá la del día anterior y subila con Importar CSV.
            </p>
            <div className="flex flex-wrap gap-1">
              {estado.fotos!.slice(0, 30).map((foto) => (
                <a
                  key={foto.fecha}
                  className="btn btn-ghost font-mono text-xs"
                  href={`/api/respaldo/descargar?dia=${foto.fecha}`}
                >
                  {foto.fecha}
                </a>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * El respaldo automatico vive adentro de Vercel, asi que no cubre perder
 * esa cuenta. Lo unico que cubre eso es un CSV bajado a una computadora, y
 * eso no se puede hacer solo: nadie puede dejar un archivo en tu disco
 * desde afuera. Lo que si se puede es no dejar que se olvide.
 */
function AvisoCopiaAfuera({ descarga }: { descarga: string | null }) {
  const dias = descarga ? diasDesde(descarga) : null;

  if (dias !== null && dias < DIAS_SIN_BAJAR) {
    return (
      <span className="w-full text-xs text-ink-3">
        Copia guardada fuera de Vercel: {describir(descarga!)}.
      </span>
    );
  }

  return (
    <div
      className="flex w-full flex-col gap-1 rounded-md p-3 text-xs"
      style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)" }}
    >
      <p style={{ color: "var(--danger)" }}>
        <strong>
          {dias === null
            ? "Nunca bajaste una copia a tu computadora."
            : `Hace ${Math.round(dias)} días que no bajás una copia a tu computadora.`}
        </strong>
      </p>
      <p className="text-ink-2">
        Todo lo de arriba vive adentro de Vercel: te cubre si se rompe la base o si alguien te
        cambia los destinos, pero no si perdés la cuenta de Vercel, porque se va con ella. Bajá el
        CSV y guardalo en tu compu o en tu Drive.
      </p>
      <a className="btn btn-secondary self-start text-xs" href="/api/respaldo/descargar">
        Bajar el CSV ahora
      </a>
    </div>
  );
}

function diasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function describir(iso: string): string {
  const dias = diasDesde(iso);
  if (dias < 1 / 24) return "hace un rato";
  if (dias < 1) return `hace ${Math.round(dias * 24)} h`;
  if (dias < 2) return "ayer";
  if (dias < 60) return `hace ${Math.round(dias)} días`;
  return new Date(iso).toLocaleDateString("es-AR");
}
