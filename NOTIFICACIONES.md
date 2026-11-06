# Catálogo de notificaciones de DataForGood

Documento actualizado a partir de la implementación de `lib/notificaciones` y de los módulos que llaman a `notificar()`.

## 1. Clasificación

| Categoría | Significado |
| --- | --- |
| **Problema** | Algo salió mal o limita la participación de la persona. |
| **Acción** | La persona debe revisar, decidir o atender algo. |
| **Buenas noticias** | Una acción terminó favorablemente o se obtuvo un resultado positivo. |
| **Novedad** | Información nueva relacionada con campañas, intereses o participación. |
| **Aviso** | Información importante que no requiere una acción inmediata. |

## 2. Notificaciones vigentes

### 2.1 Problemas

| Tipo | Título mostrado | Texto del mensaje | Destinatario y condición |
| --- | --- | --- | --- |
| `aporte_rechazado` | **Aporte rechazado** | `Tu aporte en "{campaña}" fue rechazado. Motivo: {motivo}` | Persona que aportó, si el aporte no era anónimo y tiene cuenta. |
| `campana_rechazada` | **Campaña rechazada** | `Tu campaña "{campaña}" fue rechazada. Motivo: {motivo}` | Creador de la campaña. |
| `datos_no_publicados` | **Tus datos no se publicaron** | `La supervisión decidió no publicar los datos de "{campaña}". Motivo: {motivo}` | Creador de la campaña. |
| `campana_baneo` | **Ya no puedes aportar en una campaña** | `Quien organiza "{campaña}" te retiró de la campaña y ya no puedes enviar aportes en ella. Motivo: {motivo}` | Persona expulsada de una campaña. |
| `sancion_aplicada` | **Tu cuenta se suspendió {días} días**, **Tu cuenta fue baneada** o **Tu cuenta lleva un reporte** | `Motivo: {motivo}`. Para un aviso agrega: `Es tu aviso {n} de {total}. El siguiente: {consecuencia}.` | Cuenta sancionada por moderación. |

### 2.2 Acciones requeridas

| Tipo | Título mostrado | Texto del mensaje | Destinatario y condición |
| --- | --- | --- | --- |
| `invitacion_revisor` | **Invitación para revisar aportes** | `Te invitaron a ser revisor de aportes en la campaña "{campaña}".` | Persona invitada a revisar. La invitación pendiente no se puede borrar. |
| `campana_por_revisar` | **Nueva campaña por revisar** / **Una campaña vuelve a revisión** | `"{campaña}" espera a que un supervisor la tome y la revise.` | Supervisores disponibles, excepto el creador. |
| `datos_por_decidir` | **Decide si se publican sus datos abiertos** | `"{campaña}" terminó con {aprobados} de {meta} aportes aprobados. Revisa si sus datos se publican.` | Supervisor responsable. |
| `reporte_nuevo` | **Nuevo reporte de una campaña** / **Nuevo reporte de un aporte** | Campaña: `Reportaron la campaña "{campaña}"{ por "{motivo}"}. Revísalo en Reportes de supervisión.` Aporte: `Reportaron el aporte #{aporte} en "{campaña}"{ por "{motivo}"}. Revísalo en Reportes de supervisión.` | Supervisores. |
| `campana_editada` | **Hicieron ajustes en una campaña pausada** | `Quien organiza "{campaña}" cambió {campos}. Revisa que atienda el motivo de la pausa y decide si la reanudas.` | Supervisor de una campaña pausada. |
| `campana_pausada` | **La supervisión pausó tu campaña** | `"{campaña}" no recibe aportes por ahora. Motivo: {motivo}` | Creador. |
| `campana_en_espera` | **Campaña en espera** | Tipo conservado para avisos históricos; actualmente ya no se genera. | Creador de campañas antiguas que quedaron en espera. |

### 2.3 Buenas noticias

