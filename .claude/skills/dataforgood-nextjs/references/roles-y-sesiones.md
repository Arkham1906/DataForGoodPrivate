# Cuentas, sesiones, roles y permisos

## Contenido
1. Dos tipos de sesión
2. Capas de protección
3. Roles
4. Acceso por campaña
5. Registro, verificación e inicio de sesión
6. Sanciones y baneos
7. Bitácora (`audit_log`)
8. Huecos conocidos

Las reglas de negocio y los puntos abiertos están en `dominio.md`, secciones 1, 2 y 9.

## 1. Dos tipos de sesión

| | Usuario | SuperUsuario |
| --- | --- | --- |
| Archivo | `lib/session.ts` | `lib/rootSession.ts` |
| Cookie | `session_token`, httpOnly, `SameSite=Lax`, 30 días | `root_session_token`, httpOnly, `SameSite=Strict`, 2 horas; o `Authorization: Bearer <token>` |
| Tabla | `sessions` (`usuario_id`) | `root_sessions` (sin usuario) |
| Leer | `getSessionUser()` → `SessionUser \| null` (con `cache` de React: una consulta por petición) | `hasRootSession()` → `boolean` |
| Crear / cerrar | `createSession(id)` / `destroySession()` | `createRootSession()` (cookie) o `emitirTokenRoot()` (Bearer) / `destroyRootSession()` |

- **Tokens:** 32 bytes aleatorios. En la BD solo se guarda su sha256.
- **El SuperUsuario no es una fila de `usuarios`.** Su credencial está en `ROOT_USER_ID` + `ROOT_PASSWORD_HASH` (bcrypt) y entra por `/root` → `POST /api/auth/root`. Para Swagger u otro cliente, `POST /api/auth/root/token` devuelve un token Bearer de 2 horas (otra fila de `root_sessions`, sin cookie; bitácora `root.token_api`); `hasRootSession()` acepta la cookie o ese encabezado. Las dos rutas validan con `verificarCredencialRoot()` (`lib/root-acceso.ts`): sin cortocircuito, 5 intentos por minuto por IP y 30 en total, con un `Map` en memoria. Con el token responden `GET /api/usuarios` (directorio completo, `buscarUsuarios()`) y `GET /api/usuarios/[id]` (cualquier id); el resto de la API es de la cuenta de un usuario.
- **Las dos sesiones son independientes.** Una persona con rol `supervisor` no entra al panel raíz, y la sesión raíz no sirve en `(dashboard)`.

## 2. Capas de protección

1. **`proxy.ts`:** en páginas solo comprueba que exista la cookie y redirige; no es autorización. En `/api`, rechaza con 403 las mutaciones (POST, PATCH, PUT, DELETE) cuyo `Origin` no sea el host de la petición (`Host` o `X-Forwarded-Host`) ni el de `APP_ORIGIN`; también las que traen `Sec-Fetch-Site: cross-site` sin `Origin`. Sin `Origin` (clientes que no son navegador) deja pasar, porque no pueden usar la cookie de otra persona. Las server actions no pasan por ahí: Next verifica su `Origin`.
2. **Layouts:** `(panel)/layout.tsx` (sesión raíz) y `(dashboard)/supervision/layout.tsx` (rol `supervisor`).
3. **Cada página, route handler y server action vuelve a verificar.** En el panel se usa `exigirSesionRoot()` (`lib/supervision/root.ts`) o `exigirSuperUsuario()` (`lib/usuarios/acciones-usuarios.ts`, `acciones-supervisor.ts`). En la API, `getSessionUser()` más la comprobación de permiso sobre el recurso. **Excepción actual:** las páginas de `/sistema` y `/usuarios/**` y sus funciones de lectura (`lib/sistema/metricas.ts`, `lib/usuarios/{directorio,dashboard,supervisores}.ts`) no vuelven a comprobar la sesión raíz: dependen solo de `(panel)/layout.tsx` (ver § 8). Sí lo hacen `/supervisar/**` (`lib/supervision/root.ts`) y `/sistema/campanas/**` (`lib/campanas/sistema.ts`).

## 3. Roles

`usuarios.role` es JSONB con códigos de `lib/roles.ts`: `usuario` (siempre), `supervisor`, `revisor` y `admin` (sin uso definido).

