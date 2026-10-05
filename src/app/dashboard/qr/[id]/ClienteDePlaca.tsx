"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { IDLE } from "@/lib/action-state";

import { elegirClienteDePlaca } from "../../clientes/actions";
import { Feedback } from "../../_components/Feedback";

export function ClienteDePlaca({
  qrId,
  clienteId,
  clientes,
}: {
  qrId: number;
  clienteId: number | null;
  clientes: { id: number; nombre: string }[];
}) {
  const [state, formAction, guardando] = useActionState(elegirClienteDePlaca, IDLE);
  const [elegido, setElegido] = useState(clienteId === null ? "" : String(clienteId));

  return (
    // Se envía a mano y no con action={...}: así React no reinicia el
    // formulario al terminar, que dejaba el select mostrando el cliente que
    // tenía al abrir la página aunque se hubiera guardado otro.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const datos = new FormData(event.currentTarget);
        startTransition(() => formAction(datos));
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="qr_id" value={qrId} />
      <div className="flex items-baseline justify-between gap-3">
        <label className="label" htmlFor="cliente_id">
          Cliente
        </label>
        {clienteId ? (
          <Link href={`/dashboard/clientes/${clienteId}`} className="text-xs text-ink-2 hover:underline">
            Ver cliente
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          id="cliente_id"
          name="cliente_id"
          value={elegido}
          onChange={(event) => setElegido(event.target.value)}
          className="input max-w-xs flex-1"
        >
          <option value="">Sin cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {clientes.length === 0 ? (
        <p className="text-xs text-ink-3">
          Todavía no cargaste clientes. <Link href="/dashboard/clientes" className="underline">Crear uno</Link>
        </p>
      ) : null}
      <Feedback state={state} />
    </form>
  );
}
