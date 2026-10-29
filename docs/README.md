# Guía para desarrolladores

Documentación del código de DataForGood para quien llega nuevo al proyecto. El [`README.md`](../README.md) de la raíz explica cómo **desplegar**; esta carpeta explica cómo **está hecho** el código y dónde tocar.

| Archivo | Qué contiene |
| --- | --- |
| [README.md](README.md) (este) | Qué es, stack, cómo arrancar en tu máquina, mapa de carpetas, cómo fluye una petición, convenciones y cómo agregar una funcionalidad |
| [rutas.md](rutas.md) | **Todas las pantallas y endpoints**: archivo que la implementa, de dónde saca los datos, quién puede entrar |
| [datos.md](datos.md) | Tablas de PostgreSQL, estados de campañas y aportes, archivos en MinIO |
| [permisos.md](permisos.md) | Sesiones, roles, guardias, sanciones y bitácora |
| [lib.md](lib.md) | Mapa de los módulos de `lib/`: qué hace cada archivo y qué exporta |
| [flujo-pruebas-integral.md](flujo-pruebas-integral.md) | Recorrido manual completo del sistema, de la preparación al cierre de QA |

Otras referencias del repo:

- `openapi.yaml`: contrato de la API, escrito a mano. Con la app corriendo se ve en `/api/docs` (Swagger UI).
- `dataforgood-insomnia.json`: colección de Insomnia con las mismas rutas.
- `database-schema.mmd`: diagrama Mermaid de las tablas.
- `.claude/skills/dataforgood-nextjs/`: reglas de negocio detalladas y **puntos abiertos** (`references/dominio.md`). Está escrita para agentes de IA, pero se lee bien.

> Si este documento y el código no coinciden, manda el código. Corrige el documento en el mismo commit.

---

## 1. Qué es

DataForGood conecta organizaciones con personas que aportan información en campo (fotos, texto y, en el futuro, video, audio y documentos) para campañas sociales, ambientales y comunitarias.

- Un **usuario** crea una campaña → un **supervisor** la acepta o la rechaza → la campaña se activa → otros usuarios **aportan** → el creador (y sus **revisores**) aceptan o rechazan cada aporte → al finalizar, los aportes aceptados se publican como **datos abiertos** descargables.
- Un **SuperUsuario** (cuenta raíz, fuera de la tabla de usuarios) administra roles, sanciones y también puede supervisar.

## 2. Stack

| Capa | Tecnología |
| --- | --- |
| Framework | **Next.js 16.3** (App Router) + React 19 + TypeScript. Sin servidor personalizado: `next start` lo atiende todo |
| Estilos | Tailwind CSS v4, escalas de color (system, brand, success, warning, error) en `app/globals.css` |
| API | Route handlers (`app/api/**/route.ts`) para la zona de usuario; server actions (`"use server"`) para el panel del SuperUsuario |
| Base de datos | PostgreSQL 16 con el paquete `pg` y **SQL a mano**. No hay ORM ni migraciones versionadas: el esquema vive en `lib/db-schema.ts` |
| Archivos | MinIO (compatible con S3) con el SDK `minio` |
| Correo | `nodemailer` con Gmail (códigos de verificación) |
| Login con Google | `google-auth-library` |
| Infraestructura | Docker Compose: `postgres`, `minio`, `minio-init`, `app` |
| Pruebas | **No hay pruebas automatizadas.** Se prueba a mano |

> **Ojo con Next 16.** Cambió cosas que quizá conoces de otra forma: `params`, `searchParams`, `cookies()` y `headers()` son asíncronos (`await params`); `middleware.ts` ahora se llama `proxy.ts`. Antes de usar una API de Next, consulta su guía en `node_modules/next/dist/docs/`.

## 3. Arrancar en tu máquina

### Opción A: todo en Docker (lo más simple)

```bash
cp .env.example .env          # y llena los valores
docker compose up -d --build
docker compose logs -f app
```

La app queda en `http://localhost:3000/dataforgood` (el prefijo `/dataforgood` es el `BASE_PATH`, ver § 6).

### Opción B: `next dev` con Postgres y MinIO en Docker

Recarga en caliente al editar código.

```bash
# Levanta Postgres y MinIO publicando sus puertos solo en 127.0.0.1
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres minio minio-init
npm install
npm run dev                   # http://localhost:3000 (sin /dataforgood)
```

