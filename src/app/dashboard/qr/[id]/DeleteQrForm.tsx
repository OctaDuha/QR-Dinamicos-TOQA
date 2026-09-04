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
          `¿Borrar el QR #${code} y todos sus escaneos?\n\nSi hay placas impresas con este QR, van a quedar sin destino.`,
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
