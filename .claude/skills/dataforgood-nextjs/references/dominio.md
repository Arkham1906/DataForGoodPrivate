# Reglas de negocio

Este archivo partió de las pantallas y los textos del prototipo (rama `Prueba1`) y se actualiza conforme se implementa. Cada regla indica su fuente. Las reglas se aplican **en el servidor** (route handlers, server actions y funciones de `lib/`); la interfaz solo las comunica.

## Contenido
1. Cuentas y registro
2. Roles
3. Campañas
4. Aportes y cuota
5. Revisión de aportes (una sola instancia)
6. Enlace público y aportes anónimos
7. Experiencia (XP) y campañas especiales
8. Catálogos
9. Datos abiertos
10. Contradicciones y puntos abiertos
11. Notificaciones

## 1. Cuentas y registro

Fuentes: `(auth)/registro`, `verificar`, `bienvenida` y `entrar`.

- **Registro:** alias, correo único y contraseña confirmada, más aceptar los términos de uso y el aviso de privacidad. Si el correo ya existe, se muestra "Ese correo ya está registrado".
- **Contraseña:** mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial.
- **Verificación por correo:** código de 6 dígitos, que vence (la pantalla muestra una cuenta regresiva de unos 15 minutos) y admite **3 intentos**, con opción de reenviarlo. **Hasta verificar, la cuenta queda inactiva y no puede participar en campañas.**
- **Perfil inicial (se puede omitir):** estado, ciudad, especialidad opcional (solo es un título informativo: **no** influye en qué campañas supervisa alguien) y temas de interés. Si se omite, se asignan etiquetas por defecto según las campañas más populares de la zona.
- **Inicio de sesión:** correo y contraseña, o "Continuar con Google". "¿Olvidaste tu contraseña?" lleva a `/recuperar` (abajo).
- **Recuperar contraseña** (implementado el 2026-10-07, decisiones del usuario; `lib/usuarios/recuperacion.ts`, pantalla `/recuperar`, `POST /api/auth/recuperar{, /restablecer}`): código de 6 dígitos por correo, como la verificación (15 min, 3 intentos, máximo uno cada 60 s por cuenta; `lib/usuarios/recuperacion-opciones.ts`). Pedirlo responde igual exista o no la cuenta, y el correo sale después de responder (`after()`), así que ni el mensaje ni el tiempo delatan la cuenta; todo fallo del código da el mismo error. Con el código se elige la contraseña nueva: quita el bloqueo por intentos, marca el correo como verificado (recibir el código lo demuestra), **cierra todas las sesiones y quita los avisos push** (a diferencia del cambio desde `/cuenta`), **no abre sesión** (va a `/entrar?contrasena=cambiada`) y se registra como `usuario.contrasena_recuperar`. **Una cuenta solo de Google también puede usarla y crea así su contraseña.** Pendiente: no hay tope por IP para pedir códigos (solo los 60 s por cuenta).
- **Datos del usuario** (`User`): alias, email, avatar, estado, ciudad, especialidad, `xpTotal`, `level` y `streakDays`.
- **Baja voluntaria** (SCR-WEB-31 del prototipo `DataForGood_Acceso_v2`; decisiones del usuario del 2026-10-05). Implementada en `lib/usuarios/baja.ts`:
  - Se confirma con la contraseña (las cuentas de Google, solo escribiendo ELIMINAR) **y** escribiendo ELIMINAR. Una contraseña equivocada suma al bloqueo del login.
  - **30 días de gracia.** Se cierran todas las sesiones; **iniciar sesión dentro del plazo cancela la baja** (contraseña o Google).
  - Al pedirla: las campañas propias **activas o pausadas se finalizan**; las que **no tienen ningún aporte** (borrador, en revisión, aceptada) **se borran**; las finalizadas no se tocan. Esto no se revierte si la persona cancela.
  - Destino de los aportes, a elegir: **eliminarlos**, **conservarlos anónimos** o **conservarlos con su nombre** (nombre y apellidos; el correo se borra siempre).
  - **Aporte "ya utilizado"** = aceptado en una campaña **finalizada** (es parte de los datos abiertos). Nunca se borra: con "eliminar" se anonimiza igual. Los aceptados de campañas en curso, pendientes y rechazados sí se borran.
  - Al vencer el plazo: se aplica el destino, sus campañas muestran "Cuenta eliminada", se borran notificaciones y guardadas, deja de ser revisor y suelta las campañas que supervisaba sin dictamen. La fila de `usuarios` **no se borra** (se vacía: `eliminada_en`), porque `campanas.creator_id` es `ON DELETE CASCADE`. El correo queda libre para un registro nuevo y se pierden XP y nivel.

## 2. Roles

Fuentes: texto informativo de `/entrar` y la pantalla `agregar-revisor`.

| Rol | Alcance | Cómo se obtiene |
| --- | --- | --- |
| Usuario común | Global, implícito | Toda cuenta al registrarse |
| Supervisor | Global | **Solo lo asigna el SuperUsuario** (decidido el 2026-09-25; antes `/entrar` decía "o cualquier Supervisor activo") |
| Administrador de campaña | Global (según `/entrar`) | Lo asigna el SuperUsuario |
| Revisor de aportes | **Por campaña** (según `agregar-revisor`) | Invitación de quien administra la campaña; queda pendiente hasta que la persona acepta |
| SuperUsuario | Global | — |