| Rol | Cómo se obtiene | Qué habilita |
| --- | --- | --- |
| Usuario común | Toda cuenta | Explorar, aportar, crear y administrar sus campañas |
| Revisor de aportes | El creador invita (`POST /api/campanas/[id]/revisores`) y la persona acepta desde sus notificaciones (`/api/notificaciones/[id]/aceptar`). Vale **por campaña** (`campana_revisores.estado = 'aceptado'`). `getSessionUser()` agrega `revisor` a `role` si tiene alguna asignación aceptada | `/revisiones`: acepta o rechaza los aportes de esas campañas con la misma autoridad que el creador (decisión final) |
| Supervisor | **Solo el SuperUsuario** (`asignarRol`). Al revocarlo (`revocarRol`), las campañas que tomó y siguen `en_revision` quedan libres | `/supervision`: tomar y dictaminar campañas `en_revision` ajenas |
| SuperUsuario | Credencial raíz | Panel `/sistema`, `/usuarios`, `/supervisar` |

- **Crear campañas no requiere rol.**
- **Supervisor y Revisor se pueden combinar.**
- **Los roles se leen en cada petición**, así que un cambio aplica en la misma sesión.
- **Nombres y textos de roles para la interfaz:** `lib/usuarios/rol-asignable.ts` (sin imports de servidor).

## 4. Acceso por campaña

No hay una función central: cada route handler lo comprueba con SQL. Si agregas una ruta, copia la comprobación del handler más parecido, o mejor, extrae una función a `lib/`.

| Acción | Condición |
| --- | --- |
| Bandeja, panel, especial, editar, pausar, invitar revisor, banear, regenerar el enlace público | `campanas.creator_id = user.id` |
| Ver el enlace público y el QR (cuadro Compartir) | Cualquier usuario con sesión |
| Aceptar o rechazar un aporte (decisión final) | Creador o revisor aceptado de esa campaña, si el aporte aún no tiene decisión. Decidido, nadie lo modifica |
| Ver el archivo de un aporte | Quien aportó, el creador, o un revisor aceptado si el aporte está `pendiente` o si él lo decidió (`app/api/aportes/[id]/archivo/route.ts`) |
| Aportar | Campaña `activa`, sin baneo en `campana_baneados`, cuota disponible y sin ser el creador |
| Aportar sin cuenta (persona anónima) | Solo desde `/c/[token]` con enlace vigente, campaña `activa` con `permite_anonimos` y sin bloqueo del dispositivo; cuota por dispositivo, 60 s de espera entre aportes del mismo dispositivo y tope por IP (`lib/campanas/aportes-anonimos.ts`). No ve ni modifica nada más |
| Reportar un aporte al creador | Revisor aceptado de esa campaña (no el creador). Banear sigue siendo del creador |
| Marcar un aporte anónimo como inapropiado | Creador o revisor aceptado, antes de la decisión o al rechazar (`PATCH /api/aportes/[id]` o `POST /api/aportes/[id]/inapropiado`) |
| Bloquear el dispositivo de un aporte anónimo en la campaña, borrar su archivo, apagar los aportes sin cuenta | Solo el creador |
| Quitar un bloqueo global de dispositivo | Quien modera: supervisor o SuperUsuario en modo supervisor (`.../sanciones`) |
| Ver y resolver reportes, dar avisos, banear, restaurar (2026-10-13) | Rol `supervisor` en `/supervision/{reportes,sanciones}` o el SuperUsuario en modo supervisor en `/supervisar/{reportes,sanciones}`. A cualquier usuario menos a sí mismo; un supervisor no ve los reportes contra él ni ve correos (salvo los de la lista negra) |
| Tomar y dictaminar | Supervisor que no sea el creador y la campaña esté `en_revision` y libre; o el SuperUsuario. Solo quien la tomó dictamina (`lib/supervision/decision.ts`) |

## 5. Registro, verificación e inicio de sesión

