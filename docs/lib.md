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
| `db-schema.ts` | **El esquema completo** de la BD. Lo ejecuta `instrumentation.ts` al arrancar | `ensureCoreSchema`, `ensure<Tabla>Table`; al final `ensureFechasConZona`, `ensureIndicesDeLlaves` y `ensureRestricciones` (2026-10-30) |
| `minio.ts` | Cliente de MinIO: guardar, leer (entero o por partes) y borrar archivos | `guardarArchivo`, `readUploadedFile`, `abrirArchivo`, `tamanoDeArchivo`, `borrarArchivo` |
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
| `sanciones.ts` | ¿La cuenta está bloqueada? Tipos que aplica quien modera (aviso, suspensión directa o baneo) | `obtenerBloqueo`, `contarSanciones`, `TIPOS_DE_SANCION`, `SQL_SANCION_BLOQUEANTE` |
| `auditoria.ts` | Escribe en `audit_log` | `registrarAuditoria`, `AccionAuditada` |
| `validation.ts` 🟢 | Validaciones sueltas | `isValidEmail` |

## Catálogos (listas fijas)

| Archivo | Contenido |
| --- | --- |
| `intereses.ts` 🟢 | `TEMAS_DE_INTERES`: las 28 temáticas base (2026-10-27; antes 23) y `RENOMBRES_DE_TEMATICAS_BASE`, con las que se siembra la tabla `tematicas` al arrancar. El catálogo real (que crece) está en `tematicas/` |
| `mexico-geo.ts` 🟢 | Estados y municipios de México (`ESTADOS_DE_MEXICO`, `municipiosDe`) |
| `perfil-opciones.ts` 🟢 | Especialidades y organizaciones del perfil: lista base `ESPECIALIDADES` (44 desde el 2026-10-26), `validarEspecialidad()`, `validarOrganizacion()` y `claveDeCatalogo()` (las usan los formularios y el servidor) |
| `legal.ts` 🟢 | `RESPONSABLE` (nombre, domicilio y correo; `null` = pendiente) y `FECHA_DE_ACTUALIZACION` de `/terminos` y `/privacidad` (2026-10-19) |
| `campaign-date.ts` | Fechas de campaña y las transiciones automáticas (`activateScheduledCampaigns`, `finalizeExpiredCampaigns`, `hasCampaignStarted`, `hasCampaignEnded`). Al activar o finalizar por fecha, avisa al creador. Corren cada minuto desde `instrumentation-node.ts` y al leer las listas de campañas |
| `open-data.ts` | Catálogo de datos abiertos (`/datos`): búsqueda, facetas, formatos, licencia |
| `open-data-csv.ts` | `tablaDeAportesCsv(filas)`: la tabla `aportes.csv` del ZIP de descarga (seudónimos "Participante N" / "Anónimo", UTF-8 con BOM, celdas a salvo de fórmulas) y `ubicacionDeCampana()` |

## Por módulo

### `aportes/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `archivo.ts` 🟢 | Formatos y tamaño por tipo (`FORMATOS`: foto 10 MB, video 50 MB, audio y documento 20 MB, texto 1 MB), `tiposAceptados(dataTypes)`, `archivoEsOpcional()` (con texto), `errorDeArchivo(file, tipos, formatos?)`, `acceptDeArchivo()`, formatos de "Archivo" que elige la campaña (2026-10-28: `FORMATOS_DE_DOCUMENTO`, `normalizarFormatosDeDocumento`, `extensionesDe`, `documentoPermitido`, `nombresDeFormatos`; `[]` = todos), largo de la descripción, `formatearTamano()` (KB/MB), `TIPO_DE_DATO` (cómo se describe cada tipo a quien aporta) y el aviso de metadatos de video y audio | Endpoints de aportes, `components/ui/SelectorDeArchivo`, pantallas de aportes y `/campanas/[id]` |
| `consentimiento.ts` 🟢 | Textos de los acuerdos para aportar (confirmación y uso del aporte), textos cortos de las casillas, nombres de los campos (`aceptaUso`, `confirmaContenido`) y `errorDeConsentimiento()` (FormData o JSON) | `components/ui/AcuerdosDeAporte`, `lib/campanas/inscripciones.ts`, `POST /api/c/[token]/aportes` |
| `comun.ts` | `guardarArchivoDelAporte()` (valida por contenido, limpia y sube a MinIO; sin archivo si la campaña acepta texto), `cuerpoDemasiadoGrande()` (413 antes de leer el formulario), `insertarAporteConCuota()` (cuenta e inserta con candado: cuota por persona, límite del 10% de aportes anónimos y límite total por tipo, sin carreras), `tiposConLugarParaElAporte()` (aviso del límite por tipo antes de subir); `guardarArchivoDelAporte` también exige los formatos de "Archivo" de la campaña por el formato real, `recalcularContadores()` (contadores de la campaña desde `aportes` en `campana_estadisticas`, con la campaña bloqueada) y reexporta `archivo.ts` | `POST /api/aportes`, `aportes-anonimos.ts` |
| `tabla-archivos.ts` | Archivo del aporte en la tabla `archivos` (2026-10-30): `columnasDeArchivo(alias)` (fragmento SQL que devuelve `file_path`, `file_original_name`, `file_mime_type`, `file_size_bytes` y `archivo_borrado_en` con los nombres de antes) y `registrarArchivo(client, guardado)` | Endpoints de aportes, `aportes-anonimos.ts`, pantallas de revisión y supervisión |
| `limpiar-archivo.ts` | `limpiarArchivo(file, tipos)`: el tipo lo decide la firma del contenido y debe coincidir con la extensión. Fotos con `imagen.ts`; PDF sin Info ni XMP (`pdf-lib`; rechaza cifrados); .docx, .pptx y .xlsx sin propiedades ni autores (`jszip`; rechaza macros); .xls se comprueba y va tal cual (2026-10-26); .txt a UTF-8; video y audio tal cual | `comun.ts` |
| `imagen.ts` | `limpiarImagen()`: comprueba la firma JPG/PNG y vuelve a codificar con `sharp`, quitando EXIF (GPS), ICC y XMP | `limpiar-archivo.ts` |
| `anonimato.ts` | Cookie `anonimo_id` y `hashDeDispositivo()` | Aporte anónimo, `/c/[token]`, sanciones |
| `reporte.ts` | "Reportar aporte" (`reportarASupervision`, 2026-11-07): el revisor o el creador reportan a quien envió el aporte, uno por aporte; guarda motivo y descripción en `reportes` (`origen = 'supervision'`), rechaza el aporte, lo agrega a la bandeja de Reportes y avisa solo a los supervisores. No banea | `POST /api/aportes/[id]/reportar` |
| `decision.ts` | Sin `pg`: `tieneDecision()` y `ESTADOS_SIN_DECISION`, la regla de que una decisión no se cambia | API de aportes, `sanciones-anonimas.ts`, pantallas |
| `motivos-de-rechazo.ts` | Sin `pg`: listas de motivos para rechazar y para reportar | Pantallas del creador y del revisor |
| `sanciones-anonimas.ts` | Sanciones a personas sin cuenta: marcar inapropiado, bloqueo por campaña, bloqueo global automático (3 inapropiados en 30 días → 30 días), borrar archivo, listar y quitar bloqueos | API de aportes y de baneos, `/usuarios/sanciones` |
| `bandeja.ts` | Bandeja del SuperUsuario: `buscarAportesPorParticipante` (agrupa por persona: con cuenta o mismo dispositivo anónimo; filtros y paginación por persona en SQL), `contarPorEtapa`, `listarCampanasConAportes`, `campanaTieneRevisor`, `PESTANAS_APORTES` y etiquetas de etapa. Exige sesión raíz; no lee archivos, correos ni la descripción completa | `/aportes`, `/aportes/dashboard` |
| `dashboard.ts` | `obtenerDashboardDeAportes(rango)`: totales, cola de pendientes, tasa de aprobación, recolección por día/semana/mes (hora de Tepic), reparto por tipo y temática, motivos de rechazo (textos idénticos agrupados) y campañas que más aportan. Exige sesión raíz | `/aportes/dashboard` |

