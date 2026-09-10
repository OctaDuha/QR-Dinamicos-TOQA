"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/dashboard", label: "QRs" },
  { href: "/dashboard/placa", label: "Placas" },
  { href: "/dashboard/canva", label: "Canva" },
];

/** Navegacion de la barra de marca, con la seccion actual marcada. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {SECCIONES.map((seccion) => {
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
