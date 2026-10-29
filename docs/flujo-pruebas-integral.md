# Flujo de prueba integral de DataForGood

Guía manual para recorrer el sistema de principio a fin en un entorno de pruebas. Sigue el orden indicado: varias fases necesitan que las anteriores hayan creado usuarios, campañas y aportes.

> El proyecto no tiene una suite automatizada. Esta guía verifica los flujos desde la interfaz y, cuando se indica, desde la API. Si el código y esta guía difieren, prevalece el comportamiento actual del código.

## 1. Antes de empezar

### Seguridad de los datos

- Ejecuta las pruebas **solo en local o en un entorno QA aislado**. Nunca uses la base, el MinIO ni las cuentas de producción.
- Confirma que `DATABASE_URL` y todas las variables `MINIO_*` apuntan al entorno de prueba. Para `next dev`, la aplicación lee `.env.local`; Compose lee `.env`.
- Usa buzones de prueba que puedas consultar para recibir códigos. Configura las credenciales de Gmail y, si vas a probar Google, un cliente OAuth autorizado para el entorno local.
- No cambies ni borres campañas, aportes o archivos que no hayas creado para QA. Las bajas, los baneos, las decisiones de aportes y el borrado de archivos pueden tener efectos difíciles o imposibles de revertir.
- Pon un prefijo reconocible en todos los datos, por ejemplo `QA-20261015-`. Usa nombres y correos de prueba, nunca datos personales reales.
- Guarda los IDs y enlaces de los objetos de prueba en un registro fuera de producción. No publiques tokens, códigos, cookies ni credenciales.

### Arranque local de referencia

Desde la raíz del repositorio, con `.env.local` configurado para servicios de prueba:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres minio minio-init
npm run dev
```

En otra terminal se pueden consultar los logs de desarrollo. Espera a que el esquema se cree sin errores antes de empezar. La guía de arranque y las variables necesarias están en [docs/README.md](./README.md) y [.env.example](../.env.example).

Abre la URL local que indique Next. En desarrollo normalmente es `http://localhost:3000` (sin `/dataforgood`); en producción la app usa ese `basePath`, pero **no uses producción para esta prueba**.

### Personas de prueba

Prepara identidades distintas; no uses una sola cuenta para simular todos los roles.

| Alias de QA | Rol y uso |
| --- | --- |
| `QA-ROOT` | SuperUsuario; entra por `/root`, no es una cuenta de usuario común |
| `QA-SUP` | Usuario común al que QA-ROOT asignará el rol Supervisor |
| `QA-CREADOR` | Crea y administra las campañas de QA |
| `QA-REVISOR` | Acepta una invitación por campaña; también puede aportar, pero no revisar sus propios aportes |
| `QA-PARTICIPANTE` | Aporta con cuenta, recibe avisos y puede reportar campañas |
| `QA-ANONIMO` | Navegador/perfil separado sin sesión, para probar `/c/[token]` |
| `QA-DESCARTABLE` | Cuenta aparte para probar suspensión, baneo o baja voluntaria sin afectar las demás |

Usa una temática, estado y municipio consistentes en el perfil de las personas interesadas y en la campaña. Así se puede comprobar el aviso de campaña por intereses y ubicación. Para el flujo de revisar aportes, asegúrate de tener al menos un aporte de `QA-PARTICIPANTE` y otro de `QA-REVISOR`.

## 2. Recorrido, de inicio a fin

Marca cada casilla al comprobarla. Si una fase falla, registra la URL, el usuario, la hora, el resultado esperado y el observado; no continúes suponiendo que los datos quedaron bien.

### Fase A — Salud del entorno y páginas públicas

- [ ] La app arranca y el esquema de PostgreSQL se inicializa; no hay errores de conexión a PostgreSQL o MinIO.
- [ ] Abre `/`, `/explorar`, `/datos`, `/contacto`, `/privacidad` y `/sobre-nosotros` sin sesión.
- [ ] `/explorar` muestra campañas activas; abrir una campaña protegida conduce al flujo de inicio de sesión.
- [ ] `/datos` y el detalle de un conjunto publicado se muestran sin filtrar datos privados.
- [ ] En una ventana privada, visita una ruta que requiere sesión: debe pedir iniciar sesión. No debe revelar contenido privado.