### `campanas/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `publicas.ts` | Búsqueda de campañas activas y pausadas (estas después, desde el 2026-10-24) con filtros | `/explorar` |
| `panel.ts` | Métricas de una campaña (aportes por estado, participantes, avance) | Paneles de `/supervision`, `/supervisar`, `/sistema/campanas/[id]` |
| `baneos.ts` | Baneos por campaña: consultar, listar, quitar | API de baneos, `/api/aportes`, `/usuarios/[id]` |
| `cuota-pendiente.ts` | `campanasConCuotaPendiente(usuarioId, { favoritasQueCierranAntesDe, limite })` (2026-11-10): activas donde le faltan aportes para su cuota (donde ya aportó o favoritas que cierran pronto; sin las propias ni las que la banearon) | Recordatorio semanal (`notificaciones/periodicas.ts`), aviso del menú lateral |
| `aportes-anonimos.ts` | Aporte **sin cuenta** desde `/c/[token]`: valida enlace, campaña e interruptor `permite_anonimos`, límite por campaña del 10% de la meta (cuentan los aceptados y los pendientes de revisión; solo un rechazo libera el lugar; se revisa al enviar, con la campaña bloqueada; única copia de la regla), sin limitar aportes con cuenta; además, bloqueos del dispositivo, cuota por dispositivo (se guarda el hash de la cookie), espera entre aportes del dispositivo (`ESPERA_ENTRE_APORTES_SEGUNDOS`), tope por IP en memoria (`TOPE_POR_IP_POR_HORA`, se poda cada minuto) y guarda el aporte sin datos personales, sin ninguna forma de la IP (los límites por IP viven en memoria). Bitácora `aporte.anonimo_enviar` sin IP | `POST /api/c/[token]/aportes`, `/c/[token]` |
| `enlaces.ts` | Enlace público `/c/[token]`: `asegurarEnlaceVigente` (se genera solo al quedar activa la campaña), `regenerarEnlace` (creador), buscar por token, contar visitas, atribuir aportes y generar el QR (SVG/PNG con `qrcode`). Todo en transacción con la campaña bloqueada. No autoriza: el llamador comprueba antes | `/api/campanas/[id]/{enlace,qr}`, `/c/[token]`, `POST /api/aportes`, `lib/supervision/decision.ts`, `lib/campaign-date.ts`, `PATCH`/`PUT /api/campanas/[id]` |
| `estado-del-creador.ts` | Qué estado puede pedir el creador (`borrador`/`en_revision`), cola de 5 en revisión (`cola-de-revision.ts`, sin imports de servidor), XP fijo | `POST /api/campanas`, `PATCH`/`PUT /api/campanas/[id]` |
| `ubicacion.ts` 🟢 | `textoDeUbicacion()` ("Centro, Tepic, Nayarit" o "Todo el país") y `TEXTO_TODO_EL_PAIS` (2026-10-21) | Detalle de campaña, Mis aportes, supervisión, `/explorar`, `/datos`, `/c/[token]`, CSV de datos abiertos |
| `reparto-sugerido.ts` 🟢 | Reparto **sugerido** de la cuota por persona entre los tipos de dato (2026-10-27; antes `cuota-por-tipo.ts`, que lo exigía): `repartoSugerido(cuota, tipos)` ("unos 5 de cada tipo"), `cantidadDeTipo()`, `ORDEN_DE_TIPOS`. No limita nada | `NuevaCampanaForm`, `/campanas/[id]`, `/campanas/[id]/aportar`, `/c/[token]`, supervisión |
| `tipos-de-campana.ts` | Tipos de dato de la campaña en la tabla `campana_tipos` (2026-10-30): `columnasCalculadas(alias)` (fragmento SQL que devuelve `data_types`, `limite_por_tipo`, `enviados_por_tipo`, `formatos_de_documento`, `has_reviewer_assigned`, los contadores de `campana_estadisticas`, `is_special`/`especial_*` de `campana_especial` y `checklist_secciones` de `campana_checklists` con los nombres de antes), `columnasDeEstadisticas`, `columnaDeTipos`, `condicionDeTipos`, `guardarTiposDeCampana` y `actualizarEnviados` | API de campañas, `aportes/comun.ts`, listas públicas, panel, supervisión, datos abiertos |
| `limite-por-tipo.ts` 🟢 | Límite TOTAL de aportes por tipo de dato (2026-10-28, opcional): `resolverMetaYLimites` (meta por tipo = suma de los límites, obligatorios; o meta general sin límites), `normalizarLimitePorTipo`, `limitePorTipoDesdeFila`, `enviadosPorTipoDesdeFila`, `tiposConLugar`, `quedanDelTipo`, `mensajeDeTipoLleno`, `resumenDeLimites` ("100 fotos (quedan 40)"), `avisoDeTodoLleno`. Cuentan los no rechazados | `NuevaCampanaForm`, API de campañas, `aportes/comun.ts`, aportar, `/c/[token]`, detalle, supervisión |
| `metricas-generales.ts` | `obtenerMetricasGenerales(id)` (2026-10-27): "Métricas generales" del panel según los atributos de la campaña (sin temática: se quitó a pedido del usuario): tipos de dato (recibidos, % aprobados, peso promedio), ubicación (participantes con cuenta en la zona y por estado; sin cuenta), origen (con o sin cuenta, por enlace), revisión (tasa, tiempo promedio, motivos), participación (promedio por persona, quién llegó a la cuota) y respuestas de cada checklist entre los aprobados. No autoriza. Tipos en `metricas-generales-tipos.ts` (sin `pg`) | `GET /api/campanas/[id]/metricas`, `/supervision/[id]/panel`, `/supervisar/[id]/panel` |
| `tabla-checklists.ts` | Checklists en tablas (2026-10-30): `columnaDeChecklists(alias)` y `columnaDeRespuestas(alias)` (fragmentos SQL que devuelven `checklist_secciones` y `caracteristicas` como antes), `guardarChecklists` (agrega, reordena y retira o borra en una sola sentencia; lo que tiene respuestas se retira) y `guardarRespuestas` | API de campañas y aportes, pantallas de aportes, métricas |
| `checklist.ts` 🟢 | Checklists con título: normalizar, validar respuestas, límites (`MAX_SECCIONES`...). Desde el 2026-10-28 cada uno lleva su `tipo` de dato: `seccionesDelTipo` (los que ve un aporte de ese tipo) y `seccionesParaElAporte` (los del formulario de aportar según el archivo elegido) | Formulario de campaña, aportar, API |
| `sistema.ts` | Consultas del panel del SuperUsuario (listado, conteos, dashboard). Exigen sesión raíz | `/sistema/campanas/**` |
| `meta.ts` 🟢 | **La meta cuenta solo los aprobados** (2026-10-20): `porcentajeDeMeta(aprobados, meta)` y `pronosticoDeMeta()` (¿se llega al ritmo actual?) | Todas las pantallas que muestran el avance de una campaña, `sistema.ts`, `filtro-local.ts` |
| `visibilidad.ts` | Qué campañas lee cada quien en `GET /api/campanas` y `GET /api/campanas/[id]` (`condicionDeVisibilidad`): públicas activa, pausada y finalizada; además el creador las suyas, el supervisor las en revisión y las que supervisa, el revisor aceptado la suya y la sesión raíz todas (2026-10-20) | `app/api/campanas/route.ts`, `app/api/campanas/[id]/route.ts` |
| `rechazo.ts` 🟢 | Por qué se rechazó una campaña (`RechazoDeCampana`, `rechazoDesdeFila`): motivo, fecha, si fue el SuperUsuario y la sanción del último rechazo, para el creador (2026-10-22) | `GET /api/campanas?mine=true`, `/mis-campanas`, formulario de campaña |
| `revisores.ts` | `quitarRevisor(campanaId, usuarioId)`: quita a un revisor o cancela su invitación en una transacción (rol "revisor", notificación de invitación; "tiene revisor" se calcula de `campana_revisores`) (2026-10-22) | `DELETE /api/campanas/[id]/revisores` |
| `sistema-opciones.ts` 🟢 | Constantes y tipos de esas pantallas (pestañas, etiquetas, órdenes) | `/sistema/campanas/filtros.tsx`, `components/campanas/BarraDeFiltros.tsx` |
| `filtro-local.ts` 🟢 | Filtra y ordena en el navegador listas ya cargadas, con los mismos criterios que `buscarCampanas()`; aviso de lista vacía (`avisoSinResultados`) | `/supervision`, `/supervisar`, `/revisiones` |

