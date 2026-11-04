# Estado del proyecto TOQA

Resumen de lo decidido y lo pendiente, para retomar sin tener que releer meses de conversación. Para qué sirve cada pantalla del sitio está en el [MANUAL](MANUAL.md), y el *cómo* funciona por dentro, en el [README](../README.md). Acá va el *qué*, el *por qué* y *dónde estamos*.

Última actualización: 18/10/2026.

---

## 1. Quién y qué

- **TOQA** (marca; Instagram `toqa.nfc`, mail `toqa.nfc@gmail.com`, frase "Un toque. Una acción.") vende placas, vinilos y stickers con **código QR impreso + chip NFC** para comercios: reseñas de Google, Instagram, WhatsApp, menús, etc.
  - Los productos se entregan **ya configurados**: el cliente no toca nada.
  - Hay modelos genéricos y diseños personalizados.
- El **dueño** es una sola persona, sin conocimientos técnicos. Todo se le explica paso a paso, en castellano rioplatense, con capturas.
  - Además maneja campañas de Meta Ads para otros clientes. **Nada de lo que se configure en Meta para TOQA puede tocar los activos ni los portfolios de esos clientes.**
- **Sitio:** `https://toqaqr.com.ar`.
  - Página de inicio pública.
  - Panel privado en `/dashboard`.
  - Redirecciones de las placas en `/qr/0001`, `/nfc/0001`, `/0001` y `/r/1`.

## 2. Cómo trabajar con el dueño

Reglas que pidió explícitamente:

1. **No empezar a implementar sin su OK.** Primero se explica la propuesta y se espera el "dale".
2. **No publicar sin su OK.** Hacer push a la rama de trabajo **publica en producción** (Vercel). Para cambios visibles, mostrar capturas antes.
3. **"No rompas nada de lo que venimos trabajando."** Probar todo antes de publicar.
4. **Nunca usar ni pedir la clave `service_role` de Supabase.**
5. **Nunca pedir que pegue en el chat nada que diga Secret, token o key.** Alcanza con que diga "ya lo copié".
6. **Pasos cortos y concretos.** Decir dónde tocar, qué copiar y qué va a ver. Si algo de la pantalla no coincide, que mande captura.
7. **Explicar los riesgos de lo irreversible antes de hacerlo:** decisiones en Meta, borrar cosas, cambiar URLs impresas.

## 3. Infraestructura y cuentas

No hay secretos en este archivo. Los identificadores de abajo no son claves.

| Pieza | Datos |
|---|---|
| Código | GitHub `OctaDuha/QR-Din-micos-TOQA`. La rama `claude/new-session-90xuc9` es la que publica Vercel en producción. |
| Hosting | Vercel. Crons en `vercel.json`: keepalive diario y mail de respaldo diario. |
| Base | Supabase, proyecto `qr-toqa`, región **sa-east-1 (São Paulo)**, plan gratuito. El dueño corre a mano las migraciones de `supabase/migraciones/` en el SQL Editor. |
| Login | Usuario/contraseña y Google. El registro público está apagado en Supabase. Las cuentas nuevas entran solo por invitación del dueño y quedan "pendientes" hasta que las aprueba. |
| Respaldo | CSV en Vercel Blob en cada cambio, más un mail diario con el CSV adjunto (Resend → Gmail del dueño, con un filtro que lo etiqueta). Si la copia o el mail tienen más de 7 días, el panel los marca en rojo. |
| Verificación en dos pasos | **Activada** (19/10/2026) en todas las cuentas clave: Gmail, Facebook/Meta, GitHub, Vercel y Supabase. |
| Monitor | UptimeRobot revisa `https://toqaqr.com.ar/api/health` y avisa por mail si la página no responde. |
| Dominio | `toqaqr.com.ar` en NIC Argentina, con renovación anual. Si se vence, todas las placas dejan de funcionar. Hay que renovarlo en los 30 días previos al vencimiento. |

Las variables de entorno están documentadas en `.env.example`.

