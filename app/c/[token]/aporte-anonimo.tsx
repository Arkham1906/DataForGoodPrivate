"use client";

// Formulario para aportar SIN cuenta, de /c/[token] y /participa/[id] (../ficha-publica.tsx). Envía a
// urlDeEnvio (POST /api/c/[token]/aportes o, desde la ficha, POST /api/campanas/[id]/aporte-sin-cuenta),
// que valida el enlace, la cuota por dispositivo, el tope por IP y la espera entre aportes.
// Sin cuenta se envía UN aporte por campaña desde cada dispositivo (2026-11-09, a pedido del usuario):
// al enviarlo, el formulario se cambia por la invitación a crear una cuenta o iniciar sesión para
// seguir aportando. La persona no puede consultar ni editar lo que mandó.
// Sin cuenta no hay inscripción: las dos casillas de los acuerdos (ui/AcuerdosDeAporte) van en el
// formulario, sin ventana (2026-10-15).

import { useEffect, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import Paso from "@/components/aportes/PasoDelAporte";
import { IconoInfo, IconoListo, IconoReloj } from "@/components/aportes/IconosDelAporte";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { CasillasDeAcuerdos, SIN_ACUERDOS, acuerdosCompletos, agregarAcuerdos } from "@/components/ui/AcuerdosDeAporte";
import SelectorDeArchivo from "@/components/ui/SelectorDeArchivo";
import CamposDelAporte, { camposDelAporteCompletos } from "@/components/aportes/CamposDelAporte";
import { archivoEsOpcional, type FormatoDeDocumento, type TipoDeArchivo } from "@/lib/aportes/archivo";
import { BASE_PATH } from "@/lib/base-path";
import { respuestasValidas, seccionesParaElAporte, type SeccionDeChecklist } from "@/lib/campanas/checklist";
import ChecklistsDelAporte from "@/components/aportes/ChecklistsDelAporte";

type Props = {
  /** A dónde se envía, sin BASE_PATH (2026-11-11). */
  urlDeEnvio: string;
  secciones: SeccionDeChecklist[];
  /** Tipos de archivo que acepta la campaña; con "texto", el archivo es opcional. */
  tipos: TipoDeArchivo[];
  /** Formatos de "Archivo" que acepta (2026-10-28); [] = todos. */
  formatosDeDocumento?: FormatoDeDocumento[];
  /** Aportes sin cuenta que le quedan a este dispositivo en la campaña (0 o 1). */
  restantesIniciales: number;
  /** Segundos que faltan para poder enviar otro (lo calcula el servidor). */
  esperaInicial: number;
  /** Para qué se usarán los datos, para el acuerdo de uso (2026-10-27). */
  proposito?: string | null;
  /** /entrar y /registro con ?next= a aportar con la cuenta. */
  entrar: string;
  registro: string;
};

export function BotonesDeCuenta({ entrar, registro }: { entrar: string; registro: string }) {
  return (
    <div className="flex gap-2.5 max-md:flex-col">
      <ButtonLink href={entrar} className="flex-1">
        Iniciar sesión
      </ButtonLink>
      <ButtonLink href={registro} className="flex-1">
        Crear una cuenta
      </ButtonLink>
    </div>
  );
}

/** Agrupa el resumen, los accesos superiores y el formulario. */
export function AporteAnonimoConAccesos({ children, ...props }: Props & { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl">{children}<AporteAnonimo {...props} /></div>;
}

export default function AporteAnonimo({
  urlDeEnvio,
  secciones,
  tipos,
  formatosDeDocumento = [],
  restantesIniciales,
  esperaInicial,
  proposito,
  entrar,
  registro,
  onAporteEnviado,
}: Props & { onAporteEnviado?: () => void }) {
  const [restantes, setRestantes] = useState(restantesIniciales);
  const [espera, setEspera] = useState(esperaInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [texto, setTexto] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [acuerdos, setAcuerdos] = useState(SIN_ACUERDOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  // Cambia la key del input de archivo para vaciarlo después de enviar.
  const [vuelta, setVuelta] = useState(0);

  // Cuenta regresiva de la espera. Solo informa: el servidor la vuelve a comprobar.
  const enEspera = espera > 0;
  useEffect(() => {
    if (!enEspera) return;
    const intervalo = setInterval(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(intervalo);
  }, [enEspera]);

  // Solo los checklists del tipo de lo que se manda (2026-10-28).
  const { visibles, faltaArchivo } = seccionesParaElAporte(secciones, tipos, archivo);
  // Sin archivo en una campaña que acepta texto: título + texto en vez de descripción (2026-11-11).
  const soloTexto = !archivo && archivoEsOpcional(tipos);

  function alternar(valor: string) {
    setMarcadas((actual) => (actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    try {
      const datos = new FormData();
      if (archivo) datos.set("file", archivo);
      // Solo texto (2026-11-11): description es el título y el texto va aparte; el servidor lo guarda como .txt.
      else if (soloTexto) datos.set("texto", texto);
      datos.set("description", descripcion);
      // Solo lo marcado en los checklists que se ven (cambiar de archivo puede esconder alguno).
      respuestasValidas(marcadas, visibles).forEach((valor) => datos.append("caracteristicas", valor));
      agregarAcuerdos(datos, acuerdos);
      const response = await fetch(`${BASE_PATH}${urlDeEnvio}`, { method: "POST", body: datos });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // La espera no es un error: el botón muestra la cuenta regresiva.
        if (payload.esperaSegundos) {
          setEspera(Number(payload.esperaSegundos));
          return;
        }
        // Ya había usado su aporte sin cuenta (p. ej. desde otra pestaña): que se registre.
        if (payload.pideCuenta) {
          setRestantes(0);
          onAporteEnviado?.();
          return;
        }
        throw new Error(payload.error ?? "No se pudo enviar el aporte");
      }
      setRestantes(Number(payload.data?.restantes ?? 0));
      setEspera(Number(payload.data?.esperaSegundos ?? 0));
      setEnviado(true);
      setConfirmacionAbierta(true);
      onAporteEnviado?.();
      setArchivo(null);
      setDescripcion("");
      setTexto("");
      setMarcadas([]);
      setVuelta((v) => v + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el aporte");
    } finally {
      setEnviando(false);
    }
  }

  // Ya usó su aporte sin cuenta: para el siguiente, que se registre (o entre).
  if (restantes <= 0 && !confirmacionAbierta) {
    return (
      <Card>
        {enviado && (
          <p className="mb-4 rounded-lg border border-success-700 bg-success-50 p-3.5 text-[13px] text-success-700" role="status">
            ¡Gracias! Tu aporte quedó pendiente de revisión.
          </p>
        )}
        <h2 className="mb-1 text-[15px] font-bold text-system-900">¿Quieres enviar otro aporte?</h2>
        <p className="mb-4 text-[12.5px] text-system-600">
          Sin cuenta puedes enviar un aporte a cada campaña{enviado ? "" : ", y ya enviaste el tuyo desde este dispositivo"}.
          Crea una cuenta para seguir aportando a esta campaña y ver tus aportes en tu historial.
        </p>
        <div className="flex gap-2.5 max-md:flex-col">
          <ButtonLink href={registro} variant="primary" className="flex-1">
            Crear una cuenta
          </ButtonLink>
          <ButtonLink href={entrar} className="flex-1">
            Ya tengo cuenta
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const puedeEnviar =
    (Boolean(archivo) || archivoEsOpcional(tipos)) &&
    camposDelAporteCompletos(soloTexto, descripcion, texto) &&
    acuerdosCompletos(acuerdos) &&
    !enviando &&
    espera === 0;

  const camposListos = camposDelAporteCompletos(soloTexto, descripcion, texto);
  const conChecklists = visibles.length > 0 || faltaArchivo;
  const requisitos = [
    { listo: Boolean(archivo) || soloTexto, texto: soloTexto ? "Archivo opcional: va solo el texto" : "Elegir tu archivo" },
    { listo: camposListos, texto: soloTexto ? "Escribir el título y el texto" : "Escribir la descripción" },
  ];
  return (
    <>
      <div className="mb-5 flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5 text-[12.5px] leading-5 text-system-700"><IconoInfo className="mt-0.5 size-5 shrink-0 text-brand-600" />        <p>
          No pedimos tu nombre ni tu correo: el aporte se registra como anónimo. Las fotos y los documentos se
          guardan sin sus metadatos (ubicación, fecha, modelo del teléfono, autor). Sin cuenta puedes enviar un
          aporte a esta campaña; para enviar más, crea una cuenta.
        </p>
      </div>
        <form onSubmit={(e) => void enviar(e)} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Paso
              numero={1}
              titulo={archivoEsOpcional(tipos) ? "Elige tu archivo o envía solo texto" : "Elige tu archivo"}
              nota={archivoEsOpcional(tipos) ? "Opcional" : undefined}
              listo={Boolean(archivo)}
            >
              <SelectorDeArchivo
                amplio
                reinicio={vuelta}
                tipos={tipos}
                formatosDeDocumento={formatosDeDocumento}
                archivo={archivo}
                error={errorArchivo}
                onCambio={(elegido, problema) => {
                  setArchivo(elegido);
                  setErrorArchivo(problema);
                }}
              />
            </Paso>

            <Paso numero={2} titulo={soloTexto ? "Escribe tu texto" : "Describe tu aporte"} listo={camposListos}>
              <CamposDelAporte
                soloTexto={soloTexto}
                descripcion={descripcion}
                onDescripcion={setDescripcion}
                texto={texto}
                onTexto={setTexto}
              />
            </Paso>

            {conChecklists && (
              <Paso numero={3} titulo="Marca lo que aplique" nota="Opcional" listo={respuestasValidas(marcadas, visibles).length > 0}>
                <ChecklistsDelAporte
                  fichas
                  visibles={visibles}
                  faltaArchivo={faltaArchivo}
                  marcadas={marcadas}
                  onAlternar={alternar}
                />
              </Paso>
            )}
          </div>

          <aside className="flex flex-col gap-3 rounded-xl border border-system-200 bg-white p-4 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-[14px] font-bold text-system-900">Antes de enviar</h2>
            <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} proposito={proposito} />
            <ul className="flex flex-col gap-2">
              {requisitos.map((r) => (
                <li key={r.texto} className={`flex items-center gap-2 text-[12.5px] ${r.listo ? "text-system-700" : "text-system-500"}`}>
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${r.listo ? "border-success-700 bg-success-700 text-white" : "border-system-300 bg-white"}`}
                  >
                    {r.listo && <IconoListo className="size-3.5" strokeWidth={2.5} />}
                  </span>
                  <span className={r.listo ? "font-medium" : ""}>{r.texto}</span>
                  <span className="sr-only">{r.listo ? "(listo)" : "(pendiente)"}</span>
                </li>
              ))}
            </ul>

            {error && <p role="alert" className="rounded-lg border border-error-700 bg-error-50 p-2.5 text-[12px] text-error-700">{error}</p>}

            <Button variant="primary" type="submit" className="w-full" disabled={!puedeEnviar || confirmacionAbierta}>
              {enviando ? (
                <span className="inline-flex items-center gap-2">
                  <IndicadorDeCarga />
                  Enviando…
                </span>
              ) : espera > 0 ? "Podrás enviar en " + espera + " s" : "Enviar aporte"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-system-500">
              <IconoReloj className="size-3.5" />
              Quedará pendiente de revisión
            </p>
          </aside>
        </form>
      <VentanaDeConfirmacion abierto={confirmacionAbierta} titulo="Aporte enviado" ocultarCancelar textoConfirmar="Continuar" textoOcupado="Abriendo…" onCancelar={() => setConfirmacionAbierta(false)} onConfirmar={() => setConfirmacionAbierta(false)}>
        <p className="text-[13px] leading-5 text-system-700">Tu aporte fue enviado correctamente y quedó pendiente de revisión.</p>
      </VentanaDeConfirmacion>
    </>
  );
}
