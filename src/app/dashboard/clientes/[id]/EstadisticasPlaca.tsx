"use client";

import { useCallback, useEffect, useState } from "react";

import type { ScanBucket, ScanSeriesPoint } from "@/lib/types";

import { BotonesReporte } from "../../_components/BotonesReporte";
import { ScanChart } from "../../qr/[id]/ScanChart";

type Respuesta = {
  desde: string;
  hasta: string;
  bucket: ScanBucket;
  serie: ScanSeriesPoint[];
  qr: number;
  nfc: number;
  total: number;
};

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/** Las estadísticas de una placa, ahí mismo en la ficha del cliente. */
export function EstadisticasPlaca({ qrId }: { qrId: number }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(
    async (rango?: { desde: string; hasta: string }) => {
      setCargando(true);
      setError(null);
      try {
        const params = new URLSearchParams({ qr: String(qrId), ...(rango ?? {}) });
        const respuesta = await fetch(`/api/estadisticas?${params}`, { cache: "no-store" });
        const cuerpo = (await respuesta.json().catch(() => ({}))) as Respuesta & { error?: string };
        if (!respuesta.ok) {
          setError(
            respuesta.status === 401 || respuesta.status === 403
              ? "Tu sesión se cerró. Recargá la página y volvé a entrar."
              : (cuerpo.error ?? "No pude leer las estadísticas."),
          );
          return;
        }
        setDatos(cuerpo);
        setDesde(cuerpo.desde);
        setHasta(cuerpo.hasta);
      } catch {
        setError("No pude conectarme. Revisá la conexión y probá de nuevo.");
      } finally {
        setCargando(false);
      }
    },
    [qrId],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (desde && hasta) void cargar({ desde, hasta });
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Desde
          <input
            type="date"
            required
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="input py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Hasta
          <input
            type="date"
            required
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="input py-1 text-sm"
          />
        </label>
        <button type="submit" className="btn btn-secondary text-xs" disabled={cargando}>
          {cargando ? "Cargando…" : "Ver esas fechas"}
        </button>
      </form>

      {/* Lo que se descarga es lo que se está viendo, no lo que quedó escrito
          en el calendario sin tocar "Ver esas fechas". */}
      {datos && !error ? <BotonesReporte pedido={{ qr: String(qrId), desde: datos.desde, hasta: datos.hasta }} /> : null}

      {error ? (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : datos ? (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Numero titulo="Total" valor={datos.total} />
            <Numero titulo="Por QR" valor={datos.qr} />
            <Numero titulo="Por NFC" valor={datos.nfc} />
            <p className="self-end text-xs text-ink-3">
              Del {fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)}
            </p>
          </div>
          {/* El gráfico no se achica de 320 px: en un celular angosto se desliza. */}
          <div className="overflow-x-auto" style={{ opacity: cargando ? 0.5 : 1 }}>
            <ScanChart data={datos.serie} bucket={datos.bucket} />
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">Cargando…</p>
      )}
    </div>
  );
}

function Numero({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-ink-3 uppercase">{titulo}</p>
      <p className="font-mono text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
