"use client";

/**
 * "Aplana" el PDF de un diseño antes de subirlo: cada página se dibuja como
 * una sola imagen de alta resolución, con la medida exacta del diseño. Así
 * la imprenta no necesita ninguna tipografía (sus máquinas no reconocen las
 * de Canva) y lo que en Canva era vector sale nítido igual.
 *
 * Corre en el navegador: pdf.js dibuja la página y pdf-lib arma el PDF
 * nuevo. El QR y el número los agrega después el servidor, en vector, así
 * que no pasan por acá.
 *
 * Lo que no puede hacer es mejorar una imagen que ya viene borrosa: para eso
 * el diseño tiene que salir de Canva como "PDF para imprimir".
 */

const MM_POR_PT = 25.4 / 72;
export const DPI_APLANADO = 400;
/** Vercel no acepta subidas de más de 4,5 MB: se deja margen. */
const TOPE_BYTES = 4 * 1024 * 1024;

export type Medida = { widthMm: number; heightMm: number };

export async function aplanarPdf(datos: ArrayBuffer, medida?: Medida | null): Promise<Uint8Array> {
  const [pdfjs, { PDFDocument }] = await Promise.all([import("pdfjs-dist"), import("pdf-lib")]);
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: new Uint8Array(datos.slice(0)) }).promise;
  try {
    // Cada página se dibuja una sola vez; si el archivo queda pesado, se
    // vuelve a comprimir con menos calidad, no a dibujar.
    const lienzos: { canvas: HTMLCanvasElement; anchoPt: number; altoPt: number }[] = [];
    for (let numero = 1; numero <= doc.numPages; numero++) {
      const pagina = await doc.getPage(numero);
      const base = pagina.getViewport({ scale: 1 });
      const anchoMm = medida?.widthMm ?? base.width * MM_POR_PT;
      const altoMm = medida?.heightMm ?? base.height * MM_POR_PT;
      const ancho = Math.round((anchoMm / 25.4) * DPI_APLANADO);
      const alto = Math.round((altoMm / 25.4) * DPI_APLANADO);

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("El navegador no pudo dibujar el diseño.");
      // Fondo blanco: lo transparente se imprime en blanco.
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, ancho, alto);
      // Si la medida pedida no tiene las mismas proporciones, se centra sin
      // estirar (igual que el ajuste de medida del servidor).
      const escala = Math.min(ancho / base.width, alto / base.height);
      const viewport = pagina.getViewport({ scale: escala });
      await pagina.render({
        canvasContext: contexto,
        viewport,
        transform: [1, 0, 0, 1, (ancho - viewport.width) / 2, (alto - viewport.height) / 2],
      }).promise;
      lienzos.push({ canvas, anchoPt: anchoMm / MM_POR_PT, altoPt: altoMm / MM_POR_PT });
    }

    for (const calidad of [0.92, 0.85, 0.75]) {
      const salida = await PDFDocument.create();
      for (const { canvas, anchoPt, altoPt } of lienzos) {
        const jpg = await new Promise<Blob>((listo, error) =>
          canvas.toBlob((blob) => (blob ? listo(blob) : error(new Error("No pude comprimir la imagen."))), "image/jpeg", calidad),
        );
        const imagen = await salida.embedJpg(await jpg.arrayBuffer());
        const pagina = salida.addPage([anchoPt, altoPt]);
        pagina.drawImage(imagen, { x: 0, y: 0, width: anchoPt, height: altoPt });
      }
      const bytes = await salida.save();
      if (bytes.length <= TOPE_BYTES || calidad === 0.75) return bytes;
    }
    throw new Error("No pude aplanar el diseño.");
  } finally {
    await doc.destroy();
  }
}
