# Almacenamiento de archivos (MinIO)

## Contenido
1. Cómo funciona hoy
2. Subir
3. Mostrar y descargar
4. Configuración
5. Riesgos y pendientes

## 1. Cómo funciona hoy

`lib/minio.ts` crea, en el primer uso, un `Client` del SDK `minio` con las variables `MINIO_*` (sin valores por defecto para las credenciales) y exporta:

- **`guardarArchivo(buffer, { subdir, extension, mimeType })`:** crea el bucket la primera vez (`MINIO_BUCKET`, por defecto `aportes`), guarda el objeto como `<subdir>/<uuid><ext>` con `putObject` y devuelve `{ relativePath, mimeType, sizeBytes }`. Recibe el archivo **ya validado y limpio**: la extensión y el tipo los decide el servidor por el contenido, nunca por el nombre ni por `file.type`.
- **`borrarArchivo(key)`:** borra el objeto (el creador quita el archivo de un aporte anónimo ilegal o dañino).
- **`readUploadedFile(key)`:** descarga el objeto completo a un `Buffer`.

**El archivo pasa por el servidor de Next.** El navegador manda `multipart/form-data` al route handler y el handler lo sube a MinIO. No hay URLs firmadas ni subida directa del navegador a MinIO.

## 2. Subir

`POST /api/aportes` (`app/api/aportes/route.ts`):

1. `getSessionUser()`, campaña activa, sin baneo, cuota disponible, sin ser el creador.
2. **Tamaño del cuerpo:** `cuerpoDemasiadoGrande()` (`lib/aportes/comun.ts`) responde **413** si `Content-Length` pasa del archivo más grande permitido más 1 MB, antes de leer el formulario. `next.config.ts` sube `experimental.proxyClientMaxBodySize` a 52 MB: con `proxy.ts`, Next corta en silencio todo cuerpo que pase de ese tope (por defecto 10 MB). **Si subes el tope de un tipo, súbelo también ahí y en el proxy del servidor.**
3. **Validación rápida:** `errorDeArchivo(file, tipos)` (`lib/aportes/archivo.ts`) con los tipos de la campaña (`tiposAceptados(campanas.data_types)`): extensión y tamaño por tipo (`FORMATOS`). Sin archivo, solo si la campaña acepta texto. La interfaz usa la misma función para avisar pronto (`components/ui/SelectorDeArchivo`).
4. **Validación real y limpieza** (`limpiarArchivo()` en `lib/aportes/limpiar-archivo.ts`, desde `guardarArchivoDelAporte()` de `lib/aportes/comun.ts`): los primeros bytes deciden el formato y deben coincidir con la extensión (un PDF llamado `.mp3` se rechaza).
   - **Foto** (`limpiarImagen()` de `lib/aportes/imagen.ts`): máximo 50 megapíxeles (se lee solo el encabezado antes de decodificarla) y se **vuelve a codificar con `sharp`**, lo que quita todos los metadatos (EXIF con GPS, modelo del teléfono, fecha). Se aplica antes la orientación del EXIF para que no quede girada.
   - **PDF** (`pdf-lib`): se vacía el diccionario Info y se quita el XMP; se reescribe entero (sin versiones anteriores). Uno con contraseña se rechaza.
   - **Word .docx** (`jszip`): se vacían `docProps/{core,app,custom}.xml` y los atributos `w:author`/`w:initials`/`w15:userId`/`w15:providerId` de `word/*.xml` (se vacía el valor, no se quita: `w:author` es obligatorio). Con macros (`macroEnabled` o `vbaProject.bin`) se rechaza.
   - **Texto .txt:** sin bytes nulos; si no es UTF-8 válido se lee como Windows-1252; se guarda en UTF-8 sin BOM.
   - **Video y audio:** solo la firma (MP4/MOV por `ftyp`, WEBM, MP3, WAV, OGG; `.m4a` es el mismo contenedor que `.mp4` y lo distingue la extensión). **Se guardan con sus metadatos.**
   Un archivo que no pasa se rechaza con 400.
5. `guardarArchivo()` con `subdir = campanas/<campaignId>` (las fotos de perfil, desde el 2026-10-13, van en `perfiles/<usuarioId>/`: `lib/usuarios/avatar.ts`), y después `insertarAporteConCuota()` (`lib/aportes/comun.ts`): cuenta e inserta dentro de una transacción con `pg_advisory_xact_lock` por campaña y persona, para que dos envíos simultáneos no pasen la cuota. Si la cuota ya se llenó, borra de MinIO el archivo recién subido.

