# Cómo funcionan las notificaciones

DataForGood guarda las notificaciones dentro de la aplicación y, si la persona activa los avisos en un dispositivo, también intenta enviarlas como notificaciones push del navegador o teléfono. Son dos canales distintos: el historial de la aplicación no depende de que el push esté configurado o disponible.

## Recorrido de una notificación

1. Una acción o evento del servidor detecta algo que debe comunicarse: por ejemplo, una decisión sobre un aporte, una invitación a revisar o una sanción.
2. El código llama a `notificar()` de [`lib/notificaciones/notificaciones.ts`](./lib/notificaciones/notificaciones.ts) con el destinatario, el tipo, el título, el mensaje y, si corresponde, la campaña y el enlace de destino.
3. `notificar()` inserta la notificación en PostgreSQL. El registro se conserva aunque la persona no tenga push activado. Si es `aporte_aceptado` o `aporte_rechazado` y la persona apagó "Aportes" en sus Preferencias, no se crea.
4. Después de guardar, se inicia `enviarPush()` sin esperar a que termine. Si esa persona tiene suscripciones push activas, se intenta enviar el aviso a cada dispositivo.
5. La campana y la página `/notificaciones` consultan la base de datos y reflejan el estado leído/no leído.

Las notificaciones deben crearse **después de confirmar (`COMMIT`) la operación principal** cuando esta use una transacción. Avisar es una consecuencia secundaria: `notificar()` captura y registra sus propios errores para que un fallo del aviso no revierta ni haga fallar la acción que ya se completó.

## Qué se guarda

El esquema de [`lib/db-schema.ts`](./lib/db-schema.ts) define dos tablas:

### `notificaciones`

- `usuario_id`: destinatario; al eliminar la cuenta, sus notificaciones se eliminan en cascada.
- `tipo`: identificador del evento, acotado en TypeScript por `TipoDeNotificacion`.
- `titulo` y `mensaje`: texto que aparece en la bandeja. El título se limita a 180 caracteres.
- `campana_id`: campaña relacionada, si existe; si se elimina la campaña, sus notificaciones se eliminan en cascada.
- `metadata`: JSON adicional. El enlace interno se guarda como `metadata.enlace`; otros eventos pueden guardar datos como el motivo, el identificador del aporte o el rol.
- `leida_en`: fecha en que se marcó como leída; `NULL` significa que sigue sin leer.
- `created_at`: fecha de creación.

Hay un índice por usuario y fecha descendente, para recuperar primero los avisos más recientes.

### `push_suscripciones`

Guarda una suscripción por navegador o teléfono: usuario, endpoint del servicio de push, claves de Web Push, agente del navegador y fecha del último envío. El endpoint es único. Un usuario puede tener hasta diez suscripciones; al rebasar ese límite se descartan las más antiguas.

## Tipos de notificación

Los tipos están declarados en [`lib/notificaciones/tipos.ts`](./lib/notificaciones/tipos.ts). El servidor es quien decide cuándo y a quién enviar cada uno.

