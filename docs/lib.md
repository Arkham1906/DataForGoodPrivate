# Módulos de `lib/`

`lib/` contiene toda la lógica de servidor: conexión a la BD, sesiones, reglas de negocio, consultas y server actions. Las páginas y los route handlers de `app/` la importan con el alias `@/lib/...`.

**Marcas:**

- 🟢 **Sin imports de servidor:** se puede importar desde un componente cliente (`"use client"`).
- ⚡ **Server actions** (`"use server"`): el panel las llama directamente desde componentes cliente.
- Todo lo demás **solo se usa en el servidor** (importa `pg`, `cookies()`, MinIO...). Si lo importas en un componente cliente, el build falla.

## Infraestructura

| Archivo | Qué hace | Exporta |
| --- | --- | --- |
| `db.ts` | Pool de conexiones a PostgreSQL (se crea en el primer uso) | `pool`, `dbQuery` |
| `db-schema.ts` | **El esquema completo** de la BD. Lo ejecuta `instrumentation.ts` al arrancar | `ensureCoreSchema`, `ensure<Tabla>Table` |
| `minio.ts` | Cliente de MinIO: guardar, leer y borrar archivos | `guardarArchivo`, `readUploadedFile`, `borrarArchivo` |
| `base-path.ts` 🟢 | Prefijo de la app (`/dataforgood` en producción, vacío en `next dev`) | `BASE_PATH` |
| `app-url.ts` | URL absoluta con `APP_ORIGIN` + `BASE_PATH` (para redirecciones y correos) | `absoluteUrl` |
| `ip.ts` | IP real del cliente detrás del proxy | `ipDelCliente` |
| `api-docs.ts` | Decide si se puede ver `/api/docs` | `puedeVerDocs` |
| `animaciones.ts` 🟢 | Ayudantes de las animaciones de entrada de las páginas públicas (clases `.landing-*` de `globals.css`) | `retraso`, `entradaDeTarjeta` |

## Autenticación y cuentas

| Archivo | Qué hace | Exporta |
| --- | --- | --- |
| `session.ts` | Sesión del usuario: crearla, leerla, cerrarla; detectar si está bloqueado | `getSessionUser`, `exigirUsuario`, `createSession`, `destroySession`, `obtenerBloqueoDeLaSesion`, `SessionUser` |
| `rootSession.ts` | Sesión del SuperUsuario (cookie de `/root` o token Bearer de `POST /api/auth/root/token`) | `emitirTokenRoot`, `createRootSession`, `hasRootSession`, `destroyRootSession` |
| `root-acceso.ts` | Valida la credencial de SuperUsuario del entorno con límite de intentos; la usan `POST /api/auth/root` y `POST /api/auth/root/token` | `verificarCredencialRoot` |
| `password.ts` | Hash y verificación de contraseñas (bcrypt; migra hashes viejos) y límites del bloqueo por intentos fallidos | `hashPassword`, `verifyPassword`, `wasLegacyHash`, `MAX_FAILED_ATTEMPTS`, `LOCK_DURATION_MS` |
| `reglas-contrasena.ts` 🟢 | Requisitos de una contraseña nueva (registro y `/cuenta`) | `REGLAS_DE_CONTRASENA`, `cumpleReglasDeContrasena`, `LARGO_MAXIMO_DE_CONTRASENA` |
| `verification.ts` | Código de verificación por correo | `startVerification`, `verifyCode`, `getPendingVerification`, `PENDING_COOKIE` |
| `correo.ts` | Envío de correos con Gmail (nodemailer) y escape de HTML | `enviarCorreo`, `escaparHtml` |
| `google.ts` | OAuth de Google | `getGoogleAuthUrl`, `exchangeCodeForProfile` |
| `redireccion.ts` 🟢 | Valida el parámetro `?next=` para que solo apunte a rutas internas | `destinoSeguro`, `conDestino`, `DESTINO_POR_DEFECTO` |
| `roles.ts` | Códigos de rol válidos | `VALID_ROLES`, `normalizeRoles` |
| `sanciones.ts` | ¿La cuenta está bloqueada? Tipos que aplica el SuperUsuario (aviso o baneo) | `obtenerBloqueo`, `contarSanciones`, `TIPOS_DE_SANCION`, `SQL_SANCION_BLOQUEANTE` |
| `auditoria.ts` | Escribe en `audit_log` | `registrarAuditoria`, `AccionAuditada` |
| `validation.ts` 🟢 | Validaciones sueltas | `isValidEmail` |