### Meta / WhatsApp

| Qué | Valor |
|---|---|
| Portfolio comercial | `toqa.nfc` (ID 1466992878784395). **Verificado el 16/10/2026** como persona física/monotributo del dueño, con nombre alternativo "TOQA". La verificación salió por **identidad (DNI)**: el registro público de Meta tenía un teléfono viejo que no era suyo. |
| App de Meta | **TOQA Bot**, ID `1138106575564279`, tipo empresa. **Marcada como proveedor de tecnología**, decisión irreversible y correcta. |
| Configuración de registro insertado | ID `2363042957797849`. Plantilla "registro insertado de WhatsApp con token de 60 días": el token se usa una sola vez, al conectar. |
| Portfolio para el número | **TOQA WhatsApp** (ID 4043326102477101), creado el 2/11/2026 a nombre del dueño (toqa.nfc@gmail.com), con los mismos datos legales que toqa.nfc y verificación en dos pasos para todos. Existe porque Meta exige que la app del proveedor y la cuenta de WhatsApp estén en portfolios distintos. Todavía sin verificar: Meta no ofrece la verificación mientras el portfolio esté vacío. |
| Número de prueba (bot actual) | +1 555-666-9190, phone id `1297383330136006`, cuenta de WhatsApp `2110399713184006`. |
| Número real | **+54 9 11 2243-4691**: el WhatsApp Business de TOQA, que el dueño usa en el celular. **Conectado por coexistencia el 4/11/2026**: phone id `746573765202229`, cuenta de WhatsApp (WABA) `9544882982278941`, propiedad del portfolio TOQA WhatsApp y compartida con toqa.nfc. |
| Token | Usuario del sistema con token permanente (`WHATSAPP_TOKEN` en Vercel). |
| Webhook | `https://toqaqr.com.ar/api/whatsapp`. Hoy está suscrito el campo `messages`. |
| Configuración básica de la app | Dominio `toqaqr.com.ar`, política de privacidad y eliminación de datos en `/privacidad`, ícono cargado y plataforma Sitio web. |
| Inicio de sesión con Facebook para empresas | SDK de JavaScript activado. Dominio permitido `https://toqaqr.com.ar/`. Redirect `https://toqaqr.com.ar/dashboard/whatsapp`. |

## 4. Dónde estamos: pasar el bot al número real

**Restricciones del dueño:** sin intermediarios pagos, sin dos números, y la app WhatsApp Business del celular tiene que seguir andando. El único camino que cumple las tres es la **coexistencia** mediante el **registro insertado**, para lo cual hay que ser **proveedor de tecnología**.

| Paso | Estado |
|---|---|
| Verificación del negocio | ✅ 16/10 |
| Proveedor de tecnología (marcado) | ✅ |
| Pruebas de los permisos (llamadas a la API) | ✅ Valen 30 días: hay que enviar y aprobar antes de mediados de noviembre o rehacerlas con el explorador (`GET 2110399713184006/phone_numbers` con permiso `whatsapp_business_management`). |
| Verificación de acceso | ✅ Aprobada (avisado el 29/10). Se había enviado el 17/10. |
| Revisión de la app | ✅ Aprobada el 31/10. Se había enviado el 18/10. |
| Publicar la app | ✅ 1/11 |
| Registro como proveedor | ✅ 1/11, como "Independent Tech Provider" (paso "Continuar registro"). Sin eso, Meta decía "toqa.nfc no puede registrar clientes". |
| Conectar el número real | ✅ 4/11. **El bot ya atiende en +54 9 11 2243-4691** y la app del celular sigue andando. Probado desde otro celular: llega el menú, y si responde el dueño el bot se calla. Detalle del camino abajo. |

