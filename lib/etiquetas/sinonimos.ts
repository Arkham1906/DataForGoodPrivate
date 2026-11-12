// Sinónimos de las etiquetas (subtemáticas, 2026-11-04, a pedido del usuario): al proponer una etiqueta
// nueva, "Aguas negras" es lo mismo que "Aguas residuales", así que se usa la que ya existe en esa
// temática en vez de crear otra. Lo revisan el navegador (ui/SelectorDeEtiquetas,
// ui/SubtematicasDelPerfil, para avisar) y el servidor (lib/etiquetas/catalogo.ts, que manda).
// Se compara sin acentos ni mayúsculas y en singular, y desde el 2026-11-07 también con otro orden,
// faltas de ortografía y erratas (ver etiquetaEquivalente). La lista es a mano: un sinónimo nuevo se
// agrega aquí. Solo equivalentes reales: "Abejas" no va en Polinizadores porque es un caso, no lo mismo.
// Algunas no tienen sinónimo claro y quedan vacías. Sin imports de servidor.
// Desde el 2026-11-11 (a pedido del usuario: "diccionarios de subtemáticas en cada temática, con las
// variantes validadas") el diccionario va por temática → subtemática → variantes, y cada búsqueda que
// sabe su temática solo mira las variantes de esa temática: "vida silvestre" es Fauna en Medio ambiente
// y Fauna silvestre en Animales, y "albergues" es Refugios en Protección animal y Refugios temporales
// en Protección civil. Las reglas que debe cumplir están en ./validar-diccionario.ts; después de
// tocar el diccionario, correr `npm run validar:diccionario`.

import { claveDeTematica, singular } from "@/lib/tematicas/analizar";

