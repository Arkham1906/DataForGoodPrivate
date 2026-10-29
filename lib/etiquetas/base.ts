// Etiquetas base de cada temática base (2026-10-28, a pedido del usuario: que al elegir sus intereses
// la persona encuentre subtemáticas como Perros, Gatos o Aves en Animales). Se siembran al arrancar
// (lib/db-schema.ts, ensureEtiquetasTables) como si las hubiera creado el SuperUsuario (origen 'panel',
// aprobadas), una sola vez por temática (`tematicas.etiquetas_sembradas`): si después el SuperUsuario
// borra u oculta alguna, no vuelve. Ninguna se llama igual que una temática (regla de catalogo.ts).
// Sin imports de servidor.

export const ETIQUETAS_BASE: Record<string, string[]> = {
  "Medio ambiente": ["Cambio climático", "Contaminación", "Deforestación", "Conservación", "Energía renovable", "Educación ambiental", "Fauna", "Árboles"],
  Salud: ["Salud mental", "Nutrición", "Vacunación", "Diabetes", "Salud materna", "Adicciones", "Enfermedades infecciosas", "Primeros auxilios"],
  Educación: ["Escuelas", "Alfabetización", "Educación inicial", "Bibliotecas", "Deserción escolar", "Becas", "Educación digital"],
  Infraestructura: ["Calles y banquetas", "Baches", "Alumbrado público", "Puentes", "Drenaje", "Edificios públicos"],
  "Protección animal": ["Adopción", "Rescate", "Esterilización", "Maltrato animal", "Animales callejeros", "Refugios", "Tenencia responsable"],
  Animales: ["Perros", "Gatos", "Aves", "Peces", "Reptiles", "Insectos", "Caballos", "Animales de granja", "Fauna silvestre"],
  Movilidad: ["Transporte público", "Bicicleta", "Peatones", "Tráfico", "Accidentes viales", "Estacionamiento"],
  "Arte y cultura": ["Música", "Pintura", "Teatro", "Danza", "Literatura", "Patrimonio", "Artesanías", "Fotografía"],
  Entretenimiento: ["Cine", "Videojuegos", "Series", "Conciertos", "Festivales", "Juegos de mesa"],
  "Agua y saneamiento": ["Agua potable", "Fugas de agua", "Calidad del agua", "Ríos y lagos", "Aguas residuales", "Captación de lluvia"],
  "Calidad del aire": ["Humo", "Polvo", "Emisiones de vehículos", "Quemas", "Malos olores", "Partículas"],
  "Residuos y reciclaje": ["Basura", "Reciclaje", "Composta", "Plásticos", "Tiraderos clandestinos", "Recolección de basura"],
  Biodiversidad: ["Especies en peligro", "Especies invasoras", "Polinizadores", "Humedales", "Manglares", "Áreas naturales protegidas"],
  "Plantas y jardinería": ["Huertos", "Plantas medicinales", "Flores", "Cactus y suculentas", "Plantas nativas", "Árboles frutales"],
  "Espacios públicos": ["Parques", "Plazas", "Áreas verdes", "Juegos infantiles", "Mobiliario urbano", "Grafiti"],
  Seguridad: ["Robos", "Iluminación", "Violencia", "Zonas de riesgo", "Vigilancia vecinal", "Extorsión"],
  "Protección civil": ["Sismos", "Inundaciones", "Huracanes", "Incendios", "Deslaves", "Refugios temporales", "Simulacros"],
  "Accesibilidad e inclusión": ["Discapacidad", "Rampas", "Lengua de señas", "Personas mayores", "Pueblos indígenas", "Neurodiversidad"],
  "Igualdad de género": ["Violencia de género", "Brecha salarial", "Comunidad LGBT", "Liderazgo de mujeres", "Acoso", "Cuidados"],
  "Derechos humanos": ["Migración", "Personas desaparecidas", "Libertad de expresión", "Niñez", "Discriminación", "Acceso a la justicia"],
  "Gobierno y participación ciudadana": ["Transparencia", "Presupuesto participativo", "Elecciones", "Servicios públicos", "Trámites", "Consulta ciudadana"],
  Vivienda: ["Renta", "Asentamientos irregulares", "Hacinamiento", "Vivienda social", "Servicios básicos", "Desalojos"],
  Agricultura: ["Cultivos", "Plagas", "Riego", "Ganadería", "Pesca", "Semillas", "Suelos"],
  "Cocina y alimentación": ["Recetas", "Comida tradicional", "Mercados", "Desperdicio de alimentos", "Comedores comunitarios", "Precios de alimentos"],
  "Trabajo y economía": ["Empleo", "Emprendimiento", "Comercio local", "Precios", "Trabajo informal", "Turismo"],
  Tecnología: ["Internet", "Inteligencia artificial", "Programación", "Ciberseguridad", "Brecha digital", "Robótica", "Aplicaciones"],
  Deporte: ["Fútbol", "Básquetbol", "Béisbol", "Atletismo", "Natación", "Ciclismo", "Voleibol", "Instalaciones deportivas"],
  "Aire libre": ["Senderismo", "Campismo", "Playas", "Montañas", "Observación de aves", "Pesca deportiva", "Escalada"],
};