**El bloqueo al conectar el número (1 al 4/11):**
- **Síntoma:** el registro insertado detectaba el WhatsApp Business, el QR se escaneaba bien y al final fallaba con "1466992878784395 no es un identificador del negocio válido (#1690130)". El selector de portfolio quedaba fijo en toqa.nfc.
- **Causa, confirmada por Meta:** en la coexistencia, **la app del proveedor y la cuenta de WhatsApp del número tienen que estar en portfolios distintos**, y toqa.nfc tenía las dos.
- **Lo que se hizo, en orden:**
  1. Se quitaron los vínculos del número con las páginas de Facebook TOQA y "ExplOcta tus redes" (la marca de marketing anterior del dueño) y con el Instagram. **No volver a vincular ExplOcta a este número.** La página y el Instagram de TOQA se pueden volver a vincular cuando el bot ande.
  2. Se desconectó la "Plataforma para empresas" desde la app del celular. El reintento la volvió a crear.
  3. Se creó el portfolio **TOQA WhatsApp**.
  4. Se quitó de toqa.nfc la cuenta de WhatsApp del número (WABA 9544882982278941). En toqa.nfc quedó solo el número de prueba.
  5. Se quitó TOQA Bot de las "Integraciones comerciales" del perfil personal del dueño.
- **Estado al 4/11:** desde el paso 4, el registro ya no pide portfolio ni ofrece conectar la app. Salta a "Agrega tu número de teléfono", el alta común por SMS, que **sacaría el número de la app**. Opciones que muestra: número nuevo, número virtual o Maruja Logística (cliente). **No avanzar ahí.**
- **Qué dice Meta (Bhavana, 4/11):**
  - No reintentar, no registrar el número y no volver a agregar la cuenta a ningún portfolio todavía.
  - El destino correcto es TOQA WhatsApp. Devolverla a toqa.nfc trae el mismo error.
  - La opción de conectar la app solo aparece si la cuenta del número está en el portfolio elegido, y hoy no está en ninguno.
  - La WABA 1801639751103898 la creó el propio registro y no tiene número: no importa.
  - Pidió captura de TOQA WhatsApp → Configuración → Cuentas → Cuentas de WhatsApp. Se la mandamos: estaba vacío, y "Agregar" ofrece "Crear una nueva cuenta de WhatsApp" o "Link a WhatsApp Business account".
  - Respuesta (Bhavana): usar **"Link a WhatsApp Business account"** con +54 9 11 2243-4691, nunca "Crear una nueva". Si la cuenta aparece en TOQA WhatsApp, reintentar el registro insertado desde el panel eligiendo TOQA WhatsApp. Si da error, mandarle el mensaje exacto y la hora.
  - 4/11: hecho. Con el código que llegó a la app, quedó "WhatsApp Business account linked" en TOQA WhatsApp ("Messaging accounts"). Figura en TOQA WhatsApp como WABA 9544882982278941 ("App de WhatsApp Business").
  - **4/11: CONECTADO.** El registro insertado, eligiendo el número "Registrado", mostró el portfolio TOQA WhatsApp, el QR de coexistencia y terminó con "Tu cuenta está conectada a toqa.nfc" (Session ID 01a1a781-897d-7e96-80fa-0a0bfd033de3). El panel mostró "✅ Conectado". No se agregó método de pago (el bot solo responde). Meta revisa la empresa en 24 h.
- **Casos:** 30092177693715783 (chat, cerrado) y **29136970462605848** (abierto, por mail), en https://business.facebook.com/direct-support. El chat automático se cierra solo apenas contesta. Al caso por mail se le responde desde el mismo mail.
- **Session IDs:** 01a194f1-8386-7aba-b26f-5bd63b202c72, 01a194f6-a015-7f5c-9183-699eb9a7cf83, 01a19532-451f-7e19-adba-da9eae360b86, 01a19e2e-e14b-7218-9f4f-e39ea7b7e5ff, 01a19e33-7fe6-7392-bd8c-2d9cb706fa98.
- **Nunca quitar** la WABA 2110399713184006, la del número de prueba: es con la que anda el bot.
- El código del botón no hace falta tocarlo: según Meta, la versión actual del registro no necesita `version: "v3"`.

