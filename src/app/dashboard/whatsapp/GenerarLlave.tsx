"use client";

import { useState, useTransition } from "react";

import { CopyButton } from "../_components/CopyButton";
import { generarLlave } from "./actions";

export function GenerarLlave({ hayLlave }: { hayLlave: boolean }) {
  const [resultado, setResultado] = useState<{ llave?: string; error?: string } | null>(null);
  const [generando, empezar] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className={hayLlave ? "btn btn-secondary self-start text-xs" : "btn btn-primary self-start"}
        disabled={generando}
        onClick={() => {
          if (
            hayLlave &&
            !window.confirm(
              "¿Generar una llave nueva?\n\nLa de ahora deja de funcionar en el acto: el bot no contesta hasta que pegues la nueva en Vercel.",
            )
          ) {
            return;
          }
          empezar(async () => setResultado(await generarLlave()));
        }}
      >
        {generando ? "Generando…" : hayLlave ? "Generar una llave nueva" : "Generar la llave"}
      </button>

      {resultado?.error ? (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {resultado.error}
        </p>
      ) : null}

      {resultado?.llave ? (
        <div className="flex flex-col gap-2 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)" }}>
          <p className="font-semibold">Tu llave (se muestra una sola vez)</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded px-2 py-1 text-xs break-all" style={{ background: "var(--surface)" }}>
              {resultado.llave}
            </code>
            <CopyButton value={resultado.llave} />
          </div>
          <p className="text-xs text-ink-2">
            Pegala en Vercel → Settings → Environment Variables con el nombre <code>BOT_LLAVE</code>, tipo{" "}
            <strong>Secret</strong>. Después hacé Redeploy y recargá esta página. No se la pases a nadie, ni por chat.
          </p>
        </div>
      ) : null}
    </div>
  );
}