`next dev` lee **`.env.local`**, no `.env`. Necesita al menos `DATABASE_URL`, las `MINIO_*` (con `MINIO_ENDPOINT=localhost`), `ROOT_USER_ID`, `ROOT_PASSWORD_HASH`, las de Gmail y las de Google.

> **Los dos `.env` escapan `$` distinto.** En `.env` (lo lee Compose) un `$` literal se escribe `$$`; en `.env.local` (lo lee Next) se escribe `\$`. Importa sobre todo para `ROOT_PASSWORD_HASH`, que es un hash bcrypt lleno de `$`.

**Al arrancar no hay que correr migraciones:** `instrumentation.ts` llama a `ensureCoreSchema()` y crea o actualiza las tablas solo.

### Verificar antes de subir cambios

```bash
npx tsc --noEmit              # tipos
npm run lint                  # ESLint
docker compose up -d --build  # compila la imagen: detecta páginas que fallan sin BD en el build
```

Después prueba a mano en el navegador los flujos que tocaste, con cada rol involucrado, y en anchos de 360, 768 y 1280 px.

## 4. Mapa de carpetas

```
DataForGood/
├── proxy.ts                # se ejecuta antes de cada petición: redirige si falta la cookie y frena CSRF en /api
├── instrumentation.ts      # al arrancar el servidor: crea/actualiza el esquema de la BD
├── next.config.ts          # basePath, output standalone
├── app/                    # RUTAS (cada carpeta con page.tsx es una URL)
│   ├── layout.tsx          # layout raíz: fuentes, <html>
│   ├── globals.css         # escalas de color, radios y tipografía
│   ├── page.tsx            # landing pública "/"
│   ├── explorar/ datos/ contacto/ privacidad/ sobre-nosotros/   # públicas
│   ├── cuenta-bloqueada/   # lo único que ve una cuenta sancionada
│   ├── (auth)/             # entrar, registro, verificar, bienvenida, root
│   ├── (dashboard)/        # zona del usuario con sesión (TopBar + menú lateral)
│   ├── (panel)/            # panel del SuperUsuario
│   └── api/                # route handlers: la API JSON
├── components/
│   ├── ui/                 # botones, inputs, tags, tarjetas de la zona de usuario
│   ├── cards/              # CampaignCard, ContributionCard
│   ├── layout/             # TopBar, SidebarNav, NotificationsBell, Logo (animado), Public{Header,Footer}...
│   ├── sistema/            # kit visual del panel del SuperUsuario
│   ├── supervision/        # piezas compartidas entre /supervision y /supervisar
│   ├── campanas/           # BarraDeFiltros: filtros de campañas (/sistema/campanas, /supervision, /supervisar, /revisiones)
│   └── auth/               # LogoutButton
├── lib/                    # LÓGICA DE SERVIDOR: BD, sesiones, reglas, consultas, server actions (ver lib.md)
├── types/index.ts          # tipos que devuelve la API a la zona de usuario
├── sql/                    # scripts viejos: NO son el esquema actual, no los uses
├── openapi.yaml            # documentación de la API
├── Dockerfile, docker-compose.yml, docker-compose.local.yml
└── .env.example            # plantilla de variables
```

### Cómo se traduce una carpeta de `app/` a una URL

- Cada `page.tsx` es una pantalla. `app/(dashboard)/mis-campanas/[id]/panel/page.tsx` → `/mis-campanas/123/panel`.
- Las carpetas entre **paréntesis** son *route groups*: agrupan pantallas que comparten `layout.tsx`, **pero no aparecen en la URL**. `(dashboard)/campanas` es `/campanas`, no `/dashboard/campanas`.
- Las carpetas entre **corchetes** son parámetros: `[id]` se lee con `const { id } = await params`.
- `layout.tsx` envuelve a todas las pantallas de su carpeta y subcarpetas.
- Cada `route.ts` dentro de `app/api/` es un endpoint: exporta funciones `GET`, `POST`, `PATCH`, etc.
- Los archivos que no son `page.tsx`/`layout.tsx`/`route.ts` (`PerfilForm.tsx`, `filtros.tsx`, `_ui.tsx`) son componentes que usa la pantalla de al lado. No generan URL.

La lista completa de pantallas y endpoints está en [rutas.md](rutas.md).

## 5. Cómo fluye una petición

