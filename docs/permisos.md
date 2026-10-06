# Sesiones, roles y permisos

## Contenido
1. Dos tipos de sesión
2. Las capas de protección
3. Guardias: qué función usar
4. Roles
5. Permisos por campaña
6. Registro, verificación e inicio de sesión
7. Sanciones y baneos
8. Bitácora (`audit_log`)

---

## 1. Dos tipos de sesión

Son independientes: la sesión de usuario no sirve en el panel, y la del SuperUsuario no sirve en la zona de usuario.

| | Usuario | SuperUsuario |
| --- | --- | --- |
| Módulo | `lib/session.ts` | `lib/rootSession.ts` |
| Cookie | `session_token` (httpOnly, `SameSite=Lax`, 30 días) | `root_session_token` (httpOnly, `SameSite=Strict`, 2 horas), o `Authorization: Bearer <token>` |
| Tabla | `sessions` | `root_sessions` |
| Se crea en | `POST /api/auth/login`, callback de Google, verificación del correo | `POST /api/auth/root` (cookie) o `POST /api/auth/root/token` (token en el JSON, para Swagger) |
| Leer | `getSessionUser()` → `SessionUser \| null` | `hasRootSession()` → `boolean` |

- **Token:** 32 bytes aleatorios en la cookie. En la BD solo se guarda su sha256, así que una copia de la base no permite suplantar sesiones.
- **El SuperUsuario no está en `usuarios`.** Su credencial son las variables de entorno `ROOT_USER_ID` y `ROOT_PASSWORD_HASH` (bcrypt). Entra por `/root`.
- **`getSessionUser()`** usa `cache` de React: una sola consulta por petición aunque se llame varias veces. Devuelve `null` si no hay sesión, si venció, **o si la cuenta tiene una sanción que la bloquea**. También le agrega el rol `revisor` si la persona es revisora aceptada de alguna campaña.

## 2. Las capas de protección

```
proxy.ts  ──►  layout.tsx  ──►  page.tsx / route.ts / server action
(cookie?)      (sesión, rol)    (sesión, rol y permiso sobre el recurso)  ◄── la que cuenta
```

1. **`proxy.ts`** (en Next 16 reemplaza a `middleware.ts`):
   - En páginas, **solo mira si existe la cookie** y redirige a `/entrar?next=...` o a `/root`. No valida el token. Cubre `/campanas`, `/mis-aportes`, `/mis-campanas`, `/cuenta`, `/supervision` y `/sistema` (ver `matcher` al final del archivo). **No cubre `/revisiones`, `/usuarios` ni `/supervisar`**: esas rutas dependen de sus layouts.
   - En `/api`, **protección CSRF:** rechaza con 403 los `POST`/`PATCH`/`PUT`/`DELETE` cuyo `Origin` no sea el propio sitio.
2. **Layouts:**
   - `app/(dashboard)/layout.tsx` → `exigirUsuario()`.
   - `app/(dashboard)/supervision/layout.tsx` → además, rol `supervisor`.
   - `app/(panel)/layout.tsx` → `hasRootSession()`.
3. **Cada página, route handler y server action vuelve a verificar.** Los layouts no bastan: no protegen la API ni las server actions, y no siempre se vuelven a ejecutar al navegar del lado del cliente.

> **Regla:** si escribes un endpoint o una acción, la verificación va **dentro** de él. Una server action es un endpoint público que cualquiera puede invocar con su ID, aunque la página que la usa esté protegida.

## 3. Guardias: qué función usar

| Dónde | Función | Qué hace si no pasa |
| --- | --- | --- |
| Route handler (`app/api`) | `getSessionUser()` (`lib/session.ts`) | Tú devuelves `401` y, si falta permiso, `403` |
| Página o layout de servidor de la zona de usuario | `exigirUsuario()` (`lib/session.ts`) | Redirige a `/cuenta-bloqueada` si está sancionado, o a `/entrar` si no hay sesión |
| Página del panel `(panel)` | `exigirSesionRoot()` (`lib/supervision/root.ts`) | Redirige a `/root` |
| Server action del panel | `hasRootSession()` o `exigirSuperUsuario()` interno de `lib/usuarios/acciones-*.ts` | Lanza un error |

Ejemplo de route handler:

```ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

  const campana = await pool.query("SELECT creator_id FROM campanas WHERE id = $1", [id]);
  if (campana.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  if (Number(campana.rows[0].creator_id) !== Number(user.id)) {
    return NextResponse.json({ error: "Solo quien creó la campaña puede hacer esto" }, { status: 403 });
  }
  // ...
}
```

