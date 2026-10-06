"use client";

import { startTransition, useActionState, useState } from "react";

import { IDLE } from "@/lib/action-state";
import { LARGO_MAXIMO, TEXTOS, type ClaveTexto } from "@/lib/bot-textos";

import { Feedback } from "../_components/Feedback";
import { guardarTextos } from "./actions";

/** Los textos que manda el bot, para cambiarlos sin tocar el código. */
export function TextosBot({ actuales }: { actuales: Record<ClaveTexto, string> }) {
  const [state, formAction, guardando] = useActionState(guardarTextos, IDLE);
  const [valores, setValores] = useState(actuales);

  return (
    <form
      // A mano y no con action={...}: así no se vacía lo escrito al guardar.
      onSubmit={(event) => {
        event.preventDefault();
        const datos = new FormData(event.currentTarget);
        startTransition(() => formAction(datos));
      }}
      className="flex flex-col gap-4"
    >
      {TEXTOS.map(({ clave, titulo, ayuda, porDefecto }) => (
        <div key={clave}>
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor={`texto-${clave}`}>
              {titulo}
            </label>
            {valores[clave] !== porDefecto ? (
              <button
                type="button"
                className="text-xs text-ink-3 hover:underline"
                onClick={() => setValores((v) => ({ ...v, [clave]: porDefecto }))}
              >
                Volver al de siempre
              </button>
            ) : null}
          </div>
          <textarea
            id={`texto-${clave}`}
            name={clave}
            className="input min-h-[5rem]"
            maxLength={LARGO_MAXIMO}
            value={valores[clave]}
            onChange={(event) => setValores((v) => ({ ...v, [clave]: event.target.value }))}
          />
          <p className="mt-1 text-xs text-ink-3">{ayuda}</p>
        </div>
      ))}
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary self-start" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar textos"}
      </button>
    </form>
  );
}