```
Arranque:   instrumentation.ts ──► ensureCoreSchema()   (una sola vez)

Navegador ──► proxy.ts ──► layout.tsx del grupo ──► page.tsx / route.ts / server action
               │             │                         │
               │             │                         ├─ lib/session.ts o lib/rootSession.ts  ¿quién es?
               │             │                         ├─ lib/db.ts  pool.query(sql, params)   PostgreSQL
               │             │                         ├─ lib/minio.ts                         archivos
               │             │                         └─ lib/auditoria.ts                     bitácora
               │             └─ verifica sesión y rol (no basta: no protege la API)
               └─ solo mira si EXISTE la cookie; en /api, rechaza mutaciones de otro origen
```

**Toda verificación de permisos se repite en el servidor**, en cada página, route handler y server action. `proxy.ts` no valida el token ni el rol; los layouts no protegen la API. Detalles en [permisos.md](permisos.md).

### Los tres patrones de pantalla

El proyecto mezcla tres formas de cargar datos según la zona. Si amplías una pantalla, sigue el patrón que ya usa.

**1. Zona de usuario `(dashboard)`: componente cliente + `fetch` a `/api`.** La mayoría de estas páginas empiezan con `"use client"`, cargan datos en un `useEffect` con `fetch` y muestran estados de carga y error.

```tsx
"use client";
useEffect(() => {
  fetch(`${BASE_PATH}/api/campanas?mine=true`)
    .then((r) => r.json())
    .then((payload) => setCampaigns(payload.data));
}, []);
```

El endpoint correspondiente está en `app/api/campanas/route.ts`, que lee la sesión, consulta Postgres y devuelve `{ data }` o `{ error }`.

**2. Panel del SuperUsuario `(panel)`: Server Component + funciones de `lib/` + server actions.** La página es `async`, llama directo a funciones de `lib/` (que hacen la consulta SQL) y pasa los datos como props. Los botones están en un componente cliente hermano que llama a una server action.

```tsx
// app/(panel)/usuarios/[id]/roles/page.tsx (servidor)
const usuario = await obtenerUsuario(id);          // lib/usuarios/directorio.ts
return <BotonesDeRol usuario={usuario} />;          // botones-de-rol.tsx (cliente)

// botones-de-rol.tsx (cliente)
await asignarRol(id, "supervisor");                // lib/usuarios/acciones-usuarios.ts ("use server")
```

**3. Páginas públicas y algunas de supervisión/revisión: Server Component con SQL o `lib/`.** Por ejemplo, `/explorar`, `/datos` y `/supervision/[id]/usuarios`. La landing `/` usa `revalidate = 300`, así que se prerenderiza en el build sin base de datos: sus consultas van en `try/catch`.

Para una **pantalla nueva**, se prefiere el patrón 2: Server Component que lee de `lib/`, con un componente cliente aparte para la interacción.

## 6. Convenciones que hay que respetar

