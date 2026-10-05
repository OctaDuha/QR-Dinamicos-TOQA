import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La imagen del reporte lee las letras del disco: así viajan con la ruta
  // cuando Vercel la publica.
  outputFileTracingIncludes: {
    "/api/estadisticas/imagen": ["./src/assets/fuentes/*"],
  },
};

export default nextConfig;
