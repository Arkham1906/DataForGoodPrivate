# Interfaz: sistema de diseño y diseño responsivo

## Contenido
1. Tokens y tipografía
2. Componentes existentes
3. Patrones visuales de la rama
4. Layouts
5. Móvil: lo que ya funciona y lo que falta
6. Captura de fotos, audio y video
7. Accesibilidad
8. Checklist por pantalla

## 1. Colores y tipografía

**Colores (desde el 2026-10-07, a pedido del usuario): 5 familias con escala, sin nombres por función.** Definidas en `@theme` de `app/globals.css` como `--color-<familia>-<escalón>`, del 50 (más claro) al 950 (más oscuro). La paleta por defecto de Tailwind está desactivada (`--color-*: initial`): `blue-500` o `red-600` no existen. **Usa siempre familia + escalón; no escribas hex sueltos** (excepciones: `app/manifest.ts` y el QR de `lib/campanas/enlaces.ts`, que necesitan hex).

| Familia | Para qué | Escalones de uso común |
| --- | --- | --- |
| `system` (grises) | Fondos, bordes, texto | `system-50` fondo general · `white` tarjetas, inputs, barras · `system-100` cajas neutras y cabeceras de tabla · `system-200` bordes de tarjeta · `system-300` bordes de inputs y botones secundarios · `system-400` solo bordes y decoración (no en texto: 2.6–2.9:1) · `system-500` texto terciario · `system-600` texto secundario · `system-900` texto principal |
| `brand` (azul #2e5aac) | Selección activa, enlaces, foco, destacados | `brand-50` fondo destacado · `brand-600` el azul de la marca · `brand-800` hover y énfasis |
| `success` (verdes) | **Botón primario**, éxito, aceptado | `success-50` fondo · `success-700` botón primario y texto · `success-800` hover del botón primario |
| `warning` (amarillos) | Pendiente, avisos | `warning-50` fondo · `warning-200` borde suave · `warning-500` rellenos (puntos, medidores) y bordes · `warning-800` **texto** (el amarillo no se lee como texto) |
| `error` (rojos) | Rechazo, errores, acciones destructivas | `error-50` fondo · `error-700` texto, bordes y botón de peligro |

Equivalencias con los nombres de antes (para leer commits viejos): `paper` → `system-50`, `surface` → `white`, `sunken` → `system-100`, `line` → `system-200`, `line-2` → `system-300`, `ink-3` → `system-400`, `ink-2` → `system-600`, `ink` → `system-900`, `accent` → `brand-600`, `accent-deep` → `brand-800`, `accent-tint` → `brand-50`, `ok` → `success-700`, `danger` → `error-700`, `*-tint` → `*-50`. `warn` cambió de ámbar (#96660f) a amarillo: texto `warning-800`, relleno `warning-500`. Contrastes medidos: `system-600` sobre blanco 6.3, `brand-600` 6.6, `success-700` sobre `success-50` 4.7, `error-700` sobre `error-50` 5.4, `warning-800` sobre `warning-50` 6.6.

Radios: `rounded-pill` (999px) en botones, chips y etiquetas; `rounded-lg` (16px) en tarjetas.

**Tipografía** (`app/layout.tsx`):

- **Plus Jakarta Sans** (400 a 800) como `font-sans`, cuerpo a 14.5 px.
- **JetBrains Mono** (400 y 500) como `font-mono`, para números, contadores, fechas, tokens, límites de caracteres y etiquetas de sección.
- **Escala en uso:** `text-[11px]`, `[11.5px]`, `[12px]`, `[12.5px]`, `[13px]`, `text-sm`, `[15px]`; títulos `text-xl`, `text-2xl`, `text-[26px]` y `text-[46px]` en la landing, con `font-extrabold`. Mantén esta escala; no agregues tamaños nuevos.

**Animaciones:** quien pidió menos movimiento ve la página quieta. Las clases `.landing-*` van dentro de `@media (prefers-reduced-motion: no-preference)` en `globals.css`; `.marca-animada` está fuera y se apaga con `@media (prefers-reduced-motion: reduce)`; la pastilla de los menús usa `motion-reduce:transition-none` y `ui/ContadorAnimado` lo revisa con `matchMedia`. Las tres formas son válidas, no las "corrijas"; en animaciones nuevas de CSS prefiere `no-preference`. Las de las páginas públicas son las clases `.landing-*` con los ayudantes de `lib/animaciones.ts`; no inventes otro sistema.

## 2. Componentes existentes

Todos usan `export default`, nombre de archivo en PascalCase, variantes en un `Record` y `className` para extender.

| Componente | API | Notas |
| --- | --- | --- |
| `ui/Button` | `variant`: primary (verde) · secondary · danger · ghost; `size`: sm · md | Forma de píldora. Para navegar usa `ui/ButtonLink` (nunca `<Link>` envolviendo `<Button>`) |
| `ui/Card` | `highlighted` | `rounded-lg border bg-white p-4 shadow-sm` |
| `ui/Input` | `Field` (label, hint, required, `error`), `Input`, `Textarea` | Asterisco rojo en obligatorios; la pista va en `text-system-500`. Con `error` (2026-10-27) el control lleva `aria-invalid` y borde rojo (variante `aria-invalid:`) y el motivo va debajo (`CampoEtiquetado`) |
| `ui/PasswordInput` | Las de `Input`, sin `type` | Cliente. `Input` con botón de ojo para mostrar u ocultar la contraseña. Úsalo en todo campo de contraseña de la zona de usuario (`/entrar`, `/registro`, la ventana de contraseña de `/cuenta`) |
| `ui/Tag` | `tone`: default · ok · warn · danger · info · on | Estados y temáticas. `info` (azul claro, 2026-10-27): "Novedades para participar" de las notificaciones |
| `ui/ProgressBar` | `pct`, `tone`: accent · ok | Limita el valor entre 0 y 100 |
| `ui/MetricCard` | `label`, `value` | Métricas del panel |
| `sistema/MetricCard` | `label`, `value`, `secundario`, `links`, `centrado` | Métricas del panel del SuperUsuario. `centrado` centra en todos los tamaños; para centrar solo en móvil, `/usuarios/dashboard` y `/usuarios/supervisores` la envuelven en un `div` `max-md:text-center` |
| `cards/CampaignCard` | `campaign`, `onAbrir` | Tarjeta vertical del catálogo. Con `onAbrir` (2026-10-27) toda la tarjeta es clickeable: un `<button>` absoluto la cubre y abre `campanas/VentanaDeCampana`; los botones de la tarjeta van `relative z-10` para quedar encima. Mismo patrón en las tarjetas de `/mis-campanas` |
| `ui/RutaDeTematica` | `tematica`, `etiquetas`, `className` | Temática y etiquetas como ruta: "Animales › #Perros #Adopción" (2026-10-27). Úsala donde se muestre la temática de una campaña junto con sus etiquetas |
| `campanas/VentanaDeCampana` | `campana`, `onCerrar`, `extra`, `acciones` | Cliente (2026-10-27). `<dialog>` con el detalle de una campaña: temática, estado, etiquetas, descripción, quién organiza, lugar, vigencia, tipos, cuota, meta, participantes, checklists y especial. `extra`: lo que solo ve el creador; `acciones`: botones al pie. Se monta solo abierta |
| `cards/ContributionCard` | `contribution` | Estado con `Tag` |
| `layout/PublicHeader`, `PublicFooter` | — | Landing |
| `layout/Logo` (+ `IconoDelLogo`) | `alto`, `tamanoIcono`, `acronimoEnMovil` | Ícono y palabra de `public/logo.svg` y `public/Texto.svg` dibujados en línea (colores `accent`/`ink`). Con el cursor encima se vuelve "DFG" y los 3 cuadros claros del ícono se llenan uno por uno; en `max-md` muestra siempre "DFG". **Cliente desde el 2026-10-08:** si está dentro de un enlace, el ícono rebota al hacer clic (`.logo-rebote`), y mientras llega la página siguiente la cuadrícula se llena y se enciende en secuencia (`useNavegacionEnCurso` de `layout/navegacion-en-curso.ts`: clic en un enlace interno hacia otra ruta, hasta que cambia `usePathname`, tope de 15 s). Con `loading.tsx` casi no se nota. Úsalo en vez de escribir "DataForGood" con un cuadro: está en `PublicHeader`, `(auth)/layout`, `CuentaBloqueada` y `sistema/Topbar` |
| `campanas/BarraDeFiltros` | `valores`, `tematicas`, `onCambiar`, `conVigencia`, `colapsableEnMovil`, `conTematica` (false: sin el select de temática; `/campanas`), `conTipo` (false: sin el select de tipo de dato; `/campanas`, donde va en botones desde el 2026-10-28) | Cliente. Búsqueda, temática, tipo de dato, vigencia (opcional) y orden de campañas. Solo dibuja: `/sistema/campanas` escribe los cambios en la URL y `/supervision`, `/supervisar` y `/revisiones` filtran en el navegador con `lib/campanas/filtro-local.ts`. Con `colapsableEnMovil` (hoy solo `/supervision`), en móvil deja visible la búsqueda y un ícono que abre un card emergente con los selects en borrador; se aplican al dar "Filtrar". En escritorio no cambia |
| `layout/TopBar` | `usuario: SessionUser` | Logo enlazado a `/inicio` (desde el 2026-10-24), `NotificationsBell` (resincroniza el push y se actualiza al llegar uno; las 8 más nuevas, contador del servidor, consulta cada minuto con la pestaña visible; se cierra con Esc o clic fuera; "Ver todas" lleva a `/notificaciones`; se actualiza al oír `EVENTO_NOTIFICACIONES`), avatar |
| `layout/EnlaceAlPerfil` | `iniciales`, `nombre` | Cliente. Avatar, nombre y "Ver perfil" de `TopBar`. **Experimental (2026-10-07, a pedido del usuario):** no se muestra en `/cuenta`; al dar clic, el círculo y el nombre vuelan al encabezado del perfil (`<ViewTransition>` de React con `name` `perfil-avatar`/`perfil-nombre`, el mismo que en `cuenta/page.tsx`) y el clic marca `<html data-abrir-perfil>`, con lo que `/cuenta` (`enter="perfil-desplegar"`) se despliega de arriba abajo; la marca se quita 1.5 s después de llegar. No usar `transitionTypes` en el `Link`: en ~1 de cada 3 navegaciones el tipo no llegaba a la transición (probado en Chrome, 2026-10-07). CSS en `globals.css` ("Abrir el perfil"), apagado con movimiento reducido. En móvil solo vuela el círculo. Probado en Chrome de escritorio (12 de 12; atrás/adelante no anima). Pendiente: que Gerard lo revise en móvil |
| `ui/InteresesDesdeTexto` | `texto`, `onTexto`, `seleccionados`, `onCambiar`, `deshabilitado` | Cliente. "Cuéntanos qué te gusta hacer": Enter (Mayús+Enter, salto de línea) o "Analizar" saca las temáticas con `lib/tematicas/analizar.ts` y las suma; avisa cuáles son nuevas. Debajo, `SelectorDeTemas` con `quitables`. Carga el catálogo de `GET /api/tematicas` (si falla, las 23 base). En `/bienvenida` y `/cuenta` |
| `ui/Skeleton` | `className`, `enLinea` | Desde el 2026-10-07: bloque gris que late (`animate-pulse`, quieto con movimiento reducido) mientras llegan los datos; forma y tamaño con `className`. Decorativo: el contenedor lleva `role="status"` y un texto `sr-only`. Úsalo en vez de "Cargando…" o la pantalla en blanco |
| `ui/Esqueletos` (`PantallaEsqueleto` + piezas) | `tipo`: tarjetas · tabla · detalle · tablero · formulario; `etiqueta`, `className` | Pantalla completa mientras carga, armada con `Skeleton`. **Todas las pantallas que cargan del servidor la usan (2026-10-07):** las páginas cliente en lugar de su "Cargando…" y las de servidor desde su `loading.tsx` (23: uno por defecto en `(panel)` y uno por carpeta donde la forma cambia). Piezas sueltas: `EsqueletoDeEncabezado`, `EsqueletoDeFiltros`, `EsqueletoDeTarjetas`, `EsqueletoDeFilas`, `EsqueletoDeMetricas`. **`/cuenta` no tiene `loading.tsx` a propósito:** con esqueleto previo, el avatar de "Ver perfil" ya no vuela (probado: 0 de 4). Pantalla nueva que carga datos: dale su esqueleto |
| `cards/CampaignCardSkeleton` | — | Esqueleto de `CampaignCard` con sus mismos espacios (también `max-md`): al llegar los datos no se mueve la pantalla. Si cambia `CampaignCard`, ajustarlo. Hoy solo en `/campanas` (6 tarjetas, los contadores de los filtros y 3 botones de temática que reservan el lugar de la fila) |
| `campanas/MasTematicas` | `temas` (`[temática, campañas][]`), `onElegir`, `claseDelBoton` | Cliente. "Más temáticas ▾" de `/campanas`: `<dialog>` con buscador (sin acentos) y las temáticas que no caben en la fila; tocar una la aplica y cierra |
| `ui/IndicadorDeCarga` | `tamano`, `className` | Desde el 2026-10-08: la cuadrícula del logo con los 9 cuadros encendiéndose en secuencia (`.indicador-de-carga` en `globals.css`, orden en `--i`; quieto con movimiento reducido). Toma `currentColor`. Decorativo: acompáñalo de texto ("Enviando…"). En los botones de enviar aporte (`/campanas/[id]/aportar` y `/c/[token]`) |
| `ui/MenuDeAcciones` | `opciones` (`{ etiqueta, href?, alElegir?, peligro?, deshabilitado? }[]`), `etiqueta`, `texto`, `discreto` | Cliente. Menú "Más ▾" para las acciones secundarias de una tarjeta o renglón (Ley de Hick, 2026-10-07). Las de `peligro` van en rojo y al final. Accesible: `role="menu"`, flechas, Esc y clic fuera cierran, el foco regresa al botón. `discreto`: botón de texto, para renglones con acciones en texto (`/notificaciones`). `alinear`: `"derecha"` (por defecto, la lista crece hacia la izquierda) o `"izquierda"` cuando el botón está al inicio del renglón (`/notificaciones`, donde antes se cortaba). **El contenedor no debe tener `overflow-hidden`:** corta la lista. En `/notificaciones` (Marcar, Eliminar). `/mis-campanas` lo usó hasta el 2026-10-28; desde entonces sus acciones son íconos en la tarjeta (commit `cc2990b` de Gerard) |
| `ui/SelectorDeTemas` | `opciones`, `seleccionados`, `onAceptar`, `quitables`, `unica`, `deshabilitado`, `titulo`, `descripcion` | Muestra las temáticas elegidas y abre un `<dialog>` nativo con buscador; aplica solo al dar Aceptar. En `/bienvenida`, `/cuenta` (con `quitables`: × en cada una) y la temática del formulario de campaña (con `unica`: exactamente una) |
| `ui/AcuerdosDeAporte` | `InscripcionACampana` (`campanaId`, `onInscrito`), `CasillasDeAcuerdos` (`acuerdos`, `onCambio`, `deshabilitado`), `agregarAcuerdos` | Cliente (2026-10-15; reemplaza a `ui/AvisosDeAporte`). Las dos casillas cortas de los acuerdos para aportar y "Leer los acuerdos", que abre un `<dialog>` de solo lectura con el texto completo. `InscripcionACampana` las envía a `POST /api/campanas/[id]/inscripcion` (en `/campanas/[id]` y arriba de `/campanas/[id]/aportar`); `CasillasDeAcuerdos` va en el formulario sin cuenta de `/c/[token]` |
| `ui/VentanaDeConfirmacion` | `abierto`, `titulo`, `children`, `textoConfirmar`, `textoOcupado`, `ocupado`, `peligro`, `onCancelar`, `onConfirmar` | Cliente. Ventana emergente (`<dialog>`) para confirmar una acción **en lugar de `window.confirm`**; no se cierra mientras `ocupado`. Hoy en "Pausar campaña" de `/mis-campanas` y "Quitar incentivos" de la campaña especial |
| `ui/CampoDeFecha` | `value` ("AAAA-MM-DD" o ""), `onChange(fecha)`, `min`, `disabled`, `required`, `aria-label` | Cliente (2026-10-21, a pedido del usuario). Fecha que **siempre se ve DD/MM/AAAA**: el `<input type="date">` muestra el formato del idioma del sistema (mm/dd/yyyy en inglés) y no hay atributo que lo cambie. Se escribe como texto con las diagonales puestas solas; avisa "Esa fecha no existe" (31/02) y entonces entrega ""; el botón abre el calendario nativo (`showPicker()` de un `<input type="date">` oculto, con `min`). Lo usa el formulario de campaña (inicio, finalización y reactivar); la hora sigue siendo `<input type="time">` |
| `ui/CodigoDeSeisDigitos` | `valor`, `onCambiar`, `deshabilitado`, `autoFocus` | Código de 6 dígitos en seis casillas, con el aspecto de `/verificar` (que aún tiene su propia copia, con cuenta regresiva e intentos): avanza solo, retrocede con Borrar y acepta pegar el código. Sin cuenta regresiva ni contador de intentos (a pedido del usuario, 2026-10-07): la vigencia va en el texto de arriba. Las casillas se encogen (`flex-1 max-w-11`) para caber a 360 px. Lo usan `/recuperar` y las ventanas de contraseña de `/cuenta` |
| `layout/CuentaBloqueada` | `nombre`, `bloqueo`, `historial` | Pantalla de `/cuenta-bloqueada`: motivo y contador de sanciones |
| `layout/VigilanteDeSesion` | — | En el layout de `(dashboard)`: revisa la sesión en cada navegación y recarga si ya no vale |
| `layout/SidebarNav` | `usuario` (cliente, `usePathname`) | `NAV_ITEMS`: Explorar, Mis aportes, Mis campañas (tono verde); agrega Supervisión si `role` incluye `supervisor` y Revisor de aportes si incluye `revisor`. Opción activa con pastilla deslizante |
| `ui/useIndicadorDeMenu` | hook: `activo` → `{ navRef, visual, indicador, alElegir }`; `claseDeOpcionMarcada()` | Cliente. Pastilla azul (accent, siempre: es el color principal) que se desliza a la opción activa de un menú (`SidebarNav` y `sistema/Sidebar`). El `<nav>` va `relative` con `navRef` y `{indicador}` dentro; cada enlace lleva `data-menu-clave`, `onClick={alElegir(clave)}` y, si está marcado, `claseDeOpcionMarcada()` |
| `ui/ContadorAnimado` | `valor`, `className` | Cliente. Cifra que cuenta desde 0 al entrar en pantalla (landing); sin JS o con movimiento reducido se ve el valor final |
| `ui/CampoConSugerencias` | `value`, `onChange(valor)`, `url`, `respaldo` | Cliente (2026-10-26). `<input>` con `<datalist>` que se filtra al escribir; se elige o se escribe. Base de `ui/CampoDeEspecialidad` (`/api/especialidades`) y `ui/CampoDeOrganizacion` (`/api/organizaciones`) |
| `ui/VentanaDeProblemas` | `abierto`, `titulo`, `problemas` (`{ campo, mensaje }`), `onCerrar`, `alIr(campo)` | Cliente (2026-10-27). `<dialog>` que explica por qué no se pudo guardar; "Ir →" lleva al campo después de cerrarse. Ver "Errores de formulario" |
| `ui/AsaDeArrastre` | `etiqueta`, `onMover(de, a)`, `deshabilitado` | Cliente (2026-10-24). Asa ⠿ para reordenar con puntero o flechas dentro de `data-orden-grupo`; lleva `data-sin-respuesta` |
| `campanas/MetricasGenerales` | `datos` (`lib/campanas/metricas-generales-tipos.ts`) | "Métricas generales" del panel de la campaña (2026-10-27): tarjetas por tipo de dato, ubicación, revisión, origen, participación y checklists |
| `sistema/catalogo/*` | `PantallaDeCatalogo`, `NuevoDelCatalogo`, `EditarOBorrarDelCatalogo` (reciben server actions) | Pantallas de catálogos del perfil del panel (`/sistema/especialidades`, `/sistema/organizaciones`, 2026-10-26) |

Antes de crear un componente, busca si ya existe uno equivalente. Si hace falta uno nuevo (Select, EmptyState), sigue las mismas convenciones. Para ventanas usa `<dialog>` nativo con `showModal()`, como `ui/SelectorDeTemas`.

**Ajustes para móvil:** las pantallas de `(dashboard)` ya tienen overrides `max-md:` (tamaños de texto, padding y gaps más chicos) agregados por el equipo el 2026-09-30. Al editar esas pantallas, conserva esas clases; en un conflicto de merge, toma la lógica nueva y vuelve a aplicarle los `max-md:`.

## 3. Patrones visuales de la rama

- **Chips de filtro:** `rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold`. Activo: `border-brand-600 bg-brand-600 text-white`. Inactivo: `border-system-300 bg-white text-system-600 hover:border-brand-600`. Si hay contador, va dentro en `font-mono`.
- **Cajas informativas:** `rounded-lg p-3.5` o `p-4` con `text-[12.5px]`: neutra `bg-system-100 text-system-600`, aviso `bg-warning-50 text-warning-800`, información `border-l-4 border-brand-600 bg-system-100 text-system-600` (no uses `bg-brand-50` para avisos: se confundía con un botón), error `bg-error-50 text-error-700`, éxito `border border-success-700 bg-success-50 text-success-700`.
- **Etiqueta de sección o de paso:** `font-mono text-[10.5px]` a `[12px] uppercase tracking-wide text-brand-600` o `text-system-400` (por ejemplo "Paso 1 de 4 · Tus datos", "1 · Datos básicos").
- **Enlace de regreso:** `← Volver a …` con `text-[13px] text-system-600 hover:text-system-900`, arriba del título.
- **Cabecera de página:** título `text-xl` o `text-2xl font-extrabold` + subtítulo `text-[13px] text-system-600`, con acciones a la derecha.
- **Listas de datos:** `<dl>` con filas `flex justify-between`, `dt` en `text-system-600` y `dd` en `font-medium text-system-900`.
- **Estado vacío:** `rounded-lg border border-dashed border-system-300 bg-white p-8 text-center`.
- **Fechas:** `toLocaleDateString("es-MX", …)`. Centraliza el formateo en `lib/format.ts`, porque hoy está repetido en varias páginas.

## 4. Layouts

| Grupo | Layout |
| --- | --- |
| `app/page.tsx` | `PublicHeader` + contenido centrado + `PublicFooter` |
| `(auth)` | Logo y tarjeta centrados, `max-w-md`, fondo `bg-system-50` |
| `(dashboard)` | `TopBar` arriba; `SidebarNav` a la izquierda (16rem, sticky en `lg`); contenido `max-w-7xl` con `px-4 sm:px-6 lg:px-10` |

`(dashboard)/layout.tsx` obtiene el usuario con `getSessionUser()` (redirige a `/entrar` si no hay) y se lo pasa a `TopBar` y `SidebarNav`, que muestran los elementos según `usuario.role`.

**Panel del SuperUsuario, `(panel)`:** usa su propio kit en `components/sistema/`, no el de `components/ui/`. Tiene:

- `Topbar` y `Sidebar`;
- `Button`, `Input`, `Tag`, `MetricCard` y `ProgressBar` propios;
- `Subtabs`, `GraficaDeColumnas` e iconos;
- en `ui.tsx`: `Encabezado`, `TituloDeSeccion`, `Volver`, `Aviso`, `Reparto`, `ListaClaveValor`, `Tarjeta`, `Identidad`, `MedidorDeStrikes`, `Paginacion`, `EnlaceBoton` y `formatearNumero`.

Las pantallas del panel usan solo ese kit, y las de usuario solo `components/ui/`. No los mezcles.

## 5. Móvil: lo que ya funciona y lo que falta

**Ya resuelto en la rama:**

- **Barra lateral:** por debajo de 768 px pasa a navegación horizontal con scroll (`globals.css`, clases `dashboard-*`) y oculta el bloque motivacional.
- **Grids:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **TopBar:** oculta el nombre en pantallas pequeñas.
- **Cabeceras públicas y del SuperUsuario en móvil:** `PublicHeader` permanece arriba al desplazarse; en `(panel)`, `Topbar` y la navegación horizontal de `Sidebar` quedan fijos, uno debajo del otro (`app/globals.css`).
- **Panel del SuperUsuario (2026-10-04, Gerard):** menú de Usuarios en móvil con `/usuarios?movil=menu` y las opciones móviles de `Subtabs` (`listaEnMovil`, `distribuidasEnMovil`, `volverAlMenuEnMovil`, `menuInicialMovil`); tablas del panel como tarjetas `md:hidden` + tabla en escritorio; botones de sanciones con `anchoCompleto`.
- **Filtros en fila desplazable (2026-10-05, Gerard):** los botones de filtro de `/campanas`, `/mis-aportes`, `/mis-campanas` y las categorías de `/supervision`, y las opciones de temática, estado y orden de `/explorar`, van en móvil en una sola fila con scroll horizontal (`dashboard-nav flex-nowrap overflow-x-auto`, `shrink-0 whitespace-nowrap` en cada botón y `md:flex-wrap` en escritorio). `.dashboard-nav` (`app/globals.css`) oculta la barra de scroll.

**Pendiente o por revisar:**

- **Inputs y `select` a 14 px:** iOS hace zoom al enfocar. Usa `text-base sm:text-sm` en `Input`, `Textarea` y en los `select` sueltos.
- **Tablas** (bandeja de aportes, agregar revisor): en 360 px las columnas se comprimen. Muestra tarjetas en móvil (`md:hidden`) y la tabla en `hidden md:table`, o envuelve la tabla en `overflow-x-auto`.
- **Cabeceras** `flex justify-between` con acciones o con `Input w-56`: agrega `flex-wrap` o apílalas en móvil.
- **Código de verificación:** 6 cajas `w-11` con `gap-2` miden 304 px; dentro de la tarjeta `p-8` y el contenedor `px-4`, a 360 px quedan 264 px. Reduce a `w-10 gap-1.5` en móvil o baja el padding.
- **Alturas:** `min-h-screen` y `calc(100vh - 61px)` no descuentan la barra del navegador móvil. Prefiere `min-h-dvh`.
- **Áreas táctiles:** los chips y botones `sm` miden unos 32 px de alto. En acciones frecuentes en móvil apunta a 44 px (`min-h-11`).
- **Botones de acción en fila** (`mis-campanas`): con 6 botones, `flex-wrap` funciona pero es denso. Considera un menú "Más acciones" en móvil.

## 6. Captura de fotos, audio y video

`/campanas/[id]/aportar` hoy tiene un área de "arrastrar o buscar" imagen. En el teléfono, agrega dos acciones, porque `capture` en algunos equipos oculta la galería:

```tsx
<label className="…botón secundario…">Tomar foto
  <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={onPick} />
</label>
<label className="…botón secundario…">Elegir de la galería
  <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={onPick} />
</label>
```

- **Campo de archivo de un aporte:** usa `ui/SelectorDeArchivo` (formatos y tamaños de los tipos de la campaña, `accept`, aviso al momento con `errorDeArchivo(file, tipos)`, "(opcional)" y "Quitar archivo" si la campaña acepta texto, y aviso de metadatos con video o audio). El servidor vuelve a validar con la firma real (`lib/aportes/limpiar-archivo.ts`).
- **Mostrar el archivo de un aporte:** `ui/ArchivoDelAporte` (imagen, `<video>` o `<audio>` con controles, enlace para descargar un documento o abrir un .txt, o aviso de "solo texto"). Sirve en páginas de servidor y de cliente; el "archivo borrado" lo resuelve cada pantalla antes.
- **Vista previa:** `URL.createObjectURL(file)`, liberando la URL después.
- **Audio en vivo:** `MediaRecorder` (Chrome graba `audio/webm`, Safari `audio/mp4`). Requiere HTTPS o `localhost`; como respaldo, ofrece `<input type="file" accept="audio/*">`.
- **Subida:** `FormData` con `fetch` a `POST /api/aportes` (ver `almacenamiento.md`). Si falla, conserva lo que la persona escribió.

## 7. Accesibilidad

**Objetivo: WCAG 2.2 AA.** Revisión del 2026-10-07 con axe-core 4.10 en 26 pantallas públicas, de acceso y de usuario y en 24 del panel del SuperUsuario (incluido el modo supervisor): 0 problemas después de los arreglos. También `/supervision` (sus 4 pestañas), `/supervision/campanas` y el detalle de una campaña por supervisar con un usuario supervisor. Y una campaña ya tomada por un supervisor: su panel, sus participantes, los aportes de uno y un aporte. Y como revisor: `/revisiones` (en curso y finalizadas), una campaña, dos aportes por revisar (uno con cuenta y uno anónimo) y la lista de participantes. Faltan los aportes de un participante y un aporte aceptado vistos como revisor (exigen haber aceptado uno) y una prueba con lector de pantalla real. Si una lista cambia de pestaña, pasa axe en cada pestaña: los encabezados pueden cambiar de nivel. Para revisar una pantalla nueva: en Chrome, cargar `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js` con un `<script>` y correr `axe.run(document, { runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21aa","wcag22aa","best-practice"] } })` (la portada tiene animaciones de entrada: espera a que terminen).

- **Contraste:** el texto terciario es `text-system-500` (#686c77: 4.6–5.3:1 sobre white, system-50, system-100 y brand-50). **`system-400` y más claros no van en texto** (2.6–2.9:1): solo en bordes y decoración. Íconos con significado: 3:1 como mínimo.
- **Formularios:** `Field` (de `ui/Input` y `sistema/Input`) usa `ui/CampoEtiquetado`: si su primer hijo es un control (`input`, `select`, `textarea` o un componente con `marcarComoControl`: `Input`, `Textarea`, `PasswordInput`), pone `<label htmlFor>` y conecta la pista con `aria-describedby`; si son varios controles, los agrupa (`role="group"`). **En un grupo, cada control necesita su `aria-label`** (fecha y hora de la vigencia). Un control nuevo hecho a mano: envuélvelo con `marcarComoControl`. Si un control tiene etiqueta visible, su `aria-label` debe contener ese texto (2.5.3).
- **Títulos de pestaña (2.4.2):** cada pantalla declara el suyo y queda "Título · DataForGood". Página de servidor: `export const metadata = { title: "..." }`. Página cliente: un `layout.tsx` en su carpeta con `title: tituloDeSeccion("...")` (`lib/titulo.ts`). **Los layouts usan `tituloDeSeccion`, no un texto simple:** un texto corta la plantilla para las páginas más profundas.
- **Saltar al contenido (2.4.1):** el layout raíz tiene el enlace "Saltar al contenido" (aparece con Tab) a `#contenido`. **Todo `<main>` lleva `id="contenido"`**, y todo el contenido de una página va dentro de `<main>` (no secciones sueltas fuera).
- **Objetivos táctiles (2.5.8):** botones y enlaces que no están dentro de un texto miden al menos 24×24 px (`min-h-6 min-w-6`).
- **404:** `app/not-found.tsx` (pantalla completa, con su `<main>`) para rutas que no existen; `(dashboard)/not-found.tsx` y `(panel)/not-found.tsx` (sin `<main>`, porque su layout ya lo tiene) cuando una página llama a `notFound()`. Las tres usan `ui/AvisoNoEncontrado`. Un grupo nuevo con layout propio que tenga `<main>` necesita su `not-found.tsx` sin `<main>`.
- **Tablas:** una columna de acciones lleva `<th><span className="sr-only">Acciones</span></th>`, nunca `<th />`.
- **Gráficas:** barras con `aria-label` llevan `role="img"` (si no, el `aria-label` no vale en un `div`); las del panel ya usan `role="img"` en el SVG.
- **Interruptores:** `role="switch"` + `aria-checked` + nombre.
- **Estado seleccionado:** los chips de filtro son `button` o `Link`. Agrega `aria-pressed` o `aria-current` en el activo.
- **Iconos:** los botones solo con icono llevan `aria-label` (la campana ya lo tiene) y los SVG decorativos `aria-hidden`.
- **Estructura:** un `<h1>` por página y sin saltos de nivel (si las tarjetas usan `h3`, pon un `h2` antes, aunque sea `sr-only`). Menús y `aside` con `aria-label` distinto cada uno. Respeta `prefers-reduced-motion` en animaciones nuevas.

## 8. Checklist por pantalla

- [ ] Usa las familias de color (system, brand, success, warning, error) y componentes existentes; no quedan valores de color sueltos.
- [ ] Se ve bien en 360, 768 y 1280 px, sin scroll horizontal.
- [ ] Inputs de 16 px o más en móvil; áreas táctiles razonables.
- [ ] Estados vacío, cargando (`loading.tsx`) y error.
- [ ] Sin `<Link>` anidado con `<Button>`; se puede usar solo con teclado.


## Errores de formulario (2026-10-27)

Cuando un formulario no se puede guardar, la app lo explica sin depender del navegador: `noValidate` en el `<form>` (sin globos nativos), botón de guardar siempre activo, y al intentar guardar:

- `Field` (`components/ui/Input` → `CampoEtiquetado`) acepta `error`: motivo en rojo debajo, `aria-invalid` en el control (borde rojo con la variante `aria-invalid:` de `Input`, `Textarea` y los `<select>` que la lleven) o contorno rojo si es un grupo; el motivo entra en `aria-describedby`.
- `ui/VentanaDeProblemas`: `<dialog>` con la lista de problemas; cada uno lleva a su campo (`data-campo` en el control o su contenedor) después de cerrarse.
- Se recalcula mientras se corrige. Ejemplo completo: `NuevaCampanaForm` (`problemasDe`, `errorDe`, `campoDelMensaje`, pasos con `conProblemas`).
