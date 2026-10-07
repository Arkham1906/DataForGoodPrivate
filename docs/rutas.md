# Rutas: pantallas y endpoints

Cada fila dice **qué archivo implementa la ruta**, **de dónde obtiene sus datos** y **quién puede entrar**. Las rutas no llevan el prefijo `/dataforgood` que se agrega en producción (ver `BASE_PATH` en [README.md](README.md) § 6).

Abreviaturas de la columna "Tipo":

- **S:** Server Component. Lee los datos en el servidor, con funciones de `lib/` o SQL directo.
- **C:** componente cliente (`"use client"`). Lee los datos con `fetch` a `/api/...` desde el navegador.

## Contenido
1. [Pantallas públicas](#1-pantallas-públicas)
2. [Cuenta: `(auth)`](#2-cuenta-auth)
3. [Zona de usuario: `(dashboard)`](#3-zona-de-usuario-dashboard)
4. [Panel del SuperUsuario: `(panel)`](#4-panel-del-superusuario-panel)
5. [API: `app/api`](#5-api-appapi)
6. [Server actions](#6-server-actions)
7. [Qué protege cada capa](#7-qué-protege-cada-capa)

---

## 1. Pantallas públicas

No piden sesión. Archivos en `app/` (fuera de los grupos).

| URL | Archivo | Tipo | Datos |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | S | SQL directo (`lib/db.ts`) para las cifras de la portada, y `lib/open-data.ts` para los conjuntos destacados. `revalidate = 300`: se regenera cada 5 min y sus consultas van en `try/catch` porque el build corre sin BD |
| `/explorar` | `app/explorar/page.tsx` | S | `lib/campanas/publicas.ts` (`buscarCampanasActivas`, `obtenerTematicasActivas`, `obtenerEstadosActivos`). Filtros en `searchParams`; opciones de temática, estado y orden en filas desplazables en móvil, verticales en escritorio. Al abrir una campaña manda a `/campanas/[id]`, que pide sesión |
| `/datos` | `app/datos/page.tsx` | S | `lib/open-data.ts` (`buscarConjuntosAbiertos`, facetas). Catálogo de campañas `finalizada` |
| `/datos/[id]` | `app/datos/[id]/page.tsx` | S | `lib/open-data.ts` (`obtenerConjuntoAbierto`). El botón de descarga apunta a `GET /api/datos/[id]/descarga` |
| `/contacto`, `/privacidad`, `/sobre-nosotros` | `app/<nombre>/page.tsx` | S | Texto fijo |
| `/c/[token]` | `app/c/[token]/page.tsx` | S | Enlace público de una campaña (se comparte como enlace o QR desde `/campanas/[id]`). `lib/campanas/enlaces.ts`: `buscarEnlacePorToken` y `registrarVisita` (una visita por IP cada 30 min, en memoria). Si el token es vigente y la campaña está activa, invita a aportar: con sesión → `/campanas/[id]/aportar?enlace=<token>`; **sin sesión → formulario anónimo** (`aporte-anonimo.tsx` → `POST /api/c/[token]/aportes`; cuántos le quedan con `aportesDelDispositivo` de `lib/campanas/aportes-anonimos.ts`) y opción de `/entrar` o `/registro` con `?next=`. Si no, muestra "no válido", "ya no funciona" (revocado) o "caducó". Sin formulario si el creador apagó los aportes sin cuenta o si el dispositivo está bloqueado (`bloqueoParaLaPagina`). Es lo único que ve una persona anónima. No indexable |
| `/baja-solicitada` | `app/baja-solicitada/page.tsx` | S | Pública (la sesión ya se cerró). Confirma la baja con lo que llega en la URL (fecha, campañas finalizadas, aportes, XP, destino); no lee la BD. "Cancelar la baja" lleva a `/entrar` |
| `/cuenta-bloqueada` | `app/cuenta-bloqueada/page.tsx` | S | `obtenerBloqueoDeLaSesion()` de `lib/session.ts`; dibuja `components/layout/CuentaBloqueada.tsx`. Si la cuenta no está bloqueada, redirige a `/campanas` o a `/entrar` |
| `/api/docs` | `app/api/docs/route.ts` | — | Swagger UI de `openapi.yaml`. Abierta en `next dev`; en producción pide sesión raíz (`lib/api-docs.ts`) |

## 2. Cuenta: `(auth)`

`app/(auth)/layout.tsx` solo da el marco visual. Ninguna pide sesión.

| URL | Archivo | Tipo | Datos y acciones |
| --- | --- | --- | --- |
| `/entrar` | `(auth)/entrar/page.tsx` | C | `POST /api/auth/login`. Botón de Google → `GET /api/auth/google?next=...`. Respeta `?next=` para volver a la pantalla pedida (`lib/redireccion.ts`). Si el login canceló una baja de cuenta (`bajaCancelada` en la respuesta, o `?baja=cancelada` desde el regreso de Google), muestra el aviso "Tu cuenta sigue activa" y un botón "Continuar" |
| `/registro` | `(auth)/registro/page.tsx` | C | `POST /api/usuarios` (crea la cuenta y envía el código) → `/verificar` |
| `/verificar` | `(auth)/verificar/page.tsx` | C | `GET /api/auth/verificar` (a qué correo se envió), `POST /api/auth/verificar` (código), `POST /api/auth/verificar/reenviar` |
| `/recuperar` | `(auth)/recuperar/page.tsx` | C | "¿Olvidaste tu contraseña?" de `/entrar`. Paso 1: correo → `POST /api/auth/recuperar`. Paso 2: código de 6 dígitos + contraseña nueva → `POST /api/auth/recuperar/restablecer`. Al terminar va a `/entrar?contrasena=cambiada` (aviso). Respeta `?next=` |
| `/bienvenida` | `(auth)/bienvenida/page.tsx` | C | `GET /api/auth/sesion`. Pasos 3 y 4 del registro: paso 3, estado y municipio (se guardan al dar "Siguiente"); paso 4, especialidad e intereses. Guarda con `PATCH /api/usuarios/[id]`. Catálogos en `lib/mexico-geo.ts`, `lib/intereses.ts`, `lib/perfil-opciones.ts` |
| `/root` | `(auth)/root/page.tsx` + `RootLoginForm.tsx` | S + C | `POST /api/auth/root` (credencial del SuperUsuario) → `/sistema` |

Flujo de alta: `/registro` → `/verificar` → `/bienvenida` → `/campanas` (o el `?next=` original).

## 3. Zona de usuario: `(dashboard)`

**`app/(dashboard)/layout.tsx`** se ejecuta para todas estas pantallas:

- llama a `exigirUsuario()` (`lib/session.ts`): sin sesión → `/entrar`; cuenta sancionada → `/cuenta-bloqueada`;
- dibuja `TopBar` (con `NotificationsBell`, que lee `GET /api/notificaciones` al cargar, cada minuto con la pestaña visible y al volver a ella) y `SidebarNav` (menú lateral; agrega "Supervisión" si el usuario tiene rol `supervisor`);
- monta `VigilanteDeSesion`, que consulta `GET /api/auth/sesion` en cada navegación para sacar al usuario si lo sancionan a media sesión.

### Participar en campañas

| URL | Archivo | Tipo | Datos y acciones |
| --- | --- | --- | --- |
| `/campanas` | `campanas/page.tsx` | C | `GET /api/campanas` (activas) y `GET /api/auth/sesion` (para el filtro "Tu localidad"). Filtros por temática en el cliente; fila desplazable horizontalmente en móvil |
| `/campanas/[id]` | `campanas/[id]/page.tsx` | C | `GET /api/campanas?id=` (incluye `viewer`: si eres el creador, si estás baneado, cuántos aportes llevas). Guardar como favorita: `POST`/`DELETE /api/campanas/[id]/guardar`. El botón **Compartir** abre un `<dialog>` (`compartir.tsx` + `enlace-publico.tsx` + `regenerar.tsx`) con el enlace público `/c/[token]`, cuenta regresiva, copiar, QR y descargas: lo carga con `GET /api/campanas/[id]/enlace` y el QR con `GET /api/campanas/[id]/qr`. Cualquiera con sesión lo ve; solo el creador regenera (`POST /api/campanas/[id]/enlace`), ve visitas y aportes del enlace y cambia "Permitir aportes sin cuenta" (`permitir-anonimos.tsx` → `PATCH /api/campanas/[id]/enlace`) |
| `/campanas/[id]/aportar` | `campanas/[id]/aportar/page.tsx` | C | `GET /api/campanas?id=`, `GET /api/aportes?campaignId=&mine=true` (tus aportes, para la cuota). Envía con `POST /api/aportes` (`multipart/form-data` con el archivo). Checklists con `lib/campanas/checklist.ts`. Si la URL trae `?enlace=<token>` (viene de `/c/[token]`), lo reenvía para atribuir el aporte al enlace |
| `/mis-aportes` | `mis-aportes/page.tsx` | C | `GET /api/campanas?misAportes=true` (campañas en las que aportaste o que guardaste). Botones de filtro en una fila desplazable horizontalmente en móvil |
| `/mis-aportes/[campanaId]` | `mis-aportes/[campanaId]/page.tsx` | C | `GET /api/campanas?id=`, `GET /api/aportes?campaignId=&mine=true`. Muestra el motivo de los rechazados. Borrar un aporte pendiente o rechazado (recupera ese espacio de la cuota; uno aceptado no se borra): `DELETE /api/aportes/[id]` |
| `/cuenta` | `cuenta/page.tsx` + `PerfilForm.tsx` + `CambiarContrasena.tsx` | S + C | La página lee el usuario con `exigirUsuario()`. Los campos están deshabilitados hasta que "Editar perfil" habilita la edición y "Guardar cambios" guarda con `PATCH /api/usuarios/[id]`; la ventana de contraseña, con `PATCH /api/usuarios/[id]/contrasena`. "Eliminar cuenta" lleva a `/cuenta/eliminar` |
| `/notificaciones` | `notificaciones/page.tsx` + `ListaDeNotificaciones.tsx` | S + C | Arriba, "Avisos en este dispositivo" (`components/notificaciones/AvisosEnEsteDispositivo`) activa o desactiva el push. Historial con `listarNotificaciones()` (`lib/notificaciones/notificaciones.ts`), 20 por página (`?pagina=`), todas o solo sin leer (`?filtro=no-leidas`). Abrir una la marca como leída y lleva a su enlace; marcar leída/no leída y "Marcar todas como leídas" con `PATCH /api/notificaciones{/[id]}`; borrar con `DELETE /api/notificaciones/[id]`; aceptar invitaciones de revisor. Se llega con "Ver todas" de la campana |
| `/cuenta/eliminar` | `cuenta/eliminar/page.tsx` + `EliminarCuentaForm.tsx` | S + C | Baja voluntaria (SCR-WEB-31). Resumen con `obtenerResumenDeBaja()` (`lib/usuarios/baja.ts`); el formulario elige el destino de los aportes, confirma con contraseña y ELIMINAR y manda `DELETE /api/usuarios/[id]`. Al terminar va a `/baja-solicitada` |

### Administrar campañas propias (creador)

Cualquier usuario puede crear campañas. Todas estas rutas comprueban en el servidor que seas el creador (`campanas.creator_id`).

| URL | Archivo | Tipo | Datos y acciones |
| --- | --- | --- | --- |
| `/mis-campanas` | `mis-campanas/page.tsx` | C | `GET /api/campanas?mine=true`. Filtros por estado en botones; en móvil forman una fila desplazable horizontalmente. Botón "Finalizar": `PATCH /api/campanas/[id]` con `{ status: "finalizada" }` |
| `/mis-campanas/nueva` (`?edit=<id>` para editar) | `mis-campanas/nueva/page.tsx` + `NuevaCampanaForm.tsx` | S + C | Crear: `POST /api/campanas`. Editar: `GET /api/campanas/[id]` y `PATCH /api/campanas/[id]`. Lo que se puede editar depende del estado (ver [datos.md](datos.md) § 3) |
| `/mis-campanas/[id]/aportes` | `mis-campanas/[id]/aportes/page.tsx` | C | Bandeja de aportes: `GET /api/campanas/[id]`, `GET /api/aportes?campaignId=` (todos, solo el creador), con filtros por estado en el cliente. La sección de baneados (`baneados.tsx`) usa `GET`/`DELETE /api/campanas/[id]/baneos` |
| `/mis-campanas/[id]/aportes/[aporteId]` | `.../aportes/[aporteId]/page.tsx` | C | `GET /api/aportes/[id]`; aceptar o rechazar: `PATCH /api/aportes/[id]` con `{ status, rejectionReason, inapropiado? }`. Banear al participante: `POST`/`DELETE /api/campanas/[id]/baneos`; en un aporte anónimo, el mismo `POST` bloquea su dispositivo en la campaña y `DELETE { bloqueoId }` lo desbloquea. Borrar el archivo de un aporte anónimo: `DELETE /api/aportes/[id]/archivo`. Banear o bloquear se puede antes o después de decidir; marcar inapropiado y borrar el archivo, solo antes. Con el aporte decidido ya no se ofrecen Aceptar ni Rechazar. La imagen se carga de `GET /api/aportes/[id]/archivo` |
| `/mis-campanas/[id]/aportes/agregar-revisor` | `.../agregar-revisor/page.tsx` | C | Buscar personas: `GET /api/usuarios?campanaId=&q=`. Listar e invitar revisores: `GET`/`POST /api/campanas/[id]/revisores` |
| `/mis-campanas/[id]/panel` | `mis-campanas/[id]/panel/page.tsx` | C | `GET /api/campanas?id=`, `GET /api/campanas/[id]/recoleccion-diaria` (gráficas) |
| `/mis-campanas/[id]/especial` | `mis-campanas/[id]/especial/page.tsx` | C | `GET /api/campanas?id=`. Pantalla de campaña especial (multiplicador de XP); la regla aún no está implementada en el servidor |

### Revisión de aportes (revisor invitado)

Para revisores que aceptaron una invitación (`campana_revisores.estado = 'aceptado'`). La invitación llega como notificación y se acepta con `POST /api/notificaciones/[id]/aceptar`.

| URL | Archivo | Tipo | Datos y acciones |
| --- | --- | --- | --- |
| `/revisiones` | `revisiones/page.tsx` → `CampaignList.tsx` | S → C | `GET /api/revisiones` (campañas donde eres revisor), pestaña "en curso". Barra de filtros de `components/campanas/BarraDeFiltros.tsx`, aplicada en el navegador (también en `/revisiones/finalizadas`) |
| `/revisiones/finalizadas` | `revisiones/finalizadas/page.tsx` → `CampaignList.tsx` | S → C | Lo mismo, pestaña "finalizadas" |
| `/revisiones/campanas/[campaignId]` | `revisiones/campanas/[campaignId]/page.tsx` | C | `GET /api/campanas/[id]`, `GET /api/aportes?campaignId=&reviewer=true` |
| `/revisiones/[aporteId]` | `revisiones/[aporteId]/page.tsx` | C | `GET /api/aportes/[id]`; aceptar o rechazar (con motivo de la lista o redactado): `PATCH /api/aportes/[id]` con `{ status, rejectionReason, inapropiado? }`. La decisión es final. Aporte anónimo sin decisión: casilla "Contenido inapropiado" al rechazar o "Marcar como inapropiado" (`POST /api/aportes/[id]/inapropiado`). El revisor no banea ni bloquea: si la persona lo amerita, "Reportar al creador" (`POST /api/aportes/[id]/reportar`, motivo de la lista y/o descripción) |
| `/revisiones/campanas/[campaignId]/usuarios`, `.../usuarios/[userId]/aportes`, `.../aportes/[aporteId]` | `revisiones/campanas/[campaignId]/usuarios/**/page.tsx` | S | SQL directo con `pool` tras `exigirUsuario()`; comprueban en la consulta que seas revisor aceptado |

### Supervisión (usuario con rol `supervisor`)

**`supervision/layout.tsx`** exige el rol `supervisor` (si no lo tienes → `/campanas`). Cada página de servidor lo vuelve a comprobar.

| URL | Archivo | Tipo | Datos y acciones |
| --- | --- | --- | --- |
| `/supervision` | `supervision/page.tsx` | C | `GET /api/campanas` (las `en_revision` que puedes tomar), `GET /api/campanas?supervised=true` (las tuyas), `GET /api/auth/sesion`. En móvil muestra búsqueda e icono para filtros en un card emergente con botón "Filtrar"; los botones de categoría están fuera del card. En escritorio conserva la disposición anterior. Se aplica en el navegador |
| `/supervision/campanas` | `supervision/campanas/page.tsx` | C | `GET /api/campanas?supervised=true` |
| `/supervision/[campaignId]` | `supervision/[campaignId]/page.tsx` | C | `GET /api/campanas?id=`. Tomar: `PATCH /api/campanas/[id]` con `{ action: "tomar" }`. Dictaminar: `PATCH` con `{ action: "aceptada" \| "rechazada" \| "reportada", motivo }` |
| `/supervision/[campaignId]/panel` | `supervision/[campaignId]/panel/page.tsx` | S | `lib/campanas/panel.ts` (`obtenerPanelDeCampana`) → `components/supervision/PanelDeCampanaSupervisor` |
| `/supervision/[campaignId]/usuarios` y subrutas `[userId]/aportes`, `[aporteId]` | `supervision/[campaignId]/usuarios/**/page.tsx` | S | SQL directo con `pool`; solo campañas donde `supervisor_id` eres tú |

## 4. Panel del SuperUsuario: `(panel)`

**`app/(panel)/layout.tsx`** llama a `hasRootSession()` (`lib/rootSession.ts`); sin sesión raíz → `/root`. Dibuja `components/sistema/Topbar` y `Sidebar`.

Al seleccionar Usuarios en la navegación principal, en móvil se abre un menú separado con Dashboard, Directorio, Supervisores y Sanciones. Al elegir una opción se muestra solo su pantalla, con un enlace para volver al menú; la navegación principal permanece visible. Directorio, supervisores, sanciones y las listas de campañas usan tarjetas en móvil y conservan las tablas en escritorio.

Comprobación propia de cada página, además del layout:

- `/aportes/**`: sí (`exigirSesionRoot()` en cada página y `hasRootSession()` en `lib/aportes/{bandeja,dashboard}.ts`).
- `/supervisar/**` y `/sistema/campanas/**`: sí, porque las funciones de `lib/supervision/root.ts` y `lib/campanas/sistema.ts` comprueban la sesión raíz.
- **`/sistema` y `/usuarios/**`: no.** Ni la página ni `lib/sistema/metricas.ts` ni `lib/usuarios/{directorio,dashboard,supervisores}.ts` la comprueban; solo el layout las protege. Las server actions que escriben sí verifican. Ver problemas conocidos en [README.md](README.md).

Patrón: página de servidor que lee de `lib/` + componente cliente hermano que llama a server actions (§ 6).

| URL | Archivo | Datos (lectura) | Acciones (escritura) |
| --- | --- | --- | --- |
| `/sistema` | `sistema/page.tsx` | `lib/sistema/metricas.ts` | — |
| `/sistema/campanas` | `sistema/campanas/page.tsx` + `filtros.tsx` | `lib/campanas/sistema.ts` (`buscarCampanas`, `contarPorEstado`, `listarTematicas`); constantes en `sistema-opciones.ts` | — (solo consulta) |
| `/sistema/campanas/dashboard` | `sistema/campanas/dashboard/page.tsx` | `obtenerDashboardDeCampanas` | — |
| `/sistema/campanas/[id]` | `sistema/campanas/[id]/page.tsx` | `obtenerCabeceraDeCampana`, `lib/campanas/panel.ts` | — |
| `/aportes` | `aportes/page.tsx` + `filtros.tsx` | `lib/aportes/bandeja.ts` (`buscarAportes`, `contarPorEtapa`, `listarCampanasConAportes`, `campanaTieneRevisor`; `?q=`, `?campana=`, `?etapa=pendientes\|aceptado\|rechazado`, `?pagina=`). Llama a `exigirSesionRoot()`. Muestra participante ("Anónimo" sin cuenta), fecha, campaña, los primeros 90 caracteres de la descripción (nada en anónimos), tipo y etapa; nunca el archivo ni el correo. `/sistema/campanas/[id]` enlaza aquí con "Ver aportes recibidos" | — (solo consulta) |
| `/aportes/dashboard` | `aportes/dashboard/page.tsx` (reusa `usuarios/dashboard/selector-de-rango.tsx`) | `lib/aportes/dashboard.ts` (`obtenerDashboardDeAportes`, `?rango=30d\|90d\|12m`). Llama a `exigirSesionRoot()` | — (solo cifras, nunca el contenido de un aporte) |
| `/usuarios` | `usuarios/page.tsx` + `filtros.tsx` | `lib/usuarios/directorio.ts` (`buscarUsuarios`) | — |
| `/usuarios/dashboard` | `usuarios/dashboard/page.tsx` + `selector-de-rango.tsx` | `lib/usuarios/dashboard.ts` | — |
| `/usuarios/[id]` | `usuarios/[id]/page.tsx` | `obtenerUsuario`, `baneosDeUsuario` (`lib/campanas/baneos.ts`) | — |
| `/usuarios/[id]/roles` | `usuarios/[id]/roles/page.tsx` + `botones-de-rol.tsx` | `obtenerUsuario` | `asignarRol`, `revocarRol` |
| `/usuarios/[id]/sancion` | `usuarios/[id]/sancion/page.tsx` + `formulario.tsx` | `obtenerReporteDeSancion` | `aplicarSancion` |
| `/usuarios/sanciones` | `usuarios/sanciones/page.tsx` + `boton-restaurar.tsx` + `boton-quitar-bloqueo.tsx` | `listarSancionesActivas`, `listarBloqueosGlobales` | `restaurarAcceso`, `quitarBloqueoDeDispositivo` |
| `/usuarios/supervisores` | `usuarios/supervisores/page.tsx` + `buscador.tsx` | `lib/usuarios/supervisores.ts` | — |
| `/usuarios/supervisores/[id]` | `usuarios/supervisores/[id]/page.tsx` | `obtenerActividad` | — |
| `/usuarios/supervisores/[id]/revertir/[accionId]` | `.../revertir/[accionId]/page.tsx` + `formulario.tsx` | `obtenerAccion` | `revertirAccion` (**sin lógica todavía**) |
| `/supervisar` | `supervisar/page.tsx` + `pestanas.tsx` | `lib/supervision/root.ts` (`listarCampanasParaRoot`); filtros con `components/campanas/BarraDeFiltros.tsx` en el navegador | — |
| `/supervisar/campanas` | `supervisar/campanas/page.tsx` | `listarCampanasParaRoot` | — |
| `/supervisar/[campaignId]` | `supervisar/[campaignId]/page.tsx` + `acciones.tsx` | `obtenerCampanaParaRoot` | `tomarComoSuperUsuario`, `decidirComoSuperUsuario` |
| `/supervisar/[campaignId]/panel` | `supervisar/[campaignId]/panel/page.tsx` | `obtenerCampanaSupervisadaPorRoot`, `lib/campanas/panel.ts` | — |
| `/supervisar/[campaignId]/usuarios` y subrutas | `supervisar/[campaignId]/usuarios/**/page.tsx` | SQL directo con `pool` | — |

`/supervisar` es la versión de `/supervision` para el SuperUsuario: mismas reglas (`lib/supervision/decision.ts`), pero con sesión raíz y server actions en vez de `fetch`.

## 5. API: `app/api`

Todos los archivos están en `app/api/<ruta>/route.ts`. Respuesta: `{ data }` o `{ error }`. Contrato completo con ejemplos en `openapi.yaml` (`/api/docs`).

"Sesión" = `getSessionUser()` devuelve un usuario (cuenta verificada y sin sanción que bloquee).

### Autenticación

| Método y ruta | Acceso | Qué hace | La llama |
| --- | --- | --- | --- |
| `POST /api/auth/login` | Libre | Correo + contraseña. 5 fallos → bloqueo de 15 min. Rechaza cuentas sin verificar. Mismo 401 si el correo no existe, si la cuenta es de Google o si la contraseña está mal (y tarda lo mismo). Crea la cookie `session_token` | `/entrar` |
| `POST /api/auth/logout` | Libre | Borra la sesión y la cookie | `LogoutButton` |
| `GET /api/auth/sesion` | Libre | Devuelve el usuario de la sesión o `null` | `/bienvenida`, `/campanas`, `/supervision`, `VigilanteDeSesion` |
| `GET /api/auth/google` | Libre | Redirige a Google (guarda `state` y `next` en cookies) | `/entrar`, `/registro` |
| `GET /api/auth/google/callback` | Libre | Vincula o crea la cuenta, inicia sesión y redirige | Google |
| `GET`, `POST /api/auth/verificar` | Cookie `pending_verification_id` | GET: correo pendiente. POST: valida el código de 6 dígitos (vence en 15 min, 3 intentos) | `/verificar` |
| `POST /api/auth/verificar/reenviar` | Cookie pendiente | Genera y envía un código nuevo | `/verificar` |
| `POST /api/auth/recuperar` | Libre | Pide el código de recuperación. Misma respuesta exista o no la cuenta; el correo sale después de responder (`after`). Máximo un código cada 60 s por cuenta | `/recuperar` |
| `POST /api/auth/recuperar/restablecer` | Libre | `{ email, codigo, nueva }`. Código de 6 dígitos (15 min, 3 intentos; mismo error para todo fallo). Guarda la contraseña, quita el bloqueo, marca el correo verificado, cierra todas las sesiones y quita los avisos push. No abre sesión | `/recuperar` |
| `POST /api/auth/root` | Libre (5 intentos/min por IP) | Valida `ROOT_USER_ID` + `ROOT_PASSWORD_HASH` y crea la cookie `root_session_token` | `/root` |
| `POST /api/auth/root/token` | Libre (mismo límite) | Misma credencial; devuelve un token Bearer de 2 horas (sin cookie) para usar la API desde Swagger u otro cliente. Bitácora `root.token_api` | Swagger (`/api/docs`) |

### Usuarios

| Método y ruta | Acceso | Qué hace | La llama |
| --- | --- | --- | --- |
| `POST /api/usuarios` | Libre | Registro. Crea la cuenta sin verificar, siempre con el rol `usuario`, y envía el código | `/registro` |
| `GET /api/usuarios?q=&rol=&estado=&pagina=` | Sesión raíz (cookie o Bearer) | Todos los usuarios del sistema, 20 por página (`buscarUsuarios()` del directorio) | Swagger |
| `GET /api/usuarios?campanaId=&q=` | Sesión + creador de esa campaña | Busca personas para invitar como revisor (máx. 10, correo oculto) | `agregar-revisor` |
| `GET /api/usuarios/[id]` | Sesión + la cuenta propia, o sesión raíz (cualquier id) | Perfil | Swagger |
| `PATCH /api/usuarios/[id]` | Sesión, solo tu propio id | Actualiza perfil (estado, ciudad, especialidad, intereses...) | `/bienvenida`, `/cuenta` |
| `DELETE /api/usuarios/[id]` | Sesión, solo tu propio id | Pide la baja: `{ destino, confirmacion: "ELIMINAR", contrasena }` (sin contraseña en cuentas de Google). Cierra las sesiones, finaliza o borra campañas propias y fija el borrado definitivo a 30 días | `/cuenta/eliminar` |
| `PATCH /api/usuarios/[id]/contrasena` | Sesión, solo tu propio id, cuenta con contraseña | Cambia la contraseña tras revisar la actual (los fallos cuentan para el bloqueo del login). No cierra sesiones | `/cuenta` |

### Campañas

| Método y ruta | Acceso | Qué hace | La llama |
| --- | --- | --- | --- |
| `GET /api/campanas` | Libre (sin filtros) | Campañas activas. Antes de responder activa las `aceptada` cuya fecha llegó y finaliza las vencidas (`lib/campaign-date.ts`) | `/campanas`, `/supervision` |
| `GET /api/campanas?id=<id>` | Libre | Una campaña + bloque `viewer` si hay sesión | Muchas pantallas de detalle |
| `GET /api/campanas?mine=true` | Sesión | Tus campañas creadas | `/mis-campanas`, formulario |
| `GET /api/campanas?misAportes=true` | Sesión | Campañas donde aportaste o que guardaste | `/mis-aportes` |
| `GET /api/campanas?available=true` | Sesión | Activas a las que todavía puedes aportar | — |
| `GET /api/campanas?supervised=true` | Sesión | Campañas que supervisas | `/supervision` |
| `POST /api/campanas` | Sesión | Crea una campaña de quien tiene la sesión: solo `borrador` (por defecto) o `en_revision`; con 5 activas, solo borrador. Contadores, XP (50) y "especial" los fija el servidor (`lib/campanas/estado-del-creador.ts`) | Formulario |
| `GET /api/campanas/[id]` | Libre | Detalle de la campaña + `viewer.isCreator` | Bandeja, formulario de edición, revisión |
| `PATCH /api/campanas/[id]` | Sesión | **Tres usos según el body:** `{ action: "tomar" }` (supervisor la toma); `{ action: "aceptada"\|"rechazada"\|"reportada", motivo }` (dictamen del supervisor que la tomó); cualquier otro body = edición del creador, con reglas por estado (en borrador, en revisión o rechazada solo puede pedir `borrador` o `en_revision`; XP y "revisor asignado" no se editan) | Formulario, `/mis-campanas`, `/supervision/[id]` |
| `PUT /api/campanas/[id]` | Sesión + creador, campaña en `borrador`, `en_revision` o `rechazada` | Reemplazo completo de los campos editables (pensado para Insomnia). `status` solo `borrador` o `en_revision`; no cambia XP ni "revisor asignado" | — |
| `POST`, `DELETE /api/campanas/[id]/guardar` | Sesión | Guardar o quitar de favoritos | `/campanas/[id]` |
| `GET`, `POST /api/campanas/[id]/revisores` | Sesión + creador | Listar revisores; invitar a uno (le llega una notificación) | `agregar-revisor` |
| `GET`, `POST`, `DELETE /api/campanas/[id]/baneos` | Sesión + creador | Listar (`data`: cuentas; `dispositivos`: anónimos bloqueados), banear o desbanear. `POST` desde cualquier aporte de la campaña, decidido o no. Con un aporte anónimo, `POST` bloquea su dispositivo en la campaña; `DELETE { bloqueoId }` lo desbloquea. Bitácora `campana.{bloquear,desbloquear}_dispositivo` | Detalle del aporte, `baneados.tsx` |
| `GET /api/campanas/[id]/recoleccion-diaria` | Sesión + creador | Aportes por día y por tipo, para las gráficas | `/mis-campanas/[id]/panel` |
| `GET /api/campanas/[id]/enlace` | Sesión | Enlace actual (vigente o caducado) o `null`, el estado de la campaña y `viewer.esCreador`. Visitas y aportes del enlace solo para el creador | Cuadro Compartir de `/campanas/[id]` |
| `POST /api/campanas/[id]/enlace` | Sesión + creador, campaña `activa` | Genera o regenera el enlace público (24 h). Revoca el anterior sin borrarlo. Bitácora `campana.enlace_regenerar` | `regenerar.tsx` en `/campanas/[id]` |
| `PATCH /api/campanas/[id]/enlace` | Sesión + creador | `{ permiteAnonimos }`: permite o corta los aportes sin cuenta. Bitácora `campana.anonimos_cambiar` | `permitir-anonimos.tsx` en `/campanas/[id]` |
| `GET /api/campanas/[id]/qr?formato=png\|svg` | Sesión | QR (512 px) del enlace vigente, como descarga; también se usa como `<img>`. `410` si caducó | Cuadro Compartir de `/campanas/[id]` |

### Aportes

| Método y ruta | Acceso | Qué hace | La llama |
| --- | --- | --- | --- |
| `GET /api/aportes?campaignId=&mine=true` | Sesión | Tus propios aportes en esa campaña | Aportar, `/mis-aportes/[campanaId]` |
| `GET /api/aportes?campaignId=` | Sesión + creador | Todos los aportes de la campaña | Bandeja `/mis-campanas/[id]/aportes` |
| `GET /api/aportes?campaignId=&reviewer=true` | Sesión + revisor aceptado | Aportes para revisar | `/revisiones/campanas/[id]` |
| `POST /api/aportes` | Sesión | `multipart/form-data`: sube el archivo a MinIO e inserta el aporte. Valida: campaña activa, no eres el creador, no estás baneado, te queda cuota, JPG/PNG ≤ 10 MB. Campo opcional `enlace` (token de `/c/[token]`): si es el vigente de la campaña, se guarda en `aportes.enlace_id` | `/campanas/[id]/aportar` |
| `GET /api/aportes/[id]` | Sesión + quien aportó, creador o revisor | Detalle | Detalle del aporte, revisiones |
| `PATCH /api/aportes/[id]` | Sesión + creador o revisor aceptado | Revisar: `{ status: "aceptado" \| "rechazado", rejectionReason, inapropiado? }`. El motivo es obligatorio al rechazar. `inapropiado: true` (creador o revisor), al rechazar un aporte anónimo (puede disparar el bloqueo global). Si se acepta, se quita la marca. Creador y revisor deciden igual y la decisión es final: un aporte decidido ya no se cambia (409). El revisor no recibe el correo del participante. Notifica al participante. Recalcula los contadores de la campaña | Detalle del aporte, `/revisiones/[aporteId]` |
| `PUT /api/aportes/[id]` | Sesión + quien aportó, mientras esté `pendiente` | Editar descripción y características | — (Insomnia) |
| `DELETE /api/aportes/[id]` | Sesión + quien aportó, si el aporte está pendiente o rechazado (uno aceptado no se borra) | Borra el aporte y su archivo de MinIO, y recalcula los contadores. No revisa el estado de la campaña | `/mis-aportes/[campanaId]` |
| `POST /api/c/[token]/aportes` | **Libre (sin sesión)**, solo enlace vigente de campaña activa; con sesión responde 409 | Aporte anónimo (`multipart/form-data`: `file`, `description`, `caracteristicas`). Guarda `user_id` NULL, "Anónimo", sin correo ni nombre de archivo. Cuota por dispositivo (cookie `anonimo_id`), 60 s de espera entre aportes del mismo dispositivo (`429` con `esperaSegundos` y `Retry-After`) y tope de 20 por IP por hora. `403` si la campaña no permite anónimos o el dispositivo está bloqueado. La foto se guarda sin metadatos. Responde solo cuántos le quedan | Formulario de `/c/[token]` |
| `GET /api/aportes/[id]/archivo` | Sesión + quien aportó, creador, o revisor (si el aporte está pendiente o él lo revisó) | Lee el archivo de MinIO y lo devuelve con `nosniff`. `410` si se borró. Se usa como `src` de `<img>` | Pantallas de detalle |
| `DELETE /api/aportes/[id]/archivo` | Sesión + creador, solo aportes anónimos sin decisión | Borra el archivo de MinIO (409 si el aporte ya está aceptado o rechazado); la fila se conserva. Bitácora `aporte.archivo_borrar` | Detalle del aporte del creador |
| `POST /api/aportes/[id]/reportar` | Sesión + revisor aceptado (no el creador) | "Reportar al creador" `{ motivo }`: avisa al creador que el aporte o quien lo envió merece una sanción. No banea ni cambia el estado; uno por aporte (409). Notificación `aporte_reportado` y bitácora `aporte.reportar` | `/revisiones/[aporteId]` |
| `POST /api/aportes/[id]/inapropiado` | Sesión + creador o revisor aceptado, solo aportes anónimos sin decisión | Marca "Contenido inapropiado" sin cambiar el estado (409 si ya está aceptado o rechazado); puede disparar el bloqueo global. Bitácora `aporte.inapropiado` | `/revisiones/[aporteId]` |

### Revisiones, notificaciones y datos abiertos

| Método y ruta | Acceso | Qué hace | La llama |
| --- | --- | --- | --- |
| `GET /api/revisiones` | Sesión | Campañas donde eres revisor aceptado, con conteos (`pendingContributions` = aportes `pendiente`, los que le tocan al revisor) | `/revisiones` |
| `GET /api/notificaciones` | Sesión | Tus notificaciones paginadas (`?pagina=&porPagina=&filtro=todas\|no-leidas`) y el total sin leer (`noLeidas`) | `NotificationsBell` |
| `PATCH /api/notificaciones` | Sesión | `{ leidas: "todas" }`: marca todas como leídas | `NotificationsBell`, `/notificaciones` |
| `PATCH /api/notificaciones/[id]` | Sesión, dueño de la notificación | `{ leida: true\|false }` | `NotificationsBell`, `/notificaciones` |
| `DELETE /api/notificaciones/[id]` | Sesión, dueño de la notificación | Borra la notificación; una invitación de revisor sin aceptar no se borra (409) | `/notificaciones` |
| `GET`, `POST`, `DELETE /api/push` | Sesión | Notificaciones push: `GET` da la llave pública VAPID; `POST { subscription }` activa los avisos en este navegador (solo endpoints https de Google, Apple, Mozilla o Microsoft; hasta 10 por persona); `DELETE { endpoint }` los quita | `AvisosEnEsteDispositivo` (`/notificaciones`), `NotificationsBell` (resincroniza al cargar), `LogoutButton` (quita al salir) |
| `POST /api/notificaciones/[id]/aceptar` | Sesión, dueño de la notificación | Acepta una invitación de revisor y avisa al creador | `NotificationsBell`, `/notificaciones` |
| `GET /api/datos/[id]/descarga` | Libre | ZIP con los archivos de los aportes aceptados de una campaña `finalizada` (sin datos personales). Suma 1 a `downloads_count` | `/datos/[id]` |
| `GET /api/docs`, `GET /api/docs/spec` | `next dev` libre; producción con sesión raíz | Swagger UI y el YAML | Navegador |

## 6. Server actions

Funciones `"use server"` que el panel llama como si fueran funciones locales. Next las expone como endpoints, así que **cada una verifica la sesión raíz por su cuenta**.

| Archivo | Acción | Qué hace | La llama |
| --- | --- | --- | --- |
| `lib/usuarios/acciones-usuarios.ts` | `asignarRol(id, rol)` | Agrega un rol (p. ej. `supervisor`). Bitácora `rol.asignar` | `/usuarios/[id]/roles` |
| | `revocarRol(id, rol)` | Quita un rol; si era supervisor, libera sus campañas `en_revision`. Bitácora `rol.revocar` | `/usuarios/[id]/roles` |
| | `aplicarSancion(id, datos)` | Strike, suspensión o baneo. Al 3er strike banea automáticamente. Bitácora `sancion.aplicar` | `/usuarios/[id]/sancion` |
| | `restaurarAcceso(sancionId)` | Desactiva una sanción. Bitácora `sancion.restaurar` | `/usuarios/sanciones` |
| `lib/usuarios/acciones-supervisor.ts` | `revertirAccion(...)` | **TODO: aún no hace nada** | `/usuarios/supervisores/[id]/revertir/...` |
| `lib/supervision/acciones-root.ts` | `tomarComoSuperUsuario(id)` | El SuperUsuario toma una campaña `en_revision` | `/supervisar/[id]` |
| | `decidirComoSuperUsuario(id, accion, motivo)` | Dictamen del SuperUsuario (usa la misma lógica que el `PATCH` de campañas) | `/supervisar/[id]` |

## 7. Qué protege cada capa

| Ruta | `proxy.ts` (¿hay cookie?) | Layout | Página / handler |
| --- | --- | --- | --- |
| `/campanas`, `/mis-aportes`, `/mis-campanas`, `/cuenta`, `/notificaciones`, `/supervision` | Sí → `/entrar?next=` | `exigirUsuario()` | Cliente: la API verifica. Servidor: `exigirUsuario()` |
| `/revisiones` | **No** (no está en el `matcher`) | `exigirUsuario()` | La API o `exigirUsuario()` + SQL |
| `/supervision/**` | Sí | + rol `supervisor` | + rol `supervisor` |
| `/sistema` | Sí (cookie raíz) → `/root` | `hasRootSession()` | `/sistema/campanas/**`: sí (lo hace `lib/campanas/sistema.ts`). `/sistema`: **solo el layout** |
| `/supervisar` | **No** | `hasRootSession()` | `exigirSesionRoot()` (en `lib/supervision/root.ts`) |
| `/usuarios` | **No** | `hasRootSession()` | **Solo el layout**; las server actions sí verifican |
| `/api/**` | Solo CSRF en mutaciones | — | `getSessionUser()` + permiso sobre el recurso |

`proxy.ts` es un atajo para redirigir rápido, **no un control de acceso**: la seguridad real está en las dos columnas de la derecha. Más detalle en [permisos.md](permisos.md).
