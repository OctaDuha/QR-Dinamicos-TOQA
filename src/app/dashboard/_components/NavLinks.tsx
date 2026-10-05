"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/dashboard", label: "QRs" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/placa", label: "Placas" },
  { href: "/dashboard/canva", label: "Canva" },
];

const SOLO_DUENO = [
  { href: "/dashboard/historial", label: "Historial" },
  { href: "/dashboard/usuarios", label: "Usuarios" },
];

/** Navegacion de la barra de marca, con la seccion actual marcada. */
export function NavLinks({ esDueno }: { esDueno: boolean }) {
  const pathname = usePathname();
  const secciones = esDueno ? [...SECCIONES, ...SOLO_DUENO] : SECCIONES;

  return (
    <nav className="order-last flex w-full flex-wrap items-center gap-x-1 gap-y-3 sm:order-none sm:w-auto">
      {secciones.map((seccion) => {
        const activa =
          seccion.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/dashboard/qr")
            : pathname.startsWith(seccion.href);

        return (
          <Link
            key={seccion.href}
            href={seccion.href}
            className="nav-link"
            aria-current={activa ? "page" : undefined}
          >
            {seccion.label}
          </Link>
        );
      })}
    </nav>
  );
}