export const DICCIONARIO_DE_SUBTEMATICAS: Record<string, Record<string, string[]>> = {
  "Medio ambiente": {
    "Cambio climático": ["calentamiento global", "crisis climática", "emergencia climática", "cambio del clima", "crisis del clima", "calentamiento del planeta"],
    Contaminación: ["polución", "contaminación ambiental", "polución ambiental", "contaminantes"],
    Deforestación: ["tala", "tala de árboles", "tala ilegal", "tala clandestina", "desmonte", "pérdida de bosques", "pérdida de selvas", "destrucción de bosques", "tala inmoderada"],
    Conservación: ["preservación", "preservación ambiental", "conservación ambiental", "protección ambiental", "protección de la naturaleza", "cuidado ambiental", "cuidado del medio ambiente", "conservación de la naturaleza"],
    "Energía renovable": ["energía limpia", "energía verde", "energía alternativa", "fuentes renovables", "fuentes de energía renovable", "energía sustentable", "energía sostenible"],
    "Educación ambiental": ["conciencia ambiental", "concientización ambiental", "cultura ambiental", "educación ecológica", "conciencia ecológica", "cultura ecológica", "educación para la sustentabilidad"],
    Fauna: ["vida animal", "fauna silvestre", "vida silvestre", "fauna local", "fauna nativa", "especies animales"],
    Árboles: ["arbolado", "arbolado urbano", "árboles urbanos", "arbolado público", "árboles de la ciudad"],
  },
  Salud: {
    "Salud mental": ["bienestar emocional", "salud emocional", "salud psicológica", "bienestar mental", "bienestar psicológico", "salud psíquica"],
    Nutrición: ["alimentación saludable", "alimentación sana", "dieta saludable", "buena alimentación", "alimentación balanceada", "dieta balanceada", "hábitos alimenticios", "comer sano"],
    Vacunación: ["vacunas", "vacunar", "inmunización", "campañas de vacunación", "esquema de vacunación", "jornadas de vacunación", "aplicación de vacunas", "inmunizaciones"],
    Diabetes: ["diabetes mellitus", "azúcar alta", "glucosa alta", "diabéticos", "personas con diabetes"],
    "Salud materna": ["salud de la madre", "salud de las madres", "maternidad", "embarazo", "embarazadas", "mujeres embarazadas", "control prenatal", "atención prenatal"],
    Adicciones: ["drogadicción", "farmacodependencia", "toxicomanía", "dependencia a sustancias", "abuso de sustancias", "consumo de drogas", "consumo de sustancias"],
    "Enfermedades infecciosas": ["enfermedades contagiosas", "enfermedades transmisibles", "infecciones", "enfermedades infectocontagiosas", "padecimientos infecciosos", "contagios"],
    "Primeros auxilios": ["auxilio inmediato", "atención prehospitalaria", "rcp", "reanimación cardiopulmonar", "atención de emergencias médicas"],
  },
  Educación: {
    Escuelas: ["colegios", "planteles escolares", "planteles educativos", "centros educativos", "primarias", "secundarias", "escuelas públicas", "planteles", "centros escolares"],
    Alfabetización: ["analfabetismo", "enseñar a leer y escribir", "lectoescritura", "aprender a leer", "aprender a leer y escribir"],
    "Educación inicial": ["educación temprana", "preescolar", "kínder", "educación preescolar", "jardín de niños", "estancias infantiles", "guarderías"],
    Bibliotecas: ["salas de lectura", "bibliotecas públicas", "bibliotecas comunitarias", "bibliotecas escolares", "acervos bibliográficos"],
    "Deserción escolar": ["abandono escolar", "abandono de estudios", "dejar la escuela", "abandono de la escuela", "deserción educativa", "desertores escolares"],
    Becas: ["apoyos escolares", "apoyos educativos", "ayudas escolares", "becas escolares", "estímulos educativos", "apoyos económicos para estudiar", "becarios"],
    "Educación digital": ["educación en línea", "educación virtual", "clases en línea", "alfabetización digital", "educación a distancia", "aprendizaje en línea", "cursos en línea", "clases virtuales"],
  },
  Infraestructura: {
    "Calles y banquetas": ["calles", "banquetas", "aceras", "vialidades", "pavimentación", "pavimento", "caminos", "guarniciones", "andadores", "vías públicas"],
    Baches: ["hoyos en la calle", "hoyos en el pavimento", "bacheo", "pavimento dañado", "calles en mal estado", "pozos en la calle"],
    "Alumbrado público": ["luminarias", "postes de luz", "lámparas públicas", "iluminación pública", "alumbrado", "lámparas de la calle", "postes de alumbrado", "luminarias públicas"],
    Puentes: ["pasos elevados", "puentes peatonales", "pasos a desnivel", "puentes vehiculares", "pasarelas"],
    Drenaje: ["alcantarillado", "alcantarillas", "coladeras", "drenaje sanitario", "drenaje pluvial", "desagüe", "red de drenaje", "tuberías de drenaje", "colectores"],
    "Edificios públicos": ["inmuebles públicos", "edificios de gobierno", "edificios gubernamentales", "oficinas de gobierno", "instalaciones públicas", "inmuebles de gobierno"],
  },
  "Protección animal": {
    Adopción: ["adopción de animales", "adopción de mascotas", "adoptar mascotas", "adopción responsable", "dar en adopción", "adoptar animales"],
    Rescate: ["rescate animal", "rescate de animales", "rescatistas", "rescate de perros", "rescate de gatos", "animales rescatados"],
    Esterilización: ["castración", "castraciones", "esterilización de mascotas", "jornadas de esterilización", "campañas de esterilización", "control de natalidad animal"],
    "Maltrato animal": ["crueldad animal", "abuso animal", "violencia animal", "violencia contra animales", "animales maltratados", "abuso de animales", "crueldad contra los animales"],
    "Animales callejeros": ["perros callejeros", "gatos callejeros", "animales abandonados", "animales sin hogar", "animales en situación de calle", "perros de la calle", "gatos de la calle", "animales de la calle", "perros abandonados", "gatos abandonados"],
    Refugios: ["albergues", "santuarios", "refugios de animales", "albergues de animales", "refugios animales", "albergues animales", "protectoras de animales", "casas hogar para animales"],
    "Tenencia responsable": ["dueños responsables", "tenencia responsable de mascotas", "cuidado responsable de mascotas", "cuidado de mascotas", "tenencia de mascotas", "cuidado responsable de animales"],
  },
  Animales: {
    Perros: ["canes", "caninos", "lomitos", "perritos", "perros domésticos", "mascotas caninas", "firulais"],
    Gatos: ["felinos", "michis", "gatitos", "mininos", "gatos domésticos", "mascotas felinas"],
    Aves: ["pájaros", "pajaritos", "avifauna", "aves de ornato"],
    Peces: ["pececitos", "peces de ornato", "peces de acuario", "acuarismo"],
    Reptiles: ["herpetofauna"],
    Insectos: ["bichos", "entomofauna", "bichitos"],
    Caballos: ["equinos", "yeguas", "potros", "ganado equino", "caballos de trabajo", "caballos de carga"],
    "Animales de granja": ["animales de corral", "animales de rancho", "animales de traspatio", "animales de producción"],
    "Fauna silvestre": ["animales silvestres", "animales salvajes", "vida silvestre", "animales del monte", "vida salvaje", "fauna salvaje"],
  },
  Movilidad: {
    "Transporte público": ["camiones urbanos", "transporte colectivo", "transporte urbano", "rutas de camión", "combis", "peseros", "microbuses", "autobuses urbanos", "transporte masivo", "colectivos"],
    Bicicleta: ["bici", "ciclismo urbano", "bicis", "ciclovías", "ciclistas urbanos", "movilidad ciclista"],
    Peatones: ["transeúntes", "viandantes", "movilidad peatonal", "cruces peatonales", "personas que caminan"],
    Tráfico: ["tránsito", "congestión vial", "congestionamiento vial", "embotellamientos", "tráfico vehicular", "atascos", "hora pico", "flujo vehicular"],
    "Accidentes viales": ["accidentes de tránsito", "accidentes de tráfico", "accidentes automovilísticos", "choques", "siniestros viales", "atropellamientos", "percances viales", "hechos de tránsito", "colisiones"],
    Estacionamiento: ["cocheras", "parqueo", "parqueaderos", "aparcamiento", "lugares de estacionamiento", "cajones de estacionamiento", "parquímetros"],
    // No es base: propuesta y aprobada en el catálogo.
    Patineta: ["monopatín", "skate", "skateboard", "skateboarding", "tabla de skate"],
  },
  "Arte y cultura": {
    Música: ["músicos", "orquestas", "bandas de música", "creación musical"],
    Pintura: ["artes plásticas", "pintores", "murales", "muralismo"],
    Teatro: ["artes escénicas", "dramaturgia", "obras de teatro", "actuación", "puestas en escena", "obras teatrales", "teatro comunitario"],
    Danza: ["baile", "bailes", "bailarines", "danza folclórica", "ballet folclórico"],
    Literatura: ["letras", "creación literaria", "libros", "escritores", "poesía", "narrativa"],
    Patrimonio: ["patrimonio cultural", "patrimonio histórico", "monumentos históricos", "sitios históricos", "monumentos", "centros históricos", "herencia cultural", "zonas arqueológicas"],
    Artesanías: ["arte popular", "trabajos artesanales", "artesanos", "oficios artesanales", "arte tradicional", "productos artesanales"],
    Fotografía: ["fotos", "fotografía artística", "fotógrafos", "fotografía documental"],
  },
  Entretenimiento: {
    Cine: ["películas", "pelis", "cinematografía", "séptimo arte", "cineclubes", "salas de cine", "funciones de cine", "filmes"],
    Videojuegos: ["juegos de video", "gaming", "consolas", "videojugadores", "gamers", "esports", "deportes electrónicos", "juegos en línea"],
    Series: ["series de televisión", "series de tv", "series en línea", "series web"],
    Conciertos: ["recitales", "tocadas", "música en vivo", "shows en vivo", "presentaciones musicales", "eventos musicales"],
    Festivales: ["festivales culturales", "ferias", "fiestas populares", "festividades"],
    "Juegos de mesa": ["juegos de tablero", "board games", "juegos de salón", "boardgames"],
  },
  "Agua y saneamiento": {
    "Agua potable": ["agua para beber", "agua para consumo humano", "suministro de agua", "abastecimiento de agua", "agua de la llave", "acceso al agua", "servicio de agua", "red de agua potable", "falta de agua", "escasez de agua"],
    "Fugas de agua": ["fugas", "tuberías rotas", "tubos rotos", "fugas en la red", "fugas en tuberías", "tuberías dañadas", "fugas domiciliarias"],
    "Calidad del agua": ["agua contaminada", "contaminación del agua", "pureza del agua", "agua turbia", "potabilidad", "análisis de agua"],
    "Ríos y lagos": ["ríos", "lagos", "lagunas", "arroyos", "cuerpos de agua", "presas", "cauces", "manantiales", "ojos de agua", "cenotes", "riachuelos"],
    "Aguas residuales": ["aguas negras", "aguas reciduales", "aguas servidas", "aguas cloacales", "aguas sucias", "tratamiento de aguas", "plantas de tratamiento", "descargas de aguas"],
    "Captación de lluvia": ["captación de agua de lluvia", "agua de lluvia", "cosecha de lluvia", "cosecha de agua", "captación pluvial", "recolección de agua de lluvia", "aprovechamiento de lluvia", "agua pluvial", "sistemas de captación pluvial"],
  },
  "Calidad del aire": {
    Humo: ["humaredas", "humo de fábricas", "humo de chimeneas", "humo de leña"],
    Polvo: ["tolvaneras", "polvaredas", "polvo suspendido", "tierra en el aire", "remolinos de polvo"],
    "Emisiones de vehículos": ["emisiones vehiculares", "contaminación vehicular", "gases de vehículos", "gases de autos", "humo de carros", "humo de coches", "smog vehicular", "escapes de autos", "gases de escape", "contaminación de autos"],
    Quemas: ["quema de basura", "quema de llantas", "quema de pastizales", "quemas agrícolas", "quema de residuos", "quema de rastrojo", "quemas a cielo abierto"],
    "Malos olores": ["mal olor", "olores", "olores desagradables", "hedor", "pestilencia", "fetidez", "olores fétidos", "olor a drenaje"],
    Partículas: ["partículas suspendidas", "partículas contaminantes", "material particulado", "partículas finas", "polvo fino", "hollín"],
  },
  "Residuos y reciclaje": {
    Basura: ["desechos", "desperdicios", "residuos", "residuos sólidos", "residuos urbanos", "desechos sólidos"],
    Reciclaje: ["reciclado", "reciclar", "separación de basura", "separación de residuos", "reutilización", "reúso", "materiales reciclables", "centros de acopio", "economía circular"],
    Composta: ["compostaje", "compost", "abono orgánico", "lombricomposta", "vermicompostaje", "abono casero"],
    Plásticos: ["plásticos de un solo uso", "envases de plástico", "botellas de plástico", "bolsas de plástico", "popotes", "unicel", "microplásticos"],
    "Tiraderos clandestinos": ["basureros clandestinos", "tiraderos ilegales", "basureros ilegales", "vertederos clandestinos", "basureros a cielo abierto", "tiraderos a cielo abierto", "basura en baldíos"],
    "Recolección de basura": ["recolección de residuos", "recolección de desechos", "camión de la basura", "servicio de limpia", "camiones recolectores", "servicio de recolección", "limpia pública", "barrido de calles"],
  },
  Biodiversidad: {
    "Especies en peligro": ["especies amenazadas", "especies en riesgo", "especies en peligro de extinción", "animales en peligro de extinción", "especies protegidas", "especies vulnerables", "extinción de especies", "fauna en peligro"],
    "Especies invasoras": ["especies exóticas", "especies exóticas invasoras", "especies introducidas", "flora invasora", "fauna invasora", "especies no nativas"],
    Polinizadores: ["insectos polinizadores", "animales polinizadores", "polinización", "fauna polinizadora", "jardines para polinizadores"],
    Humedales: ["pantanos", "ciénagas", "marismas", "esteros", "lagunas costeras", "zonas húmedas", "tulares"],
    Manglares: ["mangles", "manga", "bosques de manglar", "ecosistemas de manglar", "zonas de manglar"],
    "Áreas naturales protegidas": ["áreas protegidas", "reservas naturales", "reservas ecológicas", "reservas de la biosfera", "parques nacionales", "anp", "zonas protegidas", "santuarios naturales", "parques naturales"],
  },
  "Plantas y jardinería": {
    Huertos: ["huertas", "huertos urbanos", "huertos familiares", "huertos caseros", "huertos escolares", "huertos comunitarios", "cultivo en casa", "agricultura urbana"],
    "Plantas medicinales": ["herbolaria", "hierbas medicinales", "plantas curativas", "hierbas curativas", "medicina herbolaria"],
    Flores: ["floricultura", "flores de ornato", "plantas de ornato", "plantas ornamentales"],
    "Cactus y suculentas": ["cactus", "suculentas", "cactáceas", "plantas crasas", "plantas del desierto"],
    "Plantas nativas": ["plantas endémicas", "plantas autóctonas", "flora nativa", "flora endémica", "flora local", "vegetación nativa", "flora autóctona", "plantas regionales"],
    "Árboles frutales": ["frutales", "árboles de fruta", "huertos frutales", "árboles con fruto", "fruticultura"],
  },
  "Espacios públicos": {
    Parques: ["parques públicos", "parques urbanos", "jardines públicos", "alamedas", "parques vecinales"],
    Plazas: ["plazuelas", "plazas públicas", "zócalos", "explanadas", "plaza principal", "jardín principal", "kioscos"],
    "Áreas verdes": ["zonas verdes", "espacios verdes", "camellones", "jardineras", "espacios arbolados", "zonas ajardinadas"],
    "Juegos infantiles": ["columpios", "resbaladillas", "áreas de juegos", "áreas infantiles", "parques infantiles", "juegos para niños", "areneros", "subibajas", "parques de juegos"],
    "Mobiliario urbano": ["equipamiento urbano", "bancas públicas", "bancas", "bebederos", "señalética urbana", "botes de basura públicos"],
    Grafiti: ["graffiti", "grafitis", "pintas", "arte urbano", "rayones en paredes"],
  },
  Seguridad: {
    Robos: ["asaltos", "hurtos", "atracos", "rateros", "robo a transeúntes", "robo a casa habitación", "robo de vehículos"],
    Iluminación: ["calles oscuras", "zonas oscuras", "calles sin luz", "luminarias apagadas"],
    Violencia: ["agresiones", "violencia comunitaria", "violencia urbana", "riñas", "peleas callejeras", "violencia social"],
    "Zonas de riesgo": ["zonas peligrosas", "lugares peligrosos", "puntos peligrosos", "colonias peligrosas", "zonas inseguras", "calles peligrosas", "focos rojos", "puntos rojos"],
    "Vigilancia vecinal": ["vecinos vigilantes", "redes vecinales", "alarmas vecinales", "comités vecinales de seguridad", "vigilancia comunitaria", "chat vecinal"],
    Extorsión: ["cobro de piso", "derecho de piso", "extorsiones telefónicas", "llamadas de extorsión", "extorsionadores", "cobro de cuota"],
  },
  "Protección civil": {
    Sismos: ["terremotos", "temblores", "movimientos telúricos", "actividad sísmica", "temblor de tierra"],
    Inundaciones: ["encharcamientos", "desbordamientos", "anegaciones", "anegamientos", "calles inundadas", "crecidas", "desbordamiento de ríos"],
    Huracanes: ["ciclones", "ciclones tropicales", "tormentas tropicales", "temporada de huracanes", "depresiones tropicales"],
    Incendios: ["incendios forestales", "incendios urbanos", "conflagraciones", "conatos de incendio", "incendios de casas"],
    Deslaves: ["derrumbes", "deslizamientos de tierra", "desgajamientos", "aludes", "deslizamientos", "derrumbes de cerros", "caída de rocas", "laderas inestables"],
    "Refugios temporales": ["albergues", "albergues temporales", "albergues de emergencia", "refugios de emergencia", "albergues para damnificados"],
    Simulacros: ["simulacros de evacuación", "ensayos de evacuación", "prácticas de evacuación", "simulacros de sismo", "ejercicios de evacuación"],
  },
  "Accesibilidad e inclusión": {
    Discapacidad: ["personas con discapacidad", "capacidades diferentes", "diversidad funcional", "personas discapacitadas", "personas con capacidades diferentes"],
    Rampas: ["rampas de acceso", "rampas para sillas de ruedas", "accesos para silla de ruedas", "rampas accesibles"],
    "Lengua de señas": ["lenguaje de señas", "lengua de señas mexicana", "intérpretes de señas", "lsm", "lengua de signos", "lenguaje de signos", "intérpretes de lengua de señas"],
    "Personas mayores": ["adultos mayores", "tercera edad", "personas de la tercera edad", "ancianos", "abuelitos", "adultos de la tercera edad", "personas adultas mayores", "gente mayor", "viejitos"],
    "Pueblos indígenas": ["comunidades indígenas", "pueblos originarios", "comunidades originarias", "indígenas", "comunidades étnicas", "pueblos nativos"],
    Neurodiversidad: ["neurodivergencia", "personas neurodivergentes", "personas neurodiversas", "neurodivergentes"],
  },
  "Igualdad de género": {
    "Violencia de género": ["violencia contra las mujeres", "violencia contra la mujer", "violencia machista", "violencia hacia las mujeres", "violencia sexista"],
    "Brecha salarial": ["desigualdad salarial", "diferencia salarial", "brecha salarial de género", "desigualdad de sueldos", "salarios desiguales", "igualdad salarial"],
    "Comunidad LGBT": ["lgbt", "lgbtq", "lgbtiq", "lgbttiq", "comunidad lgbtq", "diversidad sexual", "comunidad gay", "personas lgbt", "comunidad lgbtiq", "disidencias sexuales"],
    "Liderazgo de mujeres": ["liderazgo femenino", "mujeres líderes", "empoderamiento femenino", "empoderamiento de la mujer", "mujeres en el poder", "participación política de las mujeres", "liderazgo de la mujer"],
    Acoso: ["acoso sexual", "acoso callejero", "hostigamiento", "hostigamiento sexual", "hostigamiento callejero", "acoso en el transporte"],
    Cuidados: ["trabajo de cuidados", "economía del cuidado", "labores de cuidado", "trabajo doméstico no remunerado", "tareas de cuidado", "cuidadoras", "cuidado de personas"],
  },
  "Derechos humanos": {
    Migración: ["migrantes", "personas migrantes", "inmigración", "emigración", "migrantes en tránsito", "personas en movilidad", "refugiados", "personas refugiadas"],
    "Personas desaparecidas": ["desaparecidos", "desapariciones", "desaparición forzada", "búsqueda de personas", "madres buscadoras", "colectivos de búsqueda", "fichas de búsqueda", "personas no localizadas"],
    "Libertad de expresión": ["libertad de prensa", "libre expresión", "censura", "protección a periodistas", "libertad de opinión"],
    Niñez: ["infancia", "infancias", "niños", "niños y niñas", "derechos de la niñez", "niñas y niños", "derechos de los niños", "derechos de la infancia", "menores de edad", "infantes"],
    Discriminación: ["trato desigual", "exclusión", "trato discriminatorio", "actos discriminatorios", "desigualdad de trato"],
    "Acceso a la justicia": ["impartición de justicia", "justicia", "debido proceso", "defensoría pública", "asesoría legal", "asesoría jurídica"],
  },
  "Gobierno y participación ciudadana": {
    Transparencia: ["rendición de cuentas", "acceso a la información", "gobierno abierto", "información pública", "transparencia gubernamental"],
    "Presupuesto participativo": ["presupuesto ciudadano", "presupuesto comunitario", "obras decididas por vecinos"],
    Elecciones: ["votaciones", "comicios", "procesos electorales", "votar", "voto", "jornada electoral", "elecciones locales"],
    "Servicios públicos": ["servicios municipales", "servicios del ayuntamiento", "servicios urbanos", "servicios de gobierno"],
    Trámites: ["gestiones", "papeleo", "trámites gubernamentales", "trámites burocráticos", "tramitología", "ventanillas", "trámites en línea", "gestiones de gobierno"],
    "Consulta ciudadana": ["consulta pública", "consulta popular", "plebiscito", "referéndum", "consulta vecinal", "consulta indígena", "encuestas ciudadanas"],
  },
  Vivienda: {
    Renta: ["alquiler", "arrendamiento", "renta de vivienda", "alquiler de vivienda", "costo de la renta", "inquilinos"],
    "Asentamientos irregulares": ["asentamientos informales", "colonias irregulares", "invasiones", "paracaidistas", "colonias sin regularizar", "terrenos irregulares", "predios invadidos"],
    Hacinamiento: ["sobrepoblación en vivienda", "vivienda saturada", "viviendas hacinadas", "casas sobrepobladas"],
    "Vivienda social": ["vivienda de interés social", "casas de interés social", "vivienda popular", "vivienda económica", "vivienda asequible", "vivienda digna", "créditos para vivienda", "infonavit"],
    "Servicios básicos": ["agua y luz", "luz y agua", "servicios de vivienda", "agua luz y drenaje", "servicios en la vivienda"],
    Desalojos: ["desahucios", "desalojos forzados", "lanzamientos", "despojos", "desalojos de vivienda"],
  },
  Agricultura: {
    Cultivos: ["siembras", "sembradíos", "cosechas", "milpas", "parcelas", "cultivos agrícolas", "producción agrícola"],
    Plagas: ["plagas agrícolas", "control de plagas", "insectos dañinos", "fumigación de cultivos"],
    Riego: ["irrigación", "sistemas de riego", "riego agrícola", "riego por goteo", "canales de riego", "agua para riego"],
    Ganadería: ["ganado", "crianza de ganado", "ganaderos", "crianza de animales", "ranchos ganaderos", "producción pecuaria"],
    Pesca: ["pesquerías", "pesca artesanal", "pescadores", "pesca ribereña", "captura de peces", "actividad pesquera"],
    Semillas: ["semillas nativas", "semillas criollas", "bancos de semillas", "intercambio de semillas", "semillas locales"],
    Suelos: ["tierras de cultivo", "fertilidad del suelo", "salud del suelo", "suelo fértil", "erosión del suelo"],
  },
  "Cocina y alimentación": {
    Recetas: ["recetarios", "recetas de cocina", "platillos", "guisos", "preparación de alimentos"],
    "Comida tradicional": ["gastronomía tradicional", "cocina tradicional", "comida típica", "platillos típicos", "cocina mexicana", "comida mexicana", "antojitos", "comida regional", "cocina regional", "platillos regionales"],
    Mercados: ["tianguis", "mercados municipales", "mercados públicos", "mercaditos", "mercados sobre ruedas", "centrales de abasto"],
    "Desperdicio de alimentos": ["desperdicio de comida", "comida desperdiciada", "merma de alimentos", "comida tirada", "pérdida de alimentos", "sobras de comida", "tirar comida"],
    "Comedores comunitarios": ["comedores populares", "comedores sociales", "comedores públicos", "comedores gratuitos", "cocinas comunitarias", "comedores de beneficencia", "ollas comunes"],
    "Precios de alimentos": ["costo de alimentos", "costo de la comida", "precio de la comida", "canasta básica", "carestía de alimentos", "inflación de alimentos", "aumento de precios de la comida"],
  },
  "Trabajo y economía": {
    Empleo: ["bolsa de trabajo", "vacantes", "ofertas de empleo", "búsqueda de empleo", "fuentes de empleo", "oportunidades laborales"],
    Emprendimiento: ["emprendedores", "startups", "negocios propios", "emprender", "pequeñas empresas", "nuevos negocios", "pymes", "mipymes"],
    "Comercio local": ["negocios locales", "pequeños negocios", "tienditas", "tiendas de barrio", "consumo local", "comercios locales", "comprar local", "negocios del barrio", "tiendas de la esquina"],
    Precios: ["inflación", "carestía", "costo de vida", "alza de precios", "aumento de precios", "subida de precios"],
    "Trabajo informal": ["empleo informal", "comercio informal", "economía informal", "ambulantes", "vendedores ambulantes", "informalidad", "trabajo por cuenta propia", "vendedores informales", "puestos callejeros"],
    Turismo: ["actividad turística", "turistas", "turismo local", "turismo comunitario", "atractivos turísticos"],
  },
  Tecnología: {
    Internet: ["conectividad", "wifi", "acceso a internet", "internet gratuito", "internet público", "señal de internet", "conexión a internet", "banda ancha"],
    "Inteligencia artificial": ["aprendizaje automático", "machine learning", "ia", "redes neuronales", "aprendizaje profundo"],
    Programación: ["desarrollo de software", "desarrollo web", "código", "programadores", "desarrolladores", "software"],
    Ciberseguridad: ["seguridad informática", "seguridad digital", "seguridad en internet", "hackeos", "fraudes en línea", "protección de datos"],
    "Brecha digital": ["desigualdad digital", "rezago digital", "exclusión digital", "rezago tecnológico", "acceso a la tecnología", "analfabetismo digital"],
    Robótica: ["robots", "automatización", "mecatrónica"],
    Aplicaciones: ["apps", "apps móviles", "aplicaciones móviles", "aplicaciones web", "apps para celular", "aplicaciones para celular"],
  },
  Deporte: {
    Fútbol: ["futbol soccer", "soccer", "balompié", "futbolito", "futbol rápido", "fut"],
    Básquetbol: ["baloncesto", "básquet", "basket", "basketball", "basketbol"],
    Béisbol: ["baseball", "beis", "pelota caliente"],
    Atletismo: ["carreras", "carreras pedestres", "maratones", "corredores", "running", "trote"],
    Natación: ["nado", "nadar", "nadadores"],
    Ciclismo: ["ciclistas", "ciclismo de ruta", "ciclismo de montaña", "rodadas ciclistas", "bicicleta de montaña", "bmx"],
    Voleibol: ["volibol", "vóley", "volley", "volleyball", "vóley de playa"],
    "Instalaciones deportivas": ["canchas", "unidades deportivas", "centros deportivos", "polideportivos", "estadios", "gimnasios", "deportivos", "campos deportivos", "albercas", "pistas deportivas"],
  },
  "Aire libre": {
    Senderismo: ["excursionismo", "caminatas", "hiking", "trekking", "caminatas en la naturaleza", "paseos por el campo"],
    Campismo: ["acampar", "acampada", "camping", "campamentos"],
    Playas: ["costas", "litoral", "zonas costeras"],
    Montañas: ["cerros", "sierras", "cumbres", "serranías"],
    "Observación de aves": ["avistamiento de aves", "pajareo", "birdwatching", "aviturismo", "observar aves", "pajarear"],
    "Pesca deportiva": ["pesca recreativa", "pesca con caña", "pesca de río", "pesca con mosca"],
    Escalada: ["alpinismo", "rápel", "escalada en roca", "escalar", "escaladores", "boulder", "montañismo"],
  },
};

