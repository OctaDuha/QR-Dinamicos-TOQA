"use client";

import type { ActionState } from "@/lib/action-state";

export function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      role="status"
      className="rounded-lg px-3 py-2 text-sm"
      style={
        state.ok
          ? { background: "var(--accent-soft)", color: "var(--accent)" }
          : { background: "var(--danger-soft)", color: "var(--danger)" }
      }
    >
      {state.message}
    </p>
  );
}
