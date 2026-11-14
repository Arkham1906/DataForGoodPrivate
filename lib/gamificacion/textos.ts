// Diccionario de textos de gamificación (2026-11-13, a pedido del responsable): un solo lugar para cambiar lo que la
// persona lee, sin buscar en cada componente. Sin imports de servidor: lo usan componentes cliente y de servidor.
//
// Cómo se usa:
// - Una sección por pantalla o componente (mapaDeAportes, …). La fase 5 de modificaciones-sistema-previas-srs-v1.4
//   traslada aquí el resto de los textos de gamificación y los reescribe en tono amigable.
// - Texto fijo: una cadena. Texto con datos: una función que recibe los datos y devuelve la cadena; así el plural y el
//   orden de las palabras se cambian aquí también.
// - Las reglas no viven aquí: un texto puede decir «3 de 5», pero los números los calcula el código.

const nf = new Intl.NumberFormat("es-MX");
const n = (valor: number) => nf.format(valor);
const plural = (cuenta: number, uno: string, varios: string) => (cuenta === 1 ? uno : varios);

export const TEXTOS = {
  mapaDeAportes: {
    titulo: "Tu mapa de aportes",
    resumen: (campanas: number, tematicas: number, aceptados: number, enRevision: number) =>
      `${n(campanas)} ${plural(campanas, "campaña", "campañas")} en ${n(tematicas)} ${plural(tematicas, "temática", "temáticas")}, ` +
      `${n(aceptados)} ${plural(aceptados, "aporte aceptado", "aportes aceptados")}` +
      (enRevision > 0 ? ` y ${n(enRevision)} en revisión.` : "."),
    vacioTitulo: "Tu mapa todavía está vacío",
    vacioTexto: "Cada campaña en la que aportes aparecerá aquí, con un punto por cada aporte.",
    vacioIntereses: "Tus intereses",
    vacioCta: "Explorar campañas",
    vacioPie: "Tu primer aporte aceptado te lleva al rango 2.",
    centro: "Tú",

    filtrosEtiqueta: "Mostrar en el mapa",
    filtros: {
      todos: "Todos",
      excepcionales: "5★ Excepcionales",
      altos: "4★ o más",
      enRevision: "En revisión",
    },

    leyenda: {
      excepcional: "5★",
      alto: "4★",
      aceptado: "1★ a 3★",
      enRevision: "En revisión",
    },

    recorteDeCampanas: (ocultas: number) =>
      `${n(ocultas)} ${plural(ocultas, "campaña con menos aportes no cabe", "campañas con menos aportes no caben")} en el mapa. Las ves en la lista de abajo.`,
    recorteDePuntos: (ocultos: number) => `+${n(ocultos)}`,
    recorteAlAcercarse: (ocultas: number) =>
      `${n(ocultas)} ${plural(ocultas, "campaña con menos aportes no cabe", "campañas con menos aportes no caben")} aquí; están en la lista de abajo.`,

    // Panel de inspección
    recientesTipo: "Tu actividad",
    recientesTitulo: "Lo más reciente",
    recientesResumen: "Elige una temática para acercarte a sus subtemáticas y campañas, o un punto para ver ese aporte.",
    recientesResumenTelefono: "Elige una temática para ver sus subtemáticas y campañas.",
    volverARecientes: "Volver a lo más reciente",
    volverA: (nombre: string) => `Volver a ${nombre}`,

    tematicaTipo: "Temática",
    tematicaResumen: (campanas: number) =>
      `Participas en ${n(campanas)} ${plural(campanas, "campaña", "campañas")} de esta temática.`,
    tematicaListaTitulo: "Campañas",
    campanaAportes: (aportes: number) => `${n(aportes)} ${plural(aportes, "aporte", "aportes")}`,

    campanaTipo: (tematica: string, especial: number | null) =>
      `Campaña de ${tematica}${especial ? `, especial ×${n(especial)}` : ""}`,
    metaColectiva: (todos: number, meta: number, tuyos: number) =>
      `${n(todos)} de ${n(meta)} aportes aprobados entre todas las personas que participan. ${n(tuyos)} ${plural(tuyos, "es tuyo", "son tuyos")}.`,
    sinMeta: (todos: number, tuyos: number) =>
      `${n(todos)} ${plural(todos, "aporte aprobado", "aportes aprobados")} entre todas las personas que participan. ${n(tuyos)} ${plural(tuyos, "es tuyo", "son tuyos")}.`,
    barraAria: (meta: number, todos: number, tuyos: number) => `Meta ${n(meta)}, aprobados ${n(todos)}, tuyos ${n(tuyos)}`,
    barraNota: "Verde oscuro: tu parte. Verde claro: el resto de la comunidad.",
    cuotaCompleta: (bono: number) => `Completaste tu cuota: bono de ${n(bono)} EXP.`,
    cuotaAvance: (tuyos: number, cuota: number) => `Tu cuota: ${n(Math.min(tuyos, cuota))} de ${n(cuota)}.`,
    campanaListaTitulo: (cuantos: number) => `Tus ${n(cuantos)} ${plural(cuantos, "aporte", "aportes")}`,
    campanaListaFiltrada: (filtro: string, cuantos: number) => `Tus aportes ${filtro} aquí: ${n(cuantos)}`,
    campanaSinCoincidencias: "Ninguno de tus aportes en esta campaña coincide con el filtro.",
    verCampana: "Ver tus aportes en esta campaña",
    masEnLaLista: (ocultos: number) => `Y ${n(ocultos)} ${plural(ocultos, "aporte más", "aportes más")}.`,

    aporteTipo: (tipo: string, campana: string) => `${tipo} en ${campana}`,
    aporteSinDescripcion: "Aporte sin descripción",
    aporteCalificacion: "Calificación",
    aporteExp: "EXP",
    aporteEstado: "Estado",
    aporteTipoDeDato: "Tipo",
    aporteEnviado: "Enviado",
    aporteCampana: "Campaña",
    aporteCalculo: "Cálculo",
    calculoPendiente: "Se calcula cuando quien revisa lo acepte.",
    calculo: (base: number, calidad: string, factor: string | null, exp: number, motivoFactor: string) =>
      `${n(base)} base × ${calidad} por calificación${factor ? ` × ${factor} ${motivoFactor}` : ""} = ${n(exp)} EXP`,
    motivoDelFactor: (potenciador: boolean, especial: boolean) =>
      potenciador && especial ? "(potenciador y campaña especial)" : potenciador ? "(potenciador)" : especial ? "(campaña especial)" : "",
    notaAceptado: "La calificación la asigna quien revisa la campaña al aceptar el aporte. Es definitiva: no cambia después.",
    notaPendiente:
      "Mientras está en revisión puedes eliminarlo desde el detalle. Al aceptarse, la decisión y la calificación son definitivas.",
    notaRechazado: "Un aporte rechazado no recibe calificación ni EXP.",
    verDetalle: "Ver el detalle del aporte",

    filtroTipo: "Filtro",
    filtroTitulo: (nombre: string, cuantos: number) => (cuantos === 1 ? `Tu aporte ${nombre}` : `Tus aportes ${nombre}`),
    filtroResumen: (aportes: number, campanas: number) =>
      `${n(aportes)} ${plural(aportes, "aporte", "aportes")} en ${n(campanas)} ${plural(campanas, "campaña", "campañas")}. Elige uno para ver su calificación y su EXP.`,
    filtroSinCoincidencias: "Ningún aporte coincide con este filtro todavía.",
    /** Cómo se nombra cada filtro dentro de una frase («Tus aportes de 4★ o más»). */
    filtroEnFrase: {
      excepcionales: "excepcionales (5★)",
      altos: "de 4★ o más",
      enRevision: "en revisión",
    },

    telefonoCampanasTitulo: "Tus campañas",
    telefonoTematicasTitulo: "Tus temáticas",

    // Acercamiento por temática (2026-11-13)
    acercarseA: (tematica: string) => `Acercarse a ${tematica}`,
    migaGeneral: "Todas tus temáticas",
    migaVolver: "Todas las temáticas",
    migasEtiqueta: "Dónde estás en el mapa",
    escapeAyuda: "Escape regresa un nivel.",
    subtematicaOtras: "Otras",
    subtematicaSin: "Sin subtemática",
    subtematicaAria: (nombre: string) => `Subtemática ${nombre}`,
    tematicaResumenAcercada: (campanas: number, subtematicas: number, aceptados: number, enRevision: number) =>
      `${n(campanas)} ${plural(campanas, "campaña", "campañas")} en ${n(subtematicas)} ${plural(subtematicas, "subtemática", "subtemáticas")}. ` +
      `${n(aceptados)} ${plural(aceptados, "aporte aceptado", "aportes aceptados")}` +
      (enRevision > 0 ? ` y ${n(enRevision)} en revisión.` : "."),
    subtematicasTitulo: "Subtemáticas",
    reglaDeSubtematica:
      "Si una campaña tiene varias subtemáticas, aparece en la que más se repite entre tus campañas de esta temática. Las demás se ven al elegirla.",
    subtematicaTipo: (tematica: string) => `Subtemática de ${tematica}`,
    subtematicaResumen: (campanas: number) => `${n(campanas)} ${plural(campanas, "campaña tuya", "campañas tuyas")}.`,
    otrasAgrupa: (nombres: string[]) => `Agrupa: ${nombres.join(", ")}.`,
    campanasDeSubtematica: (campanas: number) => `${n(campanas)} ${plural(campanas, "campaña", "campañas")}`,
    tambienEn: "También en",
    tambienEnConLinea: (nombres: string[]) => `La línea punteada del mapa la une con ${nombres.join(", ")}.`,
    tambienEnSinLinea: "Ninguna otra de tus campañas está ahí, así que no tiene nodo en el mapa.",
    campanaTipoConSubtematica: (subtematica: string, especial: number | null) =>
      `Campaña · ${subtematica}${especial ? `, especial ×${n(especial)}` : ""}`,

    estados: {
      aceptado: "Aceptado",
      pendiente: "En revisión",
      rechazado: "Rechazado",
    },
  },
  /** Ícono de EXP con su recuadro, en el detalle de una campaña (sustituye a «N XP por aporte aprobado»). */
  expPorAporte: {
    etiqueta: "EXP",
    abrir: "Ver cuánta EXP da cada aporte en esta campaña",
    titulo: "EXP por aporte aceptado",
    rango: (minimo: number, maximo: number) => (minimo === maximo ? `${n(minimo)} EXP` : `${n(minimo)} a ${n(maximo)} EXP`),
    nota: "Depende del tipo de aporte y de la calificación que reciba, de 1★ a 5★.",
    notaPotenciador: (bonificacion: number) => `Con un potenciador activo ganas ${n(Math.round(bonificacion * 100))} % más.`,
    cargando: "Cargando…",
    error: "No pudimos cargar la EXP. Intenta de nuevo en un momento.",
  },
  /** Resumen de tu cuota en Mis aportes de una campaña. */
  cuotaDeCampana: {
    aceptados: (exp: number) => `aceptados · ${n(exp)} EXP`,
  },
  /** Distintivo de rango en Mi cuenta (A6). */
  cuenta: {
    rango: (numero: number, nombre: string) => `Rango ${n(numero)} · ${nombre}`,
    rangoAria: (numero: number, nombre: string) => `Rango ${n(numero)}, ${nombre}. Ver tu trayectoria`,
  },
  /** Lo que se pierde al eliminar la cuenta (A6). */
  baja: {
    sePierde: (rango: number, nombre: string, exp: number, medallas: number) =>
      `Al borrarse la cuenta se pierden tu rango ${n(rango)} (${nombre}), tus ${n(exp)} EXP` +
      (medallas > 0 ? `, tus ${n(medallas)} ${plural(medallas, "medalla", "medallas")}` : "") +
      " y todo tu progreso; no se pueden recuperar.",
    filaEtiqueta: "Rango y experiencia",
    filaValor: (rango: number, exp: number) => `Rango ${n(rango)} y ${n(exp)} EXP se pierden`,
  },
} as const;