/** Sin acentos ni mayúsculas y en singular: "Aguas Negras" y "agua negra" dan lo mismo. */
function comparable(nombre: string): string {
  // claveDeTematica otra vez al final: singular() le devuelve el acento a "canciones" → "canción".
  return claveDeTematica(claveDeTematica(nombre).split(" ").filter(Boolean).map(singular).join(" "));
}

/** Palabras que no cambian el significado: "Calles y banquetas" y "Banquetas, calles" son lo mismo. */
const PALABRAS_VACIAS = new Set([
  "a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "lo", "los", "o", "para", "por", "u", "un", "una", "unas", "unos", "y",
]);

/** Al inicio no dicen de qué trata: "Campaña de vacunación" y "Problemas de baches" son Vacunación y Baches. */
const MULETILLAS_AL_INICIO = new Set(["acerca", "asunto", "campana", "iniciativa", "problema", "programa", "proyecto", "sobre", "tema"]);

/**
 * Cómo suena la palabra: el error de ortografía más común en español no cambia el sonido.
 * "Reciclage" = "Reciclaje", "Bacunación" = "Vacunación", "Yuvia" = "Lluvia", "Ospital" = "Hospital".
 */
function sonido(palabra: string): string {
  return palabra
    .replace(/ch/g, "1")
    .replace(/gu(?=[ei])/g, "2")
    .replace(/g(?=[ei])/g, "j")
    .replace(/2/g, "g")
    .replace(/qu(?=[ei])/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/z/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/v/g, "b")
    .replace(/h/g, "")
    .replace(/ll/g, "y")
    .replace(/(.)\1+/g, "$1");
}

