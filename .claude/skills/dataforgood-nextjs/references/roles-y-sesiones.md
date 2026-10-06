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
| Quitar un bloqueo global de dispositivo | SuperUsuario (`/usuarios/sanciones`) |
| Tomar y dictaminar | Supervisor que no sea el creador y la campaña esté `en_revision` y libre; o el SuperUsuario. Solo quien la tomó dictamina (`lib/supervision/decision.ts`) |

## 5. Registro, verificación e inicio de sesión

- **Registro:** `POST /api/usuarios` crea la cuenta con `email_verificado = false` y arranca la verificación.
- **Verificación** (`lib/verification.ts`): código de 6 dígitos enviado por Gmail (`nodemailer`), guardado como hash. Vence en 15 minutos y admite 3 intentos. La cookie `pending_verification_id` liga la pantalla `/verificar` con la cuenta.
- **Inicio de sesión:** `POST /api/auth/login` con bcrypt (`lib/password.ts` también reconoce hashes viejos y los migra). Tras 5 fallos bloquea 15 minutos (`locked_until`). Rechaza cuentas sin verificar.
- **Google:** `GET /api/auth/google` genera `state` en la cookie `google_oauth_state`. El callback vincula `google_id` o crea la cuenta ya verificada.
- **Recuperar contraseña:** no existe.

## 6. Sanciones y baneos

- **Baneo por campaña:** el creador lo aplica con `POST /api/campanas/[id]/baneos` (tabla `campana_baneados`), y bloquea aportar a esa campaña. Lo ve y lo quita con `GET`/`DELETE` en la misma ruta, desde el detalle del aporte o la sección "Participantes baneados" de la bandeja. Las consultas viven en `lib/campanas/baneos.ts`. El participante ve el aviso antes de aportar gracias a `viewer.baneado` de `GET /api/campanas?id=`; en las listas cada campaña trae `isBanned` (etiqueta "Baneado" en `/campanas` y `/mis-aportes`), y `available=true` y el filtro "Puedo aportar" la excluyen. La ficha del usuario en el panel (`/usuarios/[id]`) lista sus baneos por campaña.
- **Sanciones del panel** (`aplicarSancion` / `restaurarAcceso`): `STRIKE`, `BANEO_DE_CAMPANA` y `SUSPENSION_TEMPORAL` (con días). El servidor valida que el tipo sea uno de `TIPOS_DE_SANCION`, que el detalle tenga al menos 20 caracteres y que una suspensión traiga días enteros mayores que cero. El estado de la cuenta (`ACTIVA`, `CON_STRIKES`, `SUSPENDIDA`, `BANEADA`) se calcula en `lib/usuarios/directorio.ts`.
- **Qué bloquea cada una** (`lib/sanciones.ts`, según los textos del formulario del panel):
  - `STRIKE` suma al contador. Al llegar a `STRIKES_PARA_BANEO` (3), `aplicarSancion` agrega en la misma transacción un `BANEO_DE_CAMPANA` con `aplicada_por = 'Automático'`, salvo que ya tenga un baneo activo. Bloquea la fila del usuario (`FOR UPDATE`) para que dos strikes simultáneos no generen dos baneos. En la bitácora queda como `sancion.aplicar` con `automatico: true`.
  - `SUSPENSION_TEMPORAL` bloquea la cuenta durante `dias` desde `aplicada_en`.
  - `BANEO_DE_CAMPANA` (en la interfaz, "Baneo permanente") bloquea la cuenta hasta que se restaure.
- **Qué significa "bloquear":**
  - `getSessionUser()` devuelve `null`, así que ninguna ruta, página ni acción lo deja pasar;
  - **no** se le saca de la app: conserva sus sesiones y puede iniciar sesión (correo o Google), pero `exigirUsuario()` (`lib/session.ts`) lo manda a `/cuenta-bloqueada`, que muestra si es baneo o suspensión (con fecha de fin), el motivo (`sanciones.detalle`) y un botón para cerrar sesión;
  - en páginas de servidor de la zona de usuario usa `exigirUsuario()` en vez de `getSessionUser()` + `redirect("/entrar")`: layout y página corren en paralelo y ambos deben llevar al mismo lugar;
  - `VigilanteDeSesion` (en el layout de `(dashboard)`) revisa la sesión en cada navegación en el cliente, para que una sanción aplicada a media sesión lleve a `/cuenta-bloqueada` sin esperar a recargar.
- **Restaurar** (`restaurarAcceso`) desbloquea de inmediato. Una suspensión vencida deja de bloquear sola.

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
- **`revertirAccion` no hace nada todavía:** ya exige sesión raíz, pero su lógica sigue en `TODO`. Cuando se implemente, debe registrar `supervision.revertir` en la bitácora.
- **Buscador de revisores** (`GET /api/usuarios?campanaId=&q=`, sin sesión raíz): solo el creador de esa campaña, con al menos 3 letras del nombre o un correo completo exacto. Devuelve 10 usuarios verificados como máximo, con el correo oculto (`an***@gmail.com`).
- **El límite de intentos de `/root` vive en memoria:** se reinicia con cada despliegue y no se comparte entre instancias. Hay dos límites: 5 por minuto por IP y 30 por minuto en total. La IP es el **último** valor de `X-Forwarded-For` (el que agrega el proxy), no el primero, que lo puede inventar el cliente.
