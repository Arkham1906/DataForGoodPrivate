# DataForGood

Plataforma de crowdsourcing de datos: Next.js 16 (App Router) + PostgreSQL + MinIO, todo en Docker Compose.
Producción: https://multimodal-ai-lab.cicese.mx/dataforgood/

> **¿Vas a trabajar en el código?** Empieza por la [guía para desarrolladores](docs/README.md): rutas, API, base de datos, permisos y módulos de `lib/`. Este archivo cubre el despliegue.

## Levantar el stack

```bash
cp .env.example .env        # y cambia TODOS los valores
docker compose up -d --build
docker compose logs -f app
```

- **Servicios:** `postgres`, `minio`, `minio-init` y `app`. `minio-init` crea el bucket privado y un usuario de MinIO limitado a ese bucket (`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`), y termina. La app nunca recibe el root de MinIO.
- **Puertos:** Postgres y MinIO no publican puertos; solo la app publica `APP_PORT` (3000 por defecto, 3002 en producción), y solo en `127.0.0.1` (`APP_HOST`): de fuera se llega únicamente por el proxy del mismo servidor.
- **Desarrollo en tu máquina** (`next dev` fuera de Docker, o para abrir la consola de MinIO): publica los puertos solo en `127.0.0.1` con:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
  ```
- **Subruta:** la app se publica bajo `/dataforgood` (`BASE_PATH`, se fija al construir la imagen). El proxy inverso debe reenviar la ruta **completa**, sin recortar el prefijo. En nginx: `proxy_pass http://HOST:3000;` sin `/` final.

## Desplegar en producción con el paquete (`docker load`)

El servidor no construye la imagen: recibe una carpeta `despliegue/dataforgood-<commit>/` con las imágenes en `.tar`, este README, `docker-compose.yml` y `.env.example`.

**No uses `docker run` con la app sola:** le faltarían la base de datos, MinIO y todas las variables (`Falta DATABASE_URL`). El stack completo se levanta con `docker compose`.

Primera vez, en una carpeta propia del servidor (p. ej. `~/dataforgood/`) con los archivos del paquete:

```bash
# 1. Cargar las imágenes (la de MinIO ya no se puede descargar de internet)
docker load -i dataforgood-app-<commit>.tar
docker load -i minio.tar            # solo si `docker image ls | grep minio` no muestra quay.io/minio/minio

# 2. Configuración: copiar la plantilla y cambiar TODOS los valores
cp .env.example .env
nano .env        # APP_PORT=3002, APP_ORIGIN, claves nuevas y largas, Gmail, Google, ROOT_*

# 3. Levantar (sin --build: usa la imagen cargada)
docker compose up -d
docker compose ps                   # postgres "healthy", minio-init "Exited (0)", app "Up"
docker compose logs -f app          # sin errores de DATABASE_URL
curl -I http://localhost:3002/dataforgood    # 200
```

Si en el servidor ya corría un contenedor viejo de la app en el mismo puerto (p. ej. `docker run -p 3002:3000 ...`), detenlo antes del paso 3 (`docker stop <id>`), o Compose no podrá usar ese puerto.

Actualizaciones siguientes: `docker load -i dataforgood-app-<commit>.tar` y `docker compose up -d`.

## Migrar un servidor que ya estaba corriendo

Solo aplica si en el servidor ya existía un Postgres de esta app **con datos**. Si es la primera vez que se levanta la base, sáltate esta sección.

Las credenciales viejas estaban escritas en `docker-compose.yml` y quedaron en el historial de Git: cámbialas.

1. **Postgres.** El usuario y la contraseña se graban en el volumen la primera vez que arranca, así que cambiarlos en `.env` no cambia la base existente. Hay dos caminos:
   - **Conservar el usuario y cambiar solo la contraseña.** Antes de actualizar, con el stack viejo corriendo:
     ```bash
     docker compose exec postgres psql -U tu_usuario -d mi_base_de_datos -c "ALTER USER tu_usuario PASSWORD 'nueva-clave'"
     ```
     Luego, en `.env`: `POSTGRES_USER=tu_usuario`, `POSTGRES_DB=mi_base_de_datos` y `POSTGRES_PASSWORD=nueva-clave`.
   - **Empezar con otro usuario o base:** respalda con `pg_dump`, crea el volumen nuevo y restaura.
2. **MinIO.**
   - **Credenciales:** el root sí toma las credenciales nuevas de `.env` al reiniciar. Los datos se conservan si el volumen es el mismo.
   - **Carpeta de datos:** si los datos estaban en una carpeta del host, define `MINIO_DATA=/ruta/a/esa/carpeta` en `.env`; si no, se crea un volumen nuevo y vacío.
   - **Nombres de contenedor:** los contenedores ya no tienen nombre fijo (`postgres_local`, `minio`, `app`). Usa `docker compose exec <servicio>`.
3. **Imagen de MinIO.** MinIO dejó de publicar imágenes: `quay.io/minio/minio` y `minio/minio` ya no se pueden descargar. Solo funciona si la imagen ya está en la máquina (`docker image ls | grep minio`). No borres esa imagen del servidor.
4. **Levantar:** `docker compose up -d --build`, y comprobar con `docker compose ps` que `minio-init` terminó con `Exited (0)`.

## Verificación

```bash
npx tsc --noEmit
npm run lint
docker compose up -d --build
```
