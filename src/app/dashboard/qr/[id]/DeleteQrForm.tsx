"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { deleteQrCode } from "../../actions";
import { Feedback } from "../../_components/Feedback";
import { SubmitButton } from "../../_components/SubmitButton";

export function DeleteQrForm({ id, code }: { id: number; code: string }) {
  const [state, formAction] = useActionState(deleteQrCode, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const ok = window.confirm(
          `¿Borrar el QR #${code}?\n\nSi hay placas impresas con este QR, van a quedar sin destino mientras esté borrado.\n\n` +
            "Queda 30 días en la papelera (en Historial), con sus escaneos, por si hay que recuperarlo. " +
            "Después se elimina para siempre.",
        );
        if (!ok) event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Feedback state={state} />
      <SubmitButton pendingLabel="Borrando…" className="btn btn-danger self-start text-xs">
        Borrar este QR
      </SubmitButton>
    </form>
  );
}
