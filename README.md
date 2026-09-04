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
- **`/dashboard/canva`** — generación masiva de diseños con la Canva Connect API.

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

## Generación masiva de diseños en Canva

Implementada la **Opción A** del brief: la Canva Connect API, controlada por
código. Por cada QR el sitio sube el PNG como asset, hace el *autofill* de la
plantilla usando el campo `qr_code` y exporta el diseño a PDF de impresión.

### Configurar la integración

1. Entrá a [developers.canva.com](https://www.canva.com/developers/) y creá una
   integración privada. Es distinta de la conexión personal de Canva: esta la
   usa el sitio.
2. **Authentication** → URL de retorno: `https://tu-dominio/api/canva/callback`.
3. **Scopes**: `asset:read`, `asset:write`, `brandtemplate:meta:read`,
   `brandtemplate:content:read`, `design:content:read`, `design:content:write`,
   `design:meta:read`.
4. Cargá `CANVA_CLIENT_ID` y `CANVA_CLIENT_SECRET` y redesplegá.
5. En `/dashboard/canva` → **Conectar con Canva** (una sola vez), elegí la
   plantilla y el rango de QRs, y **Generar lote**.

El lote se procesa por tandas: el navegador va pidiendo tandas hasta terminar,
así 1000 diseños no dependen de un único request. Si se corta, el botón
**Continuar** retoma donde quedó.

### Límite conocido de Canva

El **autofill de brand templates es una función de Canva Enterprise**. Si la
cuenta no lo tiene, la API devuelve 403 al listar plantillas y el lote no puede
generarse. En ese caso quedan dos caminos, sin perder nada del diseño ya armado:

- Seguir usando **Creación masiva** dentro de Canva: bajá el ZIP y subí
  `qrs.csv`, que ya trae la columna `qr_code` con la URL pública de cada PNG.
- **Opción B**: generar el PDF vectorial desde el código replicando el diseño de
  la placa. Más rápido y sin límites de plataforma, pero cada rediseño pasa a
  ser un cambio de código.

Los links de exportación de Canva caducan a las pocas horas: bajá el ZIP de PDFs
el mismo día que generás el lote.

---

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
    dashboard/                 listado, detalle, gráfico, Canva
    api/
      qr/[id]/png/             PNG del QR (público)
      export/{csv,zip}/        export para imprenta
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
