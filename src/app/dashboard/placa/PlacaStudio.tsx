"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectQrInPdf } from "@/lib/detect-qr";
import { suggestedSizeMm } from "@/lib/page-size";
import { numberDefaults, type PlacaLayout } from "@/lib/placa";

import { PdfPreview } from "./PdfPreview";

export type Design = {
  id: number;
  name: string;
  background_name: string | null;
  page_width_mm: number | null;
  page_height_mm: number | null;
  page_count: number | null;
  layout: PlacaLayout;
};

type Note = { kind: "ok" | "error" | "info"; text: string } | null;

export function PlacaStudio({
  initialDesigns,
  defaultDestination,
}: {
  initialDesigns: Design[];
  defaultDestination: string;
}) {
  const [designs, setDesigns] = useState(initialDesigns);
  const [selectedId, setSelectedId] = useState<number | null>(initialDesigns[0]?.id ?? null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const selected = designs.find((d) => d.id === selectedId) ?? null;

  const patchDesign = useCallback((id: number, patch: Partial<Design>) => {
    setDesigns((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <NewDesign
        busy={busy}
        setBusy={setBusy}
        setNote={setNote}
        onCreated={(design) => {
          setDesigns((list) => [...list, design]);
          setSelectedId(design.id);
        }}
        onDetected={patchDesign}
      />

      {note ? <Banner note={note} /> : null}

      {designs.length > 0 ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Tus diseños</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {designs.map((design) => (
              <button
                key={design.id}
                type="button"
                onClick={() => setSelectedId(design.id)}
                className={design.id === selectedId ? "btn btn-primary" : "btn btn-secondary"}
              >
                {design.name}
                <span className="ml-1 text-xs opacity-70">
                  {design.page_width_mm} × {design.page_height_mm} mm
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <DesignEditor
          key={selected.id}
          design={selected}
          busy={busy}
          setBusy={setBusy}
          setNote={setNote}
          onChange={(layout) => patchDesign(selected.id, { layout })}
          onRenamed={(name) => patchDesign(selected.id, { name })}
          onDeleted={() => {
            setDesigns((list) => list.filter((d) => d.id !== selected.id));
            setSelectedId((current) =>
              current === selected.id ? (designs.find((d) => d.id !== selected.id)?.id ?? null) : current,
            );
          }}
        />
      ) : null}

      {designs.length > 0 ? (
        <GeneratePanel designs={designs} defaultDestination={defaultDestination} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ nuevo */

function NewDesign({
  busy,
  setBusy,
  setNote,
  onCreated,
  onDetected,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNote: (n: Note) => void;
  onCreated: (design: Design) => void;
  onDetected: (id: number, patch: Partial<Design>) => void;
}) {
  const [name, setName] = useState("");
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const [objetivo, setObjetivo] = useState<{ w: string; h: string }>({ w: "", h: "" });
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Al elegir el archivo miramos cuánto mide, antes de subir nada. */
  const inspeccionar = async () => {
    const file = fileRef.current?.files?.[0];
    setMedida(null);
    setAviso(null);
    setObjetivo({ w: "", h: "" });
    if (!file) return;

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const view = (await doc.getPage(1)).getViewport({ scale: 1 });
      await doc.destroy();

      const w = Math.round((view.width * 25.4) / 72 * 10) / 10;
      const h = Math.round((view.height * 25.4) / 72 * 10) / 10;
      setMedida({ w, h });

      const sug = suggestedSizeMm(w, h);
      if (sug) {
        setObjetivo({ w: String(sug.widthMm), h: String(sug.heightMm) });
        setAviso(
          `Ojo: el archivo dice medir ${w} × ${h} mm, o sea que impreso saldría enorme. ` +
            `Parece un diseño de ${sug.widthMm} × ${sug.heightMm} mm exportado en píxeles (a ${sug.dpi} dpi). ` +
            `Lo ajusto a esa medida al subirlo; cambiá los números si no es la correcta.`,
        );
      }
    } catch {
      // Si no se puede leer, el servidor igual valida el PDF al subirlo.
    }
  };

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!name.trim() || !file) {
      setNote({ kind: "error", text: "Necesito un nombre y el PDF del diseño." });
      return;
    }

    setBusy(true);
    setNote({ kind: "info", text: "Subiendo el diseño…" });

    try {
      const body = new FormData();
      body.append("name", name.trim());
      body.append("file", file);
      if (objetivo.w && objetivo.h) {
        body.append("width_mm", objetivo.w);
        body.append("height_mm", objetivo.h);
      }

      const response = await fetch("/api/placa/designs", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        setNote({ kind: "error", text: payload.error ?? "No pude guardar el diseño." });
        return;
      }

      const design: Design = payload.design;
      onCreated(design);
      setName("");
      setMedida(null);
      setAviso(null);
      setObjetivo({ w: "", h: "" });
      if (fileRef.current) fileRef.current.value = "";

      const ajuste = payload.normalizado
        ? ` Ajusté la página de ${payload.normalizado.from} a ${payload.normalizado.to}.`
        : "";

      // Buscamos el QR sobre el archivo YA GUARDADO, no sobre el que eligió el
      // usuario: si hubo que ajustar el tamaño de la página, las coordenadas
      // tienen que salir de la versión ajustada.
      setNote({ kind: "info", text: "Buscando el QR dentro del diseño…" });
      const guardado = await fetch(`/api/placa/designs/${design.id}/file`);
      const detection = guardado.ok ? await detectQrInPdf(await guardado.arrayBuffer()) : null;

      if (!detection) {
        setNote({
          kind: "info",
          text: `“${design.name}” quedó cargado.${ajuste} No encontré un QR adentro: ubicalo a mano abajo, o volvé a exportar el diseño con el QR de ejemplo puesto y usá “Detectar el QR automáticamente”.`,
        });
        return;
      }

      const layout: PlacaLayout = {
        ...design.layout,
        qrPage: detection.page,
        xMm: detection.xMm,
        yMm: detection.yMm,
        sizeMm: detection.sizeMm,
        // El número acompaña el tamaño del QR de cada diseño.
        ...numberDefaults(detection.xMm, detection.yMm, detection.sizeMm, detection.freeBandYMm, detection.sampleNumber),
      };

      await fetch(`/api/placa/designs/${design.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });

      onDetected(design.id, { layout });
      setNote({
        kind: "ok",
        text:
          `Listo: encontré el QR en la página ${detection.page}, a ${detection.xMm} mm del borde izquierdo ` +
          `y ${detection.yMm} mm del superior, de ${detection.sizeMm} mm de lado.${ajuste} Ya quedó guardado.`,
      });
    } catch (error) {
      setNote({ kind: "error", text: `Algo falló: ${(error as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Agregar un diseño</h2>
      <p className="mt-1 text-sm text-ink-2">
        Exportá el diseño de Canva en PDF <strong>con el QR y el número de ejemplo puestos</strong>:
        los uso para saber exactamente dónde van, y después los reemplazo por los reales de cada
        placa.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="design-name">
            Nombre
          </label>
          <input
            id="design-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Google Reseñas, Instagram, WhatsApp…"
          />
        </div>
        <div>
          <label className="label" htmlFor="design-file">
            PDF del diseño
          </label>
          <input
            id="design-file"
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={() => void inspeccionar()}
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1 file:text-sm file:text-[var(--ink-1)]"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Procesando…" : "Agregar"}
        </button>
      </div>

      {medida ? (
        <p className="mt-3 text-sm text-ink-2">
          El archivo mide <strong>{medida.w} × {medida.h} mm</strong>.
        </p>
      ) : null}

      {aviso ? (
        <div
          className="mt-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <p>{aviso}</p>
          <div className="mt-2 flex items-end gap-2">
            <div className="w-24">
              <label className="label" htmlFor="obj-w">
                Ancho mm
              </label>
              <input
                id="obj-w"
                className="input"
                value={objetivo.w}
                onChange={(e) => setObjetivo((o) => ({ ...o, w: e.target.value.replace(/[^\d.]/g, "") }))}
                inputMode="decimal"
              />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="obj-h">
                Alto mm
              </label>
              <input
                id="obj-h"
                className="input"
                value={objetivo.h}
                onChange={(e) => setObjetivo((o) => ({ ...o, h: e.target.value.replace(/[^\d.]/g, "") }))}
                inputMode="decimal"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => { setObjetivo({ w: "", h: "" }); setAviso(null); }}
            >
              Dejarlo como está
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- editor */

function DesignEditor({
  design,
  busy,
  setBusy,
  setNote,
  onChange,
  onRenamed,
  onDeleted,
}: {
  design: Design;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNote: (n: Note) => void;
  onChange: (layout: PlacaLayout) => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const [layout, setLayout] = useState<PlacaLayout>(design.layout);
  const [previewId, setPreviewId] = useState("1");
  const [nonce, setNonce] = useState(0);
  const [name, setName] = useState(design.name);

  // Cuando la detección automática guarda una posición nueva, los campos
  // tienen que mostrarla: si no, seguirían con los valores por defecto.
  useEffect(() => {
    setLayout(design.layout);
    setName(design.name);
  }, [design.layout, design.name]);

  const [debounced, setDebounced] = useState(layout);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(layout), 450);
    return () => clearTimeout(timer);
  }, [layout]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      design: String(design.id),
      id: previewId || "1",
      qrPage: String(debounced.qrPage),
      xMm: String(debounced.xMm),
      yMm: String(debounced.yMm),
      sizeMm: String(debounced.sizeMm),
      quietModules: String(debounced.quietModules),
      whiteBackdrop: String(debounced.whiteBackdrop),
      showNumber: String(debounced.showNumber),
      numberSizeMm: String(debounced.numberSizeMm),
      numberXMm: String(debounced.numberXMm),
      numberYMm: String(debounced.numberYMm),
      numberBackdrop: String(debounced.numberBackdrop),
      v: String(nonce),
    });
    return `/api/placa/preview?${params}`;
  }, [design.id, debounced, previewId, nonce]);

  const set = <K extends keyof PlacaLayout>(key: K, value: PlacaLayout[K]) =>
    setLayout((current) => ({ ...current, [key]: value }));

  const redetect = async () => {
    setBusy(true);
    setNote({ kind: "info", text: "Buscando el QR dentro del diseño…" });
    try {
      const response = await fetch(`/api/placa/designs/${design.id}/file`);
      if (!response.ok) {
        setNote({ kind: "error", text: "Ese diseño no tiene el PDF guardado." });
        return;
      }
      const detection = await detectQrInPdf(await response.arrayBuffer());
      if (!detection) {
        setNote({
          kind: "error",
          text: "No encontré ningún QR en el diseño. Exportalo de Canva con el QR de ejemplo puesto, o ubicalo a mano.",
        });
        return;
      }
      const next: PlacaLayout = {
        ...layout,
        qrPage: detection.page,
        xMm: detection.xMm,
        yMm: detection.yMm,
        sizeMm: detection.sizeMm,
        ...numberDefaults(detection.xMm, detection.yMm, detection.sizeMm, detection.freeBandYMm, detection.sampleNumber),
      };
      setLayout(next);
      setNote({
        kind: "ok",
        text: `Encontrado: página ${detection.page}, X ${detection.xMm} mm, Y ${detection.yMm} mm, lado ${detection.sizeMm} mm. Tocá “Guardar” para fijarlo.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/placa/designs/${design.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote({ kind: "error", text: payload.error ?? "No pude guardar." });
        return;
      }
      onChange(layout);
      onRenamed(name);
      setNote({ kind: "ok", text: "Diseño guardado." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el diseño “${design.name}”?\n\nLos QR ya creados no se borran, sólo quedan sin diseño asignado.`)) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/placa/designs/${design.id}`, { method: "DELETE" });
      onDeleted();
      setNote({ kind: "ok", text: "Diseño borrado." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="rename">
            Diseño
          </label>
          <input
            id="rename"
            className="input max-w-xs"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <p className="text-xs text-ink-3">
          {design.background_name} · {design.page_count} pág. · {design.page_width_mm} ×{" "}
          {design.page_height_mm} mm
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-3">
          <button type="button" className="btn btn-secondary" onClick={redetect} disabled={busy}>
            Detectar el QR automáticamente
          </button>

          <Field label="Izquierda (X) mm" value={layout.xMm} onChange={(v) => set("xMm", v)} step={0.5} />
          <Field label="Arriba (Y) mm" value={layout.yMm} onChange={(v) => set("yMm", v)} step={0.5} />
          <Field label="Lado del QR (parte negra) mm" value={layout.sizeMm} onChange={(v) => set("sizeMm", v)} step={0.5} min={5} />
          <Field label="Página del fondo" value={layout.qrPage} onChange={(v) => set("qrPage", Math.round(v))} step={1} min={1} />
          <Field label="Margen blanco (módulos)" value={layout.quietModules} onChange={(v) => set("quietModules", Math.round(v))} step={1} min={0} max={8} />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={layout.whiteBackdrop}
              onChange={(event) => set("whiteBackdrop", event.target.checked)}
            />
            Recuadro blanco detrás del QR
          </label>
          <p className="-mt-1 text-xs text-ink-3">
            Dejalo tildado: es lo que tapa el QR viejo del diseño.
          </p>

          <div
            className="mt-1 flex flex-col gap-3 rounded-lg p-3"
            style={{ background: "var(--surface-2)" }}
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={layout.showNumber}
                onChange={(event) => set("showNumber", event.target.checked)}
              />
              Imprimir el número debajo
            </label>
            <p className="-mt-2 text-xs text-ink-3">
              El número de la placa (0001, 0002…) para poder identificarla después.
            </p>

            {layout.showNumber ? (
              <>
                <Field
                  label="Altura del número mm"
                  value={layout.numberSizeMm}
                  onChange={(v) => set("numberSizeMm", v)}
                  step={0.5}
                  min={1}
                />
                <Field
                  label="Número · izquierda (X) mm"
                  value={layout.numberXMm}
                  onChange={(v) => set("numberXMm", v)}
                  step={0.5}
                />
                <Field
                  label="Número · arriba (Y) mm"
                  value={layout.numberYMm}
                  onChange={(v) => set("numberYMm", v)}
                  step={0.5}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={layout.numberBackdrop}
                    onChange={(event) => set("numberBackdrop", event.target.checked)}
                  />
                  Recuadro blanco detrás del número
                </label>
                <p className="-mt-1 text-xs text-ink-3">
                  X es el <em>centro</em> del número. Arranca debajo del QR; movelo si ahí el
                  diseño ya tiene texto.
                </p>
              </>
            ) : null}
          </div>

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
            <button type="button" className="btn btn-secondary" onClick={() => setNonce((n) => n + 1)}>
              Refrescar
            </button>
          </div>

          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Guardar
          </button>
          <button type="button" className="btn btn-danger text-xs" onClick={remove} disabled={busy}>
            Borrar diseño
          </button>
        </div>

        <PdfPreview url={previewUrl} page={debounced.qrPage} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- generar */

function GeneratePanel({
  designs,
  defaultDestination,
}: {
  designs: Design[];
  defaultDestination: string;
}) {
  const [modo, setModo] = useState<"nuevas" | "existentes">("nuevas");
  const [designId, setDesignId] = useState<string>(String(designs[0]?.id ?? ""));
  const [count, setCount] = useState("100");
  const [destination, setDestination] = useState(defaultDestination);
  const [labelPrefix, setLabelPrefix] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangoDesign, setRangoDesign] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const crear = async (zip: boolean) => {
    setBusy(true);
    setNote({ kind: "info", text: "Creando los QR y armando las placas…" });

    try {
      const response = await fetch("/api/placa/create-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(count),
          designId: Number(designId),
          destination,
          labelPrefix,
          zip,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setNote({ kind: "error", text: payload.error ?? "No pude generar el lote." });
        return;
      }

      const desde = response.headers.get("X-Qr-From");
      const hasta = response.headers.get("X-Qr-To");
      const total = response.headers.get("X-Qr-Count");

      descargar(
        await response.blob(),
        response.headers.get("Content-Disposition"),
        zip ? "placas.zip" : "placas.pdf",
      );

      setNote({
        kind: "ok",
        text: `Listo: ${total} QR nuevos (#${desde} al #${hasta}) y su PDF descargado. Ya los ves en la pestaña QRs, con sus estadísticas.`,
      });
    } catch (error) {
      setNote({ kind: "error", text: `Algo falló: ${(error as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const urlExistentes = (zip: boolean) => {
    const params = new URLSearchParams();
    if (rangoDesign) params.set("design", rangoDesign);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (zip) params.set("zip", "1");
    const suffix = params.toString();
    return `/api/placa/generate${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Generar placas</h2>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={modo === "nuevas" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setModo("nuevas")}
        >
          Crear QR nuevos
        </button>
        <button
          type="button"
          className={modo === "existentes" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setModo("existentes")}
        >
          Reimprimir QR que ya tengo
        </button>
      </div>

      {modo === "nuevas" ? (
        <>
          <p className="mt-3 text-sm text-ink-2">
            Decís cuántas querés y de qué diseño. Se crean los QR —numerados a continuación de los
            que ya existen, cada uno distinto— y se descarga el PDF listo para imprenta.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr_1fr_1fr]">
            <div>
              <label className="label" htmlFor="gen-count">
                Cantidad
              </label>
              <input
                id="gen-count"
                className="input"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="100"
              />
            </div>
            <div>
              <label className="label" htmlFor="gen-design-new">
                Diseño
              </label>
              <select
                id="gen-design-new"
                className="input"
                value={designId}
                onChange={(e) => setDesignId(e.target.value)}
              >
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gen-dest">
                Destino inicial
              </label>
              <input
                id="gen-dest"
                className="input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="gen-prefix">
                Etiqueta <span className="font-normal text-ink-3">(opcional)</span>
              </label>
              <input
                id="gen-prefix"
                className="input"
                value={labelPrefix}
                onChange={(e) => setLabelPrefix(e.target.value)}
                placeholder="Mesa, Cliente X…"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => crear(false)}
              disabled={busy || !designId || !count}
            >
              {busy ? "Generando…" : `Crear ${count || "0"} y descargar el PDF`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => crear(true)}
              disabled={busy || !designId || !count}
            >
              Crear y bajar un PDF por placa (ZIP)
            </button>
          </div>

          <p className="mt-3 text-xs text-ink-3">
            El destino se puede cambiar después, uno por uno o de a varios, sin volver a imprimir
            nada. Hasta 1000 por tanda.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink-2">
            Vuelve a generar las placas de QR que ya existen, por ejemplo si se perdió el archivo o
            se arruinó una impresión. No crea números nuevos.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <label className="label" htmlFor="gen-design-old">
                Diseño
              </label>
              <select
                id="gen-design-old"
                className="input"
                value={rangoDesign}
                onChange={(e) => setRangoDesign(e.target.value)}
              >
                <option value="">El de cada QR</option>
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="label" htmlFor="gen-from">
                Desde #
              </label>
              <input id="gen-from" className="input" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} placeholder="1" inputMode="numeric" />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="gen-to">
                Hasta #
              </label>
              <input id="gen-to" className="input" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} placeholder="100" inputMode="numeric" />
            </div>
            <a className="btn btn-primary" href={urlExistentes(false)}>
              Descargar PDF único
            </a>
            <a className="btn btn-secondary" href={urlExistentes(true)}>
              ZIP por placa
            </a>
          </div>
        </>
      )}

      {note ? <div className="mt-3"><Banner note={note} /></div> : null}

      <p className="mt-3 text-xs text-ink-3">
        El PDF sale vectorial: el QR se dibuja como figuras, no como imagen, así que imprime nítido
        a cualquier tamaño.
      </p>
    </div>
  );
}

/** Dispara la descarga de lo que devolvió el servidor. */
function descargar(blob: Blob, disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? fallback;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- comunes */

function Banner({ note }: { note: NonNullable<Note> }) {
  const style =
    note.kind === "error"
      ? { background: "var(--danger-soft)", color: "var(--danger)" }
      : note.kind === "ok"
        ? { background: "var(--accent-soft)", color: "var(--accent)" }
        : { background: "var(--surface-2)", color: "var(--ink-2)" };

  return (
    <p role="status" className="rounded-lg px-3 py-2 text-sm" style={style}>
      {note.text}
    </p>
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