- **Los roles nuevos aparecen dentro de la misma sesión**, sin volver a entrar. Por eso los permisos se recalculan en cada petición.
- **Quien crea una campaña la administra** desde `/mis-campanas/[id]/*`: bandeja, panel, especial, agregar revisor, editar y pausar. Compartir está en la descripción (`/campanas/[id]`), abierto a todos; el creador además regenera el enlace.
- **El Supervisor dictamina las campañas "En revisión".**
- **Sección Campañas del panel del SuperUsuario (solo consulta):** `/sistema/campanas` (listado con filtros, orden y paginación en SQL), `/sistema/campanas/dashboard` y `/sistema/campanas/[id]` (panel individual). Viven bajo `/sistema` porque `/campanas` y `/campanas/[id]` ya son pantallas del usuario común: dos route groups no pueden resolver a la misma URL. Los datos están en `lib/campanas/sistema.ts` (consultas, exigen sesión raíz) y `lib/campanas/sistema-opciones.ts` (constantes sin imports de servidor, las usa el cliente). Aportes y participantes se cuentan desde `aportes`; un participante es un `user_id` distinto, o un correo distinto si aportó sin cuenta.
- **Hay dos tipos de supervisor.**
  - **Usuario común promovido a Supervisor** (fila de `usuarios` con rol `supervisor`): usa `/supervision` con su sesión normal. Sus reglas están en el punto siguiente.
  - **El SuperUsuario** no tiene fila en `usuarios` (entra por `/root`, sesión en `root_sessions`). Supervisa desde **`/supervisar`**, dentro de `app/(panel)`. Es una copia aislada de `/supervision`: solo responde con sesión raíz, y un usuario con rol de supervisor que entre por URL es redirigido a `/root`. **Solo supervisa:** no crea campañas, no aporta ni revisa aportes. Sus dictámenes pasan por la server action `decidirComoSuperUsuario` (`lib/supervision/acciones-root.ts`) y dejan `campanas.supervisor_id = NULL` + `supervisado_por_root = true`, y en el historial `campana_supervisores.supervisor_id = NULL` + `por_superusuario = true`. Las reglas del dictamen (motivo obligatorio, "aceptada" con inicio futuro, notificación) viven en un solo lugar: `lib/supervision/decision.ts`, que también usa el `PATCH`.
- **Supervisor y Revisor de aportes no son excluyentes** (usuario promovido). Un Supervisor también puede crear campañas, aportar y revisar aportes (si lo invitan y acepta). Tiene dos límites: **no aporta a sus propias campañas** (regla general para cualquier creador, `app/api/aportes/route.ts`) y **no supervisa sus propias campañas** (no puede aceptar, rechazar ni reportar; se rechaza en `PATCH /api/campanas/[id]` y la interfaz lo oculta).
- **Sanciones de cuenta** (las aplica el SuperUsuario desde `/usuarios/[id]/sancion`; se implementan en `lib/sanciones.ts`):
  - `STRIKE` suma al contador, que nunca se borra.
  - **Al tercer strike la cuenta se banea automáticamente** (decidido el 2026-09-25). Si el SuperUsuario restaura ese baneo, el siguiente strike vuelve a banear. No es retroactivo: una cuenta que ya tenía 3 strikes antes de esta regla se banea con su próximo strike.
  - `SUSPENSION_TEMPORAL` bloquea la cuenta N días.
  - `BANEO_DE_CAMPANA` ("Baneo permanente") la bloquea hasta que se restaure.
  - Una cuenta bloqueada no puede entrar, y pierde sus sesiones abiertas.
- **El rol de Supervisor no da acceso a los archivos de aportes**, pero tampoco lo quita: los ve si es quien aportó, quien creó la campaña o revisor aceptado de ella (`app/api/aportes/[id]/archivo/route.ts`).

## 3. Campañas

Fuentes: `mis-campanas`, `NuevaCampanaForm`, `campanas/[id]` y `panel`.

