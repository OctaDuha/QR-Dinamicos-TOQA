"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { Feedback } from "../_components/Feedback";
import { SubmitButton } from "../_components/SubmitButton";
import { agregarPlacas, borrarCliente, crearCliente, editarCliente, quitarPlaca } from "./actions";

type Datos = { id: number; nombre: string; contacto: string | null; notas: string | null; telefonos: string[] };

/** Alta y edición comparten los campos; con `cliente` edita, sin él crea. */
export function ClienteForm({ cliente }: { cliente?: Datos }) {
  const [state, formAction] = useActionState(cliente ? editarCliente : crearCliente, IDLE);
  const sufijo = cliente ? `-${cliente.id}` : "-nuevo";
  // Si algo falló, vuelve lo que la persona había escrito, no lo guardado.
  const valor = (campo: string, guardado: string) => state.campos?.[campo] ?? guardado;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}
      <div>
        <label className="label" htmlFor={`nombre${sufijo}`}>
          Negocio
        </label>
        <input
          id={`nombre${sufijo}`}
          name="nombre"
          className="input"
          required
          defaultValue={valor("nombre", cliente?.nombre ?? "")}
          placeholder="Ej: Bar Centro"
        />
      </div>
      <div>
        <label className="label" htmlFor={`contacto${sufijo}`}>
          Persona de contacto
        </label>
        <input
          id={`contacto${sufijo}`}
          name="contacto"
          className="input"
          defaultValue={valor("contacto", cliente?.contacto ?? "")}
          placeholder="Ej: Juan Pérez"
        />
      </div>
      <div>
        <label className="label" htmlFor={`telefonos${sufijo}`}>
          WhatsApp
        </label>
        <textarea
          id={`telefonos${sufijo}`}
          name="telefonos"
          className="input min-h-[4.5rem]"
          defaultValue={valor("telefonos", cliente?.telefonos.join("\n") ?? "")}
          placeholder={"11 1234-5678\n351 15 612-3456"}
        />
        <p className="mt-1.5 text-xs text-ink-3">
          Uno por renglón, con código de área. Si tiene varios (el dueño, el encargado), poné todos.
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`notas${sufijo}`}>
          Notas
        </label>
        <textarea
          id={`notas${sufijo}`}
          name="notas"
          className="input min-h-[3rem]"
          defaultValue={valor("notas", cliente?.notas ?? "")}
          placeholder="Dirección, qué contrató, lo que te sirva recordar"
        />
      </div>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Guardando…" className="btn btn-primary self-start">
        {cliente ? "Guardar cambios" : "Crear cliente"}
      </SubmitButton>
    </form>
  );
}

export function AgregarPlacasForm({ clienteId }: { clienteId: number }) {
  const [state, formAction] = useActionState(agregarPlacas, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <label className="label" htmlFor="numeros">
        Agregar placas
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="numeros"
          name="numeros"
          defaultValue={state.campos?.numeros ?? ""}
          className="input max-w-xs flex-1"
          placeholder="Ej: 41, 43-45"
          required
        />
        <SubmitButton pendingLabel="Agregando…" className="btn btn-secondary">
          Agregar
        </SubmitButton>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-2">
        <input type="checkbox" name="pasar" value="si" />
        Si alguna ya es de otro cliente, pasarla a este
      </label>
      <Feedback state={state} />
    </form>
  );
}

export function QuitarPlacaBoton({ clienteId, qrId, numero }: { clienteId: number; qrId: number; numero: string }) {
  const [state, formAction] = useActionState(quitarPlaca, IDLE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="qr_id" value={qrId} />
      <SubmitButton pendingLabel="Quitando…" className="btn btn-ghost text-xs">
        <span className="sr-only">Quitar la {numero} de este cliente</span>
        <span aria-hidden="true">Quitar</span>
      </SubmitButton>
      {state.message && !state.ok ? <Feedback state={state} /> : null}
    </form>
  );
}

export function BorrarClienteForm({ id, nombre, placas }: { id: number; nombre: string; placas: number }) {
  const [state, formAction] = useActionState(borrarCliente, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const ok = window.confirm(
          `¿Borrar el cliente "${nombre}"?\n\n` +
            (placas > 0
              ? `Sus ${placas === 1 ? "placa no se toca" : `${placas} placas no se tocan`}: siguen funcionando igual, solo quedan sin cliente.`
              : "No tiene placas asignadas."),
        );
        if (!ok) event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Feedback state={state} />
      <SubmitButton pendingLabel="Borrando…" className="btn btn-danger self-start text-xs">
        Borrar este cliente
      </SubmitButton>
    </form>
  );
}
