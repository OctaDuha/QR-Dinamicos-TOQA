"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { updateQrCode } from "../../actions";
import { Feedback } from "../../_components/Feedback";
import { SubmitButton } from "../../_components/SubmitButton";

export function EditQrForm({
  id,
  label,
  destinationUrl,
}: {
  id: number;
  label: string | null;
  destinationUrl: string;
}) {
  const [state, formAction] = useActionState(updateQrCode, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <div>
        <label className="label" htmlFor="label">
          Etiqueta
        </label>
        <input
          id="label"
          name="label"
          className="input"
          defaultValue={label ?? ""}
          placeholder="Ej: Mesa 4, Cliente Panadería X"
        />
      </div>

      <div>
        <label className="label" htmlFor="destination_url">
          Destino actual
        </label>
        <input
          id="destination_url"
          name="destination_url"
          className="input"
          defaultValue={destinationUrl}
          required
        />
        <p className="mt-1.5 text-xs text-ink-3">
          Se aplica al instante en todas las placas que ya tengan este QR impreso.
        </p>
      </div>

      <Feedback state={state} />

      <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}
