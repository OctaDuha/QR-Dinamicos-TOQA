# TOQA · QR dinámicos

Panel propio para generar y administrar QR dinámicos con estadísticas de escaneo.

El QR impreso en la placa NFC **nunca cambia**: siempre apunta a
`https://tu-dominio/r/0001`. Lo único que se edita desde el panel es a dónde
redirige esa URL.

## Qué hace

- **`/r/[id]`** — ruta pública que apuntan las placas. Registra el escaneo y
  redirige al destino actual. Corre en Edge y resuelve todo en una sola consulta.
- **`/login`** — usuario y contraseña (Supabase Auth).
- **`/dashboard`** — listado de QRs con etiqueta, destino, total de escaneos,
  búsqueda y paginado. Alta de QR sueltos o por lote, importación de CSV y
  export ZIP/CSV.
- **`/dashboard/qr/[id]`** — detalle: editar destino, descargar el PNG y gráfico
  de escaneos por día / semana / mes.
- **`/dashboard/placa`** — placas listas para imprenta: tu diseño de Canva de
  fondo y el QR estampado por código, en lote.
- **`/dashboard/canva`** — generación vía Canva Connect API (requiere Enterprise).

## Stack

| Pieza | Qué resuelve |
|---|---|
| Next.js 15 (App Router) | Frontend y backend en un solo proyecto |
| Supabase | Postgres + login con usuario/contraseña |
| Vercel | Hosting con HTTPS y dominio propio |

---

## Puesta en marcha

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pegá y ejecutá `supabase/schema.sql` entero. Es idempotente:
   se puede volver a correr sin romper nada.
3. **Authentication → Users → Add user** → creá tu usuario con email y
   contraseña. No hay registro público: los usuarios se dan de alta acá.
4. **Project Settings → API** → copiá `Project URL` y la clave `anon public`.

### 2. Variables de entorno

Copiá `.env.example` a `.env.local` (local) o cargalas en Vercel
(*Settings → Environment Variables*):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública `anon` |
| `NEXT_PUBLIC_SITE_URL` | **El dominio final.** Es lo que queda impreso en las placas |
| `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` | Opcionales, sólo para la generación en Canva |
| `CANVA_BRAND_TEMPLATE_ID` | Opcional, plantilla por defecto |

> `NEXT_PUBLIC_SITE_URL` define la URL que codifica cada QR. Si la cambiás
> después de imprimir, las placas viejas dejan de funcionar. Definila **antes**
> de mandar el primer lote a imprenta.

### 3. Local

```bash
npm install
npm run dev
```

### 4. Deploy en Vercel