| Tipo | Cuándo se usa y quién lo recibe |
| --- | --- |
| `aporte_aceptado` | La persona participante recibe la decisión final de que aceptaron su aporte. No se envía a aportes anónimos. |
| `aporte_rechazado` | La persona participante recibe el rechazo y su motivo. No se envía a aportes anónimos. |
| `aporte_reportado` | Ya no se crea (2026-10-15): el reporte del revisor va solo a los supervisores como `reporte_nuevo`. Puede aparecer en avisos viejos. |
| `invitacion_revisor` | La persona invitada recibe la invitación del creador a revisar aportes de una campaña. |
| `revisor_acepto` | El creador recibe el aviso de que la persona invitada aceptó revisar su campaña. |
| `campana_aceptada` | El creador recibe la decisión de supervisión que acepta su campaña. |
| `campana_rechazada` | El creador recibe el rechazo de supervisión y su motivo. |
| `campana_reportada` | Ya no se crea (2026-10-15): cuando un supervisor reporta una campaña, el creador no recibe aviso. Puede aparecer en avisos viejos. |
| `campana_en_revision` | El creador recibe el aviso de que su campaña vuelve a revisión después de que el SuperUsuario revierte una decisión. |
| `campana_iniciada` | El creador recibe el aviso de que llegó la fecha de inicio y su campaña empezó a recibir aportes. |
| `campana_en_espera` | El creador recibe el aviso de que su campaña programada llegó a su fecha de inicio pero no empezó porque ya tiene 5 campañas activas; empieza sola al liberarse un lugar (2026-10-27). Se borra cuando empieza. |
| `campana_pausada` | El creador recibe el aviso de que la supervisión pausó su campaña, con el motivo (2026-10-15). |
| `campana_reanudada` | El creador recibe el aviso de que la supervisión reanudó su campaña (2026-10-15). |
| `campana_finalizada` | El creador recibe el aviso de que llegó la fecha de fin y su campaña dejó de recibir aportes, o de que la supervisión la finalizó, con el motivo (2026-10-15). |
| `campana_baneo` | La persona participante recibe el aviso de que ya no puede aportar en una campaña, con el motivo. |
| `campana_desbaneo` | La persona participante recibe el aviso de que puede volver a participar en una campaña. |
| `rol_asignado` | La cuenta recibe el aviso de que se le asignó un rol administrado por el SuperUsuario, como supervisor. |
| `rol_revocado` | La cuenta recibe el aviso de que se le retiró ese rol. |
| `supervision_revertida` | El supervisor recibe el aviso de que el SuperUsuario revirtió una de sus decisiones. |
| `campana_por_revisar` | Cada supervisor (menos el creador) recibe el aviso de que una campaña entró a revisión: la envió su creador o el SuperUsuario revirtió una decisión. Lleva a la campaña en Supervisión para tomarla. |
| `reporte_nuevo` | Cada supervisor recibe el aviso de un reporte nuevo de campaña o de aporte (qué campaña y el motivo), y lleva a Reportes de supervisión. Incluye el "Reportar a supervisión" del revisor. No le llega a quien reportó, a la persona reportada ni, si reporta un revisor, al creador de la campaña. |
| `sancion_aplicada` | La cuenta recibe el aviso de una sanción aplicada por la administración, con la consecuencia correspondiente. |
| `sancion_restaurada` | La cuenta recibe el aviso de que la administración levantó una sanción que limitaba su acceso. |
| `campana_nueva` | Al activarse una campaña, quien tiene su temática en sus intereses y vive en su estado (y municipio, si la campaña tiene uno). Máximo 3 al día por persona. |
| `campana_especial` | Al publicarse los incentivos de una campaña especial activa (o al reanudarla), quien participa en ella (aportó o la guardó) y quien cumple lo de `campana_nueva`. |
| `recordatorio_semanal` | Los lunes desde las 9:00, quien encendió "Recordatorios" y tiene cuota pendiente en campañas donde aportó o que guardó y cierran pronto. |
| `resumen_mensual` | El día 1 desde las 9:00, quien tiene "Newsletter" encendido: sus aportes aceptados, campañas de sus temáticas en su zona y datos abiertos publicados del mes anterior. |

Los cuatro últimos (2026-10-14) los envían [`lib/notificaciones/campanas-por-interes.ts`](./lib/notificaciones/campanas-por-interes.ts) y [`lib/notificaciones/periodicas.ts`](./lib/notificaciones/periodicas.ts) en segundo plano, de 10 en 10, una vez por persona y campaña o periodo, y nunca a cuentas sin verificar, bloqueadas, con baja pedida ni baneadas de la campaña. Los periódicos no tienen cron: los dispara la tarea de cada hora de [`instrumentation-node.ts`](./instrumentation-node.ts).

Los avisos de invitación a revisar tienen además un estado de invitación en `campana_revisores`. La invitación solo se considera pendiente mientras esa relación siga en estado `invitado`.

## Preferencias de la persona

En `/cuenta` → Preferencias, "Comunicación y notificaciones" tiene cuatro interruptores que se guardan al tocarlos (`PATCH /api/usuarios/[id]/preferencias`, columnas de `usuarios`, lista en [`lib/usuarios/preferencias-opciones.ts`](./lib/usuarios/preferencias-opciones.ts)):

| Interruptor | Columna | Por defecto | Qué controla |
| --- | --- | --- | --- |
| Campañas nuevas | `avisos_campanas_nuevas` | Encendido | `campana_nueva` y `campana_especial` por interés (quien participa recibe la especial igual) |
| Aportes | `avisos_aportes` | Encendido | `aporte_aceptado` y `aporte_rechazado` |
| Recordatorios | `recordatorio_semanal` | Apagado | `recordatorio_semanal` |
| Newsletter | `resumen_mensual` | Encendido | `resumen_mensual` |

Todo llega como notificación de la aplicación (y push si está activado); nada se manda por correo. Debajo está "Privacidad", que todavía no tiene función.

## Campana y página de historial

La campana aparece en la barra superior de usuario mediante [`components/layout/NotificationsBell.tsx`](./components/layout/NotificationsBell.tsx):

- Al abrirse solicita las ocho notificaciones más recientes y muestra el total de no leídas.
- Vuelve a consultar cada minuto mientras la pestaña está visible y al regresar a ella.
- Al abrir una notificación desde la campana, intenta marcarla como leída y navega a su enlace si tiene uno.
- Puede marcar todas como leídas y aceptar invitaciones de revisor.
- Si llega un push mientras la aplicación está abierta, el service worker avisa a la página para actualizar la campana sin esperar al siguiente minuto.

La página [`/notificaciones`](./app/(dashboard)/notificaciones/page.tsx) presenta el historial paginado, con 20 elementos por página, filtros de todas o solo no leídas, enlaces, fecha, y acciones para marcar o eliminar. Abrir un elemento desde esta lista lo marca como leído antes de navegar. Una invitación pendiente no se puede eliminar: debe aceptarse o dejar de estar pendiente.