### `supervision/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `datos-abiertos.ts` (2026-11-04) | Publicar o no los datos de una campaña terminada: `decidirDatosAbiertos` y `marcarDatosPorDecidir` (tarea de cada minuto) | `PATCH /api/campanas/[id]`, `lib/supervision/acciones-root.ts`, `instrumentation-node.ts` |
| `parecido.ts` 🟢 (2026-11-07) | `compararCampanas()` y `esSimilar()`: en qué se parecen dos campañas (temática, subtemática, nombre, descripción, tipos de dato) | `similares.ts`, `supervision/CampanasSimilares` |
| `similares.ts` (2026-11-04) | Campañas parecidas a una en revisión, de la más parecida a la menos, para que la supervisión decida si se acepta | `GET /api/campanas/[id]/similares`, `/supervisar/[campaignId]` |
| `decision.ts` | **Reglas del dictamen**, compartidas por supervisores y SuperUsuario: tomar una campaña (`tomarCampanaParaSupervisar`) y aceptarla, rechazarla o reportarla (`registrarDecisionDeCampana`). Notifica al creador y escribe en la bitácora | `PATCH /api/campanas/[id]`, `acciones-root.ts` |
| `root.ts` | Guardia `exigirSesionRoot()` y consultas de `/supervisar` | Páginas de `(panel)` |
| `estado-por-supervision.ts` | **Pausar (con motivo), reanudar o finalizar (con motivo)** una campaña desde la supervisión (`cambiarEstadoPorSupervision`): permisos, transiciones, bitácora y aviso al creador (2026-10-15) | `PATCH /api/campanas/[id]`, `acciones-root.ts` |
| `acciones-root.ts` ⚡ | `decidirComoSuperUsuario` (si nadie supervisa la campaña, la toma en el mismo paso; desde el 2026-10-22 ya no hay `tomarComoSuperUsuario`), `cambiarEstadoComoSuperUsuario` | `/supervisar/[campaignId]` |