**Lo que se mandó en la revisión de la app**, todo en inglés:
- **Permisos:** `whatsapp_business_messaging`, `whatsapp_business_management` y `public_profile`.
- **Videos:**
  - `video1-mensajes-bot`: desde un WhatsApp personal se escribe "menú", llega el menú, se elige Estadísticas y llega el reporte en imagen.
  - `video2-plantilla`: en WhatsApp Manager se crea la plantilla `aviso_estadisticas`, de categoría Utilidad. Se creó **solo para el video**: no se usa y se puede borrar después de la aprobación.
- **Tratamiento de datos:**
  - Encargados: Vercel Inc. (EE. UU.) y Supabase Inc. (Brasil y EE. UU.), los dos como "servicios de TI".
  - Responsable: el dueño, en Argentina.
  - Pedidos de autoridades: no hubo. Se marcaron las 4 políticas.
- **Instrucciones para revisores:** el panel es privado y por eso no se dieron credenciales. El inicio de sesión con Facebook se usa solo dentro del panel, por el dueño, para el registro insertado.

**Pasos después de conectar** (1 a 6 hechos el 4/11):

1. ~~Publicar la app~~ (hecho el 1/11).
2. ✅ **Conectar el número.** Panel → WhatsApp → **Conectar tu WhatsApp Business**, eligiendo el portfolio **TOQA WhatsApp**: se escanea un QR con el celular y se hace **una sola vez**. El panel muestra el phone id, el número y la cuenta de WhatsApp.
3. ✅ **Asignar la cuenta al usuario del sistema.** En toqa.nfc: Cuentas de WhatsApp → la cuenta del número → Asignar personas → toqa-bot, acceso total. En la lista de activos de toqa-bot figura como "unknown" porque es de otro portfolio.
4. ✅ **Suscribir `smb_message_echoes`** (developers.facebook.com → TOQA Bot → Casos de uso → WhatsApp → Configuración) en los campos del webhook. Es lo que calla al bot cuando responde una persona desde el celular.
5. ✅ **Actualizar Vercel.** Cambiar `WHATSAPP_PHONE_ID` y `WHATSAPP_NUMERO` y hacer Redeploy. Hasta ese momento, el webhook ignora los mensajes del número nuevo, así que nadie recibe respuestas a medias.
6. ✅ **Probar** desde otro celular.
7. ⏳ **Verificar el portfolio TOQA WhatsApp**: enviada el 4/11 (Sociedad unipersonal → Registrado → DUHALDE OCTAVIO GABRIEL, alternativo TOQA → verificación de identidad con DNI, porque el registro público tiene el teléfono viejo). Meta dice hasta 48 h. Sin verificar, quedan límites en los mensajes que inicia la empresa.
8. Volver a vincular la página y el Instagram de **TOQA** al número, y comprobar que el bot sigue respondiendo.

**Cuidados de la coexistencia:**
- **No registrar el número por API**: lo sacaría de la app del celular.
- Hay que abrir la app del celular al menos una vez cada 14 días.
- Se pierden algunas funciones de la app, como las listas de difusión y los mensajes "ver una vez".

**Si Meta rechaza o pide cambios:** leer el motivo, corregir y reenviar. La verificación del negocio tiene un plan B si alguna vez hace falta rehacerla: "Mi negocio no aparece" + constancia de ARCA + factura con el domicilio fiscal, o la verificación del dominio con una etiqueta meta en el sitio.

## 5. Otros pendientes

