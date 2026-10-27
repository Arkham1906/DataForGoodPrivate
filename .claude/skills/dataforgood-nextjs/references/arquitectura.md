# Arquitectura

## Contenido
1. Un solo proceso: Next.js
2. Flujo de una petición
3. Route handlers (zona de usuario)
4. Server actions (panel del SuperUsuario)
5. Patrones de página
6. Docker y variables de entorno
7. Problemas conocidos

## 1. Un solo proceso: Next.js

No hay servidor personalizado. `next start` (en Docker, el `server.js` de `.next/standalone`) atiende páginas, route handlers y server actions. Todo el código de servidor vive en `lib/` y se importa desde `app/`.

```
Arranque: instrumentation.ts ──► ensureCoreSchema() (crea o actualiza las tablas, una vez)

Navegador ──► proxy.ts (¿hay cookie?  /api: ¿Origin propio?) ──► página / route handler / server action
                                                             │
                                                             ├─ lib/session.ts o lib/rootSession.ts  (¿quién es? ¿está sancionado?)
                                                             ├─ lib/db.ts pool.query(sql, params)    (PostgreSQL)
                                                             ├─ lib/minio.ts                         (archivos)
                                                             └─ lib/auditoria.ts                     (bitácora de acciones sensibles)
```

## 2. Flujo de una petición

1. **`proxy.ts`** (antes `middleware.ts`):
   - **Páginas:** solo mira si existe la cookie. Cubre `/inicio`, `/campanas`, `/mis-aportes`, `/mis-campanas`, `/cuenta`, `/notificaciones` y `/supervision` (cookie `session_token`; si falta, `/entrar?next=<ruta pedida>`, y tras iniciar sesión, con correo o con Google, se regresa ahí; el destino también pasa por `/registro` → `/verificar` → `/bienvenida` con `conDestino()`, y se conserva si el login con Google falla; `destinoSeguro()` de `lib/redireccion.ts` solo acepta rutas internas) y `/sistema` (cookie `root_session_token`; si falta, `/root`). **No valida el token ni el rol**, y no cubre `/revisiones`, `/usuarios` ni `/supervisar`: esas rutas dependen de sus layouts y páginas.
   - **`/api`:** rechaza las mutaciones con `Origin` ajeno (CSRF, ver `roles-y-sesiones.md`).
2. **Layout del grupo:** `(panel)/layout.tsx` llama a `hasRootSession()`; `(dashboard)/supervision/layout.tsx` exige rol `supervisor`.
3. **Página o handler:** vuelve a verificar. Los layouts no bastan porque no se vuelven a ejecutar en cada navegación cliente y no protegen los route handlers ni las server actions.

## 3. Route handlers (zona de usuario)

`app/api/**/route.ts`, sin versión en la URL. Forma habitual:

```ts
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    // validar entrada → 400; comprobar permiso sobre la campaña → 403/404
    // pool.query(...) parametrizado; transacción si hay varias escrituras
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Mensaje para la persona" }, { status: 500 });
  }
}
```

- **Respuesta:** `{ data }` si sale bien, `{ error }` si no. Los clientes leen `payload.error`.
- **Mapeo:** las filas vienen en snake_case y se convierten a los tipos de `types/index.ts` con una función `mapX(row)` en el mismo archivo.
- **Endpoints actuales (2026-10-27):** `auth/{login, logout, sesion, root, root/token, verificar, verificar/reenviar, recuperar, recuperar/restablecer, google, google/callback}`, `usuarios`, `usuarios/[id]{, /contrasena, /contrasena/codigo, /avatar, /preferencias}`, `campanas`, `campanas/[id]{, /guardar, /inscripcion, /revisores, /baneos, /recoleccion-diaria, /metricas, /enlace, /qr, /especial, /reportar}`, `c/[token]/aportes` (aporte anónimo, sin sesión), `aportes`, `aportes/[id]{, /archivo, /inapropiado, /reportar, /reportar-participante}`, `revisiones`, `notificaciones`, `notificaciones/[id]{, /aceptar}`, `push`, `eventos` (actualización en vivo), `tematicas`, `especialidades`, `organizaciones` (catálogos del perfil), `datos/[id]/descarga` (ZIP con `archiver`), y `docs` + `docs/spec` (Swagger UI).
- **Documentación para personas:** `docs/` (guía en `docs/README.md`, rutas en `docs/rutas.md`, tablas y estados en `docs/datos.md`, permisos en `docs/permisos.md`, módulos en `docs/lib.md`) y un comentario de cabecera en cada archivo de `app/`, `lib/` y `components/`. Mantenlos al día en el mismo commit que el cambio.
- **Documentación OpenAPI:** `openapi.yaml` (raíz) describe todos los route handlers y se escribe a mano. **Si agregas o cambias un endpoint, actualiza `openapi.yaml` en el mismo commit.** `/api/docs` sirve Swagger UI (desde jsdelivr) y `/api/docs/spec` entrega el YAML con el servidor actual (`BASE_PATH`) como primero. Acceso (`lib/api-docs.ts`): abierto en `next dev`; en producción, incluido Docker local, exige sesión root. Swagger declara `rootBearer` (token de `POST /api/auth/root/token`) además de la cookie `session_token`. `next.config.ts` incluye el YAML en el build con `outputFileTracingIncludes`. La colección de Insomnia equivalente es `dataforgood-insomnia.json`.