- **Estados:** `borrador`, `en_revision`, `aceptada`, `activa`, `pausada`, `finalizada` y `rechazada`.
- **Transiciones permitidas:** Borrador → En revisión → Aceptada → Activa ⇄ Pausada → Finalizada. Desde En revisión también puede pasar a Rechazada.
  - **Aceptación con fecha de inicio futura (`app/api/campanas/[id]/route.ts` PATCH, decisión `aceptada`):** si el supervisor acepta una campaña cuya `start_date` es posterior a hoy, el estado de la campaña queda `aceptada` en vez de pasar directo a `activa`. Se activa sola cuando llega esa fecha — sin cron ni cola (no hay en el proyecto, ver `AGENTS.md`): `activateScheduledCampaigns` (`lib/campaign-date.ts`) corre en cada lectura de `/api/campanas` y hace `UPDATE ... WHERE status = 'aceptada' AND start_date <= hoy`, comparando fechas en JS (no `CURRENT_DATE` de Postgres) para no repetir el desfase de huso horario ya documentado arriba. Si la campaña no tiene `start_date`, se activa de inmediato como antes. Mientras está `aceptada` no aparece en `/campanas`, no acepta aportes y no cuenta para el límite de 5 activas — se edita igual que una `activa`/`pausada` (solo meta y fecha de fin, sin el atajo de "finalizar" porque todavía no arrancó a recolectar).
  - **Una campaña finalizada queda en solo lectura**, salvo el botón "Reactivar campaña" (vuelve a `activa`), disponible solo si la persona tiene menos de 5 campañas activas.
  - **Edición según estado (`app/api/campanas/[id]/route.ts` PATCH, `NuevaCampanaForm`):**
    - **Borrador, en revisión o rechazada:** se edita por completo (nombre, descripción, temática, tipos de dato, meta, cuota, vigencia, ubicación) y al reenviarla vuelve a quedar `en_revision`.
    - **Activa o pausada:** solo se puede cambiar la meta de aportes y la fecha de finalización; el resto de los campos se rechaza (400) y el estado no cambia. También desde aquí el creador puede finalizarla (`PATCH { status: "finalizada" }` → error si trae más campos).
    - **Aceptada:** igual que activa/pausada, solo meta y fecha de finalización (400 con cualquier otro campo), pero sin el atajo de finalizar (todavía no empezó a recolectar aportes).
    - **Finalizada:** de solo lectura para el resto de los campos; solo acepta un PATCH con `status: "activa"` y nada más, y lo rechaza (400) si ya tiene 5 campañas activas. Cualquier otro campo en un PATCH sobre una finalizada se rechaza (403).
  - **Finalizar manualmente:** en `/mis-campanas` (activa o pausada) hay un botón "Finalizar campaña" que solo ve y puede usar el creador (la lista ya viene filtrada por `mine=true`); el servidor igual valida `creator_id` antes de aplicar el cambio.
  - **Finalizar automáticamente por fecha de cierre (`finalizeExpiredCampaigns`, `lib/campaign-date.ts`):** una campaña `activa` cuyo `end_date` ya llegó pasa sola a `finalizada`, con el mismo mecanismo perezoso que `activateScheduledCampaigns` (sin cron ni cola, corre en cada lectura de `/api/campanas`, comparando fechas en JS). Una `pausada` no se finaliza sola por fecha: solo el botón manual la cierra.
- **Límite:** máximo **5 campañas activas a la vez** por persona. Pasado ese número, solo se permite guardar como borrador.
- **Formulario en tres bloques:**
  - **Datos básicos:** nombre (máx. 80), temática (una) y descripción (máx. 500).
  - **Qué se recolecta:** tipos de dato (uno o más entre texto, foto, video, audio y documento); meta total de aportes; cuota por persona; y **checklists con título** (cero o varios, cada uno con sus opciones) que el participante marca además de la descripción, que siempre es texto libre y obligatoria. *(2026-09-30: reemplaza el antiguo modo `checklist` / `texto_libre`, que era excluyente, y se quitaron los checklists de ejemplo. Datos en `campanas.checklist_secciones`; lógica en `lib/campanas/checklist.ts`. Las campañas viejas con `checklist_opciones` se leen como un checklist sin título.)*
  - **Vigencia y ubicación:** fecha de inicio y de fin, más ubicación: **estado obligatorio**; **municipio o "Todo el estado"** (decisión del usuario 2026-10-07: el formulario obliga a elegir uno de los dos; "Todo el estado" es solo una opción del selector y se guarda como `location_city` vacío; el servidor acepta el municipio vacío); colonia opcional y solo con municipio (sin municipio el servidor la guarda vacía). Catálogo en `lib/mexico-geo.ts`.
- **Otros datos:** organizador y XP por aporte aprobado.
- **Panel:** aportes aprobados, participantes, pendientes, porcentaje de la meta, recolección diaria, desglose por tipo de dato y días restantes. Mientras está activa, la pantalla dice "actualiza cada 3 s".
- **Acciones por estado:**
  - **Activa:** revisar aportes, panel, editar, hacer especial, compartir y pausar.
  - **Finalizada:** ver datos, descargar y compartir aportes.
- **Explorar:** filtro por temática en `searchParams` (`/campanas?tag=...`); se puede guardar como favorita.

## 4. Aportes y cuota

Fuentes: `campanas/[id]/aportar`, `mis-aportes` y `mis-aportes/[campanaId]`.

- **Un aporte tiene:** un archivo (según los tipos de la campaña), una descripción (obligatoria, máx. 1000) y respuestas de los checklists de la campaña, guardadas en `aportes.caracteristicas` como "Título: opción" (solo se aceptan opciones que existen en la campaña).
- **Fotos:** `.jpg`, `.jpeg` o `.png`, **máximo 10 MB**, **sin compresión automática**; si pesa más, se rechaza y la persona elige otra. Los límites de video, audio y documento no están definidos (punto abierto).
- **Tras enviar,** el aporte queda "Pendiente de revisión".
- **Cuota por persona:** al alcanzarla ya no se puede enviar más a esa campaña, aunque siga abierta para otras personas.
  - **Un aporte rechazado no libera cupo:** cuenta como enviado.
  - **Eliminar un aporte pendiente mientras la campaña sigue activa sí devuelve el cupo.** Una campaña finalizada no permite añadir ni eliminar.
  - **Estado real del código (2026-10-01):** `DELETE /api/aportes/[id]` deja borrar a quien aportó cualquier aporte que no esté `aceptado` (también uno `rechazado`, que según la regla de arriba no libera cupo) y no revisa el estado de la campaña. Falta alinear el endpoint con la regla.