### Fase B — Alta, verificación, perfil y sesiones

Repite el alta para `QA-CREADOR`, `QA-REVISOR`, `QA-PARTICIPANTE` y `QA-SUP`.

- [ ] Registra cada cuenta con contraseña válida y acepta términos y privacidad.
- [ ] Comprueba que la cuenta no puede iniciar sesión antes de verificar el correo.
- [ ] Verifica el código recibido; comprueba el reenvío si se necesita y que al completar se llega a bienvenida.
- [ ] Completa los pasos de bienvenida: estado, municipio, especialidad e intereses. Escribe un texto de intereses (las temáticas se ajustan solas al escribir), quitar/agregar una temática y guardar.
- [ ] Inicia sesión y cierra sesión. Comprueba que las sesiones de usuario y SuperUsuario son independientes.
- [ ] Comprueba el acceso con Google si OAuth está configurado para QA.
- [ ] En `/cuenta`, edita perfil, cambia entre iniciales/íconos y foto, guarda preferencias de comunicación y valida que el cambio se conserve al volver a abrir la página.
- [ ] Cambia o crea la contraseña desde el código enviado al correo; comprueba que la sesión actual se conserva.
- [ ] Prueba `/recuperar` con una cuenta de QA y confirma que el código restablece la contraseña, no inicia sesión automáticamente y la nueva contraseña permite entrar.
- [ ] Comprueba las notificaciones recibidas, el contador, marcar como leídas, filtrar y borrar una notificación que no sea una invitación pendiente.

**Pruebas negativas:** contraseña que incumple las reglas, correo ya registrado, código inválido/expirado y acceso a datos de otra cuenta. Usa identidades desechables si vas a probar el bloqueo por intentos fallidos; no bloquees las cuentas que necesitas para el flujo.

### Fase C — Preparar permisos de QA

1. Inicia sesión como `QA-ROOT` por `/root`.
2. En `/usuarios`, busca `QA-SUP`; abre sus roles y asígnale `supervisor`.
3. Verifica que `QA-SUP` puede entrar a `/supervision` sin volver a iniciar sesión y que un usuario común no puede entrar.
4. Comprueba que QA-ROOT tiene acceso a `/sistema`, `/usuarios`, `/aportes` y al modo `/supervisar`; una sesión de usuario normal no sustituye la sesión raíz.
5. En el panel, revisa dashboard, directorio, detalle de usuario, roles, supervisores, temáticas y sanciones (esta última es de consulta desde `/usuarios/sanciones`).

### Fase D — Crear, rechazar, corregir y aprobar campañas

Como `QA-CREADOR`, crea dos campañas con nombre `QA-20261015-...`:

- **Campaña principal:** temática que coincida con los intereses de `QA-PARTICIPANTE`; estado/municipio que coincida con su perfil; fechas que cubran la prueba; cuota suficiente para varios aportes; checklist con título y preguntas; activa los tipos de aporte que se probarán (foto, video, audio, documento y texto si la campaña permite texto).
- **Campaña de rechazo:** datos de QA similares, para ejercitar el rechazo sin alterar el flujo principal.

En la campaña principal:

- [ ] Guarda primero como borrador; vuelve a abrir y verifica que se guardaron los datos.
- [ ] Prueba la validación de campos requeridos y de fechas antes de enviar.
- [ ] Envía a revisión (`en_revision`).
- [ ] Como `QA-SUP`, localiza la campaña, tómala y apruébala. Con fecha de inicio actual/pasada debe pasar a `activa`; con fecha futura debe permanecer `aceptada` hasta su inicio.
- [ ] Como `QA-CREADOR`, comprueba la notificación y que la campaña activa aparece en `/campanas` y `/explorar`.

En la campaña de rechazo:

- [ ] `QA-SUP` la toma y la rechaza con motivo.
- [ ] `QA-CREADOR` recibe el aviso, edita la campaña rechazada y la reenvía.
- [ ] `QA-SUP` la toma y aprueba. Verifica los cambios de estado y el historial.

