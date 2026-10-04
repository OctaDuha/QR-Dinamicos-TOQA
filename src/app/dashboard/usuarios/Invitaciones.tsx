"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Invitacion = { email: string; rol: "dueno" | "empleado"; creado_en: string };

/** Invitar por mail, y las invitaciones que todavía nadie usó. */
export function Invitaciones({ invitaciones }: { invitaciones: Invitacion[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"empleado" | "dueno">("empleado");
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState<{ malo: boolean; texto: string } | null>(null);

  const llamar = async (metodo: "POST" | "DELETE", cuerpo: object) => {
    setBusy(true);
    setNota(null);
    try {
      const response = await fetch("/api/usuarios/invitar", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setNota({
          malo: true,
          texto: response.status === 401 ? "Tu sesión se cerró (por ejemplo, si saliste del panel en otra ventana). Recargá la página y volvé a entrar." : (payload.error ?? "No se pudo."),
        });
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const invitar = async (event: React.FormEvent) => {
    event.preventDefault();
    const mail = email.trim().toLowerCase();
    if (await llamar("POST", { email: mail, rol })) {
      setEmail("");
      setNota({
        malo: false,
        texto: `Listo. Decile a ${mail} que entre a toqaqr.com.ar/login con "Continuar con Google".`,
      });
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Invitar a alguien</h2>
        <p className="mt-1 text-sm text-ink-2">
          Escribí el mail de su cuenta de Google. Cuando entre con "Continuar con Google" ya va a
          tener acceso, sin ningún otro paso. Nadie que no esté invitado puede crearse una cuenta.
        </p>
      </div>

      <form onSubmit={invitar} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-3" htmlFor="invitar-email">
          Mail de Google
          <input
            id="invitar-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@gmail.com"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3" htmlFor="invitar-rol">
          Rol
          <select
            id="invitar-rol"
            className="input"
            value={rol}
            onChange={(event) => setRol(event.target.value as "empleado" | "dueno")}
          >
            <option value="empleado">Equipo</option>
            <option value="dueno">Dueño</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Invitando…" : "Invitar"}
        </button>
      </form>

      {nota ? (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            background: nota.malo ? "var(--danger-soft)" : "var(--accent-soft)",
            color: nota.malo ? "var(--danger)" : "var(--accent)",
          }}
        >
          {nota.texto}
        </p>
      ) : null}

      {invitaciones.length > 0 ? (
        <div>
          <p className="label">Invitados que todavía no entraron</p>
          <ul className="flex flex-col">
            {invitaciones.map((invitacion) => (
              <li
                key={invitacion.email}
                className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="min-w-0 break-all">
                  {invitacion.email}{" "}
                  <span className="text-ink-3">
                    · {invitacion.rol === "dueno" ? "Dueño" : "Equipo"}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={busy}
                  onClick={() => void llamar("DELETE", { email: invitacion.email })}
                >
                  Cancelar invitación
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
