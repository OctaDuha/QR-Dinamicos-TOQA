"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DPI_APLANADO, aplanarPdf } from "@/lib/aplanar-pdf";
import { detectarCirculo } from "@/lib/detect-circulo";
import { detectQrInPdf } from "@/lib/detect-qr";
import { DEMASIA_MM, FRANJA_MM, SANGRADO_MM, esCircular, escalaVinilo, suggestedSizeMm } from "@/lib/page-size";
import { numberDefaults, type PlacaLayout } from "@/lib/placa-layout";

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
  puedeBorrar,
}: {
  initialDesigns: Design[];
  defaultDestination: string;
  puedeBorrar: boolean;
}) {
  const router = useRouter();
  const [designs, setDesigns] = useState(initialDesigns);
  const [selectedId, setSelectedId] = useState<number | null>(initialDesigns[0]?.id ?? null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const selected = designs.find((d) => d.id === selectedId) ?? null;

  const patchDesign = useCallback((id: number, patch: Partial<Design>) => {
    setDesigns((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  // Los vinilos de 10x10 cargados antes de que existiera el ajuste circular
  // todavía no tienen medido su círculo: se mide una vez y queda guardado.
  useEffect(() => {
    const pendientes = initialDesigns.filter(
      (d) => esCircular(d.page_width_mm, d.page_height_mm) && d.layout.circuloMm == null,
    );
    if (pendientes.length === 0) return;
    let cancelado = false;
    (async () => {
      for (const design of pendientes) {
        try {
          const archivo = await fetch(`/api/placa/designs/${design.id}/file`);
          if (!archivo.ok || cancelado) continue;
          const circulo = await detectarCirculo(await archivo.arrayBuffer(), design.layout.qrPage);
          if (!circulo || cancelado) continue;
          const layout = { ...design.layout, circuloMm: circulo };
          const guardado = await fetch(`/api/placa/designs/${design.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layout }),
          });
          if (guardado.ok && !cancelado) patchDesign(design.id, { layout });
        } catch {
          // Si falla, queda el círculo que entra justo en la página.
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [initialDesigns, patchDesign]);

  return (
    <div className="flex flex-col gap-5">
      <NewDesign
        busy={busy}
        setBusy={setBusy}
        setNote={setNote}
        onCreated={(design) => {
          setDesigns((list) => [...list, design]);
          setSelectedId(design.id);
          // El cartel de "antes de imprimir" lo arma el servidor: sin esto
          // seguiria diciendo que no hay ningun diseño cargado.
          router.refresh();
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
          onFondo={(patch) => patchDesign(selected.id, patch)}
          puedeBorrar={puedeBorrar}
          onDeleted={() => {
            setDesigns((list) => list.filter((d) => d.id !== selected.id));
            router.refresh();
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
  const [aplanar, setAplanar] = useState(true);
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

    try {
      let subir: Blob = file;
      if (aplanar) {
        setNote({ kind: "info", text: "Aplanando el diseño para imprenta…" });
        // Se aplana ya con la medida final: si Canva exportó en píxeles, la
        // imagen sale directamente en milímetros de verdad.
        const final =
          objetivo.w && objetivo.h
            ? { widthMm: Number(objetivo.w), heightMm: Number(objetivo.h) }
            : medida
              ? { widthMm: medida.w, heightMm: medida.h }
              : null;
        subir = new Blob([(await aplanarPdf(await file.arrayBuffer(), final)) as BlobPart], { type: "application/pdf" });
      }
      setNote({ kind: "info", text: "Subiendo el diseño…" });

      const body = new FormData();
      body.append("name", name.trim());
      body.append("file", subir, file.name);
      if (objetivo.w && objetivo.h) {
        body.append("width_mm", objetivo.w);
        body.append("height_mm", objetivo.h);
      }

      const response = await fetch("/api/placa/designs", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote({
          kind: "error",
          text:
            payload.error ??
            (response.status === 413
              ? "El PDF es muy pesado para subirlo. Tildá “Aplanar para imprenta” y probá de nuevo."
              : "No pude guardar el diseño."),
        });
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
      const archivo = guardado.ok ? await guardado.arrayBuffer() : null;
      // pdf.js se queda con el buffer que recibe: cada búsqueda lleva su copia.
      const detection = archivo ? await detectQrInPdf(archivo.slice(0)) : null;

      // Los diseños cuadrados son vinilos circulares: además se mide el
      // círculo de color, para llevarlo al tamaño justo.
      const circular = esCircular(design.page_width_mm, design.page_height_mm);
      const corte = archivo && circular ? await detectarCirculo(archivo.slice(0), detection?.page ?? 1).catch(() => null) : null;
      const textoCorte = circular
        ? ` Es un vinilo circular: sale de ${design.page_width_mm} mm con una franja blanca de ${FRANJA_MM} mm.`
        : "";

      if (corte && !detection) {
        const conCorte: PlacaLayout = { ...design.layout, circuloMm: corte };
        await fetch(`/api/placa/designs/${design.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: conCorte }),
        });
        onDetected(design.id, { layout: conCorte });
      }

      if (!detection) {
        setNote({
          kind: "info",
          text: `“${design.name}” quedó cargado.${ajuste}${textoCorte} No encontré un QR adentro: ubicalo a mano abajo, o volvé a exportar el diseño con el QR de ejemplo puesto y usá “Detectar el QR automáticamente”.`,
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
        ...(corte ? { circuloMm: corte } : {}),
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
          `y ${detection.yMm} mm del superior, de ${detection.sizeMm} mm de lado.${ajuste}${textoCorte} Ya quedó guardado.`,
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
        Exportá el diseño de Canva como <strong>“PDF para imprimir”</strong>, con el QR y el número
        de ejemplo puestos: los uso para saber exactamente dónde van, y después los reemplazo por los
        reales de cada placa.
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

      <CasillaAplanar valor={aplanar} cambiar={setAplanar} id="aplanar-nuevo" />

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
  onFondo,
  onDeleted,
  puedeBorrar,
}: {
  design: Design;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNote: (n: Note) => void;
  onChange: (layout: PlacaLayout) => void;
  onRenamed: (name: string) => void;
  onFondo: (patch: Partial<Design>) => void;
  onDeleted: () => void;
  puedeBorrar: boolean;
}) {
  const [layout, setLayout] = useState<PlacaLayout>(design.layout);
  const [previewId, setPreviewId] = useState("1");
  const [nonce, setNonce] = useState(0);
  const [name, setName] = useState(design.name);
  const circular = esCircular(design.page_width_mm, design.page_height_mm);
  const ladoMm = design.page_width_mm ?? 100;
  const reemplazoRef = useRef<HTMLInputElement>(null);
  const [aplanarReemplazo, setAplanarReemplazo] = useState(true);

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
      ...(debounced.circuloMm != null ? { circuloMm: String(debounced.circuloMm) } : {}),
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
      const archivo = await response.arrayBuffer();
      const detection = await detectQrInPdf(archivo.slice(0));
      const corte = circular ? await detectarCirculo(archivo.slice(0), detection?.page ?? layout.qrPage).catch(() => null) : null;
      if (corte) set("circuloMm", corte);
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
        ...(corte ? { circuloMm: corte } : {}),
      };
      setLayout(next);
      setNote({
        kind: "ok",
        text:
          `Encontrado: página ${detection.page}, X ${detection.xMm} mm, Y ${detection.yMm} mm, lado ${detection.sizeMm} mm.` +
          `${corte ? ` Círculo del diseño: ${corte} mm.` : ""} Tocá “Guardar” para fijarlo.`,
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

  /** Cambia el PDF de fondo por una versión nueva del mismo diseño. */
  const reemplazar = async () => {
    const file = reemplazoRef.current?.files?.[0];
    if (!file) {
      setNote({ kind: "error", text: "Elegí el PDF nuevo del diseño." });
      return;
    }
    setBusy(true);
    try {
      let subir: Blob = file;
      if (aplanarReemplazo) {
        setNote({ kind: "info", text: "Aplanando el diseño para imprenta…" });
        const medida =
          design.page_width_mm && design.page_height_mm
            ? { widthMm: design.page_width_mm, heightMm: design.page_height_mm }
            : null;
        subir = new Blob([(await aplanarPdf(await file.arrayBuffer(), medida)) as BlobPart], { type: "application/pdf" });
      }
      setNote({ kind: "info", text: "Subiendo el PDF nuevo…" });
      const body = new FormData();
      body.append("file", subir, file.name);
      const response = await fetch(`/api/placa/designs/${design.id}/file`, { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote({
          kind: "error",
          text:
            payload.error ??
            (response.status === 413
              ? "El PDF es muy pesado para subirlo. Tildá “Aplanar para imprenta” y probá de nuevo."
              : "No pude reemplazar el PDF."),
        });
        return;
      }
      onFondo({ background_name: payload.background_name, page_count: payload.page_count });

      // En los vinilos se vuelve a medir el círculo sobre el PDF nuevo.
      if (circular) {
        const guardado = await fetch(`/api/placa/designs/${design.id}/file`);
        const corte = guardado.ok
          ? await detectarCirculo(await guardado.arrayBuffer(), design.layout.qrPage).catch(() => null)
          : null;
        if (corte) {
          const conCorte: PlacaLayout = { ...design.layout, circuloMm: corte };
          await fetch(`/api/placa/designs/${design.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layout: conCorte }),
          });
          onChange(conCorte);
        }
      }

      if (reemplazoRef.current) reemplazoRef.current.value = "";
      setNonce((n) => n + 1);
      setNote({
        kind: "ok",
        text:
          `Listo: “${design.name}” ya usa el PDF nuevo.${payload.ajustado ? " Lo ajusté a la medida del diseño." : ""} ` +
          "Los números ya asignados y la posición del QR siguen igual. Revisá la vista previa: si algo quedó corrido, " +
          "tocá “Detectar el QR automáticamente”.",
      });
    } catch (error) {
      setNote({ kind: "error", text: `Algo falló: ${(error as Error).message}` });
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

      <details className="mt-4 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
        <summary className="cursor-pointer text-sm font-medium">Reemplazar el PDF del diseño</summary>
        <p className="mt-2 text-xs text-ink-3">
          Para cambiar el fondo por una versión nueva del mismo diseño, por ejemplo exportada de Canva como
          “PDF para imprimir”. Los números ya asignados y la posición del QR y del número se mantienen.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={reemplazoRef}
            type="file"
            accept="application/pdf,.pdf"
            aria-label="PDF nuevo del diseño"
            className="input max-w-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-3 file:py-1 file:text-sm file:text-[var(--ink-1)]"
          />
          <button type="button" className="btn btn-secondary" onClick={reemplazar} disabled={busy}>
            Reemplazar
          </button>
        </div>
        <CasillaAplanar valor={aplanarReemplazo} cambiar={setAplanarReemplazo} id={`aplanar-${design.id}`} />
      </details>

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

          {circular ? (
            <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-sm font-medium">Vinilo circular de {ladoMm / 10} cm</p>
              <p className="text-xs text-ink-3">
                Todos salen del mismo tamaño, con una franja blanca de {FRANJA_MM} mm alrededor y la
                línea de corte (CutContour). El diseño se ajusta solo para que entre justo.
              </p>
              <Field
                label="Círculo de color del diseño mm"
                value={layout.circuloMm ?? ladoMm - 2 * FRANJA_MM}
                onChange={(v) => set("circuloMm", v)}
                step={0.1}
                min={10}
              />
              <p className="text-xs text-ink-3">
                Se mide solo. Cambialo únicamente si la franja blanca no queda pareja.
              </p>
            </div>
          ) : null}

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
                Muestra con el nº
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

          <p className="text-xs text-ink-3">
            Esto es sólo una simulación para ver dónde cae el QR en el diseño, y por eso arranca
            siempre en el mismo número. Las placas de verdad llevan cada una un número distinto, que
            no se repite nunca ni entre diseños.
          </p>

          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Guardar
          </button>
          {puedeBorrar ? (
            <button type="button" className="btn btn-danger text-xs" onClick={remove} disabled={busy}>
              Borrar diseño
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <PdfPreview
            url={previewUrl}
            page={debounced.qrPage}
            // Un pelo adentro del corte, para no mostrar la línea magenta.
            circulo={circular ? (ladoMm - 0.3) / (ladoMm + 2 * SANGRADO_MM) : undefined}
            margen={
              circular
                ? undefined
                : {
                    x: (DEMASIA_MM + 0.6) / ((design.page_width_mm ?? 100) + 2 * DEMASIA_MM),
                    y: (DEMASIA_MM + 0.6) / ((design.page_height_mm ?? 150) + 2 * DEMASIA_MM),
                  }
            }
          />
          {circular ? (
            <AvisoBorde layout={layout} lado={ladoMm} />
          ) : (
            <p className="text-xs text-ink-3">
              Así queda la placa una vez cortada. El PDF para la imprenta lleva {DEMASIA_MM} mm en blanco alrededor y
              la línea de corte (CutContour).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** La casilla para aplanar el PDF al subirlo, con su explicación. */
function CasillaAplanar({ valor, cambiar, id }: { valor: boolean; cambiar: (v: boolean) => void; id: string }) {
  return (
    <div className="mt-3">
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input id={id} type="checkbox" checked={valor} onChange={(event) => cambiar(event.target.checked)} />
        Aplanar para imprenta (recomendado)
      </label>
      <p className="mt-1 text-xs text-ink-3">
        Convierte el diseño en una imagen de {DPI_APLANADO} dpi con su medida exacta: la imprenta ya no necesita
        las tipografías de Canva. El QR y el número se agregan aparte, en vector. Para que los logos salgan nítidos,
        exportá de Canva como “PDF para imprimir”.
      </p>
    </div>
  );
}

/**
 * En un vinilo circular, el QR y el número tienen que quedar lejos del corte:
 * si el plotter se corre un poco, no puede llevarse un pedazo del QR.
 */
function AvisoBorde({ layout, lado }: { layout: PlacaLayout; lado: number }) {
  const centro = lado / 2;
  const radio = lado / 2 - 3;
  // El diseño se escala desde el centro: las distancias, también.
  const escala = escalaVinilo(lado, layout.circuloMm);
  const lejos = (x: number, y: number) => Math.hypot(x - centro, y - centro) * escala;
  const esquinas = [
    [layout.xMm, layout.yMm],
    [layout.xMm + layout.sizeMm, layout.yMm],
    [layout.xMm, layout.yMm + layout.sizeMm],
    [layout.xMm + layout.sizeMm, layout.yMm + layout.sizeMm],
  ];
  const qrAfuera = esquinas.some(([x, y]) => lejos(x, y) > radio);
  const numeroAfuera = layout.showNumber && lejos(layout.numberXMm, layout.numberYMm + layout.numberSizeMm) > radio;

  if (!qrAfuera && !numeroAfuera) {
    return <p className="text-xs text-ink-3">Así queda el vinilo una vez cortado.</p>;
  }
  return (
    <p className="text-xs font-medium text-danger">
      Ojo: {qrAfuera ? "el QR" : "el número"} queda a menos de 3 mm del corte. Movelo hacia el centro para que
      el plotter no se lleve un pedazo.
    </p>
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
