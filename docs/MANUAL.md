# Manual de uso de toqaqr.com.ar

Qué es cada parte del sitio y para qué se usa, en palabras simples. Si querés saber cómo funciona por dentro, está en el [README](../README.md). Para ver qué está pendiente, mirá [ESTADO.md](ESTADO.md).

---

## La idea general

Cada producto TOQA (placa, vinilo o sticker) tiene un **número** (0001, 0002…) y dos formas de usarlo:

- **El QR impreso** lleva a `toqaqr.com.ar/qr/0001`.
- **El chip NFC** lleva a `toqaqr.com.ar/nfc/0001`.

Las dos direcciones pasan por nuestra página, que **cuenta el escaneo** y **redirige** al destino que elegiste: las reseñas de Google, el Instagram, el menú o lo que sea.

Lo impreso y lo grabado **nunca cambia**. Lo único que cambia es el destino, y eso se hace desde el panel. Por eso un producto ya entregado se puede "reprogramar" sin reimprimir nada.

> Las formas viejas (`/0001`, `/r/1`) siguen funcionando para siempre. Si el número no existe o la base no responde, la persona va al destino de respaldo (`QR_FALLBACK_URL`, hoy el Instagram de TOQA) en vez de ver un error.

---

## Partes públicas (sin iniciar sesión)

| Dirección | Para qué |
|---|---|
| `toqaqr.com.ar` | **Página de inicio**: qué es TOQA, cómo funciona, productos, por qué TOQA y contacto (WhatsApp, mail, Instagram). Si tenés sesión iniciada, te lleva directo al panel. |
| `/privacidad` | **Política de privacidad**. Meta la pide y la revisa. Si se agrega algo que guarde datos nuevos, hay que actualizarla. |
| `/login` | **Entrada al panel**, con mail y contraseña o con Google. |
| `/qr/…`, `/nfc/…`, `/0001`, `/r/…` | Las direcciones de los productos. No se tocan. |

---

## El panel (`/dashboard`)

Arriba están las secciones: **QRs · Clientes · Placas · Canva · Historial · Usuarios · WhatsApp**. Algunas solo las ve el dueño.

### QRs: la lista de todos los productos

- La tabla tiene el número, la etiqueta, el destino, el cliente y el total de escaneos, con buscador y páginas.
- **Buscador:** encuentra por número, etiqueta, destino o **diseño y medida**. Las palabras pueden ir en cualquier orden, y no importan las tildes ni las mayúsculas: "google 10x10" encuentra todos los del diseño "Google Reseñas VINILO 10x10", y "10x15" encuentra todas las placas de esa medida.
- **Nuevo QR / lote**: crea uno o muchos números nuevos de una vez. Se numeran solos, a continuación del último. Los números **nunca se reutilizan**, aunque se borre uno.
- **Importar CSV**: carga muchos de una vez desde una planilla. También sirve para reconstruir todo desde una copia de respaldo.
- **Exportar ZIP (PNG + CSV)**: baja la imagen de cada QR y la planilla completa.
- **Solo CSV**: baja la planilla, que es la **copia de seguridad** de todo.
- **Borrar por número**: solo el dueño. Borra un rango; lo borrado va a la papelera por 30 días.
- **Estado del respaldo**: muestra cuándo fue la última copia automática, con el botón "Guardar una ahora". Si tiene más de 7 días aparece en rojo.
- Se pueden **tildar varios** para generar sus placas de una.

### Ficha de cada QR (tocando "Editar")

- **URL fija del QR**: la dirección que va impresa.
- **Para grabar en el chip NFC**: la dirección para el chip, con botón de copiar. Se graba con NFC Tools y después se **bloquea** el chip.
- **Editar**: la etiqueta (por ejemplo "Mesa 4"), el **destino** (a dónde lleva) y el **cliente**: negocio, persona de contacto y WhatsApp. Si escribís un negocio que ya existe, lo completa solo.
- **Escaneos**: el total, los últimos 30 días y un gráfico por día, semana o mes, separado en QR y NFC, con rango de fechas libre.
- **Reporte**:
  - **Descargar imagen**: el reporte prolijo para mandarle al cliente.
  - **Compartir (WhatsApp)**: lo mismo, directo desde el celular.
  - **Planilla (CSV)**: los números crudos.
- **Placa para imprenta**: baja el PDF de esa placa sola.
- **Historial de esta placa**: quién la creó, imprimió o cambió, cuándo y qué cambió.
- **Zona peligrosa**: borrarla. Solo el dueño, y va a la papelera.

### Clientes

- Lista de los negocios que tienen productos TOQA.
- Un cliente se crea solo al cargarlo en "Editar" de una placa, o se crea a mano desde acá.
- **Ficha del cliente**:
  - sus datos y sus WhatsApp;
  - **todas sus placas**, que se configuran desde ahí mismo; también se le **agregan** placas por número o se le **quitan**;
  - sus **estadísticas sin salir de la pantalla**;
  - el **reporte del cliente**, que junta todas sus placas.
- El **WhatsApp del cliente** es lo que usa el bot para reconocerlo y mandarle sus estadísticas.
- **Borrar un cliente** no borra sus placas: quedan sin cliente.