## 4. Server actions (panel del SuperUsuario)

Archivos `"use server"` en `lib/`: `lib/usuarios/acciones-usuarios.ts` (`asignarRol`, `revocarRol`, `aplicarSancion`, `restaurarAcceso`), `lib/usuarios/acciones-supervisor.ts` (`revertirAccion`) y `lib/supervision/acciones-root.ts` (`decidirComoSuperUsuario`, que también toma la campaña).

```ts
"use server";
export async function hacerAlgo(id: string, ...): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await hasRootSession())) throw new Error("No autorizado");   // guardia SIEMPRE primero
  if (!/^\d+$/.test(id)) return { ok: false, error: "Petición inválida." };
  // lógica (idealmente una función de lib/ compartida con el route handler equivalente)
  // si es sensible: await registrarAuditoria({ actor: { tipo: "superusuario" }, accion: ..., objetivo: ... });
  revalidatePath("/ruta", "layout");
  return { ok: true };
}
```

Una server action es un endpoint público: cualquiera puede invocarla con su ID. Por eso **la guardia va dentro de la acción**, no en la página que la usa.

## 5. Patrones de página

| Zona | Patrón actual |
| --- | --- |
| `(dashboard)` | Página `"use client"` que carga con `fetch("/api/...")` en `useEffect` y maneja `cargando` / `error`. Algunas, como `mis-campanas/nueva`, separan un formulario cliente (`NuevaCampanaForm.tsx`) |
| `(panel)` | Server Component `async` que debe llamar a `exigirSesionRoot()` o a una función de `lib/` que ya la exija (hoy `/sistema` y `/usuarios/**` no lo hacen, ver `roles-y-sesiones.md` § 8), lee con funciones de `lib/<modulo>/` y pasa props a componentes cliente hermanos (`filtros.tsx`, `botones-de-rol.tsx`, `formulario.tsx`) que llaman a server actions |
| Públicas (`/`, `/datos`) | Server Components. `/` usa `revalidate = 300`: sus consultas van en `try/catch` con valores por defecto porque el build no tiene base de datos |

Actualización en vivo: `components/supervision/RefrescoEnVivo.tsx` hace `router.refresh()` periódico (polling) en los paneles de campañas activas.

## 6. Docker y variables de entorno

- **Levantar:** `docker compose up -d` (agrega `--build` si cambió código, `Dockerfile` o dependencias). Logs: `docker compose logs -f app`.
- **Servicios:** `postgres` (16-alpine, con healthcheck), `minio`, `minio-init` (crea el bucket privado y el usuario limitado, y termina) y `app`, que espera a `postgres` healthy y a que `minio-init` termine bien.
- **Puertos:** solo la app publica un puerto, `APP_PORT` (3000 por defecto, 3002 en producción) → 3000 del contenedor; Postgres y MinIO no. Para `next dev` o la consola de MinIO, usa `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d`, que los publica en `127.0.0.1`. No publiques Postgres ni MinIO en el compose base.
- **Secretos:** todos salen de `.env` (plantilla versionada en `.env.example`). Los `${VAR:?}` hacen que Compose no arranque si falta alguno. `DATABASE_URL` se arma con `POSTGRES_USER/PASSWORD/DB`. `lib/db.ts` y `lib/minio.ts` no tienen credenciales por defecto: crean la conexión en el primer uso y fallan si falta la variable (no al importar, porque `next build` los importa sin entorno). Migrar un servidor existente: ver `README.md`.
- **Dos `.env`, ambos gitignored y no intercambiables:**
  - `.env.local` lo lee `next dev`. Ahí un `$` literal se escapa con `\$`.
  - `.env` lo lee Compose para sustituir `${VAR}` en `docker-compose.yml`. Ahí un `$` literal se escapa con `$$`.
  - `ROOT_PASSWORD_HASH` (bcrypt, lleno de `$`) tiene que estar en los dos, cada uno con su escape.
