// El detector de QR usa pdf.js en el navegador, y pdf.js necesita su worker
// servido como archivo estatico. Lo copiamos a /public en cada install/build.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

try {
  const pdfjs = dirname(require.resolve("pdfjs-dist/package.json"));
  mkdirSync("public", { recursive: true });
  copyFileSync(join(pdfjs, "legacy/build/pdf.worker.min.mjs"), "public/pdf.worker.min.mjs");
  console.log("pdf.worker.min.mjs copiado a public/");
} catch (error) {
  console.warn("No pude copiar el worker de pdf.js:", error.message);
  process.exitCode = 0; // no romper el build por esto
}
