"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Usuario = {
  id: string;
  email: string | null;
  rol: "dueno" | "empleado";
  creado_en: string;
};

/** Listado de quienes entran al panel, con el selector de rol. */
export function ListaUsuarios({ usuarios, yo }: { usuarios: Usuario[]; yo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [nota, setNota] = useState<{ malo: boolean; texto: string } | null>(null);

  const cambiar = async (id: string, rol: string) => {
    setBusy(id);
    setNota(null);
    try {
      const response = await fetch("/api/usuarios/rol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, rol }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        setNota({ malo: false, texto: "Rol actualizado." });
        router.refresh();
      } else {
        setNota({ malo: true, texto: payload.error ?? "No pude cambiar el rol." });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
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

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr
              className="text-left text-xs tracking-wide text-ink-2 uppercase"
              style={{ background: "var(--surface-2)" }}
            >
              <th className="px-4 py-2.5 font-semibold">Usuario</th>
              <th className="w-48 px-4 py-2.5 font-semibold">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => {
              const soyYo = usuario.id === yo;
              return (
                <tr key={usuario.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-3">
                    {usuario.email ?? <span className="text-ink-3">sin email</span>}
                    {soyYo ? <span className="chip ml-2">vos</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {soyYo ? (
                      // Bajarse el propio rol dejaria la cuenta sin nadie que
                      // pueda borrar ni repartir permisos.
                      <span className="text-ink-2">Dueño</span>
                    ) : (
                      <select
                        className="input"
                        value={usuario.rol}
                        disabled={busy === usuario.id}
                        onChange={(event) => void cambiar(usuario.id, event.target.value)}
                        aria-label={`Rol de ${usuario.email ?? usuario.id}`}
                      >
                        <option value="empleado">Empleado</option>
                        <option value="dueno">Dueño</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
