"use client";

import Link from "next/link";
import { useState } from "react";

import { EditQrForm } from "../../qr/[id]/EditQrForm";
import { QuitarPlacaBoton } from "../Formularios";

/** Una placa en la ficha del cliente, con su configuración a mano. */
export function PlacaDelCliente({
  clienteId,
  placa,
  numero,
}: {
  clienteId: number;
  placa: { id: number; label: string | null; destination_url: string; total_scans: number };
  numero: string;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <li className="border-t py-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link
              href={`/dashboard/qr/${placa.id}`}
              className="numero-placa font-mono font-semibold no-underline hover:underline"
            >
              {numero}
            </Link>
            <span className="text-ink-1"> · {placa.label ?? <span className="text-ink-3">sin etiqueta</span>}</span>
          </p>
          <p className="truncate text-xs text-ink-2" title={placa.destination_url}>
            {placa.destination_url}
          </p>
          <p className="text-xs text-ink-3">
            {Number(placa.total_scans) === 1 ? "1 escaneo" : `${placa.total_scans} escaneos`}
          </p>
        </div>
        <div className="flex items-start gap-1">
          <button
            type="button"
            className={editando ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}
            aria-expanded={editando}
            onClick={() => setEditando((abierto) => !abierto)}
          >
            {editando ? "Cerrar" : "Editar"}
          </button>
          <Link href={`/dashboard/qr/${placa.id}`} className="btn btn-ghost text-xs">
            Estadísticas
          </Link>
          <QuitarPlacaBoton clienteId={clienteId} qrId={placa.id} numero={numero} />
        </div>
      </div>
      {editando ? (
        <div className="mt-3 rounded-lg p-4" style={{ background: "var(--surface-2)" }}>
          <EditQrForm id={placa.id} label={placa.label} destinationUrl={placa.destination_url} compacto />
        </div>
      ) : null}
    </li>
  );
}