Un aporte **sin archivo** (campaña con texto) se guarda con `file_type = 'texto'`, `file_path = ''` y sin tipo MIME ni tamaño; `insertarAporteConCuota()` recibe `archivoSubido: null`.

El aporte anónimo (`POST /api/c/[token]/aportes`, `lib/campanas/aportes-anonimos.ts`) sigue los mismos pasos 2 a 5; los tipos de la campaña llegan en `CampanaDelEnlace.tiposDeArchivo`.

**Memoria:** un video de 50 MB queda completo en memoria (`request.formData()` y la limpieza). Si se necesitan archivos más grandes, conviene pasar a subida directa con POST firmado: coméntalo antes de cambiar el flujo.

## 3. Mostrar y descargar

- **Archivo de un aporte:** `GET /api/aportes/[id]/archivo`. Verifica el permiso (ver `roles-y-sesiones.md` § 4), envía el objeto de MinIO **como flujo** (`abrirArchivo()`, sin cargarlo entero) con el `Content-Type` guardado si está en `TIPOS_SERVIBLES` (cualquier otro, como binario), `X-Content-Type-Options: nosniff`, una CSP `sandbox` y `Cache-Control: private`. Fotos, video, audio y `.txt` van `inline`; **PDF y Word como descarga** (`attachment; filename="aporte-<id>.<ext>"`: la CSP `sandbox` no deja abrir el visor de PDF). Acepta **`Range`** de un solo tramo (`206`, `getPartialObject`; `416` si no existe): sin eso Safari no reproduce video y no se puede adelantar. Responde `404` si el aporte es de solo texto y `410` si el creador borró el archivo (`aportes.archivo_borrado_en`). En las pantallas se muestra con `components/ui/ArchivoDelAporte`.
- **Borrar el aporte** (`DELETE /api/aportes/[id]`, quien aportó) borra también su archivo.
- **No se guarda el nombre original** del archivo (`file_original_name` va NULL desde el 2026-10-01): el del teléfono puede traer nombres o fechas.
- **Borrar el archivo:** `DELETE /api/aportes/[id]/archivo`, solo el creador y solo en aportes anónimos. La fila se conserva.
- **Datos abiertos:** `GET /api/datos/[id]/descarga` solo para campañas `finalizada`. Arma un ZIP con `archiver` con los archivos de los aportes aceptados, renombrados `aporte-001.ext`... (sin nombre ni correo del participante), e incrementa `downloads_count`. Omite los archivos borrados. Las fotos subidas **antes del 2026-10-01** no pasaron por la limpieza: `scripts/limpiar-metadatos.mjs` las re-codifica una vez (lista por defecto; `--aplicar` escribe). En local ya se corrió; en el servidor falta. El comando está en la cabecera del script.
- **El bucket no se expone.** Nunca construyas URLs directas a MinIO para el navegador.

## 4. Configuración

- **Servicio `minio`:** sin puertos publicados; la app lo alcanza por la red interna (`MINIO_ENDPOINT=minio`). Los datos van en el volumen `minio_data`, o en la carpeta del host que indique `MINIO_DATA`.
- **Servicio `minio-init`:** usa la misma imagen, que trae `mc`, y entra con el root (`MINIO_ROOT_USER/PASSWORD`). Crea el bucket, lo deja privado y crea la política `dataforgood-app`: `GetBucketLocation`/`ListBucket` sobre el bucket, `GetObject`/`PutObject`/`DeleteObject` sobre sus objetos, y **niega** crear o editar service accounts (vector del CVE-2025-62506). Después crea el usuario `MINIO_ACCESS_KEY` con esa política. Es idempotente.
- **La app solo conoce el usuario limitado.** No puede crear buckets ni usar la API de administración (comprobado). Si agregas una operación nueva de S3, amplía la política en `docker-compose.yml`.
- **Con `next dev` fuera de Docker:** `MINIO_ENDPOINT=localhost` y `docker-compose.local.yml` para publicar el 9000 en `127.0.0.1`.

## 5. Riesgos y pendientes

- **La imagen ya no se puede descargar.** MinIO dejó de publicar imágenes: `quay.io/minio/minio` responde 401 y `minio/minio` "no existe". Solo funciona la que ya está en caché (`RELEASE.2025-09-07T16-13-09Z`), que además no recibe parches. Un servidor nuevo no puede levantar el stack. Hay que decidir el reemplazo (compilar desde el código fuente o usar otro almacenamiento compatible con S3).
- **Sin respaldos** del volumen de datos.