- **Variables:** `POSTGRES_USER/PASSWORD/DB` (Compose) o `DATABASE_URL` (`next dev`), `MINIO_ROOT_USER/PASSWORD` (solo `minio` y `minio-init`), `MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY/BUCKET` (`ACCESS_KEY` es el usuario limitado), `MINIO_DATA` (opcional), `APP_PORT` (opcional), `BASE_PATH`, `APP_ORIGIN`, `ROOT_USER_ID`, `ROOT_PASSWORD_HASH`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` (notificaciones push; opcionales: sin ellas no hay push. `VAPID_SUBJECT` vacío usa el correo de `EMAIL_FROM` como `mailto:` y, si ese también está vacío, `APP_ORIGIN` (`lib/notificaciones/push.ts`). `web-push` solo acepta `mailto:` o `https:`: en local, con los dos vacíos y `APP_ORIGIN=http://localhost:3000`, **el push falla**. Pon `VAPID_SUBJECT=mailto:<correo>`).
- **Subruta (`basePath`):** en producción la app se publica en `https://multimodal-ai-lab.cicese.mx/dataforgood/`. `BASE_PATH` es un `ARG` del Dockerfile (por defecto `/dataforgood`; `docker-compose.yml` lo pasa como build arg) y `next.config.ts` lo usa como `basePath` y `NEXT_PUBLIC_BASE_PATH`. Como se incrusta en el bundle, cambiarlo exige reconstruir la imagen. El proxy inverso del servidor **debe reenviar la ruta completa, con `/dataforgood`**, sin recortarla. En local, con `docker compose`, la app queda en `http://localhost:3000/dataforgood`, y `next dev` sin `BASE_PATH` queda en la raíz. En Git Bash, `BASE_PATH=/dataforgood` se convierte en una ruta de Windows: usa PowerShell o `MSYS_NO_PATHCONV=1`.
- **`Dockerfile`:** multi-stage `deps → builder → runner` sobre `node:24-alpine`. Usa `npm install` (no `npm ci`) porque el lockfile se genera en Windows. El runner copia `.next/standalone`.
- **Imagen con nombre fijo:** el servicio `app` se etiqueta `dataforgood-app:latest`. En producción el servidor no compila: recibe un paquete `despliegue/dataforgood-<commit>/` (imágenes `.tar`, `README.md`, `docker-compose.yml`, `.env.example`; `despliegue/`, `*.tar` e `*.img` están en `.gitignore`), hace `docker load` y `docker compose up -d` **sin `--build`**. La imagen de MinIO también se lleva en `.tar` porque ya no se puede descargar. Pasos completos en `README.md`.
- **Sin `DATABASE_URL`** (ni `POSTGRES_URL`) la app termina al arrancar con un mensaje claro (`instrumentation-node.ts`), en vez de reintentar. Pasa si se corre la imagen con `docker run` sin el stack: usa `docker compose`.

## 7. Problemas conocidos (pendientes de despliegue)

Críticos resueltos el 2026-09-25: puertos, credenciales en el compose, usuario limitado de MinIO, volumen de Windows y límite de intentos de `/root`. Siguen pendientes:

- **Imagen de MinIO:** ya no se puede descargar (MinIO dejó de publicar en `quay.io/minio/*` y en Docker Hub); solo sirve la que está en caché (`RELEASE.2025-09-07T16-13-09Z`), y no recibe parches. Hay que decidir el reemplazo (compilar desde el código fuente o migrar a otro almacenamiento compatible con S3).
- La app publica `APP_PORT` en todas las interfaces: si el proxy vive en el mismo host, conviene `127.0.0.1:${APP_PORT}:3000`.
- Sin `/api/health` y sin respaldos (`pg_dump` + copia del volumen de MinIO).

No los "arregles de paso": son una tarea propia que hay que acordar.
