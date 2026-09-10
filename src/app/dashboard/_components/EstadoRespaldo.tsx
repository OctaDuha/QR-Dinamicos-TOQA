"use client";

import { useEffect, useState } from "react";

type Estado = {
  configurado: boolean;
  fecha: string | null;
  tamano: number | null;
  url: string | null;
};

/**
 * Cuando fue la ultima copia de seguridad.
 *
 * Existe porque un respaldo automatico que falla en silencio es peor que no
 * tener ninguno: seguirias tranquilo creyendo que estas cubierto. Si esto
 * dice "hace 3 meses", te enteras.
 */
export function EstadoRespaldo() {
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
    return (
      <p className="text-xs text-ink-3">
        Respaldo automático sin configurar. Por ahora, bajá el CSV a mano cada vez que cambies algo.
      </p>
    );
  }

  const vieja = estado.fecha ? diasDesde(estado.fecha) >= 30 : true;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span style={{ color: vieja ? "var(--danger)" : "var(--ink-3)" }}>
        {estado.fecha
          ? `Última copia de seguridad: ${describir(estado.fecha)}`
          : "Todavía no se guardó ninguna copia"}
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
