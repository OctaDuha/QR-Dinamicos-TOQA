"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { Feedback } from "../_components/Feedback";
import { SubmitButton } from "../_components/SubmitButton";
import { recuperarPlacas } from "./actions";

export function BotonRecuperar({ ids, children }: { ids: number[]; children: React.ReactNode }) {
  const [state, formAction] = useActionState(recuperarPlacas, IDLE);

  return (
    <form action={formAction} className="mt-2 flex flex-col items-start gap-2">
      <input type="hidden" name="ids" value={ids.join(",")} />
      <SubmitButton pendingLabel="Recuperando…" className="btn btn-secondary text-xs">
        {children}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