### `usuarios/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `aviso-del-menu.ts` | `avisoDelMenuParaUsuario(usuario)` (2026-11-10): recuadro azul del menú lateral: invita a participar con un solo aviso (cuota pendiente; si no, una campaña que cierra pronto y necesita aportes, primero de sus temáticas); sin nada, la frase de siempre. No repite lo que ya llega como notificación | `layout/ShellDeUsuario` → `layout/SidebarNav` |
| `inicio.ts` | `obtenerResumenDeInicio(usuario)`: datos de `/inicio` (cifras, campañas para ti, aportes recientes y notificaciones sin leer) | `/inicio` |
| `tabla-roles.ts` | Roles en la tabla `usuario_roles` (2026-10-30): `columnaDeRoles(alias)` (devuelve `role` como antes), `condicionDeRol(alias, rol)`, `agregarRol`, `quitarRol` | Sesión, API de usuarios, panel, revisores |
| `directorio.ts` | Búsqueda de usuarios, ficha, estado de la cuenta, lista de sanciones (`listarSanciones`) | `/usuarios/**` |
| `dashboard.ts` | Métricas de usuarios por rango de fechas | `/usuarios/dashboard` |
| `supervisores.ts` | Lista de supervisores y su actividad | `/usuarios/supervisores/**` |
| `revisor.ts` | Retirar a alguien como revisor de todas sus campañas | `revocarRol` (al quitar el rol de revisor), borrado definitivo de una cuenta |
| `baja.ts` | Baja voluntaria: resumen, pedirla, cancelarla al iniciar sesión y borrado definitivo al vencer el plazo | `/cuenta/eliminar`, `DELETE /api/usuarios/[id]`, login y Google, `instrumentation-node.ts` (cada hora) |
| `avatar-opciones.ts` 🟢 | Ícono del perfil: opciones (iniciales, masculino, femenino, otro, foto), límites de la foto (JPG/PNG, 5 MB, 256 px), `errorDeFotoDePerfil`, `inicialesDe`, `datosDeAvatar` | `components/ui/Avatar`, `/cuenta` (`EditarAvatar`), `TopBar`, `/api/usuarios/[id]/avatar` |
| `avatar.ts` | `cambiarAvatar` (procesa la foto con sharp a 256 px sin metadatos, la guarda en MinIO y borra la anterior) y `leerFotoDePerfil` | `/api/usuarios/[id]/avatar` |
| `baja-opciones.ts` 🟢 | Constantes de la baja: plazo de gracia (`MINUTOS_DE_GRACIA` = 3 desde el 2026-10-19; eran 30 días), ELIMINAR, destinos de los aportes, formato de fecha | `/cuenta/eliminar`, `/baja-solicitada`, `baja.ts` |
| `recuperacion.ts` | Códigos por correo para poner contraseña: recuperarla sin sesión (sin revelar si la cuenta existe; cierra todas las sesiones) y crearla desde `/cuenta` en una cuenta de Google (conserva las sesiones) | `POST /api/auth/recuperar{, /restablecer}`, `POST /api/usuarios/[id]/contrasena{, /codigo}` |
| `recuperacion-opciones.ts` 🟢 | Números de la recuperación: 15 min, 3 intentos, 30 s entre correos | `/recuperar`, `recuperacion.ts` |
| `contrasena-actual.ts` | Comprueba la contraseña actual; un error suma al bloqueo del login | Cambio de contraseña, baja de cuenta |
| `rol-asignable.ts` 🟢 | Nombres y descripciones de roles para la interfaz | Panel |
| `perfil.ts` 🟢 | Largos máximos de los campos del perfil (`errorDeLargo`). Los intereses se validan en `tematicas/catalogo.ts` | `POST /api/usuarios`, `PATCH /api/usuarios/[id]` |
| `especialidades.ts` | Catálogo de especialidades (2026-10-26) sobre `catalogos/catalogo-de-perfil.ts`: `especialidadesDelPanel` (listar, crear, renombrar, borrar), `especialidadesVisibles()` y `resolverEspecialidad()` (valida; una nueva se da de alta; en el registro, `darDeAlta: false`) | `GET /api/especialidades`, `POST /api/usuarios`, `PATCH /api/usuarios/[id]`, `/sistema/especialidades` |
| `acciones-especialidades.ts` | Server actions de `/sistema/especialidades` (2026-10-26): `crearEspecialidadDelPanel`, `editarEspecialidad`, `borrarEspecialidadDelPanel`, sobre `catalogos/acciones-de-catalogo.ts`; bitácora `especialidad.crear`/`editar`/`borrar` | `/sistema/especialidades` |
| `organizaciones.ts` | Catálogo de organizaciones (2026-10-26) sobre `catalogos/catalogo-de-perfil.ts`: `organizacionesDelPanel` (renombrar también cambia `campanas.organizer`), `organizacionesVisibles()` y `resolverOrganizacion()` | `GET /api/organizaciones`, `POST /api/usuarios`, `PATCH /api/usuarios/[id]`, `/sistema/organizaciones` |
| `acciones-organizaciones.ts` | Server actions de `/sistema/organizaciones` (2026-10-26): `crearOrganizacionDelPanel`, `editarOrganizacion`, `borrarOrganizacionDelPanel`; bitácora `organizacion.crear`/`editar`/`borrar` | `/sistema/organizaciones` |
| `escala-de-avisos.ts` 🟢 | La escala de avisos: `AVISOS_PARA_BANEO`, `consecuenciaDelAviso(n)`, `describirConsecuencia` | `aplicarSancion`, pantallas del panel |
| `lista-negra.ts` | Lista negra de correos: `correoEnListaNegra`, `agregarAListaNegra` (en la transacción del baneo), `quitarDeListaNegra`, `listarListaNegra` | `aplicarSancion`, `restaurarAcceso`, `POST /api/usuarios`, callback de Google, `.../sanciones` de `/supervisar` y `/supervision` |
| `acciones-usuarios.ts` ⚡ | `asignarRol`, `revocarRol`. Cada una notifica a la persona (las sanciones pasaron a `moderacion/acciones.ts` el 2026-10-13) | `/usuarios/[id]/roles` |
| `acciones-supervisor.ts` ⚡ | `revertirAccion`: deshace una decisión de supervisor | `/usuarios/supervisores/[id]/revertir/...` |