| Tipo | Título mostrado | Texto del mensaje | Destinatario y condición |
| --- | --- | --- | --- |
| `aporte_aceptado` | **Aporte aceptado** | `Tu aporte en "{campaña}" fue aceptado.` | Persona que aportó, si no fue anónima. |
| `campana_aceptada` | **Campaña aceptada** | `Tu campaña "{campaña}" fue aceptada. Se activará sola en su fecha de inicio; si quieres empezar antes, actívala desde Mis campañas.` | Creador. |
| `datos_publicados` | **Se publicaron tus datos abiertos** | `La supervisión publicó los datos de "{campaña}" en Datos abiertos.` | Creador. |
| `campana_iniciada` | **Tu campaña empezó** | `"{campaña}" llegó a su fecha de inicio y ya recibe aportes.` | Creador cuando llega la fecha de inicio. |
| `campana_reanudada` | **Tu campaña se reanudó** | `La supervisión reanudó "{campaña}": vuelve a recibir aportes.` | Creador. |
| `revisor_acepto` | **Tu campaña tiene revisor** | `{persona} aceptó revisar los aportes de "{campaña}".` | Creador. |
| `rol_asignado` | **Ahora eres {rol}** | `Ya puedes tomar campañas en revisión y dictaminarlas desde Supervisión.` | Persona a quien se asigna el rol de supervisor. |
| `sancion_restaurada` | **Recuperaste el acceso a tu cuenta** | `La administración levantó la sanción de tu cuenta. Ya puedes volver a participar.` | Persona cuya sanción fue restaurada. |
| `campana_desbaneo` | **Puedes volver a aportar** | `Quien organiza "{campaña}" te permitió volver a participar.` | Persona a quien se retiró el veto. |
| `aportes_recibidos` | **Tu campaña ya lleva {total} aportes** | `"{campaña}" ya recibió {total} aportes.` Si hay pendientes: `Tienes {pendientes} pendientes por revisar.` | Creador, cada 10 aportes. El aviso anterior se reemplaza. |
| `etiqueta_aprobada` | **Etiqueta aprobada** | `Aprobamos «{etiqueta}» en {temática}: ya se ofrece a todos y sigue {ubicación}.` | Persona que propuso la etiqueta. |
| `tematica_aprobada` | **Temática aprobada** | `Aprobamos «{temática}»: ya se ofrece a todos en los perfiles y al crear campañas.` | Persona que propuso la temática. |
| `campana_avance` | **Campaña al {hito} %** / **¡Meta cumplida!** | Antes del 100 %: `"{campaña}" ya lleva {aceptados} de {meta} aportes aceptados. Gracias por participar; compártela para llegar a la meta.` Al 100 %: `"{campaña}" completó su meta de {meta} aportes aceptados. Gracias por participar.` | Personas que aportaron o guardaron la campaña; hitos de 25, 50, 75 y 100 %. |

### 2.4 Novedades para participar

| Tipo | Título mostrado | Texto del mensaje | Destinatario y condición |
| --- | --- | --- | --- |
| `campana_nueva` | **Campaña nueva de {temática}** | `"{campaña}" ya recibe aportes{ en {lugar}}.` | Personas con la temática en sus intereses y que viven en la zona. Máximo tres al día. |
| `campana_especial` | **Campaña especial: experiencia ×{multiplicador}** | `"{campaña}" da ×{multiplicador} de experiencia por aporte aprobado {periodo}{ y la insignia "{insignia}" al completar tu cuota}.` | Personas que participan, guardaron la campaña o cumplen el criterio de campaña nueva. |
| `campana_relacionada` | **Otra campaña de {etiqueta}** | `Como participas en "{campaña donde participa}", te puede interesar "{campaña nueva}"{, que ya recibe aportes en {lugar}}.` | Participantes de otra campaña con una etiqueta común. Máximo dos avisos diarios junto con `campana_avance`. |
| `ubicacion_nueva` | **Estás en {zona}** | Sin campañas: `Por ahora no hay campañas activas en {municipio}. Te mostramos las de todo el país.` Con campañas: `Hay {n} campaña(s) activa(s) donde estás ahora. Échales un vistazo.` | Persona cuya zona detectada por GPS cambió. |
| `tematica_nueva` | **Nueva temática para ti: {temática}** | Si se agregó: `La agregamos a tus intereses porque coincide con lo que escribiste sobre tus gustos. Puedes quitarla en tu cuenta.` Sin espacio: `Coincide con lo que escribiste sobre tus gustos, pero ya tienes {máximo} intereses. Quita uno en tu cuenta para agregarla.` | Persona cuyo texto de intereses coincide con una temática nueva. |
| `recordatorio_semanal` | **Te faltan aportes** / **Tienes campañas por completar** | `Te falta(n) {cantidad} aporte(s) en "{campaña}" (cierra el {fecha}); ...` | Personas con aportes pendientes, si activaron Recordatorios. Se envía los lunes. |
| `resumen_mensual` | **Tu resumen de {mes}** | Resumen de aportes aceptados, campañas de la zona y datos abiertos publicados durante el mes. | Personas con Newsletter activado. Se envía el día 1. |

### 2.5 Avisos informativos

