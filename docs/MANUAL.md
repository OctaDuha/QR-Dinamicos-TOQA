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

Arriba están las secciones: **QRs · Clientes · Placas · Historial · Usuarios · WhatsApp**. Algunas solo las ve el dueño.

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
- **Los diseños son las plantillas de la imprenta.** La imprenta los arma en Illustrator, en CMYK y todo en vector, con sangrado, marcas de corte, y el QR y el número de ejemplo puestos. Canva ya no se usa.
- **Agregar un diseño**: nombre + la plantilla. La página se da cuenta sola de que es una plantilla de imprenta y:
  - la deja **tal cual**: no la aplana, no la achica y no le agrega márgenes ni línea de corte;
  - encuentra el QR y el número de ejemplo y los reemplaza por los reales de cada placa;
  - pone el número con la **misma letra, el mismo tamaño y el mismo espacio entre cifras** que el de ejemplo: Calibri Bold en los vinilos redondos y Lato Semibold en las placas;
  - dibuja el QR y el número en **CMYK** (negro puro), como piden las máquinas de la imprenta.
- **Tus diseños**: para elegir uno y ver la vista previa. Si hace falta, se puede ajustar a mano la posición del QR y del número, y la letra del número.
- **Vista previa**: muestra la pieza ya cortada. Tildando **"Ver la hoja completa"** se ve el PDF entero, como va a la imprenta, con el sangrado y las marcas.
- **Reemplazar el PDF del diseño**: dentro de cada diseño, para cambiar el fondo por una plantilla nueva. El diseño mantiene sus números ya asignados, y el QR y el número se vuelven a ubicar solos. Después, revisá la vista previa.
- **Medidas de las plantillas**:
  - **vinilos redondos de 10 cm**, con su línea de corte circular;
  - **placas de 10 × 20 cm**: la placa de 10 × 15 más 5 cm en blanco abajo.
- **Diseños viejos de Canva** (si quedara alguno): siguen saliendo como antes. Los cuadrados salen redondos con franja blanca de 1 mm y línea de corte CutContour, y las placas con 3 mm en blanco alrededor. Su fondo aplanado no sale en CMYK.
- **Generar placas**:
  - **Nuevas**: cantidad, diseño y destino. Crea los números y baja el PDF de una.
  - **Existentes** ("Reimprimir QR que ya tengo"): por rango de números o con los tildados en QRs. Abajo aparecen **los números de cada diseño**, agrupados en tramos (por ejemplo "0001 a 0040"): tocando un tramo se carga en Desde y Hasta. Si elegís un diseño, aparece el botón para **reimprimir todos sus números de una**, aunque estén salteados.
  - **PDF único** (todas juntas) o **ZIP** (un PDF por placa o vinilo, lo que pide la imprenta para los vinilos).
- Cada número queda atado a un diseño: no se puede reimprimir el mismo número con otro diseño.

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
- Si alguien te escribe con su **nombre de usuario de WhatsApp sin mostrar su número**, el bot le contesta igual con el menú. Si esa persona ya te había escrito alguna vez con el número a la vista, el bot la reconoce y la trata como siempre (si es cliente, le ofrece Estadísticas). Si no, la atiende como a alguien que no es cliente, y en "Últimas consultas" aparece como **"Número oculto"**.

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
