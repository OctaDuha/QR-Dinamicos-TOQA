"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { IDLE } from "@/lib/action-state";

import { updateQrCode } from "../../actions";
import { Feedback } from "../../_components/Feedback";

export type ClienteOpcion = { id: number; nombre: string; contacto: string | null; telefonos: string[] };

/**
 * Configurar una placa: etiqueta, destino y, si se pasa `clientes`, de quién
 * es. Con `clientes` sin definir (por ejemplo, dentro de la ficha de un
 * cliente, o sin la migración de clientes) no se muestra ni se toca el cliente.
 */
export function EditQrForm({
  id,
  label,
  destinationUrl,
  cliente,
  clientes,
  compacto = false,
}: {
  id: number;
  label: string | null;
  destinationUrl: string;
  cliente?: ClienteOpcion | null;
  clientes?: ClienteOpcion[];
  compacto?: boolean;
}) {
  const [state, formAction, guardando] = useActionState(updateQrCode, IDLE);
  const sufijo = `-${id}`;

  return (
    // Se envía a mano y no con action={...}: así React no vacía el
    // formulario al terminar, y si algo falla queda lo que se escribió.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const datos = new FormData(event.currentTarget);
        startTransition(() => formAction(datos));
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={id} />

      <div>
        <label className="label" htmlFor={`label${sufijo}`}>
          Etiqueta
        </label>
        <input
          id={`label${sufijo}`}
          name="label"
          className="input"
          defaultValue={label ?? ""}
          placeholder="Ej: Mesa 4, Barra, Entrada"
        />
      </div>

      <div>
        <label className="label" htmlFor={`destination_url${sufijo}`}>
          Destino actual
        </label>
        <input
          id={`destination_url${sufijo}`}
          name="destination_url"
          className="input"
          defaultValue={destinationUrl}
          required
        />
        {compacto ? null : (
          <p className="mt-1.5 text-xs text-ink-3">
            Se aplica al instante en todas las placas que ya tengan este QR impreso.
          </p>
        )}
      </div>

      {clientes ? <CamposCliente cliente={cliente ?? null} clientes={clientes} sufijo={sufijo} /> : null}

      <Feedback state={state} />

      <button type="submit" className="btn btn-primary self-start" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function CamposCliente({
  cliente,
  clientes,
  sufijo,
}: {
  cliente: ClienteOpcion | null;
  clientes: ClienteOpcion[];
  sufijo: string;
}) {
  const [negocio, setNegocio] = useState(cliente?.nombre ?? "");
  const [contacto, setContacto] = useState(cliente?.contacto ?? "");
  const [telefonos, setTelefonos] = useState(cliente?.telefonos.join("\n") ?? "");

  const buscar = (nombre: string) =>
    clientes.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const existente = negocio.trim() ? buscar(negocio) : undefined;

  return (
    <div className="mt-1 flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <input type="hidden" name="con_cliente" value="si" />
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Cliente</p>
        {existente ? (
          <Link href={`/dashboard/clientes/${existente.id}`} className="text-xs text-ink-2 hover:underline">
            Ver cliente
          </Link>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor={`cliente_negocio${sufijo}`}>
          Negocio
        </label>
        <input
          id={`cliente_negocio${sufijo}`}
          name="cliente_negocio"
          className="input"
          list={`clientes${sufijo}`}
          autoComplete="off"
          value={negocio}
          placeholder="Ej: Bar Centro"
          onChange={(event) => {
            const valor = event.target.value;
            setNegocio(valor);
            // Si elige un cliente que ya existe, se completan sus datos.
            const elegido = buscar(valor);
            if (elegido && elegido.id !== existente?.id) {
              setContacto(elegido.contacto ?? "");
              setTelefonos(elegido.telefonos.join("\n"));
            }
          }}
        />
        <datalist id={`clientes${sufijo}`}>
          {clientes.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
        <p className="mt-1.5 text-xs text-ink-3">
          {!negocio.trim()
            ? "Vacío: la placa queda sin cliente."
            : existente
              ? "Cliente que ya existe: si cambiás su contacto o WhatsApp, cambia para todas sus placas."
              : "Cliente nuevo: se crea al guardar."}
        </p>
      </div>

      {negocio.trim() ? (
        <>
          <div>
            <label className="label" htmlFor={`cliente_contacto${sufijo}`}>
              Persona de contacto
            </label>
            <input
              id={`cliente_contacto${sufijo}`}
              name="cliente_contacto"
              className="input"
              value={contacto}
              onChange={(event) => setContacto(event.target.value)}
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <div>
            <label className="label" htmlFor={`cliente_telefonos${sufijo}`}>
              WhatsApp
            </label>
            <textarea
              id={`cliente_telefonos${sufijo}`}
              name="cliente_telefonos"
              className="input min-h-[3.5rem]"
              value={telefonos}
              onChange={(event) => setTelefonos(event.target.value)}
              placeholder="11 1234-5678"
            />
            <p className="mt-1.5 text-xs text-ink-3">Uno por renglón, con código de área.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