## Catálogos (listas fijas)

| Archivo | Contenido |
| --- | --- |
| `intereses.ts` 🟢 | `TEMAS_DE_INTERES`: las 23 temáticas base, con las que se siembra la tabla `tematicas` al arrancar. El catálogo real (que crece) está en `tematicas/` |
| `mexico-geo.ts` 🟢 | Estados y municipios de México (`ESTADOS_DE_MEXICO`, `municipiosDe`) |
| `perfil-opciones.ts` 🟢 | Especialidades del perfil |
| `campaign-date.ts` | Fechas de campaña y las transiciones automáticas (`activateScheduledCampaigns`, `finalizeExpiredCampaigns`, `hasCampaignStarted`, `hasCampaignEnded`). Al activar o finalizar por fecha, avisa al creador |
| `open-data.ts` | Catálogo de datos abiertos (`/datos`): búsqueda, facetas, formatos, licencia |
| `open-data-csv.ts` | `tablaDeAportesCsv(filas)`: la tabla `aportes.csv` del ZIP de descarga (seudónimos "Participante N" / "Anónimo", UTF-8 con BOM, celdas a salvo de fórmulas) y `ubicacionDeCampana()` |

## Por módulo

### `aportes/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `archivo.ts` 🟢 | Tipos y tamaño de archivo permitidos, largo de la descripción, `errorDeArchivo()`, `formatearTamano()` (KB/MB) y `TIPO_DE_DATO` (cómo se describe cada tipo a quien aporta) | Endpoints de aportes, formulario anónimo, pantallas de aportes y `/campanas/[id]` |
| `consentimiento.ts` 🟢 | Textos de los avisos de "Antes de enviar" (uso del aporte y contenido acorde), nombres de los campos (`aceptaUso`, `confirmaContenido`) y `errorDeConsentimiento()` | `components/ui/AvisosDeAporte`, `POST /api/aportes`, `POST /api/c/[token]/aportes` |
| `comun.ts` | `guardarFotoDelAporte()` (valida, limpia y sube a MinIO), `insertarAporteConCuota()` (cuenta e inserta con candado: sin carrera de cuota), `recalcularContadores()` (contadores de la campaña desde `aportes`, con la campaña bloqueada) y reexporta `archivo.ts` | `POST /api/aportes`, `aportes-anonimos.ts` |
| `imagen.ts` | `limpiarImagen()`: comprueba la firma JPG/PNG y vuelve a codificar con `sharp`, quitando EXIF (GPS), ICC y XMP | `comun.ts` |
| `anonimato.ts` | Cookie `anonimo_id` y `hashDeDispositivo()` | Aporte anónimo, `/c/[token]`, sanciones |
| `reporte.ts` | "Reportar al creador": el revisor avisa al creador (guarda el motivo en el aporte, notifica y registra en bitácora). No banea | `POST /api/aportes/[id]/reportar` |
| `decision.ts` | Sin `pg`: `tieneDecision()` y `ESTADOS_SIN_DECISION`, la regla de que una decisión no se cambia | API de aportes, `sanciones-anonimas.ts`, pantallas |
| `motivos-de-rechazo.ts` | Sin `pg`: listas de motivos para rechazar y para reportar | Pantallas del creador y del revisor |
| `sanciones-anonimas.ts` | Sanciones a personas sin cuenta: marcar inapropiado, bloqueo por campaña, bloqueo global automático (3 inapropiados en 30 días → 30 días), borrar archivo, listar y quitar bloqueos | API de aportes y de baneos, `/usuarios/sanciones` |
| `bandeja.ts` | Bandeja del SuperUsuario: `buscarAportesPorParticipante` (agrupa por persona: con cuenta o mismo dispositivo anónimo; filtros y paginación por persona en SQL), `contarPorEtapa`, `listarCampanasConAportes`, `campanaTieneRevisor`, `PESTANAS_APORTES` y etiquetas de etapa. Exige sesión raíz; no lee archivos, correos ni la descripción completa | `/aportes`, `/aportes/dashboard` |
| `dashboard.ts` | `obtenerDashboardDeAportes(rango)`: totales, cola de pendientes, tasa de aprobación, recolección por día/semana/mes (hora de Tepic), reparto por tipo y temática, motivos de rechazo (textos idénticos agrupados) y campañas que más aportan. Exige sesión raíz | `/aportes/dashboard` |

