"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Usuario = {
  id: string;
  email: string | null;
  rol: "dueno" | "empleado" | "pendiente";
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
        setNota({
          malo: false,
          texto: rol === "pendiente" ? "Listo: esa cuenta ya no tiene acceso." : "Rol actualizado.",
        });
        router.refresh();
      } else {
        setNota({ malo: true, texto: payload.error ?? "No pude cambiar el rol." });
      }
    } finally {
      setBusy(null);
    }
  };

  const pendientes = usuarios.filter((u) => u.rol === "pendiente" && u.id !== yo).length;

  return (
    <div className="flex flex-col gap-3">
      {pendientes > 0 ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--brand-2-soft)", color: "var(--brand-2-ink)" }}
        >
          {pendientes === 1
            ? "Hay 1 cuenta esperando que la apruebes."
            : `Hay ${pendientes} cuentas esperando que las apruebes.`}{" "}
          Si no sabés de quién es, dejala como está: sin acceso no puede ver ni tocar nada.
        </p>
      ) : null}

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
                    {!soyYo && usuario.rol === "pendiente" ? (
                      <span
                        className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{ background: "var(--brand-2-soft)", color: "var(--brand-2-ink)" }}
                      >
                        esperando aprobación
                      </span>
                    ) : null}
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
                        <option value="pendiente">Sin acceso</option>
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
