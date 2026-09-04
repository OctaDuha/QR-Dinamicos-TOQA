# Probar el panel de punta a punta

Guía para levantar la web, verificar que todo anda y recién después mandar
algo a imprenta. Toma unos 20 minutos.

---

## Antes de empezar

- **Node 20 o superior** (`node -v`). Si no lo tenés: [nodejs.org](https://nodejs.org).
- **git**.
- Una cuenta gratis en [supabase.com](https://supabase.com).

---

## 1. Traer el código

```bash
git clone -b claude/new-session-90xuc9 https://github.com/OctaDuha/QR-Din-micos-TOQA.git
cd QR-Din-micos-TOQA
npm install
```

## 2. Crear el proyecto en Supabase

1. **New project**. Elegí la región **South America (São Paulo)**: es la más
   cerca y el redirect del QR tiene que ser rápido.
2. **SQL Editor → New query** → pegá todo `supabase/schema.sql` → **Run**.
   Tiene que terminar en `Success`. Es idempotente: si lo corrés de nuevo, no
   rompe nada.
3. **Authentication → Users → Add user → Create new user**:
   - email y contraseña que quieras
   - ⚠️ **marcá "Auto Confirm User"**. Si no lo marcás, el login falla con
     *Email not confirmed*.
4. **Project Settings → API**: copiá `Project URL` y la clave **`anon` `public`**
   (la `service_role` no se usa acá, no la pongas en ningún lado).

## 3. Configurar las variables

```bash
cp .env.example .env.local
```

Editá `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4. Levantarlo

```bash
npm run dev
```

Abrí <http://localhost:3000>. Te manda al login.

---

## 5. Checklist de prueba

Hacelo en orden: cada paso apoya al siguiente.

### ✅ Login
Entrá con el usuario que creaste. Tenés que caer en el listado de QRs, vacío.

### ✅ Crear un lote
**Nuevo QR / lote** → cantidad `5`, etiqueta `Mesa`, destino
`https://instagram.com/toqa.ar` → **Crear QR**.

Aparecen `0001` a `0005`, etiquetados *Mesa 0001*… *Mesa 0005*.

### ✅ El redirect (el corazón de todo)
En la fila `0001` tocá **Copiar** y pegá esa URL en otra pestaña.
Tiene que llevarte a Instagram.

Volvé al panel y refrescá: la columna **Escaneos** de `0001` ahora dice `1`.

### ✅ Cambiar el destino sin tocar el QR
Entrá a `0001` → cambiá el destino a `https://toqa.com.ar` → **Guardar cambios**.

Volvé a abrir la **misma URL de antes** (`/r/0001`): ahora te lleva al destino
nuevo. Esto es exactamente lo que va a pasar con una placa ya impresa.

### ✅ El gráfico
Abrí `/r/0001` unas cuantas veces. En el detalle del QR la barra de hoy sube.
Probá **Por semana** y **Por mes**, y el botón **Ver tabla**.

### ✅ La migración (lo más delicado)
Es lo único que, si sale mal, rompe placas ya impresas.

1. **Importar CSV** → subí `supabase/ejemplo-import.csv`.
2. Verificá que aparecieron con **esos números exactos**: `0001`, `0002` y
   `0042`. Los dos primeros pisaron el destino de los que ya existían.
3. Ahora creá **un QR nuevo**. Tiene que salir `0043`, no repetir un número
   usado. (Eso es la secuencia reacomodándose sola.)

Cuando migres de verdad, exportá el CSV completo de la herramienta vieja y
**no des de baja nada hasta haber escaneado una placa real**.

### ✅ Export para Canva / imprenta
**Exportar ZIP** → abrí el archivo. Adentro:
- `png/` con un PNG por QR
- `qrs.csv` con las columnas `numero, qr_code, destino_actual, url_qr`

### ✅ Placas para imprenta
1. Pestaña **Placas**.
2. Subí un PDF de fondo. Para la prueba sirve cualquiera; para lo real,
   exportá tu diseño de Canva (*Compartir → Descargar → PDF para imprimir*)
   con el marco del QR vacío.
3. Movés **Izquierda / Arriba / Lado** y el preview de la derecha se actualiza:
   es el PDF real, no una simulación.
4. **Guardar posición** → **Descargar PDF único**.
5. Abrí el PDF y **escaneá el QR con el celular**. Tiene que abrir el destino
   configurado.

> ⚠️ En local los QR apuntan a `http://localhost:3000`, así que **desde el
> celular no van a funcionar** y no sirven para imprimir. Es esperable: recién
> con el dominio final quedan buenos.

---

## 6. Publicarlo en Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo.
2. En **Branch**, elegí `claude/new-session-90xuc9` (o mergeá a `main` antes).
3. **Environment Variables**: cargá las tres. Por ahora poné en
   `NEXT_PUBLIC_SITE_URL` la URL que te dé Vercel.
4. **Deploy**.
5. **Settings → Domains** → conectá tu dominio.
6. ⚠️ **Volvé a Environment Variables, poné el dominio final en
   `NEXT_PUBLIC_SITE_URL` y hacé un redeploy.** Las variables `NEXT_PUBLIC_*`
   se incrustan durante el build: cambiarlas sin volver a desplegar no tiene
   ningún efecto.

Repetí el checklist del punto 5 sobre el dominio real. Ahí sí, escaneá un QR
con el celular.

---

## 7. Recién ahora, imprenta

- El QR impreso apunta para siempre a `https://tu-dominio/r/0001`. Si el
  dominio cambia, las placas mueren. Definilo antes de imprimir.
- Escaneá una placa de prueba impresa antes de mandar las 1000.

---

## Si algo falla

| Síntoma | Qué pasa |
|---|---|
| `Email not confirmed` al entrar | El usuario de Supabase no está confirmado. Borralo y crealo de nuevo con **Auto Confirm User**. |
| `Falta la variable de entorno NEXT_PUBLIC_...` | No existe `.env.local`, o lo creaste con el server corriendo. Cortá con `Ctrl+C` y `npm run dev` de nuevo. |
| `permission denied for table qr_codes` | No corriste `supabase/schema.sql`, o falló a la mitad. Corrélo entero otra vez. |
| El QR lleva a `localhost` | Falta `NEXT_PUBLIC_SITE_URL` con el dominio real **y** un redeploy. |
| `Este QR todavía no tiene destino` | Ese número no existe en la base. Fijate en el listado. |
| El lote de placas dice que falta el fondo | Subí el PDF en la pestaña **Placas** antes de generar. |