- **Completar la cuota otorga un bono de 300 XP.**
- **Filtros de "Mis aportes":** Todas, Puedo aportar (campaña activa y cuota disponible), Cuota completa, Finalizadas y Favoritos.

## 5. Revisión de aportes (una sola instancia)

Fuentes: `mis-campanas/[id]/aportes` y `[aporteId]`.

- **Estados del aporte:** `pendiente` (sin revisar), `aceptado` y `rechazado`.
- **El revisor de aportes tiene la misma autoridad que el creador sobre los aportes** (decisión del usuario, 2026-10-06): cualquiera de los dos acepta o rechaza (`pendiente` → `aceptado` o `rechazado`) y **esa decisión es la final**; no hay segunda revisión.
  - **La decisión no se cambia** (decisión del usuario, 2026-10-06), la haya tomado quien sea: nadie cambia aceptado ↔ rechazado (409), quien aportó ya no lo edita, y el creador no borra su archivo ni lo marca inapropiado (409).
  - **Excepciones:** quien aportó **puede borrar su aporte rechazado** y recupera ese espacio de su cuota (uno aceptado no se borra nunca); el creador **puede banear o bloquear** desde un aporte ya decidido, porque es una acción sobre la persona. La regla vive en `lib/aportes/decision.ts` (`tieneDecision`, `ESTADOS_SIN_DECISION`) y cada escritura la vuelve a comprobar en el `WHERE` o con la fila bloqueada, así que si revisor y creador deciden a la vez, gana uno y el otro recibe 409.
  - Un aporte decidido **sale de las listas por revisar** ("Por aceptar" del revisor, "Pendientes" del creador) y se ve en el historial en **solo lectura** (pestañas Aceptados/Rechazados del creador, "Aceptados por ti" del revisor). Desde el aporte decidido el creador puede banear, bloquear o quitar el baneo, pero ya no aceptar ni rechazar.
  - `first_pass_by` / `first_pass_by_user_id` guardan qué revisor decidió (el creador ve su nombre); el nombre nunca se toma del body.
  - **"Reportar al creador"** (2026-10-06, a pedido del usuario): si un aporte es inapropiado o quien lo envió abusa, el revisor lo reporta con un motivo de la lista (`MOTIVOS_DE_REPORTE`) y/o una descripción. Al creador le llega la notificación `aporte_reportado` con enlace al aporte, y en el detalle ve el reporte (quién, cuándo, motivo) junto a su botón de banear. Uno por aporte, antes o después de decidirlo; quien aportó no lo ve. Lógica en `lib/aportes/reporte.ts`.
  - **El revisor acepta, rechaza, marca inapropiado y reporta.** Banear, bloquear un dispositivo y borrar archivos son **solo del creador**. Marcar inapropiado (creador o revisor) y borrar el archivo, solo mientras el aporte no tenga decisión o al rechazarlo; banear y bloquear, en cualquier momento.
  - Aceptar quita la marca de inapropiado, decida quien decida.
  - *Historia:* del 2026-10-01 al 2026-10-06 hubo dos instancias (el revisor aceptaba → `espera_final` → el creador daba la final). `espera_final` ya no se crea; si quedara alguno (p. ej. en producción), se decide como un `pendiente`. Al quitarla no había ninguno en la base local.
- **Contadores de la campaña** (`current/pending/approved/rejected_contributions`, `participants`): se **recalculan** desde `aportes` después de cada envío, revisión o borrado (`recalcularContadores()`, `lib/aportes/comun.ts`), con la fila de la campaña bloqueada (`FOR NO KEY UPDATE`; `FOR UPDATE` choca con la llave foránea de los aportes y produce deadlocks). Antes se sumaban y restaban y un cambio de decisión los desfasaba.
- **Rechazar exige un motivo:** uno de la lista ("Contenido borroso o ilegible", "No corresponde a la campaña", "Datos incompletos", "Contenido duplicado") o uno redactado. Se guarda en `aportes.rejection_reason`.
  - **Dónde lo ve el participante:** en `/mis-aportes/[campanaId]`, bajo el aporte rechazado (`ContributionCard`), y en una notificación con el motivo (desde el 2026-10-06, ver § 11). En un aporte anónimo nadie lo recibe.
- **Desde el detalle de un aporte se puede "Banear de la campaña"** al participante. El baneo es por campaña, no global.

## 6. Enlace público y aportes anónimos

Fuente: pantalla de compartir del prototipo; hoy es el cuadro "Compartir" de `/campanas/[id]`.

