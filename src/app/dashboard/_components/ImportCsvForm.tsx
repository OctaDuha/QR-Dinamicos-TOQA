"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { importQrCsv } from "../actions";
import { Feedback } from "./Feedback";
import { SubmitButton } from "./SubmitButton";

export function ImportCsvForm() {
  const [state, formAction] = useActionState(importQrCsv, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">
        Importa el CSV de la herramienta vieja <strong>conservando los mismos números</strong>, que
        es lo que mantiene vivas las placas ya impresas. Si un número ya existe, se pisa su destino.
      </p>
      <p className="text-xs text-ink-3">
        Columnas: <code>numero</code> (o <code>id</code> / <code>qr_code</code>) y{" "}
        <code>destino_actual</code> (o <code>destino</code> / <code>destination_url</code>).{" "}
        <code>label</code> es opcional.
      </p>

      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="input file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1 file:text-sm file:text-[var(--ink-1)]"
      />

      <Feedback state={state} />

      <SubmitButton pendingLabel="Importando…" className="btn btn-secondary self-start">
        Importar CSV
      </SubmitButton>
    </form>
  );
}
