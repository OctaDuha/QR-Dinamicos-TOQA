"use client";

import { useEffect, useState } from "react";

type Estado = {
  configurado: boolean;
  fecha: string | null;
  tamano: number | null;
  url: string | null;
  clavesVisibles?: string[];
  error?: string | null;
};

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