1. **SQL siempre parametrizado** (`pool.query("... WHERE id = $1", [id])`). Nunca concatenes valores del usuario. Si varias escrituras van juntas, usa una transacción (`pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`).
2. **El esquema solo se cambia en `lib/db-schema.ts`.** Una columna nueva va en el `CREATE TABLE` **y** como `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Detalles en [datos.md](datos.md).
3. **Las reglas de negocio se aplican en el servidor.** La interfaz puede ocultar un botón, pero el endpoint debe rechazar la acción de todos modos.
4. **Una regla, un solo lugar.** Si dos caminos aplican la misma regla (p. ej. el `PATCH` de campañas y la server action del SuperUsuario), extráela a `lib/` (ejemplo: `lib/supervision/decision.ts`).
5. **Respuestas de la API:** `{ data }` si sale bien, `{ error: "mensaje para la persona" }` si no, con el código HTTP correcto (400 validación, 401 sin sesión, 403 sin permiso, 404, 409 conflicto, 500).
6. **`types/index.ts` es el contrato** entre la API y la zona de usuario: campos en camelCase inglés, estados en español. Los handlers convierten filas snake_case con funciones `mapX(row)`.
7. **`basePath`.** En producción la app vive en `/dataforgood`. `<Link>`, `router.push`, `redirect()` y `revalidatePath` lo agregan solos. **`fetch`, `<img src>`, `<a href>` y `window.location` no**: antepón `BASE_PATH` de `lib/base-path.ts`. Para URLs absolutas (correos, redirecciones de OAuth) usa `absoluteUrl()` de `lib/app-url.ts`.
8. **Un componente cliente no puede importar nada que importe `pg`.** Por eso hay archivos "de opciones" sin imports de servidor (`lib/campanas/sistema-opciones.ts`, `lib/usuarios/rol-asignable.ts`, `lib/campanas/checklist.ts`).
9. **Reutiliza componentes y las familias de color.** `components/ui/*` en la zona de usuario, `components/sistema/*` en el panel. Colores con familia y escalón (`bg-white`, `text-system-600`, `border-system-200`...), no hex sueltos. Para un enlace con forma de botón usa `ButtonLink`, no un `<Link>` envolviendo un `<Button>`.
10. **Mobile-first.** Las pantallas de `(dashboard)` tienen clases `max-md:` para móvil; consérvalas al editar.
11. **Ubicación solo textual** (estado, ciudad). No se usa GPS.
12. **Nombres en español** para código nuevo (`obtenerUsuario`, `exigirSesionRoot`). Hay código viejo en inglés (`getSessionUser`, `mapCampaign`); no lo renombres de paso.

## 7. Cómo agregar una funcionalidad

1. **Revisa las reglas** en `.claude/skills/dataforgood-nextjs/references/dominio.md`. Si la tarea toca un punto abierto, pregúntale al equipo.
2. **Esquema:** si necesitas columnas o tablas, edítalas en `lib/db-schema.ts`. Una tabla nueva lleva su `ensureXTable()` y se agrega a `ensureCoreSchema()`.
3. **Lógica:** escríbela en `lib/<módulo>/`. Primero la guardia (sesión y permiso), luego la validación, luego el SQL.
4. **Entrada:**
   - Si la usa la zona de usuario, crea un route handler en `app/api/...`: `getSessionUser()` → 401, validación → 400, permiso → 403, lógica, `NextResponse.json({ data })`.
   - Si la usa el panel, crea una server action en `lib/<módulo>/acciones-*.ts`: guardia → validación → lógica → `revalidatePath(...)`, y devuelve `{ ok: true }` o `{ ok: false, error }`.
5. **Si es una acción sensible** (roles, sanciones, dictámenes, baneos), regístrala con `registrarAuditoria()`.
6. **Pantalla:** sigue el patrón de su zona (§ 5).
7. **Documentación:** si tocaste un endpoint, actualiza `openapi.yaml`. Si agregaste una pantalla o endpoint, agrégalo a [rutas.md](rutas.md).

## 8. Problemas conocidos

Están anotados para que no te sorprendan. No los "arregles de paso": cada uno es una tarea que se acuerda con el equipo.

| Problema | Dónde |
| --- | --- |
| **Tope de aportes anónimos por IP en memoria:** se reinicia con cada despliegue y no se comparte entre instancias. En local, sin proxy delante, todas las peticiones caen en la misma "IP" (`desconocida`) y comparten el tope de 20 por hora | `lib/campanas/aportes-anonimos.ts` |
| **El tope y la espera por IP confían en `X-Forwarded-For`.** Detrás del proxy es correcto; si el puerto de la app queda abierto a Internet, alguien puede inventar su IP. La cuota por dispositivo sí aplica. Se resuelve en el despliegue, no en el código | `lib/ip.ts`, `docker-compose.yml` |
| **Fotos anteriores al 2026-10-01 en el servidor:** pueden conservar su EXIF (GPS incluido) hasta correr `scripts/limpiar-metadatos.mjs --aplicar` (comando en su cabecera) | MinIO |
| **Sin CSP global:** hay X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy (`next.config.ts`), pero una Content-Security-Policy completa necesita probar Google OAuth y las fuentes | `next.config.ts` |
| **Un usuario sancionado puede aportar como anónimo** desde un enlace (al no tener sesión válida ve el formulario anónimo), igual que cualquiera que cierre sesión. No hay forma de ligar el dispositivo a la cuenta | `app/c/[token]/page.tsx` |
| **Video y audio se guardan con sus metadatos** (pueden llevar la ubicación de donde se grabaron): limpiarlos exige ffmpeg en la imagen. La pantalla de aportar lo avisa. Tampoco se limpian las imágenes incrustadas en un .docx o .pdf | `lib/aportes/limpiar-archivo.ts` |
| **Archivos de hasta 50 MB pasan por la memoria del servidor** (`request.formData()` y la limpieza los cargan completos). Para archivos más grandes conviene subir directo a MinIO con POST firmado. El proxy del servidor también debe aceptar cuerpos de ~51 MB | `lib/aportes/comun.ts`, `next.config.ts` |
| La imagen de MinIO ya no se puede descargar de internet; solo sirve la que está en caché | `docker-compose.yml` |
| Sin respaldos de Postgres ni MinIO, y sin `/api/health` | — |