### Placas: hacer los archivos para la imprenta

- **Antes de imprimir** (el semáforo de arriba): revisa que el dominio impreso sea el definitivo, que exista el destino de respaldo y que haya diseños cargados. En verde dice "Listo para imprimir".
- **Agregar un diseño**:
  - Se sube el PDF exportado de Canva **con un QR y un número de ejemplo puestos**. La página detecta sola dónde van y después los reemplaza por los reales.
  - Si Canva exportó en píxeles (con una medida gigante), la página ofrece corregir la medida.
- **Tus diseños**: para elegir uno y ajustar a mano la posición y el tamaño del QR y del número, con vista previa.
- **Vinilos circulares**: todo diseño **cuadrado** (los vinilos de 10×10) sale **redondo, de 10 cm**, con una franja blanca de 1 mm y la línea de corte **CutContour** para el plotter. El sistema lo ajusta solo. Los rectangulares (10×15) salen tal cual.
- **Generar placas**:
  - **Nuevas**: cantidad, diseño y destino. Crea los números y baja el PDF de una.
  - **Existentes**: por rango de números o con los tildados en QRs.
  - **PDF único** (todas juntas) o **ZIP** (un PDF por placa o vinilo, lo que pide la imprenta para los vinilos).
- Cada número queda atado a un diseño: no se puede reimprimir el mismo número con otro diseño.

### Canva

Para generar diseños directo en Canva. **Requiere Canva Enterprise**: con el plan Business no está disponible, así que hoy no se usa. Los diseños se suben como PDF en **Placas**.

### Historial (solo el dueño)

- **Lista general** de todo lo que pasó: creaciones, impresiones, cambios de destino, borrados, recuperaciones. Muestra quién lo hizo y cuándo.
- **Papelera**: las placas borradas quedan **30 días** con el botón **Recuperar**. Vuelven con su número, su destino, su cliente y sus escaneos. Después de 30 días se borran para siempre.

### Usuarios (solo el dueño)

- **Invitar a alguien**: se anota su mail. Puede entrar con Google o con contraseña, pero solo si está invitado.
- Las cuentas nuevas quedan **pendientes** hasta que el dueño las aprueba.
- **Roles**:
  - **Dueño**: todo.
  - **Equipo**: todo menos borrar y manejar usuarios.

### WhatsApp (solo el dueño): el bot

- **Estado**: la lista de lo que falta configurar.
- **Llave del bot**: se genera acá y se pega en Vercel como `BOT_LLAVE`. Es lo único que le permite al bot leer estadísticas.
- **Para pegar en Meta**: la dirección del webhook y la palabra de verificación.
- **Conectar tu WhatsApp Business**: el botón para pasar el bot al número real de TOQA sin dejar de usar la app del celular. **Todavía no usarlo**: falta que Meta apruebe. Ver [ESTADO.md](ESTADO.md).
- **Probar**: a qué número escribirle para ver el menú.
- **Textos del bot**: lo que contesta en cada opción del menú. Se cambian cuando quieras.
- **Últimas consultas al bot**: quién escribió, qué pidió y si **te toca responder** (pidió un producto, avisó un problema o quiere hablar con una persona).

**Cómo se comporta el bot**:
- Al que escribe por primera vez, o después de 12 horas sin hablar, le muestra el menú: 🛒 Quiero un producto · 📊 Estadísticas · ❓ ¿Cómo funciona TOQA? · 🔧 Tengo un problema · 💬 Hablar con nosotros.
- Estadísticas y "Tengo un problema" solo les aparecen a los clientes cargados.
- En medio de una charla no se mete. Escribiendo "menú" o "estadísticas" se lo llama cuando se quiera.
- Después de 🛒 Quiero un producto o 🔧 Tengo un problema, cuando el cliente cuenta qué necesita, le responde una sola vez "¡Perfecto! En breve te responderá una persona del equipo 🙌". Si ya le respondiste vos, no lo manda.
- Si piden hablar con una persona, o si respondés vos desde el celular, se calla 12 horas con ese número.

---

## Copias de seguridad

- **Automática en Vercel**: cada vez que cambia la lista se guarda el CSV.
- **Mail diario**: llega todos los días el CSV adjunto al Gmail del dueño, que lo etiqueta y lo saca de la bandeja principal.
- **A mano**: el botón "Solo CSV" en QRs.

Con ese CSV, si se perdiera la base, se reconstruye todo con los mismos números. Lo único que no vuelve son las estadísticas.

## Grabar un chip NFC (resumen)

1. En la ficha del QR, copiá la dirección **"Para grabar en el chip NFC"** (`…/nfc/0001`).
2. En **NFC Tools**: Escribir → Agregar registro → URL → pegá la dirección → Escribir → apoyá el chip.
3. Probalo con el celular: tiene que abrir el destino y sumar un escaneo NFC en la ficha.
4. Recién entonces, **bloquealo** (Otros → Bloquear etiqueta). Es irreversible: si no, cualquiera podría reescribirlo.

**Nunca** grabes en el chip el destino final del cliente (su link de Google, por ejemplo): quedaría congelado y no se podría cambiar desde el panel.
