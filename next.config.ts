import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La imagen del reporte y el número de las placas (en curvas) leen las
  // letras del disco: así viajan con las rutas que las usan cuando Vercel
  // las publica.
  outputFileTracingIncludes: {
    "/api/estadisticas/imagen": ["./src/assets/fuentes/*"],
    "/api/whatsapp": ["./src/assets/fuentes/*"],
    "/api/placa/preview": ["./src/assets/fuentes/*"],
    "/api/placa/generate": ["./src/assets/fuentes/*"],
    "/api/placa/create-batch": ["./src/assets/fuentes/*"],
  },
};

export default nextConfig;
