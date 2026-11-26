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
/** Multiplicadores y factores con al menos un decimal, como en el SRS: ×1.0, ×1.25, ×2.0. */
const nfDecimal = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const d = (valor: number) => nfDecimal.format(valor);
const plural = (cuenta: number, uno: string, varios: string) => (cuenta === 1 ? uno : varios);

/** Medallas: unidad de cada medida (campo `mide` del catálogo), en singular y plural. */
const UNIDADES_DE_MEDALLA: Record<string, readonly [string, string]> = {
  aportes_aceptados: ["aporte aceptado", "aportes aceptados"],
  aportes_excepcionales: ["aporte de 5★", "aportes de 5★"],
  racha_maxima: ["día de racha máxima", "días de racha máxima"],
  campanas_completadas: ["campaña completada", "campañas completadas"],
  campanas_distintas: ["campaña distinta", "campañas distintas"],
  exp_total: ["EXP", "EXP"],
  tipos_distintos: ["tipo de dato", "tipos de dato"],
  aceptados_consecutivos: ["aceptado seguido", "aceptados seguidos"],
  rachas_recuperadas: ["racha reavivada", "rachas reavivadas"],
  aportes_en_potenciador: ["aporte en un potenciador", "aportes en un potenciador"],
  tematicas_distintas: ["temática distinta", "temáticas distintas"],
};

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
    rangoAria: (numero: number, nombre: string) => `Rango ${n(numero)}, ${nombre}. Ver tu progreso`,
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
  /** Pestaña Historial de EXP de Mi progreso (2026-11-14; lienzo aprobado el mismo día). */
  historialDeExp: {
    titulo: "Historial de EXP",
    intro: "Cada EXP que ganaste, de dónde vino y cómo se calculó. Solo tú ves esta información.",
    total: "EXP acumulada",
    /** Lo que pide completar el rango actual (presentación del 2026-11-22). */
    siguiente: (rango: number, meta: number, faltan: number) =>
      faltan > 0
        ? `Completar tu rango ${n(rango)} pide ${n(meta)} EXP: ${plural(faltan, "te falta", "te faltan")} ${n(faltan)}.`
        : `Ya tienes la EXP para completar tu rango ${n(rango)}.`,
    desgloseEtiqueta: "De dónde viene tu EXP",
    desglose: {
      aportes: "Aportes aceptados",
      misiones: "Misiones",
      bonos: "Bonos de cuota",
      descuentos: "Descuentos por reporte",
      ajustes: "Ajustes",
    },
    movimientos: "Movimientos",
    filtrosEtiqueta: "Filtrar movimientos",
    filtros: { todos: "Todos", aporte: "Aportes", mision: "Misiones", bono: "Bonos", descuento: "Descuentos" },
    enCamino: (cuantos: number) =>
      `${n(cuantos)} ${plural(cuantos, "aporte aceptado", "aportes aceptados")} con EXP en camino.`,
    enCaminoDetalle: "Aparecerá aquí en uno o dos minutos.",

    tipos: {
      aporte: "Aporte aceptado",
      mision: "Misión",
      bono: "Bono de cuota",
      descuento: "Descuento por reporte",
      ajuste: "Ajuste de EXP",
    },
    periodicidad: (periodicidad: string) =>
      periodicidad === "diaria"
        ? "Misión diaria"
        : periodicidad === "semanal"
          ? "Misión semanal"
          : periodicidad === "inicio"
            ? "Misión de tu primera semana"
            : "Misión",
    tituloAporte: (tipo: string | null, estrellas: number, nombre: string) =>
      `${tipo ? `${tipo} · ` : ""}${n(estrellas)}★ ${nombre}`,
    tituloAporteSinDatos: "Aporte aceptado",
    tituloBono: (cuota: number) => `Completaste la cuota de ${n(cuota)} ${plural(cuota, "aporte", "aportes")}`,
    tituloBonoSinDatos: "Completaste la cuota de una campaña",
    tituloDescuento: "Se descontó un aporte reportado",
    tituloAjuste: "Ajuste de EXP",
    campanaBorrada: "Campaña que ya no existe",
    hoy: "Hoy",
    ayer: "Ayer",
    expAria: (exp: number) => (exp < 0 ? `Se descontaron ${n(-exp)} EXP` : `Ganaste ${n(exp)} EXP`),
    totalDelDiaAria: (exp: number) => `Total del día: ${exp < 0 ? "menos " : ""}${n(Math.abs(exp))} EXP`,

    detalle: {
      calculo: "Cálculo",
      factor: "Factor",
      enviado: "Enviado",
      recompensa: "Recompensa",
      periodo: "Periodo",
      limites: "Límites",
      motivo: "Motivo",
      devuelve: "Devuelve",
    },
    /** «20 base × 1.75 por calificación = 35 EXP»; con factor y redondeo, «… × 1.5 de factor = 67.5 → 68 EXP». */
    calculoAporte: (base: number, multCalidad: number, factor: number, sinRedondear: number, exp: number) =>
      `${n(base)} base × ${d(multCalidad)} por calificación` +
      (factor !== 1 ? ` × ${d(factor)} de factor` : "") +
      (sinRedondear !== exp ? ` = ${n(sinRedondear)} → ${n(exp)} EXP` : ` = ${n(exp)} EXP`),
    factorAporte: (potenciador: number, multCampana: number) =>
      "1" +
      (potenciador > 0 ? ` + ${d(potenciador)} del potenciador que tenías activo al enviar` : "") +
      (multCampana !== 1 ? ` + ${d(multCampana - 1)} del multiplicador de la campaña` : ""),
    calculoBono: (porcentaje: number, referencia: number, sinLimites: number, exp: number) =>
      `${n(porcentaje)} % de ${n(referencia)} EXP de referencia = ` +
      (sinLimites === exp ? `${n(exp)} EXP` : `${n(sinLimites)} → ${n(exp)} EXP`),
    limitesBono: (minimo: number, maximo: number) => `Mínimo ${n(minimo)}, máximo ${n(maximo)}`,
    notaBono: (cuota: number) =>
      `La referencia es base × calificación de esos ${n(cuota)} ${plural(cuota, "aporte", "aportes")}, sin potenciador. Se da una sola vez por campaña.`,
    recompensaMision: (exp: number) => `${n(exp)} EXP fijos de la misión`,
    notaMision: "Las misiones suman a tu EXP, pero no cuentan como aportes ni como calificación.",
    motivoDescuento: (tipo: string | null, aceptadoEl: string | null) =>
      `Un reporte rechazó ${tipo ? `tu aporte de ${tipo.toLowerCase()}` : "un aporte tuyo"}` +
      (aceptadoEl ? ` que se aceptó el ${aceptadoEl}.` : "."),
    devuelve: (exp: number) => `Los ${n(exp)} EXP que sumó ese aporte`,
    notaDescuento: "Tu rango, tus medallas y las misiones que ya completaste no cambian.",
    marcaDescontado: (fecha: string) => `Descontado el ${fecha}`,
    notaDescontado: (fecha: string) => `Un reporte descontó esta EXP el ${fecha}. Este movimiento se conserva tal como fue.`,
    verAporte: "Ver el aporte",
    verOriginal: "Ver el movimiento original",
    verDescuento: "Ver el descuento",

    cargando: "Cargando movimientos…",
    primerMovimiento: "Este es tu primer movimiento de EXP.",
    paginacionEtiqueta: "Páginas de movimientos",
    paginaAnterior: "Página anterior",
    paginaSiguiente: "Página siguiente",
    irAPagina: (pagina: number) => `Página ${n(pagina)}`,
    rangoDePagina: (desde: number, hasta: number, total: number) =>
      `${n(desde)}–${n(hasta)} de ${n(total)} ${plural(total, "movimiento", "movimientos")}`,
    vacioFiltro: "Todavía no tienes movimientos de este tipo.",
    errorPagina: "No se pudieron cargar los movimientos.",
    reintentar: "Intentar de nuevo",
    pie: "Los movimientos no se borran ni se modifican. Un descuento se registra como un movimiento nuevo y el original se conserva.",

    vacioTitulo: "Aquí verás cada EXP que ganes",
    vacioTexto:
      "Tu primer aporte aceptado te da EXP y te lleva al rango 2. Las misiones y los bonos de cuota también aparecerán aquí.",
    vacioCta: "Explorar campañas",
    error: "Todavía no podemos mostrar tu historial de EXP. Intenta de nuevo en unos minutos.",
    cargandoPagina: "Cargando tu historial de EXP…",

    comoTitulo: "Cómo se calcula",
    comoFormula: "EXP = base del tipo × calificación × factor",
    comoRedondeo: ", redondeado al entero más cercano.",
    comoBase: (base: number) => `${n(base)} base`,
    comoTiposEtiqueta: "EXP base por tipo de aporte",
    comoCalificacionesEtiqueta: "Multiplicador por calificación",
    comoMultiplicador: (multiplicador: number) => `×${d(multiplicador)}`,
    comoPotenciador: (bonificacion: number) => `Un potenciador activo cuando envías suma +${d(bonificacion)} al factor.`,
    comoBono: (porcentaje: number, cuotaMinima: number, minimo: number, maximo: number) =>
      `Al completar la cuota de una campaña (de ${n(cuotaMinima)} aportes o más) recibes un bono del ${n(porcentaje)} % de la EXP de esos aportes, sin potenciador (mínimo ${n(minimo)}, máximo ${n(maximo)}).`,
    comoMisiones: "Las misiones dan una cantidad fija de EXP.",
    comoDescuento: "Si un reporte rechaza un aporte aceptado, se descuenta su EXP. Tu rango y tus medallas no cambian.",
    comoPie: "Valores vigentes de la plataforma. Si cambian, lo ya ganado no se recalcula.",
  },
  /** Pestaña Medallas de Mi progreso (2026-11-15; lienzo aprobado el mismo día). */
  medallas: {
    titulo: "Medallas",
    intro: "Evolucionan cuando crece lo que miden. No dan EXP ni cuentan para tu rango, y un nivel alcanzado es tuyo para siempre.",
    introNueva: "Tu primer aporte aceptado empieza a llenar varias a la vez.",
    conNivel: "medallas con nivel",
    niveles: "niveles desbloqueados",
    deTotal: (total: number) => ` de ${n(total)}`,
    cerca: "Más cerca de subir",
    faltanPara: (faltan: number, nivel: string) => `Faltan ${n(faltan)} para ${nivel}`,
    grupos: { hitos: "Medallas de hitos", adicionales: "Medallas adicionales" } as Record<string, string>,
    resumenDeGrupo: (con: number, total: number) => `${n(con)} de ${n(total)} con nivel`,

    sinNivel: "Sin desbloquear",
    /** «Arbusto · nivel 3 de 5»; si el nivel no tiene nombre propio («Nivel 3»), solo «Nivel 3 de 5». */
    nivelDe: (nombre: string, nivel: number, total: number) =>
      /^nivel \d+$/i.test(nombre.trim()) ? `Nivel ${n(nivel)} de ${n(total)}` : `${nombre} · nivel ${n(nivel)} de ${n(total)}`,
    nivelMaximo: (nombre: string) => `Nivel máximo · ${nombre}`,
    para: (nivel: string) => `Para ${nivel}`,
    completa: "Completaste todos sus niveles",
    avance: (valor: number, meta: number) => `${n(valor)} de ${n(meta)}`,
    tarjetaAria: (nombre: string, estado: string, siguiente: string, avance: string) =>
      `${nombre}, ${estado}. ${siguiente}: ${avance}. Abre su ficha.`,

    fichaPosicion: (posicion: number, total: number) => `${n(posicion)} de ${n(total)}`,
    anterior: (nombre: string) => `Ver la medalla anterior: ${nombre}`,
    siguiente: (nombre: string) => `Ver la medalla siguiente: ${nombre}`,
    cerrar: "Cerrar",
    valorHoy: (unidad: string, faltan: number | null, nivel: string | null) =>
      `${unidad}.` + (faltan !== null && nivel ? ` Faltan ${n(faltan)} para ${nivel}.` : " Ya tienes todos sus niveles."),
    nivelesTitulo: "Niveles",
    umbral: (valor: number, unidad: string) => `${n(valor)} ${unidad}`,
    alcanzadoEl: (fecha: string) => `Alcanzado el ${fecha}`,
    alcanzado: "Alcanzado",
    porAlcanzar: "Por alcanzar",
    permanencia: "No perderas nunca un nivel de medalla una vez obtenido",
    notas: {
      aceptados_consecutivos:
        "Cuenta tu mejor secuencia de aportes aceptados seguidos, ordenados por hora de envío. Si un rechazo llega tarde la cifra puede bajar, pero el nivel que ya alcanzaste se queda.",
    } as Record<string, string>,
    /** Unidad de lo que mide cada medalla, en singular o plural (campo `mide` del catálogo); "" si no la conoce. */
    unidad: (mide: string | null, cantidad: number): string => {
      const u = mide ? UNIDADES_DE_MEDALLA[mide] : undefined;
      return u ? plural(cantidad, u[0], u[1]) : "";
    },

    error: "Todavía no podemos mostrar tus medallas. Intenta de nuevo en unos minutos.",
    cargando: "Cargando tus medallas…",
  },
  /** Misiones de inicio en /progreso/misiones (2026-11-18; SRS v1.4: RF-GAM-103). */
  misionesDeInicio: {
    titulo: "Tu primera semana",
    plazo: "Terminan en",
    filtro: "Primera semana",
    nombreDelPeriodo: "Primera semana",
    comoCuentan:
      "Durante tus primeros 7 días tienes también las misiones de tu primera semana. Salen una sola vez y, al terminar la semana, las que no completaste desaparecen.",
  },

  /**
   * Tarjetas de misión (2026-11-19; SRS v1.4: RF-GAM-43, 122; lienzo aprobado el mismo día): cuándo cuenta, la etiqueta
   * de las difíciles y la recompensa.
   */
  misiones: {
    /** Cuándo empiezan y terminan los periodos: de calendario en hora de Tepic, como la racha. */
    periodos: "Las misiones diarias cambian a las 00:00 y las semanales cada lunes a las 00:00, hora de Tepic, igual que tu racha.",
    cuenta: {
      envio: "Cuenta al enviar, aunque no lo acepten",
      aceptacion: "Cuenta cuando lo aceptan, en el periodo en que lo enviaste",
    },
    dificil: "Difícil",
    /** «+20 EXP» o «1 protector». */
    recompensa: (texto: string) => (texto.endsWith("EXP") ? `+${texto}` : texto),
    recibiste: (texto: string) => `Recibiste ${texto.endsWith("EXP") ? `+${texto}` : texto}`,
    /** Notificación al completarla: «recibiste 20 EXP», «ganaste 1 protector». */
    ganaste: (texto: string) => (texto.endsWith("EXP") ? `recibiste ${texto}` : `ganaste ${texto}`),
    comoCuentan: [
      "Las misiones «Envía…» cuentan al enviar el aporte, aunque después no lo acepten.",
      "Las misiones «Logra…» cuentan cuando aceptan el aporte, en el periodo en que lo enviaste.",
      "Cada semana puede salir una misión difícil. Da un protector o un potenciador en lugar de EXP; la tarjeta dice cuál.",
    ] as readonly string[],
  },

  /**
   * Protectores y potenciadores ganados en misiones (2026-11-19; lienzo de misiones aprobado el mismo día): la ventana
   * «ya tienes el máximo» y lo que dice la tarjeta de la misión según qué pasó con el objeto.
   */
  inventario: {
    nombre: (objeto: "protector" | "potenciador") => `1 ${objeto}`,
    completada: (mision: string) => `Misión completada: ${mision}`,
    tituloLleno: (objeto: "protector" | "potenciador") => (objeto === "protector" ? "Ya tienes 3 protectores" : "Ya tienes 4 potenciadores"),
    tituloAmbos: "Tu inventario está lleno",
    tienes: (objeto: "protector" | "potenciador", protectores: number, activo: boolean, enEspera: number) =>
      objeto === "protector"
        ? `Tus protectores: ${n(protectores)} de 3`
        : `Tus potenciadores: ${activo ? "1 activo y " : ""}${n(enEspera)} en espera`,
    tienesAmbos: (protectores: number, potenciadores: number) => `${n(protectores)} protectores y ${n(potenciadores)} potenciadores`,
    noCabe: (objeto: "protector" | "potenciador", alternativa: "protector" | "potenciador") =>
      `Es lo máximo que puedes ${objeto === "protector" ? "guardar" : "tener"}, así que este ${objeto} no cabe. ¿Lo cambias por un ${alternativa}?`,
    noCabeAmbos: (objeto: "protector" | "potenciador") =>
      `Tienes el máximo de protectores y de potenciadores, así que este ${objeto} no cabe y se pierde. Cuando uses alguno, podrás guardar los que ganes después.`,
    explica: {
      protector: "Cubre un día sin aportes para que tu racha no se rompa. Puedes guardar hasta 3.",
      potenciador: "Suma +0.5 a la EXP de los aportes que envíes durante 15 minutos. Empieza solo, o espera su turno si ya tienes uno activo.",
    },
    nota: (objeto: "protector" | "potenciador") =>
      `Con «No, gracias» el ${objeto} se pierde. Si cierras la ventana, te lo preguntamos en tu siguiente visita.`,
    cambiar: (alternativa: "protector" | "potenciador") => `Cambiar por un ${alternativa}`,
    noGracias: "No, gracias",
    entendido: "Entendido",
    perdidoTitulo: (objeto: "protector" | "potenciador") => (objeto === "protector" ? "Un protector no cupo" : "Un potenciador no cupo"),
    perdidoMensaje: (objeto: "protector" | "potenciador") =>
      `Tenías el máximo y el ${objeto} de tu misión se perdió. Lo que ya tenías sigue igual.`,
    /** Aviso cuando un protector cubre un día sin aportes (2026-11-20, RF-GAM-28, 61). */
    protectorUsadoTitulo: "Un protector cuidó tu racha",
    protectorUsadoMensaje: (dia: string, racha: number, quedan: number) =>
      `Cubrió el ${new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} y tu racha sigue en ${n(racha)} ${racha === 1 ? "día" : "días"}. ${quedan === 0 ? "Ya no te quedan protectores." : `Te ${quedan === 1 ? "queda 1 protector" : `quedan ${n(quedan)} protectores`}.`}`,
    /** Fila de protectores en la racha de Inicio y en el calendario. */
    protectores: (cuantos: number, maximo: number) => `Protectores: ${n(cuantos)} de ${n(maximo)}`,
    /** Tarjeta de la misión completada, según qué pasó con su objeto. */
    /** Celebración del objeto que entró al inventario. */
    ganado: {
      eyebrow: "Recompensa de tu misión difícil",
      eyebrowAlVolver: "Mientras no estabas",
      titulo: (objeto: "protector" | "potenciador") => (objeto === "protector" ? "¡Ganaste un protector!" : "¡Ganaste un potenciador!"),
      enEspera: (cuantos: number, maximo: number) => `En espera: ${n(cuantos)} de ${n(maximo)}`,
      activo: "Ya está activo.",
      activoAlVolver: "Lo ganaste cuando aceptaron tu aporte y se activó al volver.",
      dondeVerlo: "Lo verás en el menú lateral (en tu teléfono, en la burbuja) mientras dure.",
      espera: (reloj: string | null) =>
        reloj ? `Empieza solo cuando termine el que tienes activo (quedan ${reloj}).` : "Empieza solo cuando termine el que tienes activo.",
      usado: "Ya se usó: estuvo activo mientras no estabas.",
      protectorSolo: "Se usa solo, sin que hagas nada, el día que no envíes aportes.",
    },
    tarjeta: {
      pendiente: (texto: string) => `${texto} · por decidir: tu inventario está lleno`,
      cambiada: (texto: string) => `Recibiste ${texto} a cambio`,
      perdida: (texto: string) => `${texto} · no cupo`,
    },
  },

  /** Potenciador en el menú lateral y en la burbuja de teléfono*/
  potenciadorFlotante: {
    titulo: "Potenciador activo",
    suma: (bonificacion: number) => `+${d(bonificacion)} a lo que envíes ahora.`,
    enEspera: (cuantos: number) => (cuantos === 1 ? "1 más en espera." : `${n(cuantos)} más en espera.`),
    reloj: (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`,
    quedan: (segundos: number) => {
      const min = Math.floor(segundos / 60);
      const seg = segundos % 60;
      return `Quedan ${n(min)} ${min === 1 ? "minuto" : "minutos"} y ${n(seg)} ${seg === 1 ? "segundo" : "segundos"}`;
    },
    burbuja: (segundos: number) =>
      `Potenciador activo. Quedan ${n(Math.floor(segundos / 60))} min ${n(segundos % 60)} s. Toca para ver el detalle.`,
    mover: "Mantén presionada la burbuja y arrástrala para moverla.",
    cerrar: "Cerrar",
  },

  /** Pestaña Resumen de «Mi progreso» (2026-11-23; lienzo «Resumen e Inicio compacto», aprobado el mismo día). */
  resumen: {
    rango: (actual: number, total: number) => `Rango ${n(actual)} de ${n(total)}`,
    etapa: (etapa: number) => `Etapa ${n(etapa)} de tu avatar`,
    paraCompletar: "Para completar tu rango",
    requisitos: (cumplidos: number, total: number) => `${n(cumplidos)} de ${n(total)} requisitos`,
    luegoPasas: (numero: number) => `Luego pasas al rango ${n(numero)}.`,
    ultimoRango: "Llegaste al último rango: completaste la trayectoria. Es permanente.",
    verProgreso: "Ver tu progreso",
    cifras: {
      exp: "EXP total",
      racha: "Racha",
      dias: (dias: number) => (dias === 0 ? "Sin racha" : `${n(dias)} ${dias === 1 ? "día" : "días"}`),
      maxima: (dias: number) => `Máxima: ${n(dias)} ${dias === 1 ? "día" : "días"}`,
      misiones: "Misiones completadas",
      medallas: "Medallas con nivel",
      deTotal: (valor: number, total: number) => `${n(valor)} de ${n(total)}`,
      historial: "Historial",
      verMisiones: "Misiones",
      verMedallas: "Medallas",
    },
    misiones: {
      titulo: "Misiones",
      /** Subtítulo: el Resumen muestra solo las más cerca de completarse (2026-11-23). */
      masCerca: (cuantas: number) => (cuantas === 1 ? "La más cerca de completarse" : `Las ${n(cuantas)} más cerca de completarse`),
      cuenta: (hoy: number, totalHoy: number, semana: number, totalSemana: number) =>
        `Hoy ${n(hoy)} de ${n(totalHoy)} · Esta semana ${n(semana)} de ${n(totalSemana)}`,
      diaria: "Diaria",
      semanal: "Semanal",
      terminaEn: (tiempo: string) => `Termina en ${tiempo}`,
      sinMisiones: "Por ahora no tienes misiones.",
      todasCompletas: "Completaste todas tus misiones de hoy y de esta semana.",
      avance: (progreso: number, objetivo: number) => `${n(progreso)} de ${n(objetivo)}`,
      completada: "Completada",
      dificil: "Difícil",
      verTodas: "Ver todas tus misiones →",
    },
    exp: {
      titulo: "EXP reciente",
      vacio: "Aún no tienes movimientos de EXP. Llegan cuando se acepta un aporte o completas una misión.",
      verHistorial: "Ver historial de EXP →",
    },
    error: (que: string) => `Todavía no podemos mostrar ${que}. Intenta de nuevo en unos minutos.`,
  },

  /** Celebraciones de rango, medalla y racha (2026-11-16; lienzo aprobado el mismo día). Reconocen, no presionan (RF-GAM-62). */
  celebraciones: {
    paso: (actual: number, total: number) => `${n(actual)} de ${n(total)}`,
    cerrar: "Cerrar",
    continuar: "Continuar",
    listo: "Listo",
    /** Botón que pasa al siguiente paso de la cola. */
    siguiente: { racha: "Siguiente: tu racha", rango: "Siguiente: tu nuevo rango", objeto: "Siguiente: tu recompensa", medallas: (cuantas: number, primera: string) => (cuantas === 1 ? `Siguiente: ${primera}` : `Siguiente: ${n(cuantas)} medallas`) },

    rangoEyebrow: (numero: number, total: number) => `Nuevo rango · ${n(numero)} de ${n(total)}`,
    rangosEyebrow: (cuantos: number, numero: number, total: number) => `Subiste ${n(cuantos)} rangos · ${n(numero)} de ${n(total)}`,
    rangoTexto: "Es tuyo para siempre: no se pierde por inactividad ni por perder la racha.",
    rangosTexto: (numero: number) => `Llegaste al rango ${n(numero)}. Todos son tuyos para siempre.`,
    intermedio: (numero: number, nombre: string) => `También pasaste por el rango ${n(numero)} · ${nombre}`,
    intermedioDetalle: "Se alcanzaron juntos.",
    etapa: (etapa: number) => `Etapa ${n(etapa)} de tu avatar`,
    etapaDetalle: "Tu avatar evolucionó y no retrocede.",
    insignia: (rango: number) => `Insignia del rango ${n(rango)}`,
    insigniaDetalle: "Ya está en tu trayectoria.",
    coleccionable: (nombre: string) => `Coleccionable: ${nombre}`,
    coleccionableDetalle: "Ya está en tu inventario.",
    revelado: (numero: number, nombre: string) => `Se reveló el rango ${n(numero)} · ${nombre}`,
    reveladoDetalle: (avistado: number | null) =>
      "Es al que pasas cuando completes tu nuevo rango." + (avistado ? ` Y avistaste el ${n(avistado)}.` : ""),
    ultimoRango: "Completaste la trayectoria",
    ultimoRangoDetalle: "Es el último rango. Nadie te lo quita.",
    verTrayectoria: "Ver tu progreso",

    medallaEyebrow: "Nuevo nivel de medalla",
    medallaPrimera: "Tu primer nivel de esta medalla",
    medallaSalto: (cuantos: number) => `Subiste ${n(cuantos)} niveles de una vez`,
    medallaFuego: "Tu racha alimentó una medalla",
    medallasEyebrow: "Nuevos niveles de medalla",
    medallasTitulo: (cuantas: number) => `Subiste en ${n(cuantas)} medallas`,
    pasastePor: (nombres: readonly string[]) => `Pasaste por ${nombres.join(", ")}.`,
    medallaNota: "Las medallas no dan EXP ni cuentan para tu rango. Un nivel alcanzado no se pierde.",
    verMedallas: "Ver tus medallas",

    racha: {
      alarga: { titulo: (dias: number) => `¡Racha de ${n(dias)} días!`, texto: "Tu primer aporte de hoy la mantuvo encendida." },
      empieza: { titulo: () => "Encendiste tu racha", texto: "Cada día con al menos un aporte la hace crecer." },
      reaviva: { titulo: () => "Reavivaste tu racha", texto: "Volvió a encenderse. Tu rango y tus medallas siguieron intactos." },
    },
    numeroDeRacha: (dias: number) => `${n(dias)} ${plural(dias, "día", "días")} de racha.`,
    semana: "Últimos 7 días",
    /** Inicial de cada día, de domingo a sábado (Date.getUTCDay). */
    inicialesDeDias: ["D", "L", "M", "M", "J", "V", "S"] as readonly string[],
    nombresDeDias: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as readonly string[],
    dia: (nombre: string, conAporte: boolean, hoy: boolean) =>
      `${hoy ? "Hoy" : nombre[0].toUpperCase() + nombre.slice(1)}, ${conAporte ? "con aporte" : "sin aporte"}`,
    diaProtegido: (nombre: string) => `${nombre[0].toUpperCase() + nombre.slice(1)}, cubierto con protector`,
  },
} as const;