- **Enlace:** `dataforgood.mx/c/{token}`, con código QR descargable en PNG y SVG (512 × 512 px).
- **Aportes anónimos:** quien abre el enlace puede aportar **sin registrarse** mientras el token siga vigente. Esos aportes aparecen como "Anónimo" (`userId = null`).
- **Vencimiento y regeneración:** el token vence (la pantalla muestra unas 21 horas restantes). Al regenerarlo se crea una dirección nueva y la anterior queda inutilizable **para siempre**; los aportes ya recibidos se conservan.
- **Estadísticas del enlace vencido:** aportes recibidos y visitas.
- **Estado técnico (2026-10-01):**
  - **Implementado:** tabla `campana_enlaces` (una fila por token; regenerar revoca la anterior con `revocado_en` sin borrarla), lógica en `lib/campanas/enlaces.ts`, cuadro **Compartir** (`<dialog>`) en la descripción de la campaña `/campanas/[id]` (`compartir.tsx`; ya **no** existe `/mis-campanas/[id]/compartir`), `GET`/`POST /api/campanas/[id]/enlace` (consultar / regenerar, este último auditado como `campana.enlace_regenerar`) y `GET /api/campanas/[id]/qr?formato=png|svg` (QR con `qrcode`). La URL es `absoluteUrl("/c/<token>")`, no un dominio fijo.
  - **Decidido el 2026-10-01:**
    - El token vale **24 horas** (`HORAS_DE_VIGENCIA`) y **solo existe con la campaña `activa`**.
    - **Se genera solo al aceptarse la campaña:** en cuanto queda `activa` (aceptada y ya empezó, al llegar su fecha de inicio si se aceptó antes, o al reactivarse) con `asegurarEnlaceVigente`, en `lib/supervision/decision.ts`, `activateScheduledCampaigns` y `PATCH`/`PUT /api/campanas/[id]`. No se genera en el estado `aceptada` con inicio futuro: vencería antes de que la campaña empiece.
    - **Cualquiera con sesión** abre "Compartir" en `/campanas/[id]` y obtiene el enlace y el QR. **Solo el creador** lo regenera y ve sus visitas y aportes.
  - **Ruta pública `/c/[token]`:** valida el token en el servidor en cada apertura (inexistente, revocado, caducado, campaña no activa) y cuenta una visita por apertura de un enlace vigente. Para aportar **pide iniciar sesión o registrarse** (con `?next=` a `/campanas/[id]/aportar?enlace=<token>`); `POST /api/aportes` guarda el enlace en `aportes.enlace_id` si es el vigente de la campaña. Así "aportes recibidos" del enlace es real.
  - **Aporte anónimo (implementado el 2026-10-01):**
    - Sin sesión, `/c/[token]` muestra un formulario que envía a `POST /api/c/[token]/aportes`. La lógica está en `lib/campanas/aportes-anonimos.ts`.
    - **La persona anónima solo participa si le comparten la campaña.** No ve ni toca nada más del sistema: ni sus aportes después, ni archivos, ni la app. Solo ve lo que muestra `/c/[token]`.
    - El aporte se guarda sin datos personales: `user_id` NULL, "Anónimo", sin correo y sin nombre de archivo. Lleva `enlace_id` y `anonimo_id`, que es el sha256 de la cookie del dispositivo.
    - Con sesión iniciada, el endpoint responde 409: se aporta con la cuenta.
    - El creador lo revisa como cualquier aporte; nadie recibe el motivo del rechazo. En vez de "Banear" tiene las sanciones de abajo.
    - En las métricas, un dispositivo cuenta como participante.
    - **Espera entre aportes** (2026-10-01): 60 segundos entre dos aportes sin cuenta del mismo dispositivo, en cualquier campaña (`ESPERA_ENTRE_APORTES_SEGUNDOS`, `TODO(dominio)`: valor elegido sin consulta). Responde 429 con `esperaSegundos` y `Retry-After`; el formulario muestra la cuenta regresiva. Se comprueba dentro del candado, así que envíos simultáneos tampoco la saltan. **Sin cookie** (dispositivo nuevo), la espera también cuenta desde el último aporte anónimo de la misma IP, llevado en memoria (no se guarda en la BD); con cookie propia no se espera por otros de su IP. Antes, quien no mandaba la cookie se saltaba la espera y la cuota.
    - La foto se guarda sin metadatos (EXIF con GPS, etc.) y solo si es de verdad JPG o PNG (`lib/aportes/imagen.ts`). Lo mismo aplica a los aportes con cuenta.
  - **Sanciones para anónimos (implementado el 2026-10-01, `lib/aportes/sanciones-anonimas.ts`):**
    1. **Aporte:** casilla "Contenido inapropiado" al rechazar (creador o revisor) o botón "Marcar como inapropiado" (`POST /api/aportes/[id]/inapropiado`, sin cambiar el estado, solo antes de la decisión). Si se acepta, la marca se quita. Solo los marcados cuentan para el nivel 4. El creador puede **borrar el archivo** de MinIO mientras el aporte no tenga decisión.
    2. **Campaña:** el creador bloquea el dispositivo en su campaña ("Bloquear este dispositivo", misma API que el baneo). Solo por dispositivo, sin vencimiento; se quita desde "Participantes baneados".
    3. **Enlace:** regenerar el token y el interruptor "Permitir aportes sin cuenta" del cuadro Compartir (`campanas.permite_anonimos`). Apagado, `/c/[token]` solo invita a entrar o registrarse.
    4. **Plataforma:** 3 aportes inapropiados del mismo dispositivo en 30 días lo bloquean 30 días en todas las campañas (solo el dispositivo). El SuperUsuario lo ve y lo quita en `/usuarios/sanciones`. Todo queda en `audit_log`.
  - Las columnas viejas `campanas.share_token`/`share_token_expires_at` ya no se usan.

## 7. Experiencia (XP) y campañas especiales

Fuentes: `especial`, `campanas/[id]` y `mis-aportes`.

