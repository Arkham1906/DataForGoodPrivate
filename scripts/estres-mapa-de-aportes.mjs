#!/usr/bin/env node
// Prueba de carga del mapa de aportes de /mis-aportes (solo desarrollo; reconstruido el 2026-11-13 a partir de
// docs: claude/pantallas-v12/mapa-prueba-de-carga.md). Crea campañas «[Prueba] …» y les mete aportes a un ritmo que
// sube con el tiempo, mientras una revisión simulada acepta (con calificación) o rechaza los pendientes. Sirve para
// ver el mapa actualizarse en vivo con muchos aportes, temáticas y subtemáticas.
//
// Uso:
//   node scripts/estres-mapa-de-aportes.mjs --usuario <correo> [--creador <correo>] [--duracion 120] [--inicial 2]
//        [--incremento 2] [--paso 10] [--tope 40] [--campanas 16] [--tematicas 8] [--escenario variado|otras]
//   node scripts/estres-mapa-de-aportes.mjs --limpiar
//
// Ritmo: --inicial aportes/s durante los primeros --paso s; luego +--incremento cada --paso s, hasta --tope. Un
// INSERT por segundo (un solo aviso en vivo por segundo).
// Revisión simulada: cada 2 s, parte de los pendientes con más de 3 s pasa a aceptado (calificación 1–5) o a
// rechazado. La EXP NO la da este script: la reparte el barrido normal (repararRecompensasPendientes, cada minuto,
// a los aceptados hace más de 1 min). Ver EXP, rango y medallas tarda 1–2 min tras la aceptación.
// Escenarios:
//   variado (por defecto): dos campañas por temática; la segunda comparte una subtemática con la primera y tiene 5
//     (líneas punteadas). Las que sobran tienen 0 o 1 subtemática («Sin subtemática»).
//   otras: 9 campañas de una sola temática, cada una con una subtemática distinta, se llevan casi todo (fuerza «Otras»).
// En los dos: nombres de más de 100 caracteres, campañas con y sin meta y con cuota, tres campañas que acaparan los
// aportes (fuerza «+N») y un 25 % de aportes de otras personas (mueve la meta colectiva). Sin campañas especiales
// (descartadas por el equipo el 2026-11-13).
// Candados: se niega con NODE_ENV=production y con una base que no sea local (localhost, 127.0.0.1, ::1 o «postgres»,
// el host del compose), salvo --permitir-remoto.
// Limpieza (--limpiar): borra las campañas «[Prueba]» (en cascada: aportes, subtemáticas, tipos, bonos, estadísticas)
// y las cuentas de apoyo estres-otra-N@prueba.local. NO revierte EXP, rangos ni medallas ya ganados.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

// --- Argumentos ---------------------------------------------------------------------------------------------------

const NUMERICOS = { duracion: 120, inicial: 2, incremento: 2, paso: 10, tope: 40, campanas: 16, tematicas: 8 };
const args = { escenario: "variado", usuario: null, creador: null, limpiar: false, permitirRemoto: false, ...NUMERICOS };
const crudos = process.argv.slice(2);
for (let i = 0; i < crudos.length; i++) {
  const a = crudos[i];
  const valor = () => {
    const v = crudos[++i];
    if (v === undefined || v.startsWith("--")) salir(`Falta el valor de ${a}.`);
    return v;
  };
  if (a === "--limpiar") args.limpiar = true;
  else if (a === "--permitir-remoto") args.permitirRemoto = true;
  else if (a === "--usuario") args.usuario = valor().toLowerCase();
  else if (a === "--creador") args.creador = valor().toLowerCase();
  else if (a === "--escenario") args.escenario = valor();
  else if (a === "--ayuda" || a === "-h") salir(null, 0);
  else if (a.startsWith("--") && a.slice(2) in NUMERICOS) {
    const n = Number(valor());
    if (!Number.isFinite(n) || n < 0) salir(`${a} debe ser un número ≥ 0.`);
    args[a.slice(2)] = n;
  } else salir(`Opción desconocida: ${a}`);
}
if (!["variado", "otras"].includes(args.escenario)) salir("--escenario debe ser variado u otras.");
if (!args.limpiar && !args.usuario) salir("Falta --usuario <correo>.");
args.campanas = Math.max(1, Math.round(args.campanas));
args.tematicas = Math.max(1, Math.round(args.tematicas));
args.paso = Math.max(1, args.paso);

