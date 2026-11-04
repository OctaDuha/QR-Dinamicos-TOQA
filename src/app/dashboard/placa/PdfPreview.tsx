"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dibuja el PDF con pdf.js en vez de dejarselo al visor del navegador.
 * Es la misma libreria que ya usa la deteccion automatica, asi que no
 * agrega peso, y se ve igual en todos lados: sin barra de herramientas,
 * sin depender del plugin de PDF de cada navegador.
 */
/**
 * `circulo`: en los vinilos circulares, el radio del corte como fracción de
 * la hoja. `margen`: en las placas, cuánto de la hoja queda fuera del corte
 * de cada lado (fracción del ancho y del alto). `corte`: la pieza terminada
 * de una plantilla de imprenta, en fracciones de la hoja, con su forma. El
 * preview muestra la pieza como queda una vez cortada; sin ninguno de los
 * tres, la hoja entera.
 */
export type CortePreview = { forma: "circulo" | "rectangulo"; x: number; y: number; ancho: number; alto: number };

export function PdfPreview({
  url,
  page,
  circulo,
  margen,
  corte,
}: {
  url: string;
  page: number;
  circulo?: number;
  margen?: { x: number; y: number };
  corte?: CortePreview;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setState("cargando");
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        const doc = await pdfjs.getDocument({ data }).promise;
        const target = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));

        const canvas = canvasRef.current;
        const box = boxRef.current;
        if (!canvas || !box || cancelled) return;

        const base = target.getViewport({ scale: 1 });
        const available = { width: box.clientWidth - 24, height: 520 };
        const scale = Math.min(available.width / base.width, available.height / base.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = target.getViewport({ scale: scale * dpr });

        // El lienzo se redondea para abajo, nunca para arriba. Una placa de
        // 10x15 a 520 px de alto mide 346,67 px de ancho: redondeado para
        // arriba, la fraccion que sobraba dejaba ver el fondo blanco de abajo
        // como una linea fina en el borde derecho, que no esta en el PDF.
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${canvas.width / dpr}px`;
        canvas.style.height = `${canvas.height / dpr}px`;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("sin canvas");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await target.render({ canvasContext: context, viewport }).promise;

        await doc.destroy();
        if (!cancelled) setState("listo");
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") setState("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, page]);

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  let clipPath: string | undefined;
  if (corte) {
    clipPath =
      corte.forma === "circulo"
        ? // En una hoja cuadrada, el radio en % se mide sobre el lado.
          `circle(${pct(corte.ancho / 2)} at ${pct(corte.x + corte.ancho / 2)} ${pct(corte.y + corte.alto / 2)})`
        : `inset(${pct(corte.y)} ${pct(1 - corte.x - corte.ancho)} ${pct(1 - corte.y - corte.alto)} ${pct(corte.x)})`;
  } else if (circulo) {
    // circle() en % se mide sobre el lado de la hoja cuadrada.
    clipPath = `circle(${(circulo * 50).toFixed(3)}% at 50% 50%)`;
  } else if (margen) {
    clipPath = `inset(${pct(margen.y)} ${pct(margen.x)})`;
  }
  const redondo = corte?.forma === "circulo" || Boolean(circulo);

  return (
    <div
      ref={boxRef}
      className="relative flex min-h-[540px] items-center justify-center rounded-xl border p-3"
      style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
    >
      <canvas
        ref={canvasRef}
        className={redondo ? undefined : "rounded shadow-sm"}
        style={{
          display: state === "listo" ? "block" : "none",
          ...(clipPath ? { clipPath } : {}),
        }}
      />
      {state !== "listo" ? (
        <p className="text-sm text-ink-3">
          {state === "cargando" ? "Dibujando la placa…" : "No pude dibujar el preview."}
        </p>
      ) : null}
    </div>
  );
}