1. Importá el repo desde GitHub en [vercel.com](https://vercel.com).
2. Cargá las variables de entorno.
3. Conectá el dominio en *Settings → Domains* y poné ese dominio en
   `NEXT_PUBLIC_SITE_URL`.

---

## Migración desde la herramienta vieja

Esto es lo único crítico de todo el proceso: **las placas ya impresas apuntan a
URLs con números concretos, así que los IDs se tienen que conservar.**

1. Exportá desde la herramienta vieja un CSV con todos los códigos y sus
   destinos actuales.
2. Dejalo con estas columnas (mirá `supabase/ejemplo-import.csv`):

   ```csv
   numero,destino_actual,label
   0001,https://instagram.com/toqa,Mesa 1
   ```

   También se aceptan `id` / `qr_code` para el número y
   `destino` / `destination_url` para el destino. `label` es opcional.
3. En el panel: **Importar CSV**. Los números se respetan tal cual y, si un
   número ya existía, se pisa su destino.
4. La importación reposiciona sola la secuencia de IDs, así que el próximo QR
   nuevo arranca después del último importado y nunca reusa un número.

Después de importar, verificá una placa real antes de dar de baja lo viejo.

---

## Export para imprenta

Desde el dashboard:

- **Exportar ZIP** — un PNG por QR (1024 px, listo para Canva) más `qrs.csv`.
- **Solo CSV** — el mismo CSV sin las imágenes.

Columnas del CSV, iguales a las que ya usabas en Creación masiva de Canva:

| Columna | Contenido |
|---|---|
| `numero` | `0001` |
| `qr_code` | URL pública del PNG (es el campo imagen de la plantilla) |
| `destino_actual` | A dónde redirige hoy |
| `url_qr` | La URL fija impresa en la placa |

Para lotes grandes: `/api/export/zip?from=1&to=1000` baja por tandas (el ZIP
admite hasta 1000 PNG por vez).

---

## Placas para imprenta

`/dashboard/placa` genera los diseños finales sin depender del plan de Canva:
tu diseño exportado de Canva va de **fondo vectorial** y el QR se **dibuja
encima como vectores** (rectángulos, no una imagen), así que imprime nítido a
cualquier tamaño y un lote de 1000 placas pesa poco más de un megabyte.

### Cómo se usa

1. **El fondo.** En Canva, abrí “NFC y QR”, dejá vacío el marco del QR y
   descargá *PDF para imprimir* (con marcas de recorte y sangrado si la
   imprenta lo pide). Subilo en la pantalla de Placas: queda guardado en la base
   de datos, no hace falta redesplegar.
2. **La posición.** Ajustás X, Y y tamaño en milímetros y el panel te muestra el
   **PDF real** al lado, no una aproximación. Guardás una vez y queda fijo.
3. **El lote.** Elegís el rango de números y bajás un PDF único multipágina (lo
   que suele pedir la imprenta) o un ZIP con un PDF por placa.

Si el fondo tiene varias páginas (frente y dorso), cada placa las emite todas y
el QR va sólo en la que indiques en *Página del fondo*.

> Si exportás con marcas de recorte, la página del PDF es más grande que la
> placa terminada y los milímetros se miden desde el borde del archivo, no desde
> el corte. Por eso conviene posicionar mirando el preview en vez de calcular.

Para rediseñar la placa: la cambiás en Canva, exportás de nuevo y subís el
fondo. Ni una línea de código.

## Canva Connect API (sólo Enterprise)

`/dashboard/canva` implementa la Opción A del brief —subir el QR como asset,
autofill del campo `qr_code` y export a PDF— y queda lista por si alguna vez
pasás a Enterprise.

**No funciona con Canva Business (Canva Negocios).** El gate está en un punto
preciso:

| API | Planes |
|---|---|
| Brand templates (leer plantillas y su dataset) | Pro, Business, Enterprise |
| **Autofill** (rellenar el campo y generar el diseño) | **Sólo Enterprise** |

Con Business la API responde 403 al pedir el lote. La generación de placas vive
entonces en `/dashboard/placa`, que no tiene ese límite.

Para configurarla si algún día corresponde: integración privada en
[developers.canva.com](https://www.canva.com/developers/), URL de retorno
`https://tu-dominio/api/canva/callback`, scopes `asset:read`, `asset:write`,
`brandtemplate:meta:read`, `brandtemplate:content:read`, `design:content:read`,
`design:content:write`, `design:meta:read`, y las variables `CANVA_CLIENT_ID` /
`CANVA_CLIENT_SECRET`.

## Seguridad

- Todas las tablas tienen RLS activo. El rol `anon` no puede leer ni escribir
  ninguna tabla.
- El visitante del QR entra por una única función `resolve_qr()` que registra el
  escaneo y devuelve el destino, sin exponer el listado de QRs ni las estadísticas.
- El PNG del QR (`/api/qr/[id]/png`) es público a propósito: sólo codifica la URL
  `/r/[id]`, que ya es pública, y así Canva puede descargarlo.
- Los exports y todo `/dashboard` requieren sesión.

## Estructura

```
src/
  app/
    r/[id]/route.ts            redirect público + registro del escaneo
    login/                     login con Supabase Auth
    dashboard/                 listado, detalle, gráfico, placas, Canva
    api/
      qr/[id]/png/             PNG del QR (público)
      export/{csv,zip}/        export para imprenta
      placa/                   fondo, posición del QR, preview y lotes PDF
      canva/                   OAuth, lotes, procesamiento, PDFs
  lib/                         QR, CSV, Supabase, Canva
supabase/
  schema.sql                   tablas, vistas, funciones, RLS y permisos
  ejemplo-import.csv           formato del CSV de migración
```

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run typecheck  # chequeo de tipos
```