- **Registro:** `POST /api/usuarios` crea la cuenta con `email_verificado = false` y arranca la verificación.
- **Verificación** (`lib/verification.ts`): código de 6 dígitos enviado por Gmail (`nodemailer`), guardado como hash. Vence en 15 minutos y admite 3 intentos. La cookie `pending_verification_id` liga la pantalla `/verificar` con la cuenta.
- **Inicio de sesión:** `POST /api/auth/login` con bcrypt (`lib/password.ts` también reconoce hashes viejos y los migra). Tras 5 fallos bloquea 15 minutos (`locked_until`). Rechaza cuentas sin verificar.
- **Google:** `GET /api/auth/google` genera `state` en la cookie `google_oauth_state`. El callback vincula `google_id` o crea la cuenta ya verificada.
- **Recuperar contraseña** (implementado el 2026-10-07, decisiones del usuario; `lib/usuarios/recuperacion.ts`, pantalla `/recuperar`, `POST /api/auth/recuperar{, /restablecer}`): código de 6 dígitos por correo, como la verificación (15 min, 3 intentos, máximo uno cada 60 s por cuenta; `lib/usuarios/recuperacion-opciones.ts`). Pedirlo responde igual exista o no la cuenta, y el correo sale después de responder (`after()`), así que ni el mensaje ni el tiempo delatan la cuenta; todo fallo del código da el mismo error. Con el código se elige la contraseña nueva: quita el bloqueo por intentos, marca el correo como verificado (recibir el código lo demuestra), **cierra todas las sesiones y quita los avisos push** (a diferencia del cambio desde `/cuenta`), **no abre sesión** (va a `/entrar?contrasena=cambiada`) y se registra como `usuario.contrasena_recuperar`. **Una cuenta solo de Google también puede usarla y crea así su contraseña.** Pendiente: no hay tope por IP para pedir códigos (solo los 60 s por cuenta). **Con sesión, desde `/cuenta`, con código del correo** (2026-10-07, a pedido del usuario): **"Cambiar" ya no pide la contraseña actual**; y una cuenta de Google sin contraseña ve "Crear contraseña" (desde entonces entra de las dos formas). Las dos, en la misma ventana (`CambiarContrasena.tsx` + `ContrasenaConCodigo.tsx`), mandan un código al correo de la cuenta sin pedir que se escriba (ya hay sesión) (`POST /api/usuarios/[id]/contrasena/codigo`, 429 si se pide antes de 60 s) y con él guardan la contraseña (`POST /api/usuarios/[id]/contrasena`); el código va en seis casillas como en `/verificar` (`ui/CodigoDeSeisDigitos`, también en `/recuperar`). Se pide el código aunque haya sesión, para que una sesión robada no baste para quedarse con la cuenta (decisión tomada sin consulta). **Conservan las sesiones**; bitácora `usuario.contrasena_crear` o `usuario.contrasena_cambiar` con `conCodigo`.

## 6. Sanciones y baneos