En páginas de servidor de la zona de usuario usa `exigirUsuario()`, no `getSessionUser()` + `redirect("/entrar")`: el layout y la página corren en paralelo y deben mandar al mismo lugar.

## 4. Roles

`usuarios.role` es un arreglo JSONB con códigos de `lib/roles.ts`. Los nombres para mostrar están en `lib/usuarios/rol-asignable.ts`.

| Rol | Cómo se obtiene | Qué habilita |
| --- | --- | --- |
| `usuario` | Toda cuenta | Explorar, aportar, **crear y administrar sus propias campañas** (no hace falta otro rol) |
| `revisor` | Por campaña: el creador invita (`POST /api/campanas/[id]/revisores`) y la persona acepta desde sus notificaciones. Se guarda en `campana_revisores`, no en `usuarios.role`; `getSessionUser()` lo agrega al vuelo | `/revisiones` para las campañas donde aceptó |
| `supervisor` | **Solo el SuperUsuario** lo asigna (`asignarRol`). Al revocarlo, sus campañas `en_revision` quedan libres | `/supervision`: tomar y dictaminar campañas `en_revision` que no sean suyas |
| `admin` | Existe en el código, sin uso definido | — |
| SuperUsuario | Credencial raíz (no es un rol de la tabla) | Panel `/sistema`, `/usuarios`, `/supervisar` |

- Los roles se combinan (un supervisor puede ser revisor y crear campañas).
- Se leen en cada petición, así que un cambio de rol aplica sin volver a iniciar sesión.

## 5. Permisos por campaña

No hay una función central: cada handler lo comprueba con SQL. Si agregas una ruta, copia la comprobación del handler más parecido o, mejor, extrae una función a `lib/`.

| Acción | Quién |
| --- | --- |
| Editar, finalizar, ver bandeja, invitar revisores, banear | El creador (`campanas.creator_id`) |
| Aceptar o rechazar un aporte (decisión final) | El creador, o un revisor aceptado de la campaña (este solo si el aporte aún no tiene decisión) |
| Ver el archivo de un aporte | Quien aportó, el creador, o un revisor aceptado (si el aporte está pendiente o él lo decidió) |
| Aportar | Cualquier usuario que **no** sea el creador, no esté baneado de esa campaña y tenga cuota; campaña `activa` |
| Tomar y dictaminar una campaña | Un supervisor que no sea su creador (o el SuperUsuario), si está `en_revision` y libre. Solo quien la tomó puede dictaminar (`lib/supervision/decision.ts`) |

## 6. Registro, verificación e inicio de sesión

- **Registro** (`POST /api/usuarios`): crea la cuenta con `email_verificado = false` y llama a `startVerification()` (`lib/verification.ts`).
- **Verificación:** código de 6 dígitos enviado por Gmail (`nodemailer`), guardado como hash. Vence en 15 minutos y admite 3 intentos. La cookie `pending_verification_id` liga la pantalla `/verificar` con la cuenta.
- **Login** (`POST /api/auth/login`): bcrypt (`lib/password.ts`, que también reconoce hashes viejos y los migra al vuelo). Tras 5 fallos bloquea la cuenta 15 minutos (`locked_until`). Rechaza cuentas sin verificar.
- **Google** (`lib/google.ts`): `GET /api/auth/google` guarda un `state` aleatorio en la cookie `google_oauth_state` y redirige. El callback compara el `state`, vincula `google_id` a una cuenta existente con ese correo o crea una nueva ya verificada.
- **Volver a donde estabas:** el parámetro `?next=` viaja por `/entrar`, `/registro`, `/verificar`, `/bienvenida` y Google. `destinoSeguro()` (`lib/redireccion.ts`) solo acepta rutas internas, para evitar redirecciones abiertas.
- **SuperUsuario** (`POST /api/auth/root` y `POST /api/auth/root/token`, ambos con `verificarCredencialRoot()` de `lib/root-acceso.ts`): compara en tiempo constante y limita a 5 intentos por minuto por IP y 30 en total (en memoria: se reinicia con cada despliegue).
- **Recuperar contraseña:** no existe.

### Persona anónima (sin cuenta)

Puede participar **solo si le comparten una campaña** (enlace o QR `/c/[token]`). No tiene sesión ni rol.

