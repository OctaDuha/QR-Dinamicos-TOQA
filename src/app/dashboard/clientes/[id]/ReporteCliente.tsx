"use client";

import { useState } from "react";

import { BotonesReporte } from "../../_components/BotonesReporte";

/** El reporte de todas las placas del cliente juntas, entre dos fechas. */
export function ReporteCliente({ clienteId, desde, hasta }: { clienteId: number; desde: string; hasta: string }) {
  const [rango, setRango] = useState({ desde, hasta });

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
      <p className="text-xs text-ink-2">
        Reporte de todas sus placas juntas: una imagen lista para mandarle por WhatsApp.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Desde
          <input
            type="date"
            value={rango.desde}
            onChange={(e) => e.target.value && setRango((r) => ({ ...r, desde: e.target.value }))}
            className="input py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Hasta
          <input
            type="date"
            value={rango.hasta}
            onChange={(e) => e.target.value && setRango((r) => ({ ...r, hasta: e.target.value }))}
            className="input py-1 text-sm"
          />
        </label>
      </div>
      <BotonesReporte pedido={{ cliente: String(clienteId), desde: rango.desde, hasta: rango.hasta }} />
    </div>
  );
}