- **Baneo por campaña:** el creador lo aplica con `POST /api/campanas/[id]/baneos` (tabla `campana_baneados`), y bloquea aportar a esa campaña. Lo ve y lo quita con `GET`/`DELETE` en la misma ruta, desde el detalle del aporte o la sección "Participantes baneados" de la bandeja. Las consultas viven en `lib/campanas/baneos.ts`. El participante ve el aviso antes de aportar gracias a `viewer.baneado` de `GET /api/campanas?id=`; en las listas cada campaña trae `isBanned` (etiqueta "Baneado" en `/campanas` y `/mis-aportes`), y `available=true` y el filtro "Puedo aportar" la excluyen. La ficha del usuario en el panel (`/usuarios/[id]`) lista sus baneos por campaña.
- **Quién modera (2026-10-13, a pedido del usuario):** reportes y sanciones pasaron del panel del SuperUsuario a la supervisión. Las mismas pantallas (`components/moderacion/*`) se ven en dos zonas: `/supervision/{reportes,sanciones,sanciones/[usuarioId]}` (rol `supervisor`) y `/supervisar/{reportes,sanciones,sanciones/[usuarioId]}` (sesión raíz, modo supervisor), con pestañas Campañas / Reportes / Sanciones arriba. Las páginas llaman a `exigirModerador(zona)` y las server actions de `lib/moderacion/acciones.ts` reciben la zona y comprueban su sesión con `moderadorDe(zona)` (`lib/moderacion/moderador.ts`), así que una acción desde `/supervision` nunca queda a nombre del SuperUsuario. Bitácora con el actor real; `sanciones.aplicada_por` = "SuperUsuario" o "Supervisor: <nombre>". Un supervisor no se sanciona, no se restaura y no ve ni descarta reportes contra él (`listarReportes`/`contarReportesPendientes` con su id). La pantalla de sanciones trae un buscador "Sancionar a alguien" (`buscarUsuarios`, sin mostrar correos). El contador de reportes pendientes va en "Modo supervisor" (panel) y en "Supervisión" (menú de usuario). Ya no existen `/reportes` ni `/usuarios/[id]/sancion`, y la ficha `/usuarios/[id]` no tiene "Sancionar". **El SuperUsuario sí ve la pestaña Sanciones de Usuarios fuera del modo supervisor** (`/usuarios/sanciones`, corrección del usuario el mismo día), pero **solo para consultar**: `PantallaDeSanciones` con `soloLectura` (sin buscador, "Restaurar" ni "Quitar bloqueo", el nombre lleva a la ficha y un aviso manda a Modo supervisor → Sanciones para actuar).
- **Sanciones** (`aplicarSancion` / `restaurarAcceso`): desde el 2026-10-12, solo `STRIKE` (aviso) o `BANEO_DE_CAMPANA` (baneo inmediato). El servidor valida que el tipo sea uno de `TIPOS_DE_SANCION` y que el motivo tenga al menos 20 caracteres. El estado de la cuenta (`ACTIVA`, `CON_STRIKES`, `SUSPENDIDA`, `BANEADA`) se calcula en `lib/usuarios/directorio.ts`.
- **Qué bloquea cada una** (`lib/sanciones.ts`, según los textos del formulario del panel):
  - `STRIKE` es un **aviso** y sigue la escala (`lib/usuarios/escala-de-avisos.ts`): el número es cuántos `STRIKE` lleva la cuenta (los de antes cuentan). 1.º solo la notificación; 2.º y 3.º agregan en la misma transacción una `SUSPENSION_TEMPORAL` de 2 y 7 días; 4.º o más un `BANEO_DE_CAMPANA` (o reutiliza el vigente) y el correo a `lista_negra_correos`. La consecuencia lleva `aplicada_por = 'Automático'` y su `detalle` empieza con "Aviso N de 4." (es lo que se ve en `/cuenta-bloqueada`). Bloquea la fila del usuario (`FOR UPDATE`) para que dos avisos simultáneos cuenten bien. Bitácora: un solo `sancion.aplicar` con `tipo: AVISO`, `aviso`, `bloqueo` y `listaNegra`.
  - `SUSPENSION_TEMPORAL` bloquea la cuenta durante `dias` desde `aplicada_en`.
  - `BANEO_DE_CAMPANA` bloquea la cuenta hasta que se restaure. El baneo inmediato (si ya hay uno vigente, responde error) también pone el correo en la lista negra.
  - **Lista negra** (`lib/usuarios/lista-negra.ts`): con el correo ahí, `POST /api/usuarios` responde 403 y el callback de Google no crea la cuenta (`/entrar?error=correo_bloqueado`). La cuenta baneada que ya existe sí entra, pero solo ve `/cuenta-bloqueada`. Comparación en minúsculas y sin espacios; no se normalizan los puntos ni los `+` de Gmail.
- **Qué significa "bloquear":**
  - `getSessionUser()` devuelve `null`, así que ninguna ruta, página ni acción lo deja pasar;
  - **no** se le saca de la app: conserva sus sesiones y puede iniciar sesión (correo o Google), pero `exigirUsuario()` (`lib/session.ts`) lo manda a `/cuenta-bloqueada`, que muestra si es baneo o suspensión (con fecha de fin), el motivo (`sanciones.detalle`) y un botón para cerrar sesión;
  - en páginas de servidor de la zona de usuario usa `exigirUsuario()` en vez de `getSessionUser()` + `redirect("/entrar")`: layout y página corren en paralelo y ambos deben llevar al mismo lugar;
  - `VigilanteDeSesion` (en el layout de `(dashboard)`) revisa la sesión en cada navegación en el cliente, para que una sanción aplicada a media sesión lleve a `/cuenta-bloqueada` sin esperar a recargar.