- **Teléfono del negocio en Meta:** el portfolio muestra +54 11 4132-2221, que salió del registro público y no es de TOQA. Las dos revisiones ya están aprobadas, así que se puede corregir, pero **no mientras siga abierto el caso de la conexión**: editar datos del negocio verificado puede pedir verificar de nuevo.
- **Nombres de usuario de WhatsApp (BSUID):** WhatsApp va a permitir chatear con un nombre de usuario sin mostrar el número. En ese caso llega un identificador (BSUID) en vez del teléfono. El bot reconoce a los clientes por teléfono (`bot_telefono_comparable`), así que cuando esté disponible en Argentina hay que sumar el BSUID. El nombre de usuario ya está habilitado en Argentina: **@toqa** estaba tomado y el dueño reservó **@toqa.nfc** (4/11). El bot ya contesta a quien escribe sin mostrar su número (4/11): le responde por su identificador con el menú de alguien que no es cliente, y en el panel aparece como "Número oculto". Para reconocer a un cliente que oculte su número habría que guardar su identificador en la ficha: no está hecho.
- Aviso amarillo "WhatsApp needs more information" en el portfolio (24/10): **resuelto, no hay que hacer nada.** Es la invitación de Meta a subir el límite de conversaciones **iniciadas por la empresa** (250 por día; para pasar a 2000 hay que iniciar conversaciones de calidad). TOQA no inicia conversaciones: el bot solo responde a quien escribe primero, y eso no cuenta para ese límite.

- **Plantillas de la imprenta:** llegaron el 4/11 (5 PDF de Illustrator, en CMYK y en vector). La página ya las reconoce y las usa tal cual (ver §6). El dueño ya reemplazó los 5 diseños y mandó las placas a la imprenta. Falta su visto bueno, y preguntarle si la línea de corte del vinilo de Google va en celeste (los otros vienen en magenta).
- **Fotos reales de productos** para la página de inicio. El dueño las va a mandar; hoy hay ilustraciones.
- **Domicilio fiscal en ARCA:** el dueño se mudó y el domicilio fiscal quedó viejo. Actualizarlo es trámite suyo, y conviene hacerlo **después** de que Meta termine las revisiones, para no generar diferencias mientras revisan.
- La tarjeta "QR y NFC en uno" de la página de inicio sigue diciendo "funciona con cualquier celular". El dueño pidió **no cambiarla** por ahora, aunque el NFC funciona en alrededor del 90 % de los celulares.

## 6. Decisiones de producto, y por qué

- **El bot no manda estadísticas por su cuenta.** Los clientes las piden si les interesan. El dueño decidió no hacer envíos automáticos, que además se cobran.

- **Las URLs impresas no cambian nunca.**
  - `/0001` en vez de `/r/0001` achica el QR de 29×29 a 25×25 módulos.
  - `/qr/` y `/nfc/` se agregaron para contar por separado los escaneos de QR y los toques de NFC.
  - Las formas viejas siguen andando.
  - Los números de placa no se reutilizan nunca.
- **El chip NFC** se graba con `https://toqaqr.com.ar/nfc/XXXX` (con la app NFC Tools) y después se bloquea. Nunca se graba el destino final del cliente.
- **Estadísticas:**
  - Gráficos por día, semana y mes, con el total separado en QR y NFC.
  - Rango de fechas libre.
  - El reporte para el cliente es una **imagen**, no un CSV: se descarga o se comparte por WhatsApp. El CSV queda como opción secundaria.
- **Historial y papelera:**
  - Cada placa tiene su historial en "Editar", y hay una lista general solo para el dueño.
  - Las placas borradas quedan **30 días** en la papelera, con botón "Recuperar" dentro de Historial.
- **Roles:**
  - Dueño y "Equipo" (en la base sigue llamándose `empleado`).
  - Borrar es solo del dueño, y lo hace cumplir la base de datos.
- **Clientes:**
  - Los datos del cliente (negocio, contacto, WhatsApp) se cargan en "Editar" de cada placa.
  - Desde la ficha del cliente se configuran sus placas y se ven sus estadísticas sin salir de la pantalla.
- **Bot de WhatsApp** (propio y gratuito, sin ManyChat):
  - En una conversación nueva (12 horas sin hablar) responde con un menú, sea lo que sea que escriba el cliente: 🛒 Quiero un producto / 📊 Estadísticas / ❓ ¿Cómo funciona TOQA? / 🔧 Tengo un problema / 💬 Hablar con nosotros.
  - Estadísticas y "Tengo un problema" se les ofrecen solo a clientes cargados.
  - En medio de una charla no se mete. "menú" o "estadísticas" lo llaman siempre.
  - Los textos se editan desde el panel.
  - Si piden hablar con una persona, o si el dueño responde desde el celular, se calla 12 horas con ese número.
  - Después de "Quiero un producto" o "Tengo un problema", al primer mensaje del cliente le avisa una vez "¡Perfecto! En breve te responderá una persona del equipo 🙌" (pedido del dueño el 22/10), salvo que el dueño ya haya respondido.