### `catalogos/` (2026-10-26)

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `catalogo-de-perfil.ts` | `crearCatalogo(config)`: lógica común de un catálogo de un campo de texto del perfil (tabla con `nombre`, `clave`, `origen`): `visibles`, `resolver` (valida y da de alta), `listarDelPanel`, `crear`, `renombrar` (también en `usuarios` y, si se configura, en una columna de `campanas`, en transacción) y `borrar` (no las base; deja el dato vacío en los perfiles) | `usuarios/especialidades.ts`, `usuarios/organizaciones.ts` |
| `acciones-de-catalogo.ts` | `accionesDeCatalogo(config)`: pasos comunes de las server actions del panel (sesión raíz → validación → lógica → bitácora → `revalidatePath`). No es `"use server"`: lo envuelven los archivos `acciones-*.ts` | `usuarios/acciones-especialidades.ts`, `usuarios/acciones-organizaciones.ts` |

### `reportes/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `reportes.ts` | Reportes: `reportarCampana` (contra el creador), `yaReporto` (`reportarParticipante` se quitó el 2026-11-07: el de aporte es `reportarASupervision` de `lib/aportes/reporte.ts`), `listarReportes` (agrupados por caso), `contarReportesPendientes`, `reportesPendientesContra`, `sqlDeClave` | `POST /api/campanas/[id]/reportar`, GET de campaña, `.../reportes` y `.../sanciones/[usuarioId]` de `/supervisar` y `/supervision`, layout del panel (contador de "Modo supervisor"), `aplicarSancion`. `listarReportes` y `contarReportesPendientes` reciben la cuenta del supervisor para no mostrarle reportes contra él |
| `motivos.ts` 🟢 | Motivos para reportar una campaña o un aporte, largo máximo, estados y la clave del caso (`campana-116`, `aporte-55`) | `/campanas/[id]`, detalle del aporte, bandejas de reportes |

### `moderacion/` (2026-10-13)

Reportes y sanciones, que antes eran del panel del SuperUsuario. Las mismas pantallas (`components/moderacion/*`) se muestran en dos zonas: `/supervisar/{reportes,sanciones}` (SuperUsuario en modo supervisor) y `/supervision/{reportes,sanciones}` (usuario con rol `supervisor`).

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `rutas.ts` 🟢 | `ZonaDeModeracion` (`supervisar` o `supervision`), `rutasDeModeracion(zona)` (reportes, sanciones, sancionar, ficha de campaña) y `pestanasDeModeracion` (Campañas / Reportes / Sanciones) | Pantallas y componentes de `components/moderacion` |
| `moderador.ts` | `moderadorDe(zona)` (para server actions: raíz o usuario con rol `supervisor`, según la zona), `exigirModerador(zona)` (para páginas: redirige a `/root` o `/campanas`), `actorDeModerador`, `firmaDeModerador` (`aplicada_por`), `cuentaDelModerador` | Páginas de las dos zonas, `acciones.ts` |
| `acciones.ts` ⚡ | `aplicarSancion`, `restaurarAcceso`, `descartarReportes`, `quitarBloqueoDeDispositivo`; reciben la zona y comprueban su sesión. Un supervisor no se modera a sí mismo | `components/moderacion/*` |
| `sancionar.ts` (2026-10-16) | Aplicar una sanción en un solo lugar: `sancionarEnTransaccion` (aviso con su escala, suspensión directa de 2 o 7 días o baneo, dentro de la transacción de quien llama), `avisarSancion`, `detalleDeAuditoria`, `errorDeSancionPedida` | `aplicarSancion` y el rechazo de una campaña con sanción (`lib/supervision/decision.ts`) |

### `gamificacion/` (2026-10-13)