Las fechas se muestran en hora de Tepic (`America/Mazatlan`). El punto de color se determina según el tipo de notificación.

## API y permisos

Los endpoints de notificaciones están bajo `app/api/notificaciones/` y todos requieren sesión de usuario:

| Endpoint | Función |
| --- | --- |
| `GET /api/notificaciones?pagina=&porPagina=&filtro=` | Devuelve una página y los conteos. `filtro` acepta `todas` o `no-leidas`; `porPagina` admite de 1 a 50. |
| `PATCH /api/notificaciones` con `{ "leidas": "todas" }` | Marca como leídas todas las notificaciones de la sesión actual. |
| `PATCH /api/notificaciones/[id]` con `{ "leida": true/false }` | Cambia el estado de lectura de una notificación propia. |
| `DELETE /api/notificaciones/[id]` | Elimina una notificación propia, excepto una invitación de revisor que siga pendiente. |
| `POST /api/notificaciones/[id]/aceptar` | Acepta una invitación propia pendiente, actualiza la relación de revisor y avisa al creador. |

Las consultas y mutaciones comprueban el `usuario_id` de la sesión. Conocer el identificador de otra persona no permite leer, modificar ni borrar sus notificaciones.

## Avisos push en navegador o teléfono

El push es Web Push y lo implementan [`lib/notificaciones/push.ts`](./lib/notificaciones/push.ts), [`lib/notificaciones/registro-push.ts`](./lib/notificaciones/registro-push.ts), [`/api/push`](./app/api/push/route.ts) y [`public/sw.js`](./public/sw.js).

### Activación

En la página `/notificaciones`, el recuadro “Avisos en este dispositivo”:

1. Comprueba si el navegador y el contexto seguro (HTTPS) soportan push.
2. Obtiene la llave pública VAPID desde `GET /api/push`.
3. Pide permiso al navegador y registra `public/sw.js`.
4. Crea o reutiliza la suscripción local y la envía con `POST /api/push`.
5. El servidor valida el endpoint y sus claves antes de guardar la suscripción asociada a la sesión.

Para enviar push, el servidor necesita `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`. Si faltan, la funcionalidad push queda apagada; la campana y el historial siguen funcionando. En iPhone/iPad se requiere iOS 16.4 o posterior y agregar la aplicación a la pantalla de inicio para que el navegador permita estos avisos.

Al cargar la aplicación, si ese navegador ya tenía permiso y una suscripción, se resincroniza con la sesión actual. Como el endpoint es único, activar el push con otra cuenta en el mismo navegador reasigna esa suscripción a la última cuenta que inició sesión allí. Cerrar sesión o desactivar los avisos elimina la suscripción correspondiente.

### Envío y apertura

`enviarPush()` manda el título, un mensaje limitado a 180 caracteres y la ruta interna (anteponiendo el `basePath` de la aplicación). El servicio de push conserva el mensaje por un máximo de un día (`TTL` de 86 400 segundos). Si el proveedor responde `404` o `410`, esa suscripción se elimina; otros errores se registran en el log y no impiden guardar ni mostrar la notificación dentro de la aplicación.

El service worker muestra el aviso y, al tocarlo, abre su ruta. Si ya hay una ventana de DataForGood abierta, la reutiliza; si no, abre una nueva. El clic del aviso del sistema no cambia por sí solo el estado leído de la fila: la notificación sigue en el historial hasta que se marque como leída o se abra desde la campana o la página.

## Archivos principales

- [`lib/notificaciones/notificaciones.ts`](./lib/notificaciones/notificaciones.ts): creación, consulta, lectura, borrado y conteos.
- [`lib/notificaciones/tipos.ts`](./lib/notificaciones/tipos.ts): tipos compartidos, tonos y formato de fechas.
- [`lib/notificaciones/campanas-por-interes.ts`](./lib/notificaciones/campanas-por-interes.ts): avisos de campañas nuevas y especiales por temática y zona.
- [`lib/notificaciones/periodicas.ts`](./lib/notificaciones/periodicas.ts): recordatorio semanal y resumen mensual.
- [`lib/notificaciones/push.ts`](./lib/notificaciones/push.ts): suscripciones y envío Web Push del servidor.
- [`lib/notificaciones/registro-push.ts`](./lib/notificaciones/registro-push.ts): activación, desactivación y sincronización en el navegador.
- [`components/layout/NotificationsBell.tsx`](./components/layout/NotificationsBell.tsx): campana, contador y actualización periódica.
- [`app/(dashboard)/notificaciones/`](./app/(dashboard)/notificaciones/): página de historial y acciones de usuario.
- [`app/api/notificaciones/`](./app/api/notificaciones/): operaciones de bandeja e invitaciones.
- [`app/api/push/route.ts`](./app/api/push/route.ts): API autenticada de suscripciones.
- [`public/sw.js`](./public/sw.js): presentación y apertura de avisos push.
