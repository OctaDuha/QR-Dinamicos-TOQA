"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Layout = {
  qrPage: number;
  xMm: number;
  yMm: number;
  sizeMm: number;
  quietModules: number;
  whiteBackdrop: boolean;
};

type BackgroundInfo = { name: string; pages?: number; widthMm?: number; heightMm?: number };

export function PlacaEditor({
  initialLayout,
  initialBackground,
}: {
  initialLayout: Layout;
  initialBackground: string | null;
}) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [background, setBackground] = useState<BackgroundInfo | null>(
    initialBackground ? { name: initialBackground } : null,
  );
  const [previewId, setPreviewId] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nonce, setNonce] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // El preview es el PDF real; se regenera con un respiro para no pegarle
  // al servidor en cada tecla.
  const [debounced, setDebounced] = useState(layout);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(layout), 450);
    return () => clearTimeout(timer);
  }, [layout]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      id: previewId || "1",
      qrPage: String(debounced.qrPage),
      xMm: String(debounced.xMm),
      yMm: String(debounced.yMm),
      sizeMm: String(debounced.sizeMm),
      quietModules: String(debounced.quietModules),
      whiteBackdrop: String(debounced.whiteBackdrop),
      v: String(nonce),
    });
    // Abre el visor del navegador ya en la cara del QR y a página completa.
    return `/api/placa/preview?${params}#page=${debounced.qrPage}&view=Fit`;
  }, [debounced, previewId, nonce]);

  const set = <K extends keyof Layout>(key: K, value: Layout[K]) =>
    setLayout((current) => ({ ...current, [key]: value }));

  const uploadBackground = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Elegí el PDF exportado de Canva.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/placa/background", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No pude guardar el fondo.");
        return;
      }

      setBackground({
        name: payload.name,
        pages: payload.pages,
        widthMm: payload.widthMm,
        heightMm: payload.heightMm,
      });
      setNonce((n) => n + 1);
      setMessage(
        `Fondo cargado: ${payload.pages} página${payload.pages === 1 ? "" : "s"} de ${payload.widthMm} × ${payload.heightMm} mm.`,
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const saveLayout = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/placa/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      const payload = await response.json();
      setMessage(response.ok ? "Posición guardada." : (payload.error ?? "No pude guardar."));
    } finally {
      setBusy(false);
    }
  }, [layout]);

  const generateUrl = (zip: boolean) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (zip) params.set("zip", "1");
    const suffix = params.toString();
    return `/api/placa/generate${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5">
        <h2 className="text-sm font-semibold">1 · El fondo, exportado de Canva</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-2">
          <li>Abrí tu diseño “NFC y QR” en Canva y borrá (o dejá vacío) el marco del QR.</li>
          <li>
            Compartir → Descargar → <strong>PDF para imprimir</strong>, con marcas de recorte y
            sangrado si la imprenta lo pide.
          </li>
          <li>Subilo acá. Queda guardado en la base: no hay que volver a desplegar nada.</li>
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="input max-w-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1 file:text-sm file:text-[var(--ink-1)]"
          />
          <button type="button" className="btn btn-primary" onClick={uploadBackground} disabled={busy}>
            {busy ? "Subiendo…" : "Subir fondo"}
          </button>
        </div>

        {background ? (
          <p className="mt-3 text-sm text-ink-2">
            Fondo actual: <strong>{background.name}</strong>
            {background.pages
              ? ` · ${background.pages} pág. · ${background.widthMm} × ${background.heightMm} mm`
              : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
            Todavía no hay fondo cargado. El preview de abajo muestra sólo el QR sobre una hoja
            vacía.
          </p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">2 · Dónde va el QR</h2>
        <p className="mt-1 text-sm text-ink-2">
          Todo en milímetros, medido desde el borde superior izquierdo de la placa. El preview de la
          derecha es el PDF real que sale a imprenta.
        </p>

        <div className="mt-4 grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3">
            <Field label="Izquierda (X)" value={layout.xMm} onChange={(v) => set("xMm", v)} step={0.5} />
            <Field label="Arriba (Y)" value={layout.yMm} onChange={(v) => set("yMm", v)} step={0.5} />
            <Field label="Lado del QR" value={layout.sizeMm} onChange={(v) => set("sizeMm", v)} step={0.5} min={5} />
            <Field
              label="Página del fondo"
              value={layout.qrPage}
              onChange={(v) => set("qrPage", Math.round(v))}
              step={1}
              min={1}
            />
            <Field
              label="Margen blanco (módulos)"
              value={layout.quietModules}
              onChange={(v) => set("quietModules", Math.round(v))}
              step={1}
              min={0}
              max={8}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={layout.whiteBackdrop}
                onChange={(event) => set("whiteBackdrop", event.target.checked)}
              />
              Recuadro blanco detrás del QR
            </label>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="previewId">
                  Previsualizar el QR nº
                </label>
                <input
                  id="previewId"
                  className="input"
                  value={previewId}
                  onChange={(event) => setPreviewId(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNonce((n) => n + 1)}
              >
                Refrescar
              </button>
            </div>

            <button type="button" className="btn btn-primary" onClick={saveLayout} disabled={busy}>
              Guardar posición
            </button>

            {message ? (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {message}
              </p>
            ) : null}
          </div>

          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--line)", background: "var(--surface-2)", minHeight: 520 }}
          >
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Preview de la placa"
              className="h-[560px] w-full"
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">3 · Generar el lote</h2>
        <p className="mt-1 text-sm text-ink-2">
          Vacío = todos los QR. Hasta 1000 placas por tanda; para más, pedilas por rango.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className="label" htmlFor="from">
              Desde #
            </label>
            <input
              id="from"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value.replace(/\D/g, ""))}
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div className="w-28">
            <label className="label" htmlFor="to">
              Hasta #
            </label>
            <input
              id="to"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value.replace(/\D/g, ""))}
              placeholder="100"
              inputMode="numeric"
            />
          </div>
          <a className="btn btn-primary" href={generateUrl(false)}>
            Descargar PDF único
          </a>
          <a className="btn btn-secondary" href={generateUrl(true)}>
            ZIP con un PDF por placa
          </a>
        </div>

        <p className="mt-3 text-xs text-ink-3">
          El PDF sale vectorial: el QR se dibuja como figuras, no como imagen, así que imprime
          nítido a cualquier tamaño.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}