- **XP por aporte:** se otorga solo por aportes **aprobados**. La campaña define XP por aporte, y la pantalla de especial muestra XP base por tipo (ver punto abierto 4).
- **Bono:** completar la cuota otorga 300 XP. Las campañas especiales pueden dar una insignia exclusiva (ejemplo: "Guardián verde") al completarla.
- **Campaña especial:** un periodo con **multiplicador de XP de ×1 a ×3** (tope del sistema).
- **Tope diario de XP por usuario:** existe y sigue vigente durante el periodo especial; su valor no está definido.
- **Perfil:** nivel y racha de días.

## 8. Catálogos

- **Temáticas de campaña e intereses del perfil:** una sola lista de 23 en `lib/intereses.ts` (`TEMAS_DE_INTERES`), desde el 2026-09-30.
- **Estados y municipios:** `lib/mexico-geo.ts`. **Especialidades:** `lib/perfil-opciones.ts`.
- **Motivos de rechazo:** ver sección 5 (todavía repetidos en las pantallas que los usan).

Si agregas un catálogo, ponlo en un archivo sin imports de servidor para que lo use el cliente.

## 9. Datos abiertos

Fuentes: pantalla pública `/` (landing) y `/datos` (catálogo).

- **Qué es un "conjunto de datos abierto":** hoy, simplemente una campaña con `status = 'finalizada'`, leída directo de `campanas` + `aportes` (`lib/open-data.ts`). No hay tabla ni paso de "publicar" propios todavía: se calcula en vivo.
- **Qué se muestra y de dónde sale (todo real, sin datos inventados):**
  - nombre, organizador, temática, tipos de dato, aportes aprobados, ubicación y fecha de cierre → columnas de `campanas`.
  - **formatos** → `DISTINCT file_mime_type` de los aportes `aceptado` de la campaña, mapeado a una etiqueta corta (JPG, PNG, MP4...).
  - **peso (tamaño)** → `SUM(file_size_bytes)` de esos mismos aportes.
  - **descargas** → columna `campanas.downloads_count`; sube en cada ZIP generado por `GET /api/datos/[id]/descarga` (no cuando el navegador termina de bajarlo).
  - **verificado** → `campanas.supervisor_id IS NOT NULL` (tuvo supervisor asignado antes de finalizar).
  - **calidad (0-10)** → `aceptados / (aceptados + rechazados)` de la campaña, escalado a 0-10; `null` (se oculta) si todavía no hay dictámenes. **Decisión del equipo (2026-09):** fue la fórmula elegida entre varias opciones cuando se preguntó, a falta de una definición previa.
  - **licencia** → valor fijo `"CC BY 4.0"` para todo el catálogo. **Decisión temporal del equipo (2026-09):** no hay campo por campaña ni selector en `NuevaCampanaForm`; si se necesita variar por campaña, hay que agregar la columna y el selector.
- **Descarga real:** `GET /api/datos/[id]/descarga` arma un ZIP en memoria con `archiver` (paquete agregado para esto) leyendo los archivos de MinIO, los renombra `aporte-001.ext`, `aporte-002.ext`... (sin nombre ni correo de quien participó) y responde 404 si la campaña no está finalizada o no tiene archivos aceptados con `file_path`.
- **Filtros del catálogo (`/datos`):** búsqueda de texto, temática y estado, de un solo valor cada uno (no multi-selección) y resueltos en SQL contra `campanas`. Orden por recientes, cobertura, descargas o calidad. Las facetas de temática/estado muestran conteos sobre el total de finalizadas, no recalculados por combinación de filtros.

## 10. Contradicciones y puntos abiertos

**No los resuelvas por tu cuenta.** Pregunta, o deja un TODO explícito y menciónalo.

