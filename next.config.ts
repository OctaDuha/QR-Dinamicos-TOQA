import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La imagen del reporte lee las letras del disco: así viajan con las rutas
  // que la dibujan cuando Vercel las publica.
  outputFileTracingIncludes: {
    "/api/estadisticas/imagen": ["./src/assets/fuentes/*"],
    "/api/whatsapp": ["./src/assets/fuentes/*"],
  },
};

export default nextConfig;