- **Restaurar** (`restaurarAcceso`) desbloquea de inmediato una suspensión o un baneo (un aviso no se restaura). Restaurar un baneo saca su correo de la lista negra. Una suspensión vencida deja de bloquear sola.
- **Reportes a la plataforma (2026-10-12, decisiones del usuario):** dos tipos en la tabla `reportes`, ambos contra una cuenta (`reportado_id`): **de campaña** (cualquiera con sesión menos el creador, campaña que no sea borrador, desde `/campanas/[id]` → `POST /api/campanas/[id]/reportar`; `viewer.yaReportada`) y **de aporte** (el creador o un revisor aceptado, solo aportes con cuenta, desde el detalle del aporte → `POST /api/aportes/[id]/reportar-participante`; `participanteReportado` en `GET /api/aportes/[id]`). Una vez por persona y campaña o aporte. Motivo de `MOTIVOS_DE_REPORTE_DE_CAMPANA` / `MOTIVOS_DE_REPORTE_DE_APORTE` (`lib/reportes/motivos.ts`) y/o descripción (máx. 500); formulario compartido `ui/ReportarAPlataforma`. Llegan a la bandeja de reportes de la supervisión (desde el 2026-10-13; antes `/reportes`) agrupados por caso (clave `campana-116` o `aporte-55`; pendientes en el menú lateral). **Quien modera confirma** (no es automático): "Dar aviso a <persona>" abre `.../sanciones/[usuarioId]?reportes=<clave>` y `aplicarSancion` da el aviso (o el baneo) y marca esos reportes `sancionado` en la misma transacción (si ya no quedan, no aplica nada); o **descarta** (`descartarReportes`, nota opcional, no cuenta como aviso). En `/usuarios/sanciones` la sanción dice "Por N reportes de <campaña>" o "del aporte #N en <campaña>". **La persona reportada no se entera del reporte ni de quién lo hizo**; solo recibe el aviso. Quien reporta no recibe el resultado. Bitácora: `campana.reportar`, `aporte.reportar_participante`, `reporte.descartar`, `sancion.aplicar`. Lógica en `lib/reportes/reportes.ts`.

## 7. Bitácora (`audit_log`)

`registrarAuditoria()` en `lib/auditoria.ts`, llamado después de que la acción se completó. Si el registro falla, solo se reporta en consola: no revierte la acción.

- **Qué guarda:** actor (`usuario` + id, `superusuario` o `anonimo`), acción, objetivo (`usuario:5`, `campana:3`, `aporte:7`, `dispositivo:2`), detalle JSONB e IP (`lib/ip.ts`: último valor de `X-Forwarded-For`). Para el actor `anonimo` la IP **no** se guarda (`guardarIp: false`): la IP de una persona sin cuenta no se guarda en ningún lado.
- **Acciones:** `rol.asignar`, `rol.revocar`, `sancion.aplicar`, `sancion.restaurar`, `supervision.tomar`, `supervision.dictaminar`, `campana.banear`, `campana.desbanear`, `campana.enlace_regenerar`, `revisor.invitar`, `revisor.aceptar`, `root.acceso`, `root.acceso_fallido` y `usuario.contrasena_cambiar` (no guarda ninguna contraseña). `root.acceso_fallido` no guarda el identificador tecleado, por si alguien escribió ahí la contraseña.
- **Sin pantalla:** todavía no hay vista en el panel para consultarla; se lee con SQL.

## 8. Huecos conocidos