### `campanas/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `publicas.ts` | Búsqueda de campañas activas con filtros | `/explorar` |
| `panel.ts` | Métricas de una campaña (aportes por estado, participantes, avance) | Paneles de `/supervision`, `/supervisar`, `/sistema/campanas/[id]` |
| `baneos.ts` | Baneos por campaña: consultar, listar, quitar | API de baneos, `/api/aportes`, `/usuarios/[id]` |
| `aportes-anonimos.ts` | Aporte **sin cuenta** desde `/c/[token]`: valida enlace, campaña e interruptor `permite_anonimos`, bloqueos del dispositivo, cuota por dispositivo (se guarda el hash de la cookie), espera entre aportes del dispositivo (`ESPERA_ENTRE_APORTES_SEGUNDOS`), tope por IP en memoria (`TOPE_POR_IP_POR_HORA`, se poda cada minuto) y guarda el aporte sin datos personales, sin ninguna forma de la IP (los límites por IP viven en memoria). Bitácora `aporte.anonimo_enviar` sin IP | `POST /api/c/[token]/aportes`, `/c/[token]` |
| `enlaces.ts` | Enlace público `/c/[token]`: `asegurarEnlaceVigente` (se genera solo al quedar activa la campaña), `regenerarEnlace` (creador), buscar por token, contar visitas, atribuir aportes y generar el QR (SVG/PNG con `qrcode`). Todo en transacción con la campaña bloqueada. No autoriza: el llamador comprueba antes | `/api/campanas/[id]/{enlace,qr}`, `/c/[token]`, `POST /api/aportes`, `lib/supervision/decision.ts`, `lib/campaign-date.ts`, `PATCH`/`PUT /api/campanas/[id]` |
| `estado-del-creador.ts` | Qué estado puede pedir el creador (`borrador`/`en_revision`), límite de 5 activas, XP fijo | `POST /api/campanas`, `PATCH`/`PUT /api/campanas/[id]` |
| `checklist.ts` 🟢 | Checklists con título: normalizar, validar respuestas, límites (`MAX_SECCIONES`...) | Formulario de campaña, aportar, API |
| `sistema.ts` | Consultas del panel del SuperUsuario (listado, conteos, dashboard). Exigen sesión raíz | `/sistema/campanas/**` |
| `sistema-opciones.ts` 🟢 | Constantes y tipos de esas pantallas (pestañas, etiquetas, órdenes) | `/sistema/campanas/filtros.tsx`, `components/campanas/BarraDeFiltros.tsx` |
| `filtro-local.ts` 🟢 | Filtra y ordena en el navegador listas ya cargadas, con los mismos criterios que `buscarCampanas()`; aviso de lista vacía (`avisoSinResultados`) | `/supervision`, `/supervisar`, `/revisiones` |

### `supervision/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `decision.ts` | **Reglas del dictamen**, compartidas por supervisores y SuperUsuario: tomar una campaña (`tomarCampanaParaSupervisar`) y aceptarla, rechazarla o reportarla (`registrarDecisionDeCampana`). Notifica al creador y escribe en la bitácora | `PATCH /api/campanas/[id]`, `acciones-root.ts` |
| `root.ts` | Guardia `exigirSesionRoot()` y consultas de `/supervisar` | Páginas de `(panel)` |
| `acciones-root.ts` ⚡ | `tomarComoSuperUsuario`, `decidirComoSuperUsuario` | `/supervisar/[campaignId]` |

