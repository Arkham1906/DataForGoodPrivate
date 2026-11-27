// Diccionario de textos de gamificación: un solo lugar para cambiar lo que la persona lee, sin buscar en cada
// componente. Sin imports de servidor: lo usan componentes cliente y de servidor.
//
// Cómo se usa:
// - Una sección por pantalla o componente (mapaDeAportes, …). `ayudas` reúne las explicaciones de los íconos de
//   información: una por concepto, la misma en todas las pantallas.
// - Texto fijo: una cadena. Texto con datos: una función que recibe los datos y devuelve la cadena; así el plural y el
//   orden de las palabras se cambian aquí también.
// - Las reglas no viven aquí: un texto puede decir «3 de 5», pero los números los calcula el código.
//
// Cómo se escribe (guía de tono, RNF-GAM-15): frases cortas, primero lo que la persona gana o tiene que hacer, sin
// palabras internas (factor, periodo, base, cuota, trayectoria). Tres ideas viven solo en su ayuda y no se repiten en
// otros textos: que la racha no espera a que acepten el aporte (ayudas.racha), que un rango no se pierde
// (ayudas.rango) y que un nivel de medalla no se pierde (ayudas.medallas).

const nf = new Intl.NumberFormat("es-MX");
const n = (valor: number) => nf.format(valor);
/** Multiplicadores y factores con al menos un decimal, como en el SRS: ×1.0, ×1.25, ×2.0. */
const nfDecimal = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const d = (valor: number) => nfDecimal.format(valor);
const plural = (cuenta: number, uno: string, varios: string) => (cuenta === 1 ? uno : varios);
/** +0.5 → «50 %». */
const pct = (bonificacion: number) => `${n(Math.round(bonificacion * 100))} %`;

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
  multimedia_en_su_enfoque: ["foto, video o audio aceptado", "fotos, videos o audios aceptados"],
  textos_descritos_en_su_enfoque: ["texto o documento bien descrito", "textos o documentos bien descritos"],
  campanas_pioneras_en_su_enfoque: ["campaña pionera", "campañas pioneras"],
  logros_de_enfoque: ["logro de enfoque", "logros de enfoque"],
};

/**
 * Logros: la siguiente meta de cada medida, dicha como una acción («Logra 15 aportes aceptados»), al estilo de los logros
 * de Duolingo. La clave es el campo `mide` del catálogo; una medida sin entrada usa la unidad («15 aportes aceptados»).
 */
const META_DE_LOGRO: Record<string, (meta: number) => string> = {
  aportes_aceptados: (m) => `Logra ${n(m)} ${plural(m, "aporte aceptado", "aportes aceptados")}`,
  aportes_excepcionales: (m) => `Consigue ${n(m)} ${plural(m, "aporte", "aportes")} de 5★`,
  racha_maxima: (m) => `Llega a una racha de ${n(m)} ${plural(m, "día", "días")}`,
  campanas_completadas: (m) => `Completa la meta de aportes de ${n(m)} ${plural(m, "campaña", "campañas")}`,
  campanas_distintas: (m) => `Logra un aporte aceptado en ${n(m)} ${plural(m, "campaña", "campañas distintas")}`,
  exp_total: (m) => `Gana ${n(m)} EXP`,
  tipos_distintos: (m) => `Logra aportes aceptados de ${n(m)} tipos de dato distintos`,
  aceptados_consecutivos: (m) => `Logra ${n(m)} aportes aceptados seguidos, sin un rechazo`,
  rachas_recuperadas: (m) => `Reaviva tu racha ${n(m)} ${plural(m, "vez", "veces")}`,
  aportes_en_potenciador: (m) => `Logra ${n(m)} aportes aceptados enviados con un mismo potenciador`,
  tematicas_distintas: (m) => `Logra un aporte aceptado en ${n(m)} ${plural(m, "temática", "temáticas distintas")}`,
  multimedia_en_su_enfoque: (m) => `Logra ${n(m)} ${plural(m, "foto, video o audio aceptado", "fotos, videos o audios aceptados")}`,
  textos_descritos_en_su_enfoque: (m) =>
    `Logra ${n(m)} ${plural(m, "texto o documento aceptado", "textos o documentos aceptados")} con descripción de 120 caracteres o más`,
  campanas_pioneras_en_su_enfoque: (m) =>
    `Queda entre los 10 primeros aportes aceptados de ${n(m)} ${plural(m, "campaña", "campañas")}`,
  logros_de_enfoque: () => "Llega al primer nivel de los tres logros de enfoque",
};