function salir(mensaje, codigo = 1) {
  if (mensaje) console.error(`✖ ${mensaje}\n`);
  console.error(
    "Uso: node scripts/estres-mapa-de-aportes.mjs --usuario <correo> [--creador <correo>] [--duracion 120] [--inicial 2]\n" +
      "       [--incremento 2] [--paso 10] [--tope 40] [--campanas 16] [--tematicas 8] [--escenario variado|otras]\n" +
      "     node scripts/estres-mapa-de-aportes.mjs --limpiar",
  );
  process.exit(codigo);
}

// --- Conexión y candados ------------------------------------------------------------------------------------------

const envLocal = resolve(process.cwd(), ".env.local");
if (!process.env.DATABASE_URL && existsSync(envLocal)) process.loadEnvFile?.(envLocal);
if (!process.env.DATABASE_URL) salir("No hay DATABASE_URL (ni en el entorno ni en .env.local).");
if (process.env.NODE_ENV === "production") salir("NODE_ENV=production: este script solo corre en desarrollo.");
const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(host) && !args.permitirRemoto) {
  salir(`La base está en «${host || "?"}», no es local. Si de verdad es de pruebas, agrega --permitir-remoto.`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const q = (sql, params) => pool.query(sql, params);

const PREFIJO = "[Prueba]";
const CORREO_DE_APOYO = (n) => `estres-otra-${n}@prueba.local`;
const TIPOS = ["foto", "texto", "video", "audio", "documento"];

// --- Limpieza -----------------------------------------------------------------------------------------------------

async function limpiar() {
  const c = await q(`DELETE FROM campanas WHERE name LIKE $1 RETURNING id`, [`${PREFIJO}%`]);
  let cuentas = 0;
  try {
    const u = await q(`DELETE FROM usuarios WHERE email LIKE 'estres-otra-%@prueba.local' RETURNING id`);
    cuentas = u.rowCount;
  } catch (e) {
    console.warn(`  (No se pudieron borrar las cuentas de apoyo: ${e.message})`);
  }
  console.log(`✔ Borradas ${c.rowCount} campañas ${PREFIJO} con sus aportes, y ${cuentas} cuentas de apoyo.`);
  console.log("  La EXP, los rangos y las medallas ya ganados no se revierten.");
}

// --- Preparación --------------------------------------------------------------------------------------------------

async function idDe(correo) {
  const r = await q(`SELECT id, nombre, apellidos FROM usuarios WHERE LOWER(email) = $1`, [correo]);
  if (!r.rows[0]) salir(`No existe la cuenta ${correo}.`);
  return r.rows[0];
}

async function cuentasDeApoyo() {
  const ids = [];
  for (let n = 1; n <= 3; n++) {
    const r = await q(
      `INSERT INTO usuarios (nombre, apellidos, email, email_verificado) VALUES ($1, 'Estrés', $2, true)
        ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, nombre`,
      [`Otra ${n}`, CORREO_DE_APOYO(n)],
    );
    ids.push(r.rows[0]);
  }
  return ids;
}

/** Temáticas del catálogo con sus subtemáticas aprobadas (las de más subtemáticas primero). */
async function catalogo() {
  const r = await q(
    `SELECT t.nombre, array_agg(e.id ORDER BY e.id) AS etiquetas
       FROM tematicas t JOIN etiquetas e ON e.tematica_id = t.id AND e.aprobada AND NOT e.oculta
      GROUP BY t.id, t.nombre
     HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC, t.nombre`,
  );
  if (r.rows.length === 0) salir("No hay temáticas con subtemáticas aprobadas en el catálogo.");
  return r.rows;
}

const LARGO =
  "con un nombre deliberadamente larguísimo para comprobar que el mapa, el panel y la lista recortan bien el texto";

/** Plan de campañas: { nombre, tematica, etiquetas[], meta, cuota, peso }. */
function planear(temas) {
  const plan = [];
  if (args.escenario === "otras") {
    const grande = temas.find((t) => t.etiquetas.length >= 9) ?? temas[0];
    const cuantas = Math.min(9, grande.etiquetas.length, args.campanas);
    for (let k = 0; k < cuantas; k++) plan.push({ tematica: grande.nombre, etiquetas: [grande.etiquetas[k]], peso: 8 });
    const resto = temas.filter((t) => t !== grande).slice(0, Math.max(0, args.tematicas - 1));
    for (let i = 0; plan.length < args.campanas && resto.length; i++) {
      const t = resto[i % resto.length];
      plan.push({ tematica: t.nombre, etiquetas: t.etiquetas.slice(0, 1 + (i % 2)), peso: 1 });
    }
  } else {
    const usadas = temas.slice(0, args.tematicas);
    for (let i = 0; i < args.campanas; i++) {
      const t = usadas[i % usadas.length];
      const k = Math.floor(i / usadas.length);
      const e = t.etiquetas;
      const etiquetas =
        k === 0 ? e.slice(0, 2) : k === 1 ? e.slice(1, 6) : i % 2 === 0 ? [] : [e[(k + i) % e.length]];
      plan.push({ tematica: t.nombre, etiquetas, peso: 2 });
    }
  }
  // Tres campañas acaparan (fuerza «+N»): en temáticas distintas cuando se puede.
  const vistas = new Set();
  let acaparan = 0;
  for (const c of plan) {
    if (acaparan === 3) break;
    if (vistas.has(c.tematica) && plan.some((o) => !vistas.has(o.tematica))) continue;
    vistas.add(c.tematica);
    c.peso += 10;
    acaparan++;
  }
  plan.forEach((c, i) => {
    const largo = i % 4 === 1;
    c.nombre = `${PREFIJO} ${c.tematica} ${i + 1}${largo ? ` ${LARGO}` : ""}`.slice(0, 200);
    c.meta = i % 3 === 0 ? 0 : [30, 80, 200][i % 3];
    c.cuota = [1, 3, 5][i % 3];
  });
  return plan;
}

async function crearCampanas(plan, creador) {
  const nombreCreador = `${creador.nombre} ${creador.apellidos ?? ""}`.trim();
  for (const c of plan) {
    const r = await q(
      `INSERT INTO campanas (creator_id, creator_name, name, description, tematica, tag, status, goal_contributions,
                             quota_per_user, start_date, end_date, todo_el_pais)
       VALUES ($1, $2, $3, 'Campaña generada por scripts/estres-mapa-de-aportes.mjs.', $4, $4, 'activa', $5, $6,
               CURRENT_DATE, CURRENT_DATE + 30, true)
       RETURNING id`,
      [creador.id, nombreCreador, c.nombre, c.tematica, c.meta, c.cuota],
    );
    c.id = r.rows[0].id;
    for (const [orden, tipo] of TIPOS.entries()) {
      await q(`INSERT INTO campana_tipos (campana_id, tipo, orden) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
        c.id,
        tipo,
        orden + 1,
      ]);
    }
    for (const e of c.etiquetas) {
      await q(`INSERT INTO campana_etiquetas (campana_id, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [c.id, e]);
    }
  }
}

// --- Carga --------------------------------------------------------------------------------------------------------

function elegirPorPeso(plan) {
  const total = plan.reduce((s, c) => s + c.peso, 0);
  let r = Math.random() * total;
  for (const c of plan) if ((r -= c.peso) < 0) return c;
  return plan[plan.length - 1];
}

async function insertarTanda(n, plan, tu, otras) {
  if (n <= 0) return;
  const valores = [];
  const params = [];
  for (let i = 0; i < n; i++) {
    const c = elegirPorPeso(plan);
    const quien = Math.random() < 0.25 ? otras[Math.floor(Math.random() * otras.length)] : tu;
    const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
    const b = params.length;
    valores.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, NOW())`);
    params.push(c.id, quien.id, quien.nombre, `Aporte de prueba (${tipo}) para ${c.nombre}`, tipo);
  }
  await q(
    `INSERT INTO aportes (campaign_id, user_id, participant_name, description, file_type, submitted_at)
     VALUES ${valores.join(", ")}`,
    params,
  );
}

/** Revisión simulada: ~60 % de los pendientes con más de 3 s; 85 % aceptados (más 3★–5★), 15 % rechazados. */
async function revisar() {
  const r = await q(
    `WITH elegidos AS (
       SELECT a.id, random() AS dado FROM aportes a JOIN campanas c ON c.id = a.campaign_id
        WHERE c.name LIKE $1 AND a.status = 'pendiente' AND a.submitted_at < NOW() - INTERVAL '3 seconds'
          AND random() < 0.6
     )
     UPDATE aportes a SET
       status = CASE WHEN e.dado < 0.85 THEN 'aceptado' ELSE 'rechazado' END,
       calificacion = CASE WHEN e.dado < 0.85 THEN
         (ARRAY[1,2,3,3,4,4,4,5,5])[1 + floor(random() * 9)::int] END,
       rejection_reason = CASE WHEN e.dado >= 0.85 THEN 'Rechazo simulado por la prueba de carga.' END,
       reviewed_at = NOW(), updated_at = NOW()
     FROM elegidos e WHERE a.id = e.id
     RETURNING a.status`,
    [`${PREFIJO}%`],
  );
  const aceptados = r.rows.filter((f) => f.status === "aceptado").length;
  return { aceptados, rechazados: r.rows.length - aceptados };
}

async function correr() {
  const tu = await idDe(args.usuario);
  const creador = args.creador ? await idDe(args.creador) : tu;
  const lanz = await q(`SELECT MIN(lanzamiento_en) AS l FROM parametros_gamificacion`).catch(() => ({ rows: [{}] }));
  if (!lanz.rows[0]?.l) console.warn("⚠ parametros_gamificacion no tiene lanzamiento_en: los aceptados no darán EXP.");

  const otras = await cuentasDeApoyo();
  const plan = planear(await catalogo());
  await crearCampanas(plan, creador);
  const temas = new Set(plan.map((c) => c.tematica));
  console.log(
    `✔ ${plan.length} campañas ${PREFIJO} en ${temas.size} temáticas (escenario ${args.escenario}).\n` +
      `  Abre /mis-aportes con ${args.usuario}. Ctrl+C detiene la carga (las campañas quedan; bórralas con --limpiar).\n`,
  );

  let detener = false;
  process.on("SIGINT", () => {
    if (detener) process.exit(130);
    detener = true;
    console.log("\n… deteniendo (Ctrl+C otra vez para salir ya)");
  });

  const inicio = Date.now();
  let enviados = 0;
  let aceptados = 0;
  let rechazados = 0;
  let segundo = 0;
  while (!detener && segundo < args.duracion) {
    const ritmo = Math.min(args.tope, args.inicial + args.incremento * Math.floor(segundo / args.paso));
    await insertarTanda(Math.round(ritmo), plan, tu, otras);
    enviados += Math.round(ritmo);
    if (segundo % 2 === 1) {
      const r = await revisar();
      aceptados += r.aceptados;
      rechazados += r.rechazados;
    }
    if (segundo % 5 === 0) {
      console.log(
        `t=${String(segundo).padStart(3)} s  ritmo ${String(ritmo).padStart(2)}/s  enviados ${enviados}  aceptados ${aceptados}  rechazados ${rechazados}`,
      );
    }
    segundo++;
    const espera = inicio + segundo * 1000 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  }
  console.log(
    `\n✔ Fin: ${enviados} aportes en ${segundo} s; ${aceptados} aceptados, ${rechazados} rechazados, el resto en revisión.\n` +
      "  La EXP de los aceptados llega con el barrido de cada minuto (1–2 min).",
  );
}

try {
  if (args.limpiar) await limpiar();
  else await correr();
} catch (e) {
  console.error("✖ Error:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