/** Singular también en palabras cortas ("Ríos", "Aves") y sin diminutivo ("gatito" → "gato"). */
function sinVariantes(palabra: string): string {
  const una = claveDeTematica(singular(palabra));
  const sinPlural = una === palabra && una.length === 4 && /[aeo]s$/.test(una) ? una.slice(0, -1) : una;
  return sinPlural.replace(/^(.{3,})it([oa])$/, "$1$2");
}

/**
 * Sin la "e" final tras consonante: singular() le quita "es" completo a "mangles" y "calles" ("mangl",
 * "call") y deja igual a "mangle" y "calle". Sin ella, plural y singular coinciden.
 */
function sinEFinal(palabra: string): string {
  return palabra.replace(/([^aeiou])e$/, "$1");
}

/** La palabra lista para compararla en un texto. */
export function palabraBase(palabra: string): string {
  return sinEFinal(sinVariantes(palabra));
}

/** Las palabras que importan de un nombre, ya como suenan, en el orden en que se escribieron. */
export function palabrasQueImportan(nombre: string): string[] {
  const todas = claveDeTematica(nombre).split(" ").filter(Boolean);
  const llenas = todas.filter((p) => !PALABRAS_VACIAS.has(p));
  const base = (llenas.length > 0 ? llenas : todas).map(sinVariantes);
  const utiles = base.length > 1 && MULETILLAS_AL_INICIO.has(base[0]) ? base.slice(1) : base;
  // La "e" se quita después del sonido: es la que hace que la "g" de "reciclage" suene a "j".
  return utiles.map((p) => sinEFinal(sonido(p)));
}