export const TEXTOS = {
  /** Íconos de información (AyudaEmergente): la etiqueta la lee el lector de pantalla; el texto aparece al abrirlo. */
  ayudas: {
    exp: {
      etiqueta: "Qué es la EXP",
      texto: "Son tus puntos de experiencia. Los ganas cuando aceptan tus aportes y cuando completas misiones. Con ellos subes de rango.",
    },
    rango: {
      etiqueta: "Qué es un rango",
      texto: "Es tu nivel en la plataforma. Hay 20. Subes cuando cumples todo lo que pide tu rango. Un rango que alcanzas no se pierde.",
    },
    racha: {
      etiqueta: "Qué es la racha",
      texto:
        "Son los días seguidos en que envías al menos un aporte. El día cuenta desde que envías el aporte: no tienes que esperar a que lo acepten. Si un día no envías nada, vuelve a cero, salvo que tengas un protector.",
    },
    rachaMaxima: {
      etiqueta: "Qué es la racha máxima",
      texto: "Es tu racha más larga. Es la que piden los rangos y el logro Llama Constante.",
    },
    protector: {
      etiqueta: "Qué es un protector",
      texto: "Cuida tu racha un día que no envíes aportes. Se usa solo. Puedes tener hasta 3 y los ganas en algunas misiones semanales difíciles.",
    },
    potenciador: {
      etiqueta: "Qué es un potenciador",
      texto:
        "Durante 15 minutos, los aportes que envíes ganan 50 % más EXP cuando los acepten. Se activa solo cuando estás en la plataforma. Los ganas en algunas misiones semanales difíciles.",
    },
    estrellas: {
      etiqueta: "Qué significan las estrellas",
      texto: "Quien revisa tu aporte le pone de 1 a 5 estrellas al aceptarlo. Más estrellas, más EXP. Una vez puestas, no cambian.",
    },
    dificil: {
      etiqueta: "Qué es una misión difícil",
      texto: "Algunas semanas sale una misión más difícil. En lugar de EXP te da un protector o un potenciador; la tarjeta te dice cuál.",
    },
    medallas: {
      etiqueta: "Cómo funcionan los logros",
      texto:
        "Suben de nivel con lo que haces en la plataforma, por ejemplo, con tus aportes aceptados. No dan EXP ni te suben de rango. Un nivel que consigues es tuyo para siempre.",
    },
    nombreOculto: {
      etiqueta: "Por qué no veo su nombre",
      texto: "Ves el nombre y lo que da un rango cuando es el siguiente. Del que sigue después ves una pista.",
    },
    cambioDeMisiones: {
      etiqueta: "Cuándo cambian las misiones",
      texto: "Las diarias cambian cada día a medianoche. Las semanales, cada lunes a medianoche.",
    },
    movimientos: {
      etiqueta: "Cómo se guardan tus movimientos",
      texto: "Aquí nada se borra. Si se descuenta EXP, aparece como un movimiento nuevo.",
    },
    subtematicas: {
      etiqueta: "Dónde aparece cada campaña",
      texto: "Si una campaña tiene varias subtemáticas, aparece en la que más se repite entre tus campañas. Las demás se ven al elegirla.",
    },
    lideresPorRango: {
      etiqueta: "Cómo se ordena por rango",
      texto: "Ordena por rango. Si dos personas tienen el mismo rango, va primero quien tiene más EXP.",
    },    enfoque: {
      etiqueta: "Qué es el enfoque",
      texto:
        "Tu enfoque dice cómo te gusta aportar. No es tu especialidad (a qué te dedicas o qué estudias). Cambia el estilo de tu avatar, algunos mensajes y te da un logro propio. No cambia la EXP que ganas ni las campañas en las que puedes aportar. Puedes cambiarlo una vez cada 7 días.",
    },
  },

  /** Encabezado de «Mi progreso». */
  progreso: {
    encabezado: "Lo que has logrado al aportar.",
    error: "Todavía no podemos mostrar tu progreso. Intenta de nuevo en unos minutos.",
  },

  /** Bloque de progreso de Inicio cuando no hay datos. */
  inicio: {
    sinProgreso: "Tu rango, tus misiones y tu racha están en Mi progreso.",
  },

  /** Racha: tarjeta de los últimos 7 días y calendario. */
  racha: {
    titulo: "Días de racha",
    sinRacha: "Sin racha",
    dias: (dias: number) => `${n(dias)} ${plural(dias, "día", "días")}`,
    maxima: (dias: number) => `Máxima: ${n(dias)} ${plural(dias, "día", "días")}.`,
    dia: {
      confirmado: "Enviaste al menos un aporte. Este día cuenta para tu racha.",
      protegido: "Un protector cuidó tu racha. Este día no suma, pero tu racha no se rompió.",
      suspendido: "Tu racha estuvo pausada este día por una suspensión.",
      hoy: "Envía un aporte hoy para que el día cuente.",
      sinActividad: "Este día no enviaste aportes.",
    },
  },

  /** Avisos (notificaciones) del módulo. */
  avisos: {
    rango: (numero: number, nombre: string) => `Alcanzaste el rango ${n(numero)}, ${nombre}.`,
    rangos: (cuantos: number, numero: number, nombre: string) =>
      `Subiste ${n(cuantos)} rangos de una vez y llegaste al ${n(numero)}, ${nombre}.`,
    logroTitulo: (nombre: string) => `Logro: ${nombre}`,
    /** Al elegir un enfoque por primera vez aparece su logro, que estaba oculto (decisiones del 26 nov). */
    logroDesbloqueadoTitulo: "¡Desbloqueaste un logro nuevo!",
    logroDesbloqueado: (nombre: string, meta: string) => `${nombre} ya está en tus logros. Tu primera meta: ${meta.charAt(0).toLowerCase()}${meta.slice(1)}.`,
    /** «Subiste a Brote: llegaste a 15 aportes aceptados.» */
    medalla: (nivel: string, hecho: string) => `Subiste a ${nivel}${hecho ? `: ${hecho}` : ""}.`,
    rachaTerminadaTitulo: "Tu racha se interrumpió",
    rachaTerminada: (dias: number) => `Tu racha de ${n(dias)} ${plural(dias, "día", "días")} terminó. Envía un aporte hoy para empezar otra.`,
    /** Los protectores cubrieron unos días, pero no todos los que faltaban: un solo aviso en lugar de varios «sigue». */
    protectoresNoAlcanzaronTitulo: "Tus protectores no alcanzaron",
    protectoresNoAlcanzaron: (usados: number, dias: number) =>
      `Usaste ${n(usados)} ${plural(usados, "protector", "protectores")}, pero no alcanzaron para todos los días sin aportes y tu racha de ${n(dias)} ${plural(dias, "día", "días")} terminó. Envía un aporte hoy para empezar otra.`,
    rachaEnRiesgoTitulo: "Tu racha sigue viva",
    rachaEnRiesgo: (dias: number) => `Llevas ${n(dias)} días seguidos aportando. Un aporte hoy la mantiene.`,
    rachaPorEmpezarTitulo: "Empieza una racha",
    rachaPorEmpezar: "Un aporte hoy es tu primer día de racha. Cada día seguido suma.",
  },

  /** Camino de rangos (pestaña Progreso), su tabla de requisitos y la ficha de cada rango. */
  camino: {
    guia: "Arriba está lo que ya lograste y abajo lo que sigue. Toca un rango para ver qué pide.",
    intro: (actual: number, total: number) => {
      if (actual >= total) return `Llegaste a la cumbre: recorriste los ${n(total)} rangos.`;
      if (actual === total - 1) return `Te falta un paso. Del rango ${n(total)}, el último, ya puedes ver todo.`;
      if (actual === 1) return "Envía tu primer aporte para subir al rango 2. Cada rango que subes te muestra más del camino.";
      return `Vas avanzando. Del rango ${n(actual + 1)} ya ves todo y del ${n(actual + 2)}, una pista.`;
    },
    notaUltimo: "Llegaste al último rango.",
    notaAvistado: (numero: number) => `Verás su nombre cuando llegues al rango ${n(numero)}.`,
    tablaTitulo: "Lo que pide cada rango",
    tablaCaption: "Lo que pide cada rango. La fila marcada es el tuyo.",
    horizonte: (actual: number, total: number) => {
      if (actual >= total) return "Ya conoces todos los rangos. Aquí ves lo que pidió cada uno.";
      if (actual >= total - 1) return "Ya puedes ver todos los rangos.";
      const primero = actual + 3;
      if (primero > total) return `Del rango ${n(total)} ya tienes una pista. Verás su nombre cuando sea tu siguiente rango.`;
      return primero === total
        ? `Del rango ${n(total)} ves lo que pide; lo demás se descubre al acercarte.`
        : `De los rangos ${n(primero)} a ${n(total)} ves lo que piden; lo demás se descubre al acercarte.`;
    },
    fichaUltimo: "Es el último rango.",
    completo: "Cumpliste todo. En un momento subes al siguiente rango.",
    avatarDetalle: "Tu avatar cambia con tu nuevo rango.",
    completoEtiqueta: "Camino completo",
    completoTitulo: "Llegaste al último rango",
    completoTexto: (total: number) => `Llegaste al rango ${n(total)}, el último. Tus logros siguen subiendo con cada aporte aceptado.`,
    verLogros: "Ver tus logros",
  },

  /** «Cómo calificaron tus aportes», en Mis aportes. */
  calificaciones: {
    titulo: "Cómo calificaron tus aportes",
    vacio: "Todavía no tienes aportes con estrellas. Cada aporte aceptado recibe de 1 a 5.",
    resumen: (calificados: number, altos: number, maximos: number) =>
      `${n(calificados)} ${plural(calificados, "aporte aceptado", "aportes aceptados")}: ${n(altos)} de 4★ o más y ${n(maximos)} de 5★.`,
    pie: "Para subir de rango cuentan los de 4★ o más y los de 5★. Un aporte de 5★ cuenta en los dos.",
  },

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
    vacioPie: "Envía tu primer aporte para subir al rango 2.",
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
    cuotaCompleta: (bono: number) => `Completaste la meta de aportes de esta campaña: ganaste ${n(bono)} EXP extra.`,
    cuotaAvance: (tuyos: number, cuota: number) => `Tu meta de aportes: ${n(Math.min(tuyos, cuota))} de ${n(cuota)}.`,
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
    calculoPendiente: "Sabrás cuánta EXP te da cuando lo acepten.",
    calculo: (base: number, calidad: string, factor: string | null, exp: number, motivoFactor: string) =>
      `${n(base)} EXP del tipo × ${calidad} por estrellas${factor ? ` × ${factor} de extra ${motivoFactor}` : ""} = ${n(exp)} EXP`,
    motivoDelFactor: (potenciador: boolean, especial: boolean) =>
      potenciador && especial ? "(potenciador y campaña especial)" : potenciador ? "(potenciador)" : especial ? "(campaña especial)" : "",
    notaPendiente: "Todavía lo están revisando. Mientras tanto, puedes eliminarlo desde el detalle.",
    notaRechazado: "Este aporte no fue aceptado, así que no recibe estrellas ni EXP.",
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
    escapeAyuda: "Con la tecla Escape vuelves un paso atrás.",
    subtematicaOtras: "Otras",
    subtematicaSin: "Sin subtemática",
    subtematicaAria: (nombre: string) => `Subtemática ${nombre}`,
    tematicaResumenAcercada: (campanas: number, subtematicas: number, aceptados: number, enRevision: number) =>
      `${n(campanas)} ${plural(campanas, "campaña", "campañas")} en ${n(subtematicas)} ${plural(subtematicas, "subtemática", "subtemáticas")}. ` +
      `${n(aceptados)} ${plural(aceptados, "aporte aceptado", "aportes aceptados")}` +
      (enRevision > 0 ? ` y ${n(enRevision)} en revisión.` : "."),
    subtematicasTitulo: "Subtemáticas",
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
    rangoAria: (numero: number, nombre: string) => `Rango ${n(numero)}, ${nombre}. Ver tus rangos`,
  },
  /**
   * Textos por enfoque (RF-GAM-119): solo estos cuatro momentos cambian con el enfoque. Lo que no esté aquí, o un enfoque
   * sin entrada, usa el texto común (deEnfoque). Ninguna variante nombra un tipo de aporte: alguien con DataTracker
   * también puede enviar textos.
   */
  porEnfoque: {
    tracker: {
      rango: "Tu lente ya ve lo que otros pasan por alto.",
      logroSube: "¡Tu lente encontró algo nuevo!",
      rachaCrece: "Hoy también saliste a mirar: tu racha sigue encendida.",
    },
    collector: {
      rango: "Tu bitácora suma otra página importante.",
      logroSube: "¡Tu bitácora ganó una página!",
      rachaCrece: "Hoy también escribiste en tu bitácora: tu racha sigue encendida.",
    },
    explorer: {
      rango: "Tu mapa tiene un territorio nuevo.",
      logroSube: "¡Tu mapa se hizo más grande!",
      rachaCrece: "Hoy también abriste camino: tu racha sigue encendida.",
    },
  } as Record<string, Partial<Record<"rango" | "logroSube" | "rachaCrece", string>>>,
  /** Filtro por enfoque en Líderes, categoría Rango (decisión del 26 nov). */
  lideres: {
    enfoque: "Enfoque",
    todos: "Todos",
    porEnfoque: (nombre: string) => `Quienes más alto han llegado con ${nombre}.`,
    vacioPorEnfoque: (nombre: string) => `Todavía nadie con ${nombre} ha subido de rango.`,
    /** Aparecer u ocultarse (RF-GAM-95), en la ventana de Preferencias de Mi cuenta. */
    visibilidad: {
      interruptor: "Aparecer en la clasificación",
      encendida: "Apareces con tu nombre y la inicial de tu apellido, tu rango y tu enfoque, también en la página principal.",
      apagada: "No apareces en ninguna tabla de líderes. Tu progreso, tus rangos y tus logros siguen igual.",
      error: "No pudimos guardar el cambio. Inténtalo de nuevo.",
    },
    ocultoAviso: "No apareces en esta tabla porque elegiste ocultarte.",
    ocultoEnlace: "Cambiarlo en Preferencias",
  },
  /** Enfoque (RF-GAM-115, 116): último paso del registro, ventana para cuentas sin enfoque y Mi cuenta. */
  enfoque: {
    paso: "Paso 5 de 5 · Tu enfoque",
    pregunta: "¿Cómo te gusta aportar?",
    elige: "Elige el que más se parezca a ti. Podrás cambiarlo después en Mi cuenta.",
    noEsEspecialidad: "No es tu especialidad.",
    diferencia: "Tu especialidad es a qué te dedicas o qué estudias; tu enfoque es cómo te gusta aportar en DataForGood.",
    queCambia: "Cambia el estilo de tu avatar y te da un logro propio. No cambia la EXP que ganas ni las campañas en las que puedes aportar.",
    finalizar: "Finalizar y explorar campañas",
    finalizarCorto: "Finalizar",
    guardando: "Guardando…",
    ventana: {
      antetitulo: "Algo nuevo en DataForGood",
      titulo: "Elige tu enfoque",
      guardar: "Guardar mi enfoque",
    },
    cuenta: {
      antetitulo: "Gamificación",
      titulo: "Tu enfoque",
      cambiar: "Cambiar enfoque",
      sinEnfoque: "Aún no eliges tu enfoque.",
      elegir: "Elegir enfoque",
      podrasCambiarlo: (fecha: string) => `Podrás cambiarlo de nuevo el ${fecha}.`,
    },
    cambio: {
      titulo: "Cambiar tu enfoque",
      actual: "Tu enfoque actual",
      aviso: (nombre: string, dias: number) =>
        `Tu avatar tomará el estilo de ${nombre}. Lo que ya ganaste se queda igual. Después podrás cambiarlo otra vez en ${n(dias)} ${plural(dias, "día", "días")}.`,
      eligeOtro: "Elige un enfoque distinto al actual.",
      boton: (nombre: string) => `Cambiar a ${nombre}`,
      cancelar: "Cancelar",
      listo: (nombre: string) => `Listo: ahora tu enfoque es ${nombre}.`,
    },
    errores: {
      cargar: "No pudimos cargar los enfoques.",
      guardar: "No pudimos guardar tu enfoque. Revisa tu conexión e inténtalo de nuevo.",
      espera: (fecha: string) => `Cambiaste tu enfoque hace poco. Podrás cambiarlo de nuevo el ${fecha}.`,
      noDisponible: "Ese enfoque ya no se puede elegir. Elige otro.",
      reintentar: "Intentar de nuevo",
    },
  },
  /** Lo que se pierde al eliminar la cuenta (A6). */
  baja: {
    sePierde: (rango: number, nombre: string, exp: number, medallas: number) =>
      `Al borrarse la cuenta se pierden tu rango ${n(rango)} (${nombre}), tus ${n(exp)} EXP` +
      (medallas > 0 ? `, tus ${n(medallas)} ${plural(medallas, "logro", "logros")}` : "") +
      " y todo tu progreso; no se pueden recuperar.",
    filaEtiqueta: "Rango y experiencia",
    filaValor: (rango: number, exp: number) => `Rango ${n(rango)} y ${n(exp)} EXP se pierden`,
  },
  /** Pestaña Historial de EXP de Mi progreso (2026-11-14; lienzo aprobado el mismo día). */
  historialDeExp: {
    titulo: "Historial de EXP",
    intro: "Toda la EXP que has ganado y de dónde vino. Solo tú la ves.",
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
      bonos: "Bonos por meta de campaña",
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
      bono: "Bono por meta de campaña",
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
    tituloBono: (cuota: number) => `Completaste la meta de ${n(cuota)} ${plural(cuota, "aporte", "aportes")}`,
    tituloBonoSinDatos: "Completaste la meta de aportes de una campaña",
    tituloDescuento: "Se descontó un aporte reportado",
    tituloAjuste: "Ajuste de EXP",
    campanaBorrada: "Campaña que ya no existe",
    hoy: "Hoy",
    ayer: "Ayer",
    expAria: (exp: number) => (exp < 0 ? `Se descontaron ${n(-exp)} EXP` : `Ganaste ${n(exp)} EXP`),
    totalDelDiaAria: (exp: number) => `Total del día: ${exp < 0 ? "menos " : ""}${n(Math.abs(exp))} EXP`,

    detalle: {
      calculo: "Cálculo",
      factor: "Extra",
      enviado: "Enviado",
      recompensa: "Recompensa",
      periodo: "Válida",
      limites: "Límites",
      motivo: "Motivo",
      devuelve: "Se descuentan",
    },
    /** «20 EXP por ser foto × 1.75 por 4 estrellas × 1.5 de extra = 53 EXP» (sin el paso del redondeo). */
    calculoAporte: (base: number, tipo: string | null, multCalidad: number, estrellas: number | null, factor: number, exp: number) =>
      `${n(base)} EXP ${tipo ? `por ser ${tipo.toLowerCase()}` : "del tipo"} × ${d(multCalidad)} por ${estrellas ? `${n(estrellas)} ${plural(estrellas, "estrella", "estrellas")}` : "estrellas"}` +
      (factor !== 1 ? ` × ${d(factor)} de extra` : "") +
      ` = ${n(exp)} EXP`,
    factorAporte: (potenciador: number, multCampana: number) =>
      [
        potenciador > 0 ? `${pct(potenciador)} más, porque enviaste con un potenciador activo` : null,
        multCampana !== 1 ? `${d(multCampana - 1)} del multiplicador de la campaña` : null,
      ]
        .filter(Boolean)
        .join(" y "),
    calculoBono: (porcentaje: number, referencia: number, sinLimites: number, exp: number) =>
      `${n(porcentaje)} % de los ${n(referencia)} EXP que te dieron esos aportes = ` +
      (sinLimites === exp ? `${n(exp)} EXP` : `${n(sinLimites)}, ajustado a ${n(exp)} EXP`),
    limitesBono: (minimo: number, maximo: number) => `Entre ${n(minimo)} y ${n(maximo)} EXP`,
    notaBono: () => "Se cuenta sin el extra de los potenciadores y se da una sola vez por campaña.",
    recompensaMision: (exp: number) => `${n(exp)} EXP de la misión`,
    notaMision: "Suma a tu EXP, pero no cuenta como aporte.",
    motivoDescuento: (tipo: string | null, aceptadoEl: string | null) =>
      `Un reporte rechazó ${tipo ? `tu aporte de ${tipo.toLowerCase()}` : "un aporte tuyo"}` +
      (aceptadoEl ? ` que se aceptó el ${aceptadoEl}.` : "."),
    devuelve: (exp: number) => `Los ${n(exp)} EXP que sumó ese aporte`,
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

    vacioTitulo: "Aquí verás cada EXP que ganes",
    vacioTexto:
      "Tu primer aporte aceptado te da EXP. Las misiones y los bonos por meta de campaña también aparecerán aquí.",
    vacioCta: "Explorar campañas",
    error: "Todavía no podemos mostrar tu historial de EXP. Intenta de nuevo en unos minutos.",
    cargandoPagina: "Cargando tu historial de EXP…",

    comoTitulo: "Cómo se calcula",
    comoFormula: "Tu EXP = EXP del tipo de aporte × extra por estrellas × extra del potenciador",
    comoRedondeo: ", sin decimales.",
    comoBase: (base: number) => `${n(base)} EXP`,
    comoTiposEtiqueta: "EXP por tipo de aporte",
    comoCalificacionesEtiqueta: "Extra por estrellas",
    comoMultiplicador: (multiplicador: number) => `×${d(multiplicador)}`,
    comoPotenciador: (bonificacion: number) => `Si envías con un potenciador activo, ganas ${pct(bonificacion)} más.`,
    comoBono: (porcentaje: number, cuotaMinima: number, minimo: number, maximo: number) =>
      `Si completas la meta de aportes de una campaña, recibes ${n(porcentaje)} % de la EXP de esos aportes, entre ${n(minimo)} y ${n(maximo)} EXP. Solo en campañas con meta de ${n(cuotaMinima)} aportes o más.`,
    comoMisiones: "Cada misión da una cantidad fija de EXP.",
    comoDescuento: "Si un reporte rechaza un aporte que ya estaba aceptado, se descuenta la EXP que te dio.",
    comoPie: "Si estos valores cambian, la EXP que ya ganaste se queda igual.",
  },
  /**
   * Pestaña «Logros» de Mi progreso (en el código y en la base siguen siendo medallas). Cada logro dice su siguiente
   * meta como una acción y anima cuando falta poco.
   */
  medallas: {
    titulo: "Logros",
    intro: "Cada logro sube de nivel con lo que vas haciendo en la plataforma.",
    introNueva: "Tu primer aporte aceptado ya avanza varios a la vez.",
    conNivel: "logros conseguidos",
    niveles: "niveles conseguidos",
    deTotal: (total: number) => ` de ${n(total)}`,
    cerca: "Más cerca de subir",
    /** «Faltan 2 aportes aceptados para Brote»; sin unidad conocida, «Faltan 2 para Brote». */
    faltanPara: (faltan: number, nivel: string, unidad = "") =>
      `${plural(faltan, "Falta", "Faltan")} ${n(faltan)}${unidad ? ` ${unidad}` : ""} para ${/^nivel \d+$/i.test(nivel.trim()) ? nivel.trim().toLowerCase() : nivel}`,
    grupos: { hitos: "Logros principales", adicionales: "Más logros", enfoque: "Logros de enfoque" } as Record<string, string>,
    resumenDeGrupo: (con: number, total: number) => `${n(con)} de ${n(total)} conseguidos`,

    sinNivel: "Por conseguir",
    /** «Arbusto · nivel 3 de 5»; si el nivel no tiene nombre propio («Nivel 3»), solo «Nivel 3 de 5». */
    nivelDe: (nombre: string, nivel: number, total: number) =>
      /^nivel \d+$/i.test(nombre.trim()) ? `Nivel ${n(nivel)} de ${n(total)}` : `${nombre} · nivel ${n(nivel)} de ${n(total)}`,
    nivelMaximo: (nombre: string) => `Nivel máximo · ${nombre}`,
    para: (nivel: string) => `Para ${nivel}`,
    /** Etiqueta del siguiente nivel en la tarjeta: anima cuando falta poco. */
    paraConAnimo: (nivel: string, faltan: number, porcentaje: number) =>
      faltan === 1 ? `¡Solo falta 1 para ${nivel}!` : porcentaje >= 75 ? `¡Ya casi llegas a ${nivel}!` : `Para ${nivel}`,
    /** La siguiente meta como acción: «Logra 15 aportes aceptados». */
    meta: (mide: string | null, valor: number, unidad: string): string => {
      const f = mide ? META_DE_LOGRO[mide] : undefined;
      return f ? f(valor) : `${n(valor)} ${unidad}`.trim();
    },
    /** Lo que se logró al subir de nivel, para el aviso: «llegaste a 15 aportes aceptados». */
    hecho: (valor: number, unidad: string) => (unidad ? `llegaste a ${n(valor)} ${unidad}` : ""),
    completa: "Conseguiste todos sus niveles",
    avance: (valor: number, meta: number) => `${n(valor)} de ${n(meta)}`,
    tarjetaAria: (nombre: string, estado: string, siguiente: string, avance: string) =>
      `${nombre}, ${estado}. ${siguiente}: ${avance}. Abre su ficha.`,

    fichaPosicion: (posicion: number, total: number) => `${n(posicion)} de ${n(total)}`,
    anterior: (nombre: string) => `Ver el logro anterior: ${nombre}`,
    siguiente: (nombre: string) => `Ver el logro siguiente: ${nombre}`,
    cerrar: "Cerrar",
    valorHoy: (unidad: string, faltan: number | null, nivel: string | null) =>
      `${unidad}.` +
      (faltan !== null && nivel
        ? ` ${faltan === 1 ? "¡Te falta solo 1" : `Te faltan ${n(faltan)}`} para ${nivel}${faltan === 1 ? "!" : "."}`
        : " Conseguiste todos sus niveles."),
    nivelesTitulo: "Niveles",
    umbral: (valor: number, unidad: string) => `${n(valor)} ${unidad}`,
    alcanzadoEl: (fecha: string) => `Conseguido el ${fecha}`,
    alcanzado: "Conseguido",
    porAlcanzar: "Por conseguir",
    notas: {
      aceptados_consecutivos:
        "Cuenta tu mejor serie de aportes aceptados sin un rechazo en medio. La cifra puede bajar si rechazan uno después.",
    } as Record<string, string>,
    /** Unidad de lo que mide cada medalla, en singular o plural (campo `mide` del catálogo); "" si no la conoce. */
    unidad: (mide: string | null, cantidad: number): string => {
      const u = mide ? UNIDADES_DE_MEDALLA[mide] : undefined;
      return u ? plural(cantidad, u[0], u[1]) : "";
    },

    error: "Todavía no podemos mostrar tus logros. Intenta de nuevo en unos minutos.",
    cargando: "Cargando tus logros…",
  },
  /** Misiones de inicio en /progreso/misiones (2026-11-18; SRS v1.4: RF-GAM-103). */
  misionesDeInicio: {
    titulo: "Tu primera semana",
    plazo: "Desaparecen en",
    filtro: "Primera semana",
    nombreDelPeriodo: "Primera semana",
    comoCuentan: "Tus primeros 7 días tienes misiones extra. Las que no completes desaparecen al terminar la semana.",
  },

  /**
   * Tarjetas de misión (2026-11-19; SRS v1.4: RF-GAM-43, 122; lienzo aprobado el mismo día): cuándo cuenta, la etiqueta
   * de las difíciles y la recompensa.
   */
  misiones: {
    titulo: "Misiones",
    intro: "Retos que cambian cada día y cada semana. Cada uno que completas te da EXP y te acerca al siguiente rango.",
    completadas: (total: number) => `${plural(total, "misión completada", "misiones completadas")} en total`,
    metaDelRango: (rango: number, meta: number, faltan: number) =>
      faltan <= 0
        ? `Ya tienes las misiones para completar tu rango ${n(rango)}.`
        : `Completar tu rango ${n(rango)} pide ${n(meta)}: ${faltan === 1 ? "te falta 1" : `te faltan ${n(faltan)}`}.`,
    error: "Todavía no podemos mostrar tus misiones. Intenta de nuevo en unos minutos.",
    diarias: "Diarias",
    semanales: "Semanales",
    /** Fechas en que vale el grupo de misiones. */
    vigencia: (fechas: string) => `Válidas: ${fechas}`,
    comoCuentanTitulo: "Cómo cuentan",
    cuenta: {
      envio: "Cuenta al enviar",
      aceptacion: "Cuenta cuando lo aceptan",
    },
    dificil: "Difícil",
    /** «+20 EXP» o «1 protector». */
    recompensa: (texto: string) => (texto.endsWith("EXP") ? `+${texto}` : texto),
    recibiste: (texto: string) => `Recibiste ${texto.endsWith("EXP") ? `+${texto}` : texto}`,
    /** Notificación al completarla: «recibiste 20 EXP», «ganaste 1 protector». */
    ganaste: (texto: string) => (texto.endsWith("EXP") ? `recibiste ${texto}` : `ganaste ${texto}`),
    comoCuentan: [
      "«Cuenta al enviar»: avanza en cuanto envías el aporte.",
      "«Cuenta cuando lo aceptan»: avanza cuando lo aceptan, aunque sea días después, y cuenta para el día en que lo enviaste.",
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
      protector: "Cuida tu racha un día que no envíes aportes. Puedes tener hasta 3.",
      potenciador: "Durante 15 minutos, tus aportes ganan 50 % más EXP. Si ya tienes uno activo, este espera su turno.",
    },
    nota: (objeto: "protector" | "potenciador") =>
      `Si eliges «No, gracias», pierdes el ${objeto}. Si cierras esta ventana, te volvemos a preguntar la próxima vez.`,
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
      dondeVerlo: "Mientras dure, lo ves en el menú de la izquierda o, en el teléfono, en la burbuja.",
      espera: (reloj: string | null) =>
        reloj ? `Empieza solo cuando termine el que tienes activo (quedan ${reloj}).` : "Empieza solo cuando termine el que tienes activo.",
      usado: "Se activó y terminó mientras no estabas.",
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
    suma: (bonificacion: number) => `${pct(bonificacion)} más EXP en lo que envías ahora.`,
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
    luegoPasas: (numero: number) => `Al cumplirlos, subes al rango ${n(numero)}.`,
    ultimoRango: "Llegaste al último rango.",
    verProgreso: "Ver tu progreso",
    verRangos: "Ver tus rangos",
    cifras: {
      exp: "EXP total",
      racha: "Racha",
      dias: (dias: number) => (dias === 0 ? "Sin racha" : `${n(dias)} ${dias === 1 ? "día" : "días"}`),
      maxima: (dias: number) => `Máxima: ${n(dias)} ${dias === 1 ? "día" : "días"}`,
      misiones: "Misiones completadas",
      medallas: "Logros conseguidos",
      deTotal: (valor: number, total: number) => `${n(valor)} de ${n(total)}`,
      historial: "Historial",
      verMisiones: "Misiones",
      verMedallas: "Logros",
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
      vacio: "Todavía no ganas EXP. La ganas cuando aceptan un aporte tuyo o completas una misión.",
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
    siguiente: { racha: "Siguiente: tu racha", rango: "Siguiente: tu nuevo rango", objeto: "Siguiente: tu recompensa", medallas: (cuantas: number, primera: string) => (cuantas === 1 ? `Siguiente: ${primera}` : `Siguiente: ${n(cuantas)} logros`) },

    rangoEyebrow: (numero: number, total: number) => `Nuevo rango · ${n(numero)} de ${n(total)}`,
    rangosEyebrow: (cuantos: number, numero: number, total: number) => `Subiste ${n(cuantos)} rangos · ${n(numero)} de ${n(total)}`,
    rangoTexto: "Ya puedes ver lo que pide el siguiente.",
    rangosTexto: (numero: number) => `Llegaste al rango ${n(numero)}.`,
    intermedio: (numero: number, nombre: string) => `También pasaste por el rango ${n(numero)} · ${nombre}`,
    intermedioDetalle: "Se alcanzaron juntos.",
    etapa: (etapa: number) => `Etapa ${n(etapa)} de tu avatar`,
    etapaDetalle: "Tu avatar cambió con tu nuevo rango.",
    insignia: (rango: number) => `Insignia del rango ${n(rango)}`,
    insigniaDetalle: "Ya aparece en tu camino de rangos.",
    coleccionable: (nombre: string) => `Objeto para tu avatar: ${nombre}`,
    coleccionableDetalle: "Ya lo tienes en tu inventario.",
    revelado: (numero: number, nombre: string) => `Se reveló el rango ${n(numero)} · ${nombre}`,
    reveladoDetalle: (avistado: number | null) =>
      "Es el rango que sigue." + (avistado ? ` Y ya puedes ver una pista del ${n(avistado)}.` : ""),
    ultimoRango: "Llegaste al último rango",
    ultimoRangoDetalle: "Recorriste todo el camino.",
    verTrayectoria: "Ver tus rangos",

    medallaEyebrow: "¡Subiste de nivel en un logro!",
    medallaPrimera: "¡Nuevo logro!",
    medallaSalto: (cuantos: number) => `¡Subiste ${n(cuantos)} niveles de una vez!`,
    medallaFuego: "¡Tu racha hizo crecer un logro!",
    medallasEyebrow: "¡Nuevos logros!",
    medallasTitulo: (cuantas: number) => `Subiste en ${n(cuantas)} logros`,
    pasastePor: (nombres: readonly string[]) => `Pasaste por ${nombres.join(", ")}.`,
    verMedallas: "Ver tus logros",

    racha: {
      alarga: { titulo: (dias: number) => `¡Racha de ${n(dias)} días!`, texto: "Tu primer aporte de hoy la mantuvo encendida." },
      empieza: { titulo: () => "Encendiste tu racha", texto: "Cada día con al menos un aporte la hace crecer." },
      reaviva: { titulo: () => "Reavivaste tu racha", texto: "Volvió a empezar. Cada día seguido la hace crecer." },
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

/** Variante del enfoque para un momento (RF-GAM-119), o null si no hay: quien la usa pone el texto común. */
export function deEnfoque(enfoque: string | null | undefined, momento: "rango" | "logroSube" | "rachaCrece"): string | null {
  return (enfoque && TEXTOS.porEnfoque[enfoque]?.[momento]) || null;
}