- ~~**Campaña activa sin supervisión**~~ *Corregido el 2026-10-01: `POST /api/campanas` exige sesión (antes tomaba el creador del body), solo acepta `borrador` o `en_revision` y fija contadores, XP y "especial" del lado del servidor; el `PATCH` en borrador/en revisión/rechazada solo acepta esos dos estados; el `PUT` solo vale en esos estados. El límite de 5 activas se aplica al enviar a revisión. Regla en `lib/campanas/estado-del-creador.ts`.*
- **Panel protegido solo por el layout:** `/sistema` y `/usuarios/**` no llaman a `exigirSesionRoot()` y sus funciones de `lib/` no verifican. Las server actions que escriben sí. Detectado el 2026-10-01, sin corregir.
- **El tope y la espera por IP dependen del proxy:** `ipDelCliente` toma el último valor de `X-Forwarded-For`. Si alguien llega a la app sin pasar por el proxy (puerto 3000 abierto a Internet), puede escribir la IP que quiera. La cuota por dispositivo sí aplica. Se resuelve en el despliegue: el puerto de la app solo debe ser accesible desde el proxy. Detectado el 2026-10-01.
- ~~**`GET /api/campanas/[id]/recoleccion-diaria` sin comprobar creador**~~ *Corregido el 2026-10-01: solo el creador.* Las pantallas `/mis-campanas/[id]/{panel,especial}` siguen sin comprobar `viewer.isCreator` (sin datos que filtrar: la API ya responde 403).
- ~~**El registro acepta roles del body**~~ *Corregido el 2026-10-01: `POST /api/usuarios` guarda siempre `["usuario"]`.*
- ~~**`GET /api/usuarios/[id]` sin sesión**~~ *Corregido el 2026-10-01: solo la cuenta propia (401/403), como el `PATCH`. Ninguna pantalla lo usaba.*
- **Actividad de supervisores y reversión (2026-10-08, `/usuarios/supervisores`):** los datos salen de `campanas.supervisor_id` y de `supervision.tomar`/`supervision.dictaminar` en `audit_log` (`lib/usuarios/supervisores.ts`); también aparecen quienes ya no tienen el rol pero dejaron historial ("Ya no tiene el rol"). "Dictámenes" reemplaza a "Aportes validados" (el supervisor no valida aportes). **`revertirAccion`** (`lib/usuarios/acciones-supervisor.ts`, solo sesión raíz) deshace las 4 decisiones que existen, con las reglas de `puedeRevertirse`: *Tomó* (sigue en revisión y a su cargo) libera la campaña; *Aceptó* (sigue activa o aceptada y es el último dictamen) y *Rechazó* (sigue rechazada) la regresan a `en_revision` sin supervisor; *Reportó* retira el reporte sin cambiar el estado. En una transacción: asienta `supervision.revertir` (`detalle.accionId`, con índice único `audit_log_reversion_unica`: no se revierte dos veces), hace un UPDATE que vuelve a exigir el estado y deja una fila `reasignada` en `campana_supervisores` (así deja de figurar como reportada). Avisa siempre al supervisor (`supervision_revertida`, con causal y descripción) y al creador si se marca la casilla (`campana_en_revision`). La "observación en el expediente" es `detalle.observacionEnExpediente` y se lista en la actividad del supervisor. La acción original nunca se borra.
- **La lista de sanciones (2026-10-08; desde el 2026-10-13 en `/supervisar/sanciones` y `/supervision/sanciones`) muestra todas:** `listarSanciones()` (`lib/usuarios/directorio.ts`) junta las de la cuenta (tabla `sanciones`: strike, suspensión, baneo; las aplica el SuperUsuario o el baneo automático) y los baneos por campaña (los aplica el creador por un aporte; historial desde `campana.banear` en `audit_log`, porque la fila de `campana_baneados` se borra al quitarlo). Muestra tipo, motivo, campaña y aporte (o "Toda la cuenta"), quién la aplicó, fecha y estado (vigente, restaurada, vencida, levantado). "Restaurar" solo en suspensión o baneo de cuenta vigentes; el baneo en campaña lo quita su creador. Cada usuario (aunque tenga una sola) se compacta en un renglón resumen (cuántas, de qué tipo, la más reciente, cuántas vigentes) que se despliega al hacer clic (`usuarios/sanciones/lista.tsx`, cliente).
- **Buscador de revisores** (`GET /api/usuarios?campanaId=&q=`, sin sesión raíz): solo el creador de esa campaña, con al menos 3 letras del nombre o un correo completo exacto. Devuelve 10 usuarios verificados como máximo, con el correo oculto (`an***@gmail.com`).
- **El límite de intentos de `/root` vive en memoria:** se reinicia con cada despliegue y no se comparte entre instancias. Hay dos límites: 5 por minuto por IP y 30 por minuto en total. La IP es el **último** valor de `X-Forwarded-For` (el que agrega el proxy), no el primero, que lo puede inventar el cliente.