type Forma = {
  palabras: string[];
  /** Sin importar el orden: "Banquetas y calles" = "Calles y banquetas". */
  ordenada: string;
  /** Sin espacios: "Video juegos" = "Videojuegos". */
  junta: string;
};

function formaDe(nombre: string): Forma {
  const palabras = palabrasQueImportan(nombre);
  return { palabras, ordenada: [...palabras].sort().join(" "), junta: palabras.join("") };
}

function mismaForma(a: Forma, b: Forma): boolean {
  return a.junta !== "" && (a.ordenada === b.ordenada || a.junta === b.junta);
}

/** Distancia de edición con trasposición (Damerau-Levenshtein): "potabel" y "potable" están a 1. */
function distancia(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cambio = a[i - 1] === b[j - 1] ? 0 : 1;
      filas[i][j] = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + cambio);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        filas[i][j] = Math.min(filas[i][j], filas[i - 2][j - 2] + 1);
      }
    }
  }
  return filas[a.length][b.length];
}

/**
 * Erratas al teclear. A propósito estricto, porque aquí un acierto falso impide proponer una etiqueta
 * real: una sola letra de diferencia, nunca en la primera ("Renta" no es "Venta"), desde 6 letras; y
 * cambiar una letra por otra (sin que falte, sobre o se volteen) solo desde 9: "Playas" no es "Plagas"
 * ni "Donación" es "Dotación".
 */