Tabla de líderes de la landing. **Hoy devuelve datos de ejemplo** y la sección está oculta salvo con `MOSTRAR_TABLA_DE_LIDERES=si`; la lógica real la hace quien lleva la gamificación (instrucciones en el comentario de `obtenerTablaDeLideres`).

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `tipos.ts` 🟢 | Contrato: `Lider`, `TablaDeLideres`, `CategoriaDeClasificacion`, `LIDERES_POR_CATEGORIA` (6), `LUGARES_DEL_PODIO` (3), `textoDelValor()`, `nombreParaMostrar()` ("Carlos P.") | `components/gamificacion/*`, `clasificacion.ts` |
| `clasificacion.ts` | `obtenerTablaDeLideres()` (TODO: consultas reales) y `mostrarTablaDeLideres()` (interruptor del entorno) | `app/page.tsx` |
| `datos-de-ejemplo.ts` 🟢 | `TABLA_DE_EJEMPLO`: 6 personas inventadas; se borra al conectar la base | `clasificacion.ts` |
| `rangos.ts` 🟢 (2026-11-02) | Lógica pura de rangos (RF-GAM-16, 22, 23, 78 a 83): estado de cada rango, requisitos y avance, `pistaDelRango()`, fichas por estado (alcanzado, actual, siguiente, avistado, oculto), `textoDeAscenso()`; desde el 2026-11-10 `fechaDelRecorrido()`, `lapsoDeAscenso()` y `TEXTO_DE_LA_RACHA` (leyenda de la racha, SRS v1.3) | `progreso.ts`, `components/gamificacion/*` |
| `progreso-tipos.ts` 🟢 (2026-11-02) | Contrato de `ResumenDeProgreso`: rango, potenciadores, misiones de hoy y racha. El tipo de la ficha avistada no tiene campos ocultos (RNF-GAM-14) | `progreso.ts`, `components/gamificacion/*` |
| `catalogos.ts` 🟢 (2026-11-04) | Valida `lib/datos/rangos.json`, `lib/datos/misiones.json` y, desde el 2026-11-09, `lib/datos/medallas.json` (`erroresDeMedallas()`); `ensureGamificacion()` los copia a las tablas al arrancar | `lib/db-schema.ts` |
| `misiones-reglas.ts` 🟢 (2026-11-04) | Reglas puras de misiones (RF-GAM-40 a 45): `periodoEn()`, `avanceDeMision()`, `elegirMisiones()`, `textoDeRecompensa()` | `misiones.ts`, `catalogos.ts` |
| `misiones.ts` (2026-11-04) | `actualizarMisiones()`: avance y recompensa automática; `asegurarMisionesVigentes()`: abre los periodos al leer; `obtenerMisiones()`: datos de `/progreso/misiones` | `/api/aportes`, `/api/aportes/[id]`, `/api/campanas/[id]/guardar`, `progreso.ts` |
| `racha-reglas.ts` 🟢 (2026-11-04) | Reglas puras de la racha sin protectores (RF-GAM-25, 27, 31): `calcularRacha()`, `diaDeRuptura()` | `racha.ts` |
| `racha.ts` (2026-11-04) | `actualizarRacha(usuarioId)`: recalcula y guarda `racha_dias`, `racha_eventos` y `usuario_progreso`; registra `racha_recuperada` cuando un aporte reaviva una racha perdida (Fénix, 2026-11-09) y, si algo cambió, evalúa rango y medallas; `revisarRachas()`: cada minuto, para los días sin aportes | `/api/aportes`, `instrumentation-node.ts` |
| `medallas.ts` 🟢 (2026-11-04) | `medallasMasCercanas()`, `nivelPorValor()`, `mayorSecuenciaSinRechazo()` (Pulso Firme) y `RACHA_PERDIDA_MINIMA_PARA_FENIX` | `mi-progreso.ts`, `evaluacion.ts`, `racha.ts` |
| `exp-reglas.ts` 🟢 (2026-11-09) | Reglas puras de la EXP (RF-GAM-01 a 03, 37, 38): `calcularExpDeAporte()`, `bonoDeCuota()`, `redondearExp()` (mitades hacia arriba), `PARAMETROS_GAMIFICACION_V2` (calificación de 1 a 5) | `recompensas.ts`, `lib/db-schema.ts` |
| `parametros.ts` (2026-11-09) | `leerParametros()`: versión vigente de `parametros_gamificacion` y fecha de lanzamiento (RF-GAM-64, 67) | `recompensas.ts`, `evaluacion.ts` |
| `recompensas.ts` (2026-11-09) | `recompensarAporteAceptado(client, aporteId)`: dentro de la transacción de aceptación (SAVEPOINT) da la EXP, el movimiento, los contadores y el bono de cuota, y evalúa rango y medallas; `repararRecompensasPendientes()`: cada minuto, retoma los aceptados que quedaron sin procesar (`aportes.exp_otorgada` NULL) | `/api/aportes/[id]`, `instrumentation-node.ts` |
| `evaluacion.ts` (2026-11-09) | `evaluarProgreso()` / `evaluarProgresoDe()`: ascenso de rango (uno o varios, con `rango_ascensos`) y niveles de medalla (`medallas_usuario`, `medalla_ascensos`), con avisos `rango_ascenso` y `medalla_nivel`; `valoresDeMedallas()`: lo que mide cada una de las 11 medallas | `recompensas.ts`, `racha.ts`, `misiones.ts`, `progreso.ts`, `mi-progreso.ts` |
| `pantallas-de-progreso.ts` 🟢 (2026-11-04) | Las pestañas de Mi progreso y cuáles ya existen (`rutaDePantalla()`; Trayectoria desde el 2026-11-10) | `components/gamificacion/*` |
| `mi-progreso-tipos.ts` 🟢 (2026-11-04) | Contrato del Resumen, de la Trayectoria (`DatosDeTrayectoria`, `RANGOS_POR_TRAMO`, 2026-11-10) y del calendario de racha | `mi-progreso.ts`, `components/gamificacion/*` |
| `mi-progreso.ts` (2026-11-04) | `obtenerDatosDeResumen()` (fichas de los 20 rangos, camino, calificaciones, medallas), `obtenerDatosDeTrayectoria()` (2026-11-10: camino de los 20 rangos, recorrido, tabla de requisitos y fichas) y `obtenerCalendarioDeRacha()`; solo lectura; devuelven `null` si fallan | `/progreso`, `/progreso/trayectoria`, `/api/progreso/racha` |
| `progreso.ts` (2026-11-02) | `obtenerResumenDeProgreso(usuarioId)`: 6 consultas en paralelo (`usuario_progreso`, `rangos`, `rango_ascensos`, `potenciadores`, `mision_instancias`, `racha_dias`); devuelve `null` si falla | `/inicio`, `/progreso` |

Componentes en `components/gamificacion/`: `TablaDeLideres` (cliente: categorías y selector de temática), `Podio` (lugares 1 a 3) y `ListaDeLideres` (del 4 en adelante).

Componentes del progreso (2026-11-02, diseño v9): `ResumenDeRango` (compone `TarjetaDeAvatar`, `BarraDeRequisitos` y `CaminoCompacto`), `CaminoCompacto` (cliente, abre `FichaDeRango`), `FichaDeRango` (cliente, `<dialog>`), `InsigniaDeRango`, `AvatarDeGamificacion` (placeholder: el avatar es distinto de la foto de perfil y es el único que se cambiará al mejorarlo), `ResumenDeHoy` (compone `PotenciadorActivo` —cliente, cuenta regresiva—, `MisionesDeHoy` y `RachaSemanal`). Trayectoria (2026-11-10, diseño v11): `TrayectoriaDeRangos` (cliente, lleva la ficha abierta) compone `CaminoDeLaTrayectoria` (cliente: pista horizontal en escritorio, tramos de 5 en teléfono), `TarjetasDeLaTrayectoria` (`TarjetaDelSiguienteRango`, `TrayectoriaCompleta`, `TarjetaDelAvistado`, `RecorridoDeRangos`) y `TablaDeRequisitosDeRangos` (cliente). `ui/AyudaEmergente` (cliente): icono «!» con leyenda al pasar el cursor, enfocar o tocar; Escape la cierra sin cerrar la ventana que la contiene.