| Tipo | Título mostrado | Texto del mensaje | Destinatario y condición |
| --- | --- | --- | --- |
| `campana_en_revision` | **Tu campaña vuelve a revisión** | `Tu campaña "{campaña}" vuelve a revisión: un supervisor la revisará de nuevo.` | Creador cuando se revierte una decisión. |
| `campana_finalizada` | **Tu campaña terminó** / **La supervisión finalizó tu campaña** | Fecha: `"{campaña}" llegó a su fecha de fin y ya no recibe aportes.` Supervisión: `"{campaña}" ya no recibe aportes. Motivo: {motivo}` | Creador. |
| `supervision_revertida` | **Se revirtió una de tus decisiones** | `El SuperUsuario revirtió «{decisión}» en "{campaña}". Motivo: {motivo}. {descripción}` | Supervisor cuya decisión fue revertida. |
| `rol_revocado` | **Ya no eres {rol}** | Supervisor: `La administración retiró tu rol de supervisor. Las campañas que tomaste sin dictaminar quedaron libres.` Revisor: `La administración retiró tu rol de revisor de aportes en todas las campañas.` | Persona a quien se retira un rol. |
| `revisor_quitado` | **Ya no revisas aportes de una campaña** | `Quien organiza "{campaña}" te quitó como revisor de aportes. Los aportes que ya revisaste se conservan.` | Revisor retirado por el creador. |
| `etiqueta_rechazada` | **Etiqueta no aceptada** | `No aceptamos «{etiqueta}» en {temática} y se quitó {ubicación}. Puedes elegir otra de las que ya existen o proponer una distinta.` | Persona que propuso la etiqueta. |
| `tematica_rechazada` | **Temática no aceptada** / **Cambió la temática de tu campaña** | Perfil: `No aceptamos «{temática}»{ y se quitó de tus intereses}. Puedes elegir otra de las que ya existen o proponer una distinta.` Campaña: `No aceptamos la temática propuesta para «{campaña}»: ahora está en «{reemplazo}». Puedes cambiarla al editar la campaña.` | Persona que propuso la temática o creador afectado. |
| `campana_eliminada` | **Se eliminó una campaña en la que aportaste** | `Quien organizaba «{campaña}» la eliminó. Tus aportes en ella se borraron.` | Personas con aportes en la campaña eliminada. |
| `racha_interrumpida` | **Tu racha se interrumpió** | `Tu racha de {días} día(s) terminó. Tu rango y tus medallas no cambian.` | Persona que dejó pasar un día sin aportar. |
| `mision_completada` | **Misión completada** | Con recompensa: `{misión}: recibiste {recompensa}.` Sin recompensa: `{misión}. Suma a lo que piden los rangos.` | Persona que completó una misión. |

## 3. Tipos históricos o que ya no se generan

| Tipo | Situación |
| --- | --- |
| `aporte_reportado` | Sustituido por `reporte_nuevo`, enviado directamente a supervisores. |
| `campana_reportada` | Ya no se avisa al creador cuando un supervisor reporta su campaña. |
| `campana_en_espera` | Se conserva para avisos históricos; dejó de generarse al eliminarse el tope de campañas activas. |

## 4. Preferencias y avisos esenciales

En **Cuenta → Preferencias** existen estos controles:

| Preferencia | Controla |
| --- | --- |
| **Notificaciones** | Apaga las notificaciones no esenciales. |
| **Campañas nuevas** | `campana_nueva` y `campana_especial`. |
| **Aportes** | `aporte_aceptado`, `aporte_rechazado` y `racha_interrumpida`. |
| **Recordatorios** | `recordatorio_semanal`. |
| **Newsletter** | `resumen_mensual`. |

Aunque se apague **Notificaciones**, siempre se conservan los avisos esenciales: asignación y retiro de roles, sanciones aplicadas o restauradas, baneo y desbaneo de campaña, invitaciones para revisar y retiro como revisor.

## 5. Canales y funcionamiento

- Cada aviso se guarda en PostgreSQL y aparece en la campana y en `/notificaciones`.
- Si hay una suscripción Web Push activa, también se intenta enviar al navegador o teléfono.
- El texto del push se limita a 180 caracteres; el historial conserva el mensaje completo.
- Los avisos se crean después del `COMMIT`; un fallo del push no deshace la operación original.
- La campana muestra las ocho notificaciones más recientes y actualiza el contador periódicamente.
- La página de historial permite filtrar, marcar como leídas y eliminar. Una invitación pendiente no se puede eliminar.
- **Limpiar** elimina notificaciones leídas o con más de 30 días, excepto invitaciones de revisor pendientes.

## 6. Archivos de referencia

- `lib/notificaciones/tipos.ts`: tipos, clasificación visual y colores.
- `lib/notificaciones/notificaciones.ts`: creación, preferencias, lectura y eliminación.
- `lib/notificaciones/campanas-por-interes.ts`: campañas nuevas y especiales.
- `lib/notificaciones/socializacion.ts`: avances y campañas relacionadas.
- `lib/notificaciones/periodicas.ts`: recordatorio semanal y resumen mensual.
- `lib/notificaciones/push.ts`: envío Web Push.
- `components/layout/NotificationsBell.tsx`: campana y contador.
- `app/(dashboard)/notificaciones/`: historial y acciones.
- `app/api/notificaciones/`: API de notificaciones e invitaciones.

