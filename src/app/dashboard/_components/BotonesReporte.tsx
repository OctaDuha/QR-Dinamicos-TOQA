"use client";

import { useEffect, useState } from "react";

/**
 * Lo que se le manda al cliente: la imagen del reporte. En el celular,
 * además, "Compartir" abre el menú del teléfono (WhatsApp incluido) con la
 * imagen ya adjunta. La planilla queda como opción chica, para otros usos.
 *
 * `pedido` es lo que entienden /api/estadisticas/imagen y /descargar:
 * { qr } o { cliente }, más { desde, hasta }.
 */
export function BotonesReporte({ pedido }: { pedido: Record<string, string> }) {
  const consulta = new URLSearchParams(pedido).toString();
  const imagen = `/api/estadisticas/imagen?${consulta}`;
  const planilla = `/api/estadisticas/descargar?${consulta}`;

  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const prueba = new File([new Uint8Array(1)], "prueba.png", { type: "image/png" });
      setPuedeCompartir(Boolean(navigator.canShare?.({ files: [prueba] })));
    } catch {
      setPuedeCompartir(false);
    }
  }, []);

  // El teléfono solo deja compartir justo después del toque: la imagen se
  // prepara antes, para que al tocar "Compartir" ya esté lista.
  useEffect(() => {
    if (!puedeCompartir) return;
    let vigente = true;
    setArchivo(null);
    setError(null);
    fetch(imagen, { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error(await respuesta.text());
        const nombre =
          respuesta.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "reporte-toqa.png";
        const blob = await respuesta.blob();
        if (vigente) setArchivo(new File([blob], nombre, { type: "image/png" }));
      })
      .catch((e: Error) => vigente && setError(e.message || "No pude preparar la imagen."));
    return () => {
      vigente = false;
    };
  }, [imagen, puedeCompartir]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <a href={imagen} download className="btn btn-primary text-xs">
          Descargar imagen
        </a>
        {puedeCompartir ? (
          <button
            type="button"
            className="btn btn-secondary text-xs"
            disabled={!archivo}
            onClick={() => {
              if (!archivo) return;
              navigator.share({ files: [archivo], title: "Reporte de escaneos" }).catch(() => {
                // Cerrar el menú sin elegir nada también "falla": no es un error.
              });
            }}
          >
            {archivo ? "Compartir (WhatsApp)" : "Preparando…"}
          </button>
        ) : null}
        <a href={planilla} download className="text-xs text-ink-3 underline-offset-2 hover:underline">
          Planilla (CSV)
        </a>
      </div>
      {error ? (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
