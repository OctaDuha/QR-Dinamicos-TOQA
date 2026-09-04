# Poner la web a funcionar

No hace falta instalar nada ni escribir un solo comando. Todo se hace desde el
navegador, haciendo clic. Son unos 20 minutos.

*(Si sos programador y querés levantarlo en tu máquina, saltá al final.)*

---

## Qué es cada cosa

Tres piezas. La primera ya está lista:

- **GitHub** — el archivador donde está guardado el código. No se toca.
- **Supabase** — la base de datos: ahí viven los QR, sus destinos y cada
  escaneo. Gratis.
- **Vercel** — agarra el código de GitHub y lo publica en una dirección web.
  Gratis.

En Supabase y en Vercel te creás cuenta con el botón *"Continue with GitHub"*.

---

## 1. Crear la base de datos

1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. Ponele un nombre y elegí la región **South America (São Paulo)**: es la más
   cerca, y el redirect del QR tiene que ser rápido.
3. Esperá un minuto a que termine de crearse.

## 2. Armar las tablas

Suena a programar, pero es copiar y pegar.

1. Abrí el archivo [`supabase/schema.sql`](supabase/schema.sql) y copiá **todo**
   el contenido (en GitHub hay un botón de copiar arriba a la derecha del texto).
2. En Supabase, menú de la izquierda → **SQL Editor** → **New query**.
3. Pegá todo y tocá **Run**.
4. Tiene que decir **Success**.

Si algún día hay que volver a correrlo, no pasa nada: está hecho para poder
ejecutarse mil veces sin romper lo que ya existe.

## 3. Crear tu usuario

En Supabase: **Authentication** → **Users** → **Add user** → *Create new user*.

- Poné tu email y una contraseña.
- ⚠️ **Tildá la casilla "Auto Confirm User".** Si no la tildás, después no vas a
  poder entrar al panel.

## 4. Copiar dos datos

En Supabase: **Project Settings** → **API**. Anotá:

- **`Project URL`** — una dirección que termina en `.supabase.co`
- la clave **`anon` `public`** — larga, empieza con `eyJ`

> 🔒 En esa pantalla también vas a ver una clave **`service_role`**.
> **No la copies ni la pegues en ningún lado.** Es la llave maestra de la base:
> quien la tenga puede leer y borrar todo. Esta web no la necesita.

## 5. Publicar la web