1. **Quién asigna al Revisor de aportes.** `/entrar` dice que "revisor y administrador de campaña los asigna el SuperUsuario". `agregar-revisor` dice que quien administra la campaña lo invita y que el rol aplica solo dentro de esa campaña. *El código sigue la segunda versión: el creador invita y la persona acepta; el SuperUsuario solo puede revocarlo (`lib/usuarios/acciones-usuarios.ts`).*
2. **Administrador de campaña.** Se menciona como rol que asigna el SuperUsuario, pero en la rama cualquier usuario crea y administra sus campañas. ¿Qué agrega este rol?
3. **Colaborador de Supervisor.** Aparecía en requisitos anteriores; no existe en la rama. ¿Sigue vigente?
4. **Cálculo de XP.** `xpPerContribution` por campaña (50, 40, 35, 30) frente a XP base por tipo en la pantalla de especial (texto 10, foto o documento 25, audio o video 50). ¿Cuál manda, o se combinan?
5. ~~**Catálogo de temáticas.** El filtro de `/campanas` usa "Salud y bienestar" y omite varias categorías; el formulario usa "Salud urbana".~~ *Resuelto (2026-09-30): una sola lista de 23 temáticas en `lib/intereses.ts` para intereses del perfil y temáticas de campaña; los filtros de `/campanas` se arman con las temáticas de las campañas activas.*
6. **Límites de archivos** para video, audio y documento, y formatos de documento. Hoy `POST /api/aportes` solo acepta JPG y PNG de hasta 10 MB y 50 megapíxeles (`MAXIMO_DE_MEGAPIXELES` en `lib/aportes/imagen.ts`, valor elegido sin consulta el 2026-10-01).
7. ~~**Cuota de aportes anónimos.** Sin cuenta no hay persona a quien contar: ¿límite por dispositivo o IP, o solo la meta total?~~ *Resuelto (2026-10-01): la misma cuota por persona de la campaña, contada **por dispositivo** (cookie `anonimo_id`), más un **tope por IP** contra abuso. El valor del tope (20 aportes anónimos por IP por hora, `TOPE_POR_IP_POR_HORA`) se eligió sin consulta: confirmarlo con el equipo. Vive en memoria, así que se reinicia con cada despliegue.*
8. ~~**Rechazo en primera instancia.**~~ *Resuelto (2026-10-06): el revisor acepta o rechaza con la misma autoridad que el creador y su decisión es final (§ 5). `/revisiones/[aporteId]` tiene Aceptar y Rechazar con motivo.*
9. **Valor del tope diario de XP.**
10. ~~**Recuperación de contraseña.**~~ *Resuelto (2026-10-07): ver § 1.*
11. **La meta de la campaña** ¿cuenta aportes recibidos o solo aprobados? El panel usa ambos.
12. ~~**Reparto de campañas a supervisores** por especialidad: ¿automático o manual?~~ *Resuelto (2026-09-24): no hay reparto. Cada supervisor (usuario promovido o SuperUsuario) ve todas las campañas `en_revision` (menos las suyas, en el caso del usuario) y **escoge** cuáles supervisa. La especialidad es solo un título informativo.*
    - **Un solo supervisor por campaña.** Se toma con el botón **"Supervisar esta campaña"** (`PATCH /api/campanas/[id]` con `{ action: "tomar" }` para usuarios; server action `tomarComoSuperUsuario` para root). El `UPDATE` es atómico: solo pasa si la campaña sigue `en_revision` y sin supervisor (`supervisor_id IS NULL AND NOT supervisado_por_root`). Si dos la toman a la vez, gana uno y el otro recibe 409.
    - **Solo quien la tomó** puede aceptar, rechazar o reportar (`registrarDecisionDeCampana` responde 403 a cualquier otro). En la lista "Por supervisar" cada supervisor ve solo las libres y las suyas.
    - La campaña se queda con ese supervisor aunque el creador la corrija y la reenvíe tras un rechazo.
    - Al revocar el rol de Supervisor, las campañas que tomó y siguen `en_revision` vuelven a quedar libres (`revocarRol`). No existe un botón para "soltar" una campaña.
13. **"Actualiza cada 3 s" en el panel:** polling o websockets.
14. **Publicación de datos abiertos.** ¿Quién dispara la publicación al finalizar una campaña (automática o manual) y qué anonimización explícita aplica sobre los aportes más allá de excluir nombre/correo del ZIP? *Resuelto parcialmente (2026-09): calidad, licencia y descarga real ya están definidas, ver § 9. Sigue abierto si "finalizar" debe congelar/copiar los datos en vez de leerlos en vivo de `campanas`/`aportes`.*
15. **Topes de checklists** (2026-09-30): 50 checklists de 50 opciones y 120 caracteres por texto (`lib/campanas/checklist.ts`). Son técnicos, elegidos sin consulta: ¿el equipo quiere otros?
16. **Motivo visible al sancionado** (2026-09-30): `/cuenta-bloqueada` muestra tal cual el `detalle` que escribe el SuperUsuario. ¿Se redacta pensando en la persona o conviene un campo aparte para el mensaje?
17. ~~**Motivo del baneo por campaña.**~~ *Resuelto (2026-10-06): sí se le muestra. Lo recibe en la notificación `campana_baneo` y lo ve en `/campanas/[id]` y `/campanas/[id]/aportar` (`viewer.motivoDeBaneo` de `GET /api/campanas?id=`, `motivoDeBaneo()` en `lib/campanas/baneos.ts`). El formulario de baneo avisa al creador que la persona lo verá.*
18. ~~**Sanciones para aportes anónimos**~~ *Implementado el 2026-10-01 (ver § 6). Decisiones: marcan "inapropiado" el creador y el revisor (confirmado por el usuario el 2026-10-06); bloquear, borrar el archivo y apagar los anónimos, solo el creador; nivel 4 con 3 inapropiados en 30 días → 30 días de bloqueo (números provisionales, `TODO(dominio)` en `lib/aportes/sanciones-anonimas.ts`); al principio se guardó el HMAC de la IP (`ANONIMO_IP_SECRETO`) para bloquear también la red, pero el mismo 2026-10-01 se quitó a pedido del usuario: la IP de una persona sin cuenta no se guarda en ningún lado y el bloqueo global es solo por dispositivo. Abajo, la propuesta original.*
    - **Situación actual:** si una persona sin cuenta sube algo indebido, solo se puede **rechazar** el aporte. Nadie recibe el motivo, no hay "Banear" y la persona sigue aportando hasta su cuota.
    - **Identificador disponible:** solo `aportes.anonimo_id`, el hash de la cookie del dispositivo; la IP no se guarda. Borrar las cookies o usar modo incógnito da un dispositivo nuevo, así que la meta es volver tedioso el abuso, no imposible.
    - **Propuesta aceptada:**
      1. **Aporte:** casilla "Contenido inapropiado" al rechazar; solo esos cuentan para lo demás. El creador puede borrar el archivo de MinIO si es ilegal o dañino.
      2. **Campaña:** el creador bloquea ese dispositivo en la campaña. Es como el baneo por campaña, pero por `anonimo_id`, y se quita desde "Participantes baneados".
      3. **Enlace:** regenerar el token (ya existe) y un interruptor por campaña "Permitir aportes sin cuenta".
      4. **Plataforma:** 3 aportes inapropiados del mismo dispositivo lo bloquean en toda la plataforma por un tiempo. El SuperUsuario lo ve y lo restaura en `/usuarios/sanciones`, y queda en `audit_log`.
    - **Orden sugerido:** implementar 1–3 primero; el 4, cuando se fijen sus números.
    - **Por decidir:**
      - Quién marca "inapropiado". Propuesta: creador y revisor. Bloquear, borrar el archivo y cortar los aportes anónimos, solo el creador.
      - Los números del nivel 4: cuántos aportes y cuánto dura el bloqueo.
      - Si guardar un HMAC de la IP. Recomendación: no, salvo que haya abuso real.