### `tematicas/`

Catálogo de temáticas (intereses del perfil y temática de campaña), desde el 2026-10-07.

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `analizar.ts` 🟢 | `analizarIntereses(texto, catalogo)`: temáticas que salen de un texto (diccionario local, palabras vacías, groserías, singular). `esTematicaNuevaValida`, `claveDeTematica`, `conMayuscula`, `MAXIMO_DE_INTERESES` (20), `LARGO_MAXIMO_DEL_TEXTO` (500), `LARGO_DEL_NOMBRE` (3 a 60, nombres del panel) | `ui/InteresesDesdeTexto`, `catalogo.ts`, `db-schema.ts` |
| `catalogo.ts` | `tematicasVisibles()`, `resolverIntereses()` (valida y da de alta las nuevas), `listarTematicasDelPanel(q)`, `cambiarVisibilidad()`; desde el 2026-10-26 `validarNombreDeTematica()`, `crearTematica()` (origen `panel`), `renombrarTematica()` (también en perfiles y campañas, en transacción) y `borrarTematica()` (no si la usan campañas; la quita de los perfiles). Las base no se editan ni borran. Desde el 2026-10-29: `revisarPropuestas()`/`crearPropuestas()` (temáticas que propone un usuario, pendientes, máximo 3), `revisarTematicaDeCampana()` (la temática de una campaña debe existir o venir propuesta), `tematicasPropuestasPor()`, `propuestaDeTematica()` y `rechazar(id, reemplazo)` (las campañas que la usan pasan a `reemplazo`) | `GET /api/tematicas`, `POST`/`PATCH /api/usuarios`, `/sistema/tematicas` |
| `equivalente.ts` 🟢 | `tematicaEquivalente(escrito, catalogo)` (2026-11-11): la temática existente que equivale a una que se quiere proponer, por nombre (plural, ortografía, erratas; reglas de `etiquetas/sinonimos.ts`) o por significado (`analizarIntereses`, solo si apunta a una). Si hay una, se asigna esa en vez de proponer | `ui/SelectorDeTemas`, `catalogo.ts` (`revisarPropuestas`, `revisarTematicaDeCampana`) |
| `acciones-tematicas.ts` | Server actions `cambiarVisibilidadDeTematica(id, oculta)` y `revisarTematica(id, aprobada)` (aprobar, o rechazar: la borra y la quita de los perfiles, desde el 2026-10-22), y desde el 2026-10-26 `crearTematicaDelPanel`, `editarTematica` y `borrarTematicaDelPanel`: sesión raíz, bitácora `tematica.ocultar`/`mostrar`/`aprobar`/`rechazar`/`crear`/`editar`/`borrar` | `/sistema/tematicas` |

### `etiquetas/` (2026-10-27)

Subtemáticas de una temática (Protección animal → Perros, Gatos...).

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `reglas.ts` 🟢 | `MAXIMO_DE_ETIQUETAS_POR_CAMPANA` (5), `MAXIMO_DE_ETIQUETAS_EN_PERFIL` (20), `MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL` (5, 2026-10-28) y tipos (`EtiquetaNueva`) | Formulario de campaña, perfil, tarjetas |
| `desde-texto.ts` 🟢 | `etiquetasEnElTexto()`: ids de las etiquetas que menciona el texto de intereses (2026-10-28), también por sus sinónimos (2026-11-07). Desde el 2026-11-11 gana la mención más larga ("tala de árboles" marca Deforestación, no también Árboles) y cada etiqueta usa las variantes de su temática | `ui/SubtematicasDelPerfil` |
| `base.ts` 🟢 | `ETIQUETAS_BASE`: etiquetas de cada temática base, sembradas una vez por temática (2026-10-28) | `lib/db-schema.ts` |
| `catalogo.ts` | `etiquetasVisibles(usuarioId?)` (con las pendientes propias, 2026-10-28), `tematicasConEtiquetas(usuarioId?)` (con las temáticas pendientes propias, 2026-10-29), `validarEtiquetasNuevas()`, `guardarEtiquetasDeCampana()`, `quitarEtiquetasDeOtraTematica()`, `etiquetasDeCampanas()`, `agregarEtiquetas()` (pone `etiquetas` en las filas antes de mapearlas; las pendientes solo para creador, supervisor y SuperUsuario), perfil (`etiquetasDelUsuario`, `guardarEtiquetasDelUsuario`, `recortarEtiquetasDelUsuario`) y panel (`listarEtiquetasDelPanel`, `crearEtiqueta`, `renombrarEtiqueta`, `borrarEtiqueta`, `aprobarEtiqueta`, `rechazarEtiqueta`...) | `/api/campanas`, `/api/usuarios/[id]`, `/api/etiquetas`, `lib/campanas/publicas.ts`, `lib/supervision/root.ts`, `/sistema/tematicas` |
| `sinonimos.ts` 🟢 | `DICCIONARIO_DE_SUBTEMATICAS` (temática → subtemática → variantes; hasta el 2026-11-10 una sola lista, `SINONIMOS_DE_ETIQUETAS`), `etiquetaEquivalente()` y `terminosDeEtiqueta()` (2026-11-04): al proponer, un sinónimo de una etiqueta de la temática se vuelve esa; desde el 2026-11-07 también otro orden, faltas de ortografía y erratas. Desde el 2026-11-11 reciben la temática y solo usan sus variantes | `catalogo.ts`, `ui/SelectorDeEtiquetas`, `ui/SubtematicasDelPerfil` |
| `validar-diccionario.ts` 🟢 | `problemasDelDiccionario()` (2026-11-11): las 6 reglas del diccionario (temática y subtemáticas base, formato, repetidas, una variante por temática, que al proponerla lleve a su subtemática y que en un texto marque solo esa). Correr `npm run validar:diccionario` después de tocar el diccionario | `scripts/validar-diccionario.mjs` |
| `acciones-etiquetas.ts` | Server actions del panel: crear, editar, borrar, ocultar/mostrar, aprobar/rechazar; sesión raíz y bitácora `etiqueta.*` | `/sistema/tematicas` |