function esErrata(a: string, b: string): boolean {
  if (a === b) return true;
  const largo = Math.min(a.length, b.length);
  if (largo < 6 || a[0] !== b[0] || distancia(a, b) !== 1) return false;
  const cambiaUnaLetra = a.length === b.length && [...a].filter((letra, i) => letra !== b[i]).length === 1;
  return !cambiaUnaLetra || largo >= 9;
}

function conErrata(a: Forma, b: Forma): boolean {
  return a.palabras.length === b.palabras.length && a.palabras.every((p, i) => esErrata(p, b.palabras[i]));
}

type Grupo = { tematica: string; etiqueta: string; terminos: string[]; claves: Set<string>; formas: Forma[] };

const GRUPOS: Grupo[] = Object.entries(DICCIONARIO_DE_SUBTEMATICAS).flatMap(([tematica, subtematicas]) =>
  Object.entries(subtematicas).map(([etiqueta, sinonimos]) => {
    const terminos = [etiqueta, ...sinonimos];
    return {
      tematica: claveDeTematica(tematica),
      etiqueta,
      terminos,
      claves: new Set(terminos.map(comparable)),
      formas: terminos.map(formaDe),
    };
  }),
);

/** Los grupos de una temática; sin temática, todos (para quien no la sabe). */
function gruposDe(tematica: string | undefined): Grupo[] {
  if (tematica === undefined) return GRUPOS;
  const clave = claveDeTematica(tematica);
  return GRUPOS.filter((g) => g.tematica === clave);
}