## 11. Notificaciones

*Implementado el 2026-10-06.* Hoy son 16 tipos. Cada evento crea una fila en `notificaciones` con `notificar()` (`lib/notificaciones/notificaciones.ts`), después de completarse la acción. Si falla, solo se registra en el log: avisar nunca tumba la acción. Las ve la persona en la campana del `TopBar` (las 8 más nuevas; consulta cada minuto con la pestaña visible y al volver a ella) y en `/notificaciones` (historial de 20 en 20, filtro "Sin leer").

| Para | Tipo | Cuándo | Lleva a |
| --- | --- | --- | --- |
| Participante | `aporte_aceptado`, `aporte_rechazado` (con motivo) | Decisión del creador o del revisor en `PATCH /api/aportes/[id]` (las dos son finales). Anónimos: nadie | `/mis-aportes/[campanaId]` |
| Participante | `campana_baneo` (con motivo), `campana_desbaneo` | El creador banea o quita el baneo (`/api/campanas/[id]/baneos`) | `/campanas/[id]` |
| Creador | `campana_aceptada`, `campana_rechazada` (con motivo), `campana_reportada` | Dictamen en `lib/supervision/decision.ts` (supervisor o SuperUsuario) | Panel si quedó activa; si no, `/mis-campanas` |
| Creador | `campana_iniciada`, `campana_finalizada` | Activación o cierre **por fecha** (`lib/campaign-date.ts`). El `UPDATE ... RETURNING` asegura un solo aviso. Si el creador la finaliza a mano, no se avisa | `/mis-campanas/[id]/panel` |
| Creador | `aporte_reportado` | Un revisor reporta un aporte (`POST /api/aportes/[id]/reportar`) | `/mis-campanas/[id]/aportes/[aporteId]` |
| Creador | `revisor_acepto` | La persona invitada acepta (`POST /api/notificaciones/[id]/aceptar`) | `/mis-campanas/[id]/aportes` |
| Invitado | `invitacion_revisor` | El creador invita (`POST /api/campanas/[id]/revisores`). Se acepta desde la campana o `/notificaciones`; **no se puede borrar mientras siga pendiente** (409) | — |
| Usuario | `rol_asignado`, `rol_revocado` | El SuperUsuario asigna o quita Supervisor, o quita Revisor. Solo si el rol cambió de verdad | `/supervision` al asignar |
| Usuario | `sancion_aplicada` (strike con "Llevas N de 3", suspensión con días, baneo; también el baneo automático al tercer strike), `sancion_restaurada` | `aplicarSancion` / `restaurarAcceso`. Restaurar un strike no avisa (no bloqueaba nada). Con la cuenta bloqueada la persona no la ve hasta recuperar el acceso: mientras, `/cuenta-bloqueada` muestra el motivo | — |

- **Leída:** abrir una notificación la marca como leída. También "Marcar como leída/no leída" por notificación y "Marcar todas como leídas". Se puede borrar cualquiera salvo una invitación pendiente.
- **Sin correo.** La campana consulta cada minuto (decisión del usuario, 2026-10-06).
- **Notificaciones push** (2026-10-06, a pedido del usuario): cada notificación sale también como aviso del teléfono o navegador, aunque la app esté cerrada, si la persona lo activó en "Avisos en este dispositivo" (`/notificaciones`). Web Push con `web-push` y llaves VAPID (`.env`); `public/sw.js` las muestra y al tocarlas abre su enlace; `app/manifest.ts` + íconos `public/icono-*.png` permiten instalarla.
  - **Android** (Chrome, Firefox): en el navegador. **iPhone:** solo agregando la app a la pantalla de inicio (iOS 16.4+); la pantalla lo explica. Requiere HTTPS (en local, el túnel).
  - La suscripción es del navegador, a nombre de quien tenga la sesión: al cargar se resincroniza; **al cerrar sesión se quita**; en la baja definitiva se borran. Solo se aceptan endpoints de Google, Apple, Mozilla y Microsoft (evita que el servidor haga peticiones a sitios arbitrarios). Hasta 10 por persona. TTL de 1 día.
  - El contenido del push (título y mensaje) pasa cifrado por el servicio de push del teléfono.
- **Pendientes:**
  - La reversión de una decisión de supervisor (`revertirAccion`) aún no tiene lógica; cuando la tenga debe avisar al supervisor con el motivo, como pide el prototipo.
  - No se borran notificaciones viejas: si crece la tabla, decidir una retención (p. ej. leídas de más de 6 meses) y correrla en `instrumentation-node.ts`.
  - El fin de una suspensión por tiempo no avisa (no hay cron).
