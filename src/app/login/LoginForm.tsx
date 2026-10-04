"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { login, loginConGoogle, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

function BotonGoogle() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-secondary w-full gap-2.5"
      disabled={pending}
    >
      <LogoGoogle />
      {pending ? "Yendo a Google…" : "Continuar con Google"}
    </button>
  );
}

/** El logo oficial de cuatro colores, como pide Google para estos botones. */
function LogoGoogle() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export default function LoginForm({
  next,
  conGoogle,
  errorInicial,
}: {
  next: string;
  conGoogle: boolean;
  errorInicial: string | null;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {
    error: null,
  });
  const [errorGoogle, setErrorGoogle] = useState<string | null>(errorInicial);

  // Segun como falle, Supabase puede mandar el motivo despues de un "#" en la
  // direccion, que el servidor nunca ve. Se lee aca para no mostrar un error
  // generico cuando el motivo es que esa cuenta no tiene acceso.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const motivo =
      `${hash.get("error_code") ?? ""} ${hash.get("error_description") ?? ""}`.toLowerCase();
    if (!motivo.trim()) return;
    setErrorGoogle(
      /signup|not allowed/.test(motivo)
        ? "Esa cuenta de Google no tiene acceso a este panel. Si debería tenerlo, pedile al dueño que la dé de alta."
        : "No se pudo entrar con Google. Probá de nuevo, o entrá con tu mail y contraseña.",
    );
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }, []);

  const error = state.error ?? errorGoogle;

  return (
    <div className="flex flex-col gap-4">
      {conGoogle ? (
        <>
          <form action={loginConGoogle}>
            <input type="hidden" name="next" value={next} />
            <BotonGoogle />
          </form>

          <div
            className="flex items-center gap-3 text-xs text-ink-3"
            aria-hidden="true"
          >
            <span
              className="h-px flex-1"
              style={{ background: "var(--line)" }}
            />
            o con tu mail
            <span
              className="h-px flex-1"
              style={{ background: "var(--line)" }}
            />
          </div>
        </>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="input"
            placeholder="vos@toqa.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {error}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </div>
  );
}