Comprueba además que otro supervisor no puede tomar una campaña ya reservada, y que quien creó una campaña no puede supervisarla. Si se prueba la supervisión con SuperUsuario, hazlo en una campaña aparte desde `/supervisar` y verifica que queda registrada como supervisada por la cuenta raíz.

### Fase E — Aportes con cuenta, archivos y revisión

1. Invita a `QA-REVISOR` a la campaña principal como creador.
2. Acepta la invitación desde sus notificaciones. Debe aparecer la campaña en `/revisiones`.
3. Como `QA-PARTICIPANTE`, aporta a la campaña activa. Repite con archivos de prueba pequeños para cada tipo habilitado: imagen JPG/PNG, video MP4/MOV/WebM, audio MP3/M4A/WAV/OGG, documento PDF/DOCX y texto TXT si se habilitó. Responde el checklist y acepta los avisos obligatorios de uso y contenido.
4. Envía suficientes aportes para ejercitar las cuotas; no uses archivos personales ni archivos maliciosos.

- [ ] El creador ve los aportes en su bandeja; el participante ve los suyos en `/mis-aportes`.
- [ ] Imagen, audio y video se muestran/reproducen cuando corresponde; documentos se descargan. El aporte de solo texto no intenta cargar un archivo.
- [ ] Al guardar una imagen y un documento, confirma que los archivos se sirven limpios de metadatos; la foto no debe revelar EXIF/GPS.
- [ ] Prueba un tipo no habilitado y una extensión/contenido inválido: el servidor debe rechazarlo, no solo ocultar el control en la pantalla.
- [ ] Confirma que el creador no puede aportar a su propia campaña, que un participante baneado no puede aportar y que la cuota no se puede exceder.
- [ ] `QA-REVISOR` ve los aportes pendientes de la campaña, pero no los aportes que envió él mismo.
- [ ] Como revisor, acepta un aporte y rechaza otro con motivo. Como creador, revisa un tercero. El rechazo debe mostrar su motivo al participante.
- [ ] Una decisión final no se puede cambiar. Un aporte aceptado no se puede borrar; el participante sí puede borrar un aporte rechazado según las reglas actuales.
- [ ] Revisa que el estado y los contadores de pendientes/aceptados/rechazados se actualicen.
- [ ] Comprueba que una persona sin permiso no puede ver el archivo del aporte.

### Fase F — Enlace público y aporte anónimo

Como creador, abre Compartir en la campaña activa:

- [ ] Consulta el enlace y el QR; descárgalo en PNG y SVG.
- [ ] Copia el enlace en un navegador/perfil separado sin sesión (`QA-ANONIMO`).
- [ ] Envía un aporte anónimo de prueba. Debe mostrarse como “Anónimo” y no exponer correo, nombre ni archivo original.
- [ ] Comprueba la espera entre envíos desde el mismo dispositivo: un segundo envío antes de 60 segundos debe recibir la espera indicada; vuelve a intentarlo cuando termine.
- [ ] Como creador, ve el aporte anónimo y reproduce o descarga el archivo permitido.
- [ ] Prueba apagar “Permitir aportes sin cuenta” y verifica que el formulario anónimo deja de estar disponible; vuelve a habilitarlo para completar las pruebas.
- [ ] Regenera el enlace; el enlace viejo deja de aceptar aportes y el nuevo funciona. Comprueba que el QR apunta al enlace vigente.
- [ ] Bloquea el dispositivo anónimo en la campaña y confirma que no puede aportar; desbloquéalo al terminar.
- [ ] Si marcas un aporte anónimo inapropiado, prueba el flujo disponible de creador/revisor. No borres el archivo hasta confirmar que es un fixture prescindible: el borrado del objeto en MinIO no se puede deshacer.

La expiración natural del enlace es de 24 horas. Si no se va a mantener QA durante ese tiempo, registra la expiración como pendiente en vez de alterar la base manualmente.

### Fase G — Pausar, reanudar, especial y favoritos

Sobre la campaña principal, mientras no esté finalizada:

- [ ] Como creador, pausa la campaña. Un participante ya no puede enviar aportes.
- [ ] Reanúdala y confirma que vuelve a aceptar aportes y que su enlace se genera o sigue vigente según corresponda.
- [ ] Márcala como favorita desde otra cuenta y quita el favorito; revisa `/mis-aportes`.
- [ ] Configura una campaña especial en `/mis-campanas/[id]/especial`, con fechas válidas dentro de la vigencia, multiplicador ×1–×3 y nombre de insignia opcional.
- [ ] Confirma el resumen de incentivos y el aviso correspondiente a quienes cumplen los criterios de interés/ubicación o participan en la campaña.
- [ ] Prueba una fecha fuera de la vigencia y multiplicadores fuera de rango; deben ser rechazados.
- [ ] Quita los incentivos y comprueba que desaparecen.

> **Límite funcional conocido:** se guardan y muestran los incentivos especiales y se calcula el multiplicador, pero otorgar XP al aprobar aportes aún está pendiente. No marques como fallo que el XP no aumente por esta función.

### Fase H — Reportes, supervisión y sanciones

- [ ] Desde una cuenta que no sea creadora, reporta una campaña con motivo y/o descripción. La campaña no debe cambiar de estado.
- [ ] Desde `QA-REVISOR`, usa “Reportar al creador” en un aporte. El creador recibe aviso; el reporte no decide ni banea automáticamente.
- [ ] Como `QA-SUP`, abre `/supervision/reportes`, consulta el caso y descártalo con una nota o sigue al flujo de sanción.
- [ ] Como `QA-SUP`, abre `/supervision/sanciones`; revisa el detalle de una persona QA y aplica una sanción solo a `QA-DESCARTABLE`.
- [ ] Verifica que no se puede moderar a uno mismo y que al supervisor no se le muestra información que no debe ver.
- [ ] En `/supervisar/reportes` y `/supervisar/sanciones`, confirma que SuperUsuario puede realizar la misma moderación en modo supervisor; `/usuarios/sanciones` solo consulta.
- [ ] Si aplicaste suspensión o baneo, verifica que la cuenta queda bloqueada y luego restaura el acceso desde el área correspondiente. Confirma que el acceso se recupera.
- [ ] Si pruebas la escala completa de avisos (aviso, suspensión de 2 días, suspensión de 7 días y baneo/lista negra), usa cuentas desechables distintas o un entorno reiniciable. No escales las cuentas que necesitas para otras fases.

### Fase I — Notificaciones y push

- [ ] Comprueba avisos por invitación, campaña activada, aporte recibido, decisión, reporte y sanción, según el flujo ejecutado.
- [ ] En Preferencias de `/cuenta`, desactiva “Campañas nuevas”; una nueva campaña coincidente no debe generar ese aviso. Reactívalo para otras pruebas.
- [ ] Cambia también las preferencias de avisos de aportes, recordatorio semanal y resumen mensual; comprueba que cada selección se conserva al recargar.
- [ ] Con avisos de aportes desactivados, genera una acción de QA que normalmente avisaría de un aporte y confirma que no llega ese aviso; vuelve a activarlos.
- [ ] Si el entorno está en HTTPS y tiene claves VAPID, activa push en `/notificaciones`, genera una notificación de QA y confirma recepción; después desactiva la suscripción.
- [ ] Comprueba el recordatorio semanal el lunes a partir de las 9:00 de Tepic con una campaña activa relevante y cuota pendiente, y el resumen mensual entre el día 1 y el 3 a partir de las 9:00 de Tepic con actividad en el mes anterior.

Los avisos periódicos se evalúan al arrancar y después cada hora; no hay botón para forzarlos desde la interfaz. Si las fechas/horas no coinciden con la ventana indicada, documenta estas verificaciones como pendientes, no como fallidas.

### Fase J — Finalizar y comprobar datos abiertos

Solo cuando ya se hayan probado aportes, archivos y revisiones:

- [ ] Como creador, finaliza la campaña principal; alternativamente, prueba la finalización automática dejando vencer una campaña de QA.
- [ ] Comprueba que una campaña finalizada ya no recibe aportes y aparece en `/datos`.
- [ ] Abre su detalle público y descarga el ZIP.
- [ ] Revisa que el ZIP contiene `aportes.csv` y los archivos aceptados, no los rechazados o pendientes.
- [ ] Verifica que los nombres de participantes se anonimizan como “Participante N” o “Anónimo” y que no se exportan correos ni otros datos personales.
- [ ] Confirma que el contador de descargas aumenta.
- [ ] Opcional: prueba reactivar la campaña con fecha de fin nueva si se necesita verificar esa transición; no lo hagas si ya se considera cerrado el fixture.