/**
 * Las candidatas que coinciden según `coincide`, comparando el texto con cada una y con los sinónimos
 * de su grupo. Sin repetir, para saber si hay más de una.
 */
function coincidencias(forma: Forma, candidatas: string[], coincide: (a: Forma, b: Forma) => boolean, grupos: Grupo[]): string[] {
  const halladas = new Set(candidatas.filter((c) => coincide(forma, formaDe(c))));
  for (const grupo of grupos) {
    if (!grupo.formas.some((f) => coincide(forma, f))) continue;
    for (const c of candidatas) {
      if (grupo.claves.has(comparable(c)) || grupo.formas.some((f) => mismaForma(formaDe(c), f))) halladas.add(c);
    }
  }
  return [...halladas];
}

/**
 * De `candidatas` (las etiquetas de UNA temática), la que significa lo mismo que `escrito`, o null. De
 * lo más seguro a lo menos: la misma palabra en singular o plural ("Perro" → "Perros"); un sinónimo de
 * la lista; lo mismo escrito de otra forma (orden, palabras vacías, espacios, muletillas, ortografía o
 * diminutivo: "Banquetas y calles", "Video juegos", "Reciclage", "Campaña de vacunación"); y, con
 * `erratas` (por defecto), una errata al teclear ("Agua potabel"), también en un sinónimo ("Aguas
 * negars"). Si en estos dos últimos pasos caben varias, no se elige ninguna: mejor proponer que
 * cambiarle a alguien su etiqueta por otra que no pidió.
 * Un grupo cuenta aunque su etiqueta principal ya no esté: con "Aguas negras" en el catálogo, "Aguas
 * servidas" también coincide. Solo se compara dentro de la temática: "Albergues" es Refugios en
 * Protección animal y Refugios temporales en Protección civil. Con `tematica` (2026-11-11) solo se usan
 * las variantes del diccionario de esa temática; sin ella, las de todas.
 */