### `usuarios/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `directorio.ts` | Búsqueda de usuarios, ficha, estado de la cuenta, lista de sanciones (`listarSanciones`) | `/usuarios/**` |
| `dashboard.ts` | Métricas de usuarios por rango de fechas | `/usuarios/dashboard` |
| `supervisores.ts` | Lista de supervisores y su actividad | `/usuarios/supervisores/**` |
| `revisor.ts` | Retirar a alguien como revisor de todas sus campañas | `revocarRol` (al quitar el rol de revisor), borrado definitivo de una cuenta |
| `baja.ts` | Baja voluntaria: resumen, pedirla, cancelarla al iniciar sesión y borrado definitivo al vencer el plazo | `/cuenta/eliminar`, `DELETE /api/usuarios/[id]`, login y Google, `instrumentation-node.ts` (cada hora) |
| `avatar-opciones.ts` 🟢 | Ícono del perfil: opciones (iniciales, masculino, femenino, otro, foto), límites de la foto (JPG/PNG, 5 MB, 256 px), `errorDeFotoDePerfil`, `inicialesDe`, `datosDeAvatar` | `components/ui/Avatar`, `/cuenta` (`EditarAvatar`), `TopBar`, `/api/usuarios/[id]/avatar` |
| `avatar.ts` | `cambiarAvatar` (procesa la foto con sharp a 256 px sin metadatos, la guarda en MinIO y borra la anterior) y `leerFotoDePerfil` | `/api/usuarios/[id]/avatar` |
| `baja-opciones.ts` 🟢 | Constantes de la baja: 30 días, ELIMINAR, destinos de los aportes, formato de fecha | `/cuenta/eliminar`, `/baja-solicitada`, `baja.ts` |
| `recuperacion.ts` | Códigos por correo para poner contraseña: recuperarla sin sesión (sin revelar si la cuenta existe; cierra todas las sesiones) y crearla desde `/cuenta` en una cuenta de Google (conserva las sesiones) | `POST /api/auth/recuperar{, /restablecer}`, `POST /api/usuarios/[id]/contrasena{, /codigo}` |
| `recuperacion-opciones.ts` 🟢 | Números de la recuperación: 15 min, 3 intentos, 60 s entre correos | `/recuperar`, `recuperacion.ts` |
| `contrasena-actual.ts` | Comprueba la contraseña actual; un error suma al bloqueo del login | Cambio de contraseña, baja de cuenta |
| `rol-asignable.ts` 🟢 | Nombres y descripciones de roles para la interfaz | Panel |
| `perfil.ts` 🟢 | Largos máximos de los campos del perfil (`errorDeLargo`). Los intereses se validan en `tematicas/catalogo.ts` | `POST /api/usuarios`, `PATCH /api/usuarios/[id]` |
| `escala-de-avisos.ts` 🟢 | La escala de avisos: `AVISOS_PARA_BANEO`, `consecuenciaDelAviso(n)`, `describirConsecuencia` | `aplicarSancion`, pantallas del panel |
| `lista-negra.ts` | Lista negra de correos: `correoEnListaNegra`, `agregarAListaNegra` (en la transacción del baneo), `quitarDeListaNegra`, `listarListaNegra` | `aplicarSancion`, `restaurarAcceso`, `POST /api/usuarios`, callback de Google, `.../sanciones` de `/supervisar` y `/supervision` |
| `acciones-usuarios.ts` ⚡ | `asignarRol`, `revocarRol`. Cada una notifica a la persona (las sanciones pasaron a `moderacion/acciones.ts` el 2026-10-13) | `/usuarios/[id]/roles` |
| `acciones-supervisor.ts` ⚡ | `revertirAccion`: deshace una decisión de supervisor | `/usuarios/supervisores/[id]/revertir/...` |

### `reportes/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `reportes.ts` | Reportes: `reportarCampana` (contra el creador), `reportarParticipante` (contra quien aportó; creador o revisor), `yaReporto`, `listarReportes` (agrupados por caso), `contarReportesPendientes`, `reportesPendientesContra`, `sqlDeClave` | `POST /api/campanas/[id]/reportar`, `POST /api/aportes/[id]/reportar-participante`, GET de campaña y de aporte, `.../reportes` y `.../sanciones/[usuarioId]` de `/supervisar` y `/supervision`, layouts del panel y de `(dashboard)` (contador), `aplicarSancion`. `listarReportes` y `contarReportesPendientes` reciben la cuenta del supervisor para no mostrarle reportes contra él |
| `motivos.ts` 🟢 | Motivos para reportar una campaña o un aporte, largo máximo, estados y la clave del caso (`campana-116`, `aporte-55`) | `/campanas/[id]`, detalle del aporte, bandejas de reportes |

### `moderacion/` (2026-10-13)

