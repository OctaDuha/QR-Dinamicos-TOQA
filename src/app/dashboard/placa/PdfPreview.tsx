"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dibuja el PDF con pdf.js en vez de dejarselo al visor del navegador.
 * Es la misma libreria que ya usa la deteccion automatica, asi que no
 * agrega peso, y se ve igual en todos lados: sin barra de herramientas,
 * sin depender del plugin de PDF de cada navegador.
 */
export function PdfPreview({ url, page }: { url: string; page: number }) {
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
        const viewport = target.getViewport({ scale: scale * (window.devicePixelRatio || 1) });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(base.width * scale)}px`;
        canvas.style.height = `${Math.ceil(base.height * scale)}px`;

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

  return (
    <div
      ref={boxRef}
      className="relative flex min-h-[540px] items-center justify-center rounded-xl border p-3"
      style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
    >
      <canvas
        ref={canvasRef}
        className="rounded shadow-sm"
        style={{ display: state === "listo" ? "block" : "none" }}
      />
      {state !== "listo" ? (
        <p className="text-sm text-ink-3">
          {state === "cargando" ? "Dibujando la placa…" : "No pude dibujar el preview."}
        </p>
      ) : null}
    </div>
  );
}
