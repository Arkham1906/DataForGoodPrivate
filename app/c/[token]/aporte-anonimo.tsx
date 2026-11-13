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
import Tag from "@/components/ui/Tag";
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
export function AporteAnonimoConAccesos({ children, etiqueta, ...props }: Props & { children: ReactNode; etiqueta: string }) {
  const [mostrarAccesos, setMostrarAccesos] = useState(props.restantesIniciales > 0);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {mostrarAccesos && (
        <>
          <div className="mb-3 hidden flex-col items-center gap-2 text-center lg:flex">
            <p className="text-[12px] text-system-500">¿Prefieres que tus aportes queden en tu historial?</p>
            <div className="w-full max-w-[440px]">
              <BotonesDeCuenta entrar={props.entrar} registro={props.registro} />
            </div>
          </div>
          <div className="mb-2">
            <Tag tone="info">{etiqueta}</Tag>
          </div>
        </>
      )}
      {children}
      <div className="mt-5 lg:mt-3">
        <AporteAnonimo {...props} onAporteEnviado={() => setMostrarAccesos(false)} />
      </div>
    </div>
  );
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
  if (restantes <= 0) {
    return (
      <Card className="mt-5">
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

  return (
    <>
      <Card className="lg:p-3">
        <h2 className="mb-1 text-[15px] font-bold text-system-900">Aporta sin crear una cuenta</h2>
        <p className="mb-4 max-w-4xl text-[12.5px] text-system-600 lg:mb-2">
          No pedimos tu nombre ni tu correo: el aporte se registra como anónimo. Las fotos y los documentos se
          guardan sin sus metadatos (ubicación, fecha, modelo del teléfono, autor). Sin cuenta puedes enviar un
          aporte a esta campaña; para enviar más, crea una cuenta.
        </p>
        <form onSubmit={(e) => void enviar(e)}>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-3">
            <SelectorDeArchivo
              className="mb-4 lg:mb-0"
              compactoEnEscritorio
              tipos={tipos}
              formatosDeDocumento={formatosDeDocumento}
              archivo={archivo}
              error={errorArchivo}
              reinicio={vuelta}
              onCambio={(elegido, problema) => {
                setArchivo(elegido);
                setErrorArchivo(problema);
              }}
            />

            <div>
              <CamposDelAporte
                soloTexto={soloTexto}
                descripcion={descripcion}
                onDescripcion={setDescripcion}
                texto={texto}
                onTexto={setTexto}
                placeholderDescripcion="Describe lo que aportas"
                compactoEnEscritorio
              />
            </div>
          </div>

          <ChecklistsDelAporte
            visibles={visibles}
            faltaArchivo={faltaArchivo}
            marcadas={marcadas}
            onAlternar={alternar}
            compactoEnEscritorio
          />

          <div className="grid lg:grid-cols-[32rem_auto] lg:items-center lg:justify-center lg:gap-x-4">
            <div className="mb-4 rounded-lg border border-system-200 bg-white p-3.5 lg:col-start-1 lg:row-start-1 lg:mb-0 lg:p-2.5">
              <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} proposito={proposito} />
            </div>

            {error && (
              <p className="mb-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700 lg:col-span-2 lg:row-start-2 lg:mb-0" role="alert">
                {error}
              </p>
            )}

            <Button variant="primary" type="submit" className="w-full lg:col-start-2 lg:row-start-1 lg:w-auto lg:min-w-64" disabled={!puedeEnviar}>
              {enviando ? (
                <span className="inline-flex items-center gap-2">
                  <IndicadorDeCarga />
                  Enviando…
                </span>
              ) : espera > 0 ? `Podrás enviar en ${espera} s` : "Enviar aporte sin cuenta"}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11.5px] text-system-500">
            Se registra como anónimo y queda pendiente de revisión. Es tu único aporte sin cuenta a esta campaña.
          </p>
        </form>
      </Card>
      <div className="mt-5 flex flex-col gap-2.5 lg:hidden">
        <p className="text-center text-[12px] text-system-500">¿Prefieres que tus aportes queden en tu historial?</p>
        <div className="flex gap-2.5 max-md:flex-col">
          <ButtonLink href={entrar} className="flex-1">
            Iniciar sesión
          </ButtonLink>
          <ButtonLink href={registro} className="flex-1">
            Crear una cuenta
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
