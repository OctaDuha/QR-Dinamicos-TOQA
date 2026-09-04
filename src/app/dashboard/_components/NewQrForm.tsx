"use client";

import { useActionState } from "react";

import { createQrCodes, IDLE } from "../actions";
import { Feedback } from "./Feedback";
import { SubmitButton } from "./SubmitButton";

export type DesignOption = { id: number; name: string };

export function NewQrForm({
  defaultDestination,
  designs,
}: {
  defaultDestination: string;
  designs: DesignOption[];
}) {
  const [state, formAction] = useActionState(createQrCodes, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr_170px]">
        <div>
          <label className="label" htmlFor="count">
            Cantidad
          </label>
          <input
            id="count"
            name="count"
            type="number"
            min={1}
            max={2000}
            defaultValue={1}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="label_prefix">
            Etiqueta <span className="font-normal text-ink-3">(opcional)</span>
          </label>
          <input
            id="label_prefix"
            name="label_prefix"
            className="input"
            placeholder="Ej: Mesa, Cliente Panadería X"
          />
        </div>
        <div>
          <label className="label" htmlFor="destination_url">
            Destino inicial
          </label>
          <input
            id="destination_url"
            name="destination_url"
            className="input"
            defaultValue={defaultDestination}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="design_id">
            Diseño
          </label>
          <select id="design_id" name="design_id" className="input" disabled={designs.length === 0}>
            <option value="">
              {designs.length === 0 ? "Todavía no hay diseños" : "Sin asignar"}
            </option>
            {designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Feedback state={state} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Creando…">Crear QR</SubmitButton>
        <p className="text-xs text-ink-3">
          Se numeran solos y siguen la numeración existente. El destino se puede cambiar cuando
          quieras.
        </p>
      </div>
    </form>
  );
}