- **Página de inicio:**
  - Pública y permanente. Quien tiene sesión iniciada va directo al panel.
  - Colores: azul `#223f84` y naranja `#fa8632`.
  - El cartel de muestra está dibujado como las placas reales: NFC a la izquierda y QR real a la derecha.
  - Los íconos de contacto son de Simple Icons (CC0).
  - Las imágenes de productos hechas con IA se descartaron.
- **Placas para imprenta:**
  - **Desde el 4/11 los diseños son las plantillas de la imprenta** y Canva no se usa más. Vienen en CMYK, todo vector, con sangrado, marcas de corte y caja de corte (TrimBox). La página las reconoce y las deja **tal cual**: no las aplana, no las achica y no les agrega margen ni línea de corte propia. Solo cambia el QR y el número.
  - Medidas: vinilos redondos de 10 cm (con su círculo de corte magenta) y placas de **10 × 20 cm** (la de 10 × 15 más 5 cm en blanco abajo, pedido de la imprenta).
  - **Todo lo que agrega la página va en CMYK** (pedido de la imprenta, para que tomen bien los negros): QR y número en K 100 %, recuadros blancos al 0 %.
  - El número sale **con la misma letra que el de ejemplo** (pedido del dueño): Calibri Bold en los vinilos (con Carlito, su copia libre) y Lato Semibold en las placas. Se reconoce sola, igual que el tamaño y el espacio entre cifras.
  - **La pestaña Canva se sacó del panel** (pedido del dueño, 4/11), con sus rutas y su código. Nunca se usó porque pedía Canva Enterprise. El dueño dio de baja el plan de Canva. El dueño borró de Vercel las variables `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` y `CANVA_BRAND_TEMPLATE_ID` (4/11).
  - Lo que sigue vale para los diseños viejos de Canva, si quedara alguno:
  - Las placas rectangulares (10×15) mantienen su medida, con **3 mm en blanco alrededor** (hoja de 106 × 156 mm) y línea de corte `CutContour` rectangular, de esquinas rectas. Pedido de la imprenta (29/10).
  - **Sin tipografías en los PDF** (pedido de la imprenta): el número va en curvas, y los fondos se aplanan a 400 dpi al subirlos ("Aplanar para imprenta"). Los diseños se exportan de Canva como **"PDF para imprimir"** y se cambian con "Reemplazar el PDF del diseño".
  - El número va siempre encima del recuadro blanco del QR. Antes se cortaba en los vinilos de Google.
  - Los **diseños cuadrados (vinilos de 10×10) salen redondos**, todos de **10 cm**: el aro de color se ajusta solo para terminar a 1 mm del corte (una franja blanca pareja en todos), con línea de corte `CutContour` y 2 mm de margen.
  - Va un PDF por vinilo (opción ZIP).
  - Para la imprenta: "línea de corte en CutContour, con 2 mm de sangrado".

## 7. Probar sin tocar producción

En las sesiones en la nube se probó todo con:
- un Postgres 16 local con el esquema y las migraciones;
- PostgREST 12;
- un servidor falso de Auth de Supabase (que deja pasar las llamadas REST a PostgREST);
- una Graph API de Meta falsa (`WHATSAPP_API_BASE` apunta a ella);
- `next build` + `next start` y Playwright.

Esos scripts vivían en el espacio temporal de la sesión y no se guardaron. Si hace falta, se rearman con esa receta. Para la ventana de Meta del registro insertado, Playwright intercepta `connect.facebook.net` y `www.facebook.com` con versiones falsas.