- **Ve:** únicamente `/c/[token]`, con la ficha de la campaña y el formulario. Todo lo demás de la app le pide iniciar sesión, y la API le responde 401.
- **Puede:** enviar aportes con `POST /api/c/[token]/aportes`, solo con un enlace vigente de una campaña activa.
- **No puede:** ver sus aportes después, consultar archivos, ver el enlace o el QR desde la app, ni modificar nada.
- **Límites:** la cuota por persona de la campaña, contada por dispositivo (cookie `anonimo_id`), 60 segundos de espera entre dos aportes del mismo dispositivo, y 20 aportes por IP por hora (`lib/campanas/aportes-anonimos.ts`). No puede aportar si el creador apagó "Permitir aportes sin cuenta" o si su dispositivo está bloqueado. Sin cookie, además espera 60 s desde el último aporte anónimo de su IP (en memoria).
- **Privacidad:** el aporte se guarda como "Anónimo", sin correo ni nombre de archivo, y la foto sin metadatos. De la cookie solo se guarda su hash. La IP no se guarda en ningún lado (ni en la bitácora): los límites por IP viven en memoria.
- **Revisión:** el creador lo acepta o rechaza como cualquier aporte; nadie recibe el motivo del rechazo.
- **Sanciones** (`lib/aportes/sanciones-anonimas.ts`):
  - Creador y revisor marcan un aporte anónimo como "Contenido inapropiado" (al rechazarlo o con un botón que no cambia el estado). Banear y bloquear, solo el creador. Un aporte ya decidido no se marca ni se borra su archivo; banear desde él sí se puede.
  - Solo el creador bloquea el dispositivo en su campaña (se quita en "Participantes baneados"), borra el archivo y apaga los aportes sin cuenta.
  - 3 aportes inapropiados del mismo dispositivo en 30 días lo bloquean 30 días en toda la plataforma. Solo el SuperUsuario lo quita antes (`/usuarios/sanciones`).

## 7. Sanciones y baneos

Hay dos cosas distintas con nombres parecidos:

**Baneo por campaña** (lo aplica el creador): impide aportar a **esa** campaña.

- Tabla `campana_baneados`. Endpoint `GET`/`POST`/`DELETE /api/campanas/[id]/baneos`. Consultas en `lib/campanas/baneos.ts`.
- El participante ve la etiqueta "Baneado" en las listas (`isBanned`) y un aviso antes de aportar (`viewer.baneado`).

**Sanciones de cuenta** (las aplica el SuperUsuario desde `/usuarios/[id]/sancion`): afectan toda la cuenta.

| Tipo | Efecto |
| --- | --- |
| `STRIKE` | Suma al contador. **Al tercero, la cuenta se banea sola** (`STRIKES_PARA_BANEO = 3`), dentro de la misma transacción |
| `SUSPENSION_TEMPORAL` | Bloquea la cuenta `dias` días desde `aplicada_en`. Se levanta sola al vencer |
| `BANEO_DE_CAMPANA` | En la interfaz se llama "Baneo permanente": bloquea la cuenta hasta que se restaure |

- La lógica de "¿está bloqueado?" vive en `lib/sanciones.ts` (`obtenerBloqueo`, `SQL_SANCION_BLOQUEANTE`).
- **Qué pasa con una cuenta bloqueada:** `getSessionUser()` devuelve `null`, así que ninguna API ni acción la deja pasar. Conserva su sesión, pero `exigirUsuario()` la manda a `/cuenta-bloqueada`, donde ve el motivo y puede cerrar sesión. `VigilanteDeSesion` (cliente) la saca si la sancionan mientras navega.
- `restaurarAcceso()` desactiva la sanción de inmediato.

## 8. Bitácora (`audit_log`)

Las acciones sensibles se registran con `registrarAuditoria()` (`lib/auditoria.ts`) **después** de completarse. Si el registro falla, solo se escribe en consola: no revierte la acción.

- **Guarda:** actor (`usuario` + id, `superusuario` o `anonimo`), acción, objetivo (`usuario:5`, `campana:3`), detalle JSONB e IP (`lib/ip.ts`, último valor de `X-Forwarded-For`).
- **Acciones registradas:** `rol.asignar`, `rol.revocar`, `sancion.aplicar`, `sancion.restaurar`, `supervision.tomar`, `supervision.dictaminar`, `campana.banear`, `campana.desbanear`, `campana.enlace_regenerar`, `revisor.invitar`, `revisor.aceptar`, `root.acceso`, `root.acceso_fallido`, `usuario.contrasena_cambiar` (cambio de contraseña en /cuenta; no guarda ninguna contraseña).
- **Si agregas una acción sensible**, regístrala y añade su nombre al tipo `AccionAuditada`.
- **No hay pantalla** para consultarla todavía; se lee con SQL.