### `notificaciones/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `notificaciones.ts` | `notificar()` crea una notificación (nunca lanza: si falla, solo lo registra en el log; llámala después del `COMMIT`). `listarNotificaciones()` (paginada, todas o sin leer, con el total sin leer), `marcarNotificacion()`, `marcarTodasComoLeidas()`, `borrarNotificacion()` (no borra una invitación de revisor sin aceptar) y `limpiarNotificaciones()` (borra las leídas y las de más de `DIAS_PARA_NOTIFICACION_VIEJA` días, con la misma excepción; `listarNotificaciones()` cuenta cuántas serían en `limpiables`) | `/api/notificaciones/**`, `/notificaciones` y los eventos: `PATCH /api/aportes/[id]`, `/api/campanas/[id]/{baneos,revisores}`, `decision.ts`, `campaign-date.ts`, `acciones-usuarios.ts` |
| `hitos-de-aportes.ts` | `avisarAportesRecibidos(campanaId, total)` (2026-10-19): cada 10 aportes recibidos avisa al creador (`aportes_recibidos`) con el total, borrando el aviso anterior de esa campaña. Lo llama `insertarAporteConCuota` | `aportes/comun.ts` |
| `tematica-nueva.ts` | `avisarTematicaNueva(nombre)` (2026-10-26): en segundo plano y por tandas, vuelve a analizar el texto de gustos (`intereses_texto`) de cada persona activa; si menciona la temática, se la agrega a sus intereses (si le queda lugar) y le avisa con `tematica_nueva` (enlace a `/cuenta`) | `acciones-tematicas.ts` (crear y aprobar) |
| `tematica-revisada.ts` | `avisarTematicaRevisada(propuesta, aprobada, rechazo?)` (2026-10-29): a quien propuso una temática, `tematica_aprobada` o `tematica_rechazada`; si se rechazó, al creador de cada campaña que la usaba, a qué temática pasó | `acciones-tematicas.ts` (`revisarTematica`) |
| `socializacion.ts` | Avisos a quien participa (2026-10-28): `avisarAvanceDeCampana(id)` (`campana_avance` al pasar el 25/50/75/100 % de la meta, una vez por hito con `campana_estadisticas.ultimo_hito_avisado`) y `avisarCampanaRelacionada(id)` (`campana_relacionada` a quien participa en otra campaña con alguna de sus etiquetas y vive donde se hace). Máx. 2 al día entre los dos | `PATCH /api/aportes/[id]` (al aceptar) y `campanas-por-interes.ts` (después de `campana_nueva`) |
| `push.ts` | Notificaciones push (Web Push con `web-push` y llaves VAPID): guardar o borrar la suscripción de un navegador (solo servicios de push conocidos) y `enviarPush()`, que `notificar()` llama en segundo plano. Sin llaves en el entorno queda apagado | `/api/push`, `notificaciones.ts` |
| `../en-vivo.ts`, `../en-vivo-postgres.ts`, `../en-vivo-cliente.ts` | Actualización en vivo (2026-10-19): `notificar()` llama `publicarAviso()`; triggers `dfg_avisar_cambio` (creados por `ensureAvisosDeCambios()`) mandan `NOTIFY dfg_cambios` y una conexión con LISTEN (`escucharCambiosDeLaBase()`, desde `instrumentation-node.ts`) sube `versionDeCambios()`. `GET /api/eventos` espera ambos. En el navegador, `useRecargaEnVivo()` hace que las pantallas cliente vuelvan a leer. EventEmitter en `globalThis`: los avisos personales solo sirven con un proceso | `notificaciones.ts`, `/api/eventos`, `ActualizacionEnVivo`, pantallas de datos de `(dashboard)` |
| `registro-push.ts` | Lado del navegador, sin `pg`: registra `public/sw.js`, pide permiso, suscribe, desactiva y resincroniza; `estadoDePush()` distingue sin soporte, iPhone sin instalar, bloqueado, inactivo y activo | `AvisosEnEsteDispositivo`, `NotificationsBell`, `LogoutButton` |
| `tipos.ts` | Sin `pg`: `TipoDeNotificacion` (los 30 eventos), el tipo `Notificacion` que entrega la API, el tono de cada tipo y el formato de fecha (`fechaDeNotificacion`, `haceCuanto`) | `NotificationsBell`, `ListaDeNotificaciones` |

### `sistema/`

| Archivo | Qué hace | Lo usa |
| --- | --- | --- |
| `metricas.ts` | Cifras generales del sistema | `/sistema` |
| `aviso-del-menu.ts` | `avisoDelMenuParaRoot({ reportes, tematicas })` (2026-11-10): pendientes del SuperUsuario para el recuadro azul del menú (campañas por supervisar, datos abiertos que solo él decide, temáticas, reportes), un renglón con enlace por cada uno; sin pendientes, la frase de siempre | Layout de `(panel)` → `sistema/Sidebar` |

## Fuera de `lib/`

| Archivo | Qué hace |
| --- | --- |
| `proxy.ts` | Redirección por cookie y CSRF en `/api` (ver [permisos.md](permisos.md)) |
| `instrumentation.ts` + `instrumentation-node.ts` | Al arrancar: valida `DATABASE_URL` y corre `ensureCoreSchema()` |
| `types/index.ts` | Tipos que devuelve la API a la zona de usuario (`Campaign`, `Contribution`, `User`, estados) |
| `components/supervision/RefrescoEnVivo.tsx` | Refresca la página cada pocos segundos (`router.refresh()`) en paneles de campañas activas |
| `components/layout/VigilanteDeSesion.tsx` | Revisa la sesión en cada navegación del cliente |