### Fase K — Paneles y registro global del SuperUsuario

Como `QA-ROOT`, completa al final:

- [ ] Revisa los dashboards de sistema, campañas, usuarios y aportes, incluyendo filtros y rangos de fechas.
- [ ] Busca la campaña QA y contrasta conteos, participantes y etapas con los resultados de las fases anteriores.
- [ ] En `/aportes`, verifica la agrupación por participante y que el panel no expone contenido de archivos ni correos.
- [ ] Revisa la actividad de supervisores y la reversión solo de una acción QA que el sistema permita revertir.
- [ ] Abre el catálogo de temáticas, oculta una temática de usuario QA y vuelve a mostrarla.
- [ ] Si vas a probar `/api/docs` en modo producción de un entorno QA aislado, genera un token raíz temporal y prueba únicamente endpoints de consulta con datos QA; no lo guardes ni compartas.

### Fase L — Baja voluntaria y limpieza

Haz esta fase **al final**, exclusivamente en `QA-DESCARTABLE` y después de revisar qué campañas posee:

- [ ] Solicita la baja con el destino de aportes elegido y las confirmaciones requeridas. Comprueba el cierre de sesión y `/baja-solicitada`.
- [ ] Confirma que la baja entra en el periodo de gracia de 30 días. Inicia sesión antes de que venza para comprobar la cancelación.
- [ ] Ten presente que pedir la baja puede finalizar o borrar campañas propias inmediatamente; cancelar la baja no revierte esos cambios. No uses esta prueba con `QA-CREADOR` si su campaña principal todavía es necesaria.

Al terminar, cierra las sesiones de prueba y elimina los fixtures de QA solo mediante el procedimiento autorizado para el entorno aislado. Revisa también los objetos de MinIO creados para QA. No ejecutes un borrado amplio de la base o del bucket compartidos.

## 3. Comprobaciones transversales

Durante las fases anteriores, incluye estos controles:

- **Permisos:** prueba cada ruta con el rol correcto, con una cuenta sin rol y, cuando aplique, con el creador/revisor equivocado. La API debe proteger la operación aunque se intente llamar sin usar el botón de la interfaz.
- **Errores de entrada:** IDs inválidos, campos requeridos vacíos, transiciones no permitidas, cuota agotada y acciones duplicadas deben producir un error visible; no deben dar apariencia de éxito.
- **Responsive:** revisa las pantallas principales a 360, 768 y 1280 px: públicas, cuenta, campañas, aportes, revisión, supervisión y panel root. Registra los hallazgos; no cambies estilos móviles como parte de la ejecución de pruebas sin coordinarlo.
- **Accesibilidad básica:** navega formularios con teclado, verifica etiquetas y mensajes de error, foco en diálogos y que estados no dependan solo del color.
- **Archivos:** usa fixtures de prueba pequeños. Para comprobar límites de tamaño, genera archivos desechables en local; no subas archivos grandes a producción ni a un MinIO compartido.
- **Datos:** comprueba que al borrar un aporte permitido se actualizan contadores y archivo, que una decisión final no cambia, y que el contenido de aportes privados no se filtra a vistas públicas o al panel de solo lectura.

## 4. Qué significa terminar

El recorrido se considera completo cuando:

1. todas las fases aplicables están marcadas;
2. no quedan errores bloqueantes sin registrar;
3. las comprobaciones con condición especial (Google/OAuth, push/VAPID, ventanas horarias y expiración del enlace) están marcadas como **probadas** o **pendientes con motivo**;
4. los fixtures se identifican como QA y no queda una cuenta desechable sancionada o una baja pendiente por accidente;
5. la campaña finalizada y el ZIP se verificaron sin datos personales.

Para el mapa exhaustivo de pantallas, endpoints y roles consulta [rutas.md](./rutas.md), [permisos.md](./permisos.md), [datos.md](./datos.md) y la sección de reglas y puntos abiertos en la skill del proyecto.
