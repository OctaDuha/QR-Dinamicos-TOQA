"use client";

import { useState } from "react";

import { PdfPreview } from "../../placa/PdfPreview";

export type DesignOption = { id: number; name: string; qrPage: number };

/**
 * La placa de ESTE QR: el diseño con su código ya puesto, tal como sale a
 * imprenta, y el boton para bajarla suelta. Tambien permite cambiarle el
 * diseno asignado.
 */
export function PlacaCard({
  qrId,
  designs,
  initialDesignId,
}: {
  qrId: number;
  designs: DesignOption[];
  initialDesignId: number | null;
}) {
  const [designId, setDesignId] = useState<string>(
    initialDesignId ? String(initialDesignId) : String(designs[0]?.id ?? ""),
  );
  const [asignado, setAsignado] = useState<number | null>(initialDesignId);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  const design = designs.find((d) => String(d.id) === designId);
  const guardado = asignado !== null && String(asignado) === designId;

  if (designs.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold">Placa para imprenta</h2>
        <p className="mt-2 text-sm text-ink-2">
          Todavía no cargaste ningún diseño. Subí el PDF que exportaste de Canva en la pestaña{" "}
          <strong>Placas</strong> y acá vas a ver esta placa lista para imprimir.
        </p>
      </div>
    );
  }

  const asignar = async () => {
    setBusy(true);
    setNota(null);
    try {
      const response = await fetch(`/api/qr/${qrId}/design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: Number(designId) }),
      });
      if (response.ok) {
        setAsignado(Number(designId));
        setNota(`Listo: este QR queda guardado con el diseño “${design?.name ?? ""}”.`);
      } else {
        setNota("No pude guardar el diseño.");
      }
    } finally {
      setBusy(false);
    }
  };

  const bajar = async () => {
    setBusy(true);
    setNota(null);
    try {
      const response = await fetch("/api/placa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [qrId], design: Number(designId) }),
      });
      if (!response.ok) {
        setNota(await response.text());
        return;
      }
      const blob = await response.blob();
      const nombre =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "placa.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Placa para imprenta</h2>
          <p className="mt-1 text-xs text-ink-3">
            {guardado
              ? "El diseño con este QR ya puesto, tal cual sale impreso."
              : "Este QR todavía no tiene un diseño guardado: elegí uno y guardalo para que salga solo en los lotes."}
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-[170px]">
            <label className="label" htmlFor="placa-design">
              Diseño
            </label>
            <select
              id="placa-design"
              className="input"
              value={designId}
              onChange={(event) => setDesignId(event.target.value)}
              disabled={busy}
            >
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {guardado ? null : (
            <button type="button" className="btn btn-secondary" onClick={asignar} disabled={busy}>
              Guardar como diseño de este QR
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={bajar} disabled={busy}>
            {busy ? "…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      {nota ? (
        <p
          className="mt-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {nota}
        </p>
      ) : null}

      <div className="mt-4">
        <PdfPreview
          url={`/api/placa/preview?design=${designId}&id=${qrId}`}
          page={design?.qrPage ?? 1}
        />
      </div>
    </div>
  );
}