Reportes y sanciones, que antes eran del panel del SuperUsuario. Las mismas pantallas (`components/moderacion/*`) se muestran en dos zonas: `/supervisar/{reportes,sanciones}` (SuperUsuario en modo supervisor) y `/supervision/{reportes,sanciones}` (usuario con rol `supervisor`).

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `rutas.ts` 🟢 | `ZonaDeModeracion` (`supervisar` o `supervision`), `rutasDeModeracion(zona)` (reportes, sanciones, sancionar, ficha de campaña) y `pestanasDeModeracion` (Campañas / Reportes / Sanciones) | Pantallas y componentes de `components/moderacion` |
| `moderador.ts` | `moderadorDe(zona)` (para server actions: raíz o usuario con rol `supervisor`, según la zona), `exigirModerador(zona)` (para páginas: redirige a `/root` o `/campanas`), `actorDeModerador`, `firmaDeModerador` (`aplicada_por`), `cuentaDelModerador` | Páginas de las dos zonas, `acciones.ts` |
| `acciones.ts` ⚡ | `aplicarSancion`, `restaurarAcceso`, `descartarReportes`, `quitarBloqueoDeDispositivo`; reciben la zona y comprueban su sesión. Un supervisor no se modera a sí mismo | `components/moderacion/*` |

### `tematicas/`

Catálogo de temáticas (intereses del perfil y temática de campaña), desde el 2026-10-07.

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `analizar.ts` 🟢 | `analizarIntereses(texto, catalogo)`: temáticas que salen de un texto (diccionario local, palabras vacías, groserías, singular). `esTematicaNuevaValida`, `claveDeTematica`, `conMayuscula`, `MAXIMO_DE_INTERESES` (20), `LARGO_MAXIMO_DEL_TEXTO` (500) | `ui/InteresesDesdeTexto`, `catalogo.ts`, `db-schema.ts` |
| `catalogo.ts` | `tematicasVisibles()`, `resolverIntereses()` (valida y da de alta las nuevas), `listarTematicasDelPanel(q)`, `cambiarVisibilidad()` | `GET /api/tematicas`, `POST`/`PATCH /api/usuarios`, `/sistema/tematicas` |
| `acciones-tematicas.ts` | Server action `cambiarVisibilidadDeTematica(id, oculta)`: sesión raíz, bitácora `tematica.ocultar`/`tematica.mostrar` | `/sistema/tematicas` |

### `notificaciones/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `notificaciones.ts` | `notificar()` crea una notificación (nunca lanza: si falla, solo lo registra en el log; llámala después del `COMMIT`). `listarNotificaciones()` (paginada, todas o sin leer, con el total sin leer), `marcarNotificacion()`, `marcarTodasComoLeidas()` y `borrarNotificacion()` (no borra una invitación de revisor sin aceptar) | `/api/notificaciones/**`, `/notificaciones` y los eventos: `PATCH /api/aportes/[id]`, `/api/campanas/[id]/{baneos,revisores}`, `decision.ts`, `campaign-date.ts`, `acciones-usuarios.ts` |
| `push.ts` | Notificaciones push (Web Push con `web-push` y llaves VAPID): guardar o borrar la suscripción de un navegador (solo servicios de push conocidos) y `enviarPush()`, que `notificar()` llama en segundo plano. Sin llaves en el entorno queda apagado | `/api/push`, `notificaciones.ts` |
| `registro-push.ts` | Lado del navegador, sin `pg`: registra `public/sw.js`, pide permiso, suscribe, desactiva y resincroniza; `estadoDePush()` distingue sin soporte, iPhone sin instalar, bloqueado, inactivo y activo | `AvisosEnEsteDispositivo`, `NotificationsBell`, `LogoutButton` |
| `tipos.ts` | Sin `pg`: `TipoDeNotificacion` (los 16 eventos), el tipo `Notificacion` que entrega la API, el tono de cada tipo y el formato de fecha (`fechaDeNotificacion`, `haceCuanto`) | `NotificationsBell`, `ListaDeNotificaciones` |

### `sistema/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `metricas.ts` | Cifras generales del sistema | `/sistema` |

## Fuera de `lib/`

| Archivo | Qué hace |
| --- | --- |
| `proxy.ts` | Redirección por cookie y CSRF en `/api` (ver [permisos.md](permisos.md)) |
| `instrumentation.ts` + `instrumentation-node.ts` | Al arrancar: valida `DATABASE_URL` y corre `ensureCoreSchema()` |
| `types/index.ts` | Tipos que devuelve la API a la zona de usuario (`Campaign`, `Contribution`, `User`, estados) |
| `components/supervision/RefrescoEnVivo.tsx` | Refresca la página cada pocos segundos (`router.refresh()`) en paneles de campañas activas |
| `components/layout/VigilanteDeSesion.tsx` | Revisa la sesión en cada navegación del cliente |