export function etiquetaEquivalente(
  escrito: string,
  candidatas: string[],
  { erratas = true, tematica }: { erratas?: boolean; tematica?: string } = {},
): string | null {
  const buscada = comparable(escrito);
  if (!buscada) return null;
  const mismaPalabra = candidatas.find((c) => comparable(c) === buscada);
  if (mismaPalabra) return mismaPalabra;
  const grupos = gruposDe(tematica);
  for (const grupo of grupos) {
    if (!grupo.claves.has(buscada)) continue;
    const sinonimo = candidatas.find((c) => grupo.claves.has(comparable(c)));
    if (sinonimo) return sinonimo;
  }
  const forma = formaDe(escrito);
  const iguales = coincidencias(forma, candidatas, mismaForma, grupos);
  if (iguales.length > 0) return iguales.length === 1 ? iguales[0] : null;
  if (!erratas) return null;
  const parecidas = coincidencias(forma, candidatas, conErrata, grupos);
  return parecidas.length === 1 ? parecidas[0] : null;
}

/** Sinónimos que en un texto libre suelen significar otra cosa: "leo manga" no habla de manglares. */
export const SOLO_AL_PROPONER = new Set(["manga"]);

/**
 * Los términos que nombran a una etiqueta en un texto libre: ella y los sinónimos de su grupo. Lo usa
 * lib/etiquetas/desde-texto.ts para reconocerla ("lomitos" → Perros). Con `tematica` (2026-11-11), solo
 * los grupos de esa temática: antes "Fauna silvestre" (Animales) tomaba "vida animal" de Fauna (Medio
 * ambiente) porque las dos tenían la variante "fauna silvestre".
 */
export function terminosDeEtiqueta(nombre: string, tematica?: string): string[] {
  const clave = comparable(nombre);
  const terminos = new Set([nombre]);
  for (const grupo of gruposDe(tematica)) {
    if (grupo.terminos.some((t) => comparable(t) === clave)) grupo.terminos.forEach((t) => terminos.add(t));
  }
  return [...terminos].filter((t) => !SOLO_AL_PROPONER.has(t));
}