1. Entrá a [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Elegí el repositorio `QR-Din-micos-TOQA`.
3. Antes de publicar, abrí **Environment Variables** y cargá estas tres:

   | Nombre | Qué poner |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | el `Project URL` del paso 4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave `anon public` del paso 4 |
   | `NEXT_PUBLIC_SITE_URL` | por ahora dejalo vacío |

4. **Deploy**. En un minuto te da una dirección tipo `algo.vercel.app`.

## 6. Conectar tu dominio

1. En Vercel: **Settings** → **Domains** → agregá tu dominio y seguí lo que te
   indique.
2. Volvé a **Settings → Environment Variables**, y ahora sí poné tu dominio
   final en `NEXT_PUBLIC_SITE_URL` (por ejemplo `https://qr.tudominio.com`).
3. ⚠️ **Andá a la pestaña Deployments y hacé "Redeploy".**
   Sin este paso el cambio no tiene ningún efecto: esa dirección se graba
   dentro de la web al momento de publicarla.

---

## 7. Probar que anda

Entrá a tu dirección e iniciá sesión con el usuario del paso 3. Después:

| Qué hacer | Qué tiene que pasar |
|---|---|
| **Nuevo QR / lote** → cantidad 5, etiqueta `Mesa`, destino `https://instagram.com/tucuenta` | Aparecen los números `0001` a `0005` |
| En la fila `0001`, tocá **Copiar** y pegá esa dirección en otra pestaña | Te lleva a Instagram |
| Volvé al panel y refrescá | La columna **Escaneos** de `0001` ahora dice `1` |
| Entrá a `0001`, cambiá el destino a otra página y guardá. Volvé a abrir **la misma dirección de antes** | Ahora te lleva al destino nuevo. **Esto es lo importante: el QR no cambió, sólo a dónde apunta.** |
| Escaneá el QR de `0001` con el celular | Te abre el destino |
| **Exportar ZIP** | Se baja un archivo con las imágenes de los QR y una planilla |

Si todo eso funciona, la web está lista.

---

## 8. Migrar los QR que ya tenés impresos

Esto es lo único que, si sale mal, deja placas muertas. Los números tienen que
mantenerse **idénticos**.

1. Exportá de la herramienta vieja la lista completa: número y destino actual.
2. Armá una planilla con esta forma (mirá
   [`supabase/ejemplo-import.csv`](supabase/ejemplo-import.csv)) y guardala como
   CSV:

   | numero | destino_actual | label |
   |---|---|---|
   | 0001 | https://instagram.com/toqa | Mesa 1 |

3. En el panel: **Importar CSV** → subila.
4. Verificá que los números quedaron **exactamente iguales** a los de las placas.
5. **Escaneá una placa real ya impresa** antes de dar de baja la herramienta
   vieja.

---

## 9. Las placas para imprenta

Pestaña **Placas**:

1. En Canva, abrí tu diseño “NFC y QR”, dejá **vacío** el marco del QR y
   descargalo con *Compartir → Descargar → PDF para imprimir*.
2. Subí ese PDF en la pestaña Placas.
3. Movés los números de **Izquierda**, **Arriba** y **Lado del QR** hasta que el
   QR quede donde va. Lo que ves a la derecha es el archivo real que sale a
   imprenta.
4. **Guardar posición**.
5. Elegís desde qué número hasta qué número y tocás **Descargar PDF único**.
6. Abrí el PDF y **escaneá el QR con el celular** antes de mandarlo a imprimir.

Si algún día rediseñás la placa, la cambiás en Canva, exportás de nuevo y subís
el PDF. No hay que tocar nada más.

---

## Dos cosas para tener en cuenta

**La dirección de los QR es para siempre.** El QR impreso apunta a
`https://tu-dominio/r/0001`. Si mañana cambiás de dominio, todas las placas
impresas dejan de funcionar. Por eso conviene definirlo antes de imprimir.

**Supabase gratis se pausa.** Si pasa una semana sin actividad, el plan gratuito
suspende la base y los QR dejan de redirigir hasta que la reactives a mano.
Mientras la gente escanee no hay problema, pero cuando esto pase a ser algo
serio conviene el plan pago (unos 25 USD por mes) para que no se apague nunca.

---

## Si algo falla

| Lo que ves | Qué pasó |
|---|---|
| `Email not confirmed` al entrar | El usuario no quedó confirmado. Borralo en Supabase y creá otro **tildando "Auto Confirm User"**. |
| `Falta la variable de entorno...` | Falta alguna de las tres variables en Vercel, o las cargaste y no hiciste *Redeploy*. |
| `permission denied for table qr_codes` | El paso 2 no se completó. Volvé a pegar y correr el archivo entero. |
| El QR lleva a una dirección rara o no abre nada | Falta poner tu dominio en `NEXT_PUBLIC_SITE_URL` **y hacer Redeploy**. |
| `Este QR todavía no tiene destino` | Ese número no existe en la base. Fijate en el listado del panel. |
| Al generar placas dice que falta el fondo | Subí primero el PDF de Canva en la pestaña **Placas**. |

---

## Apéndice: levantarlo en tu máquina (para programadores)

Requiere Node 20+ y git.

```bash
git clone https://github.com/OctaDuha/QR-Din-micos-TOQA.git
cd QR-Din-micos-TOQA
npm install
cp .env.example .env.local   # completá las tres variables
npm run dev
```

Con `NEXT_PUBLIC_SITE_URL=http://localhost:3000` los QR generados apuntan a
localhost: sirven para probar desde la misma computadora, pero no desde el
celular ni para imprimir.
