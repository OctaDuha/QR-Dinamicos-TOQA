"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectQrInPdf } from "@/lib/detect-qr";
import type { PlacaLayout } from "@/lib/placa";

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

export function PlacaStudio({ initialDesigns }: { initialDesigns: Design[] }) {
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

      {designs.length > 0 ? <GeneratePanel designs={designs} /> : null}
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
  const fileRef = useRef<HTMLInputElement>(null);

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

      const response = await fetch("/api/placa/designs", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        setNote({ kind: "error", text: payload.error ?? "No pude guardar el diseño." });
        return;
      }

      const design: Design = payload.design;
      onCreated(design);
      setName("");
      if (fileRef.current) fileRef.current.value = "";

      // Lo interesante: buscamos el QR de ejemplo dentro del diseño.
      setNote({ kind: "info", text: "Buscando el QR dentro del diseño…" });
      const detection = await detectQrInPdf(await file.arrayBuffer());

      if (!detection) {
        setNote({
          kind: "info",
          text: `“${design.name}” quedó cargado, pero no encontré un QR adentro. Ubicalo a mano abajo, o volvé a exportar el diseño con el QR de ejemplo puesto y usá “Detectar de nuevo”.`,
        });
        return;
      }

      const layout: PlacaLayout = {
        ...design.layout,
        qrPage: detection.page,
        xMm: detection.xMm,
        yMm: detection.yMm,
        sizeMm: detection.sizeMm,
      };

      await fetch(`/api/placa/designs/${design.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });

      onDetected(design.id, { layout });
      setNote({
        kind: "ok",
        text: `Listo: encontré el QR en la página ${detection.page}, a ${detection.xMm} mm del borde izquierdo y ${detection.yMm} mm del superior, de ${detection.sizeMm} mm de lado. Ya quedó guardado.`,
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
        Exportá el diseño de Canva en PDF <strong>con el QR de ejemplo puesto</strong>: lo uso para
        saber exactamente dónde va el QR, y después lo tapo con el dinámico.
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
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1 file:text-sm file:text-[var(--ink-1)]"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Procesando…" : "Agregar"}
        </button>
      </div>
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

function GeneratePanel({ designs }: { designs: Design[] }) {
  const [designId, setDesignId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const url = (zip: boolean) => {
    const params = new URLSearchParams();
    if (designId) params.set("design", designId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (zip) params.set("zip", "1");
    const suffix = params.toString();
    return `/api/placa/generate${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Generar el lote</h2>
      <p className="mt-1 text-sm text-ink-2">
        Hasta 1000 placas por tanda. Si dejás el diseño en “el de cada QR”, cada placa sale con el
        diseño que le asignaste al crearla.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[190px]">
          <label className="label" htmlFor="gen-design">
            Diseño
          </label>
          <select
            id="gen-design"
            className="input"
            value={designId}
            onChange={(event) => setDesignId(event.target.value)}
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
        <a className="btn btn-primary" href={url(false)}>
          Descargar PDF único
        </a>
        <a className="btn btn-secondary" href={url(true)}>
          ZIP con un PDF por placa
        </a>
      </div>

      <p className="mt-3 text-xs text-ink-3">
        El PDF sale vectorial: el QR se dibuja como figuras, no como imagen, así que imprime nítido
        a cualquier tamaño.
      </p>
    </div>
  );
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
