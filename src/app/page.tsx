import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { Inicio } from "./Inicio";

export const metadata: Metadata = {
  title: "TOQA · Un toque. Una acción.",
  description:
    "Placas y productos con código QR y chip NFC para tu negocio: reseñas de Google, Instagram, WhatsApp, menú y mucho más.",
  // La página pública sí se puede encontrar en buscadores; el panel no.
  robots: { index: true, follow: true },
  openGraph: {
    title: "TOQA · Un toque. Una acción.",
    description:
      "Placas y productos con código QR y chip NFC para tu negocio: reseñas de Google, Instagram, WhatsApp, menú y mucho más.",
    images: ["/marca/toqa-logo.jpg"],
  },
};

/** Quien está logueado va directo al panel; cualquier otro ve la página de TOQA. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");
  return <Inicio />;
}
