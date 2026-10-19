// Pantalla /terminos (pública): términos de uso. Texto fijo con las reglas que ya aplica la app
// (campañas, aportes, reportes y sanciones; ver references/dominio.md de la skill). El responsable y
// el correo salen de lib/legal.ts. Se enlaza desde /registro (casilla de aceptación) y el pie público.

import Link from "next/link";
import type { Metadata } from "next";
import PaginaLegal, { Pendiente, type SeccionLegal } from "@/components/layout/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";
import { PLAZO_DE_GRACIA } from "@/lib/usuarios/baja-opciones";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Las reglas para usar DataForGood: cuentas, campañas, aportes, datos abiertos y sanciones.",
};

const SECCIONES: SeccionLegal[] = [
  {
    id: "aceptacion",
    titulo: "Aceptación",
    contenido: (
      <p>
        Al crear una cuenta o enviar un aporte aceptas estos términos y el{" "}
        <Link href="/privacidad" className="text-brand-600 hover:underline">
          aviso de privacidad
        </Link>
        . Si no estás de acuerdo, no uses la plataforma. DataForGood la ofrece{" "}
        <Pendiente valor={RESPONSABLE.nombre} falta="nombre del responsable" />.
      </p>
    ),
  },
  {
    id: "servicio",
    titulo: "Qué es DataForGood",
    contenido: (
      <p>
        Una plataforma de crowdsourcing: organizaciones y personas crean campañas para reunir información de campo (fotos,
        video, audio, documentos o texto) sobre temas sociales, ambientales y comunitarios, y otras personas participan
        con aportes. Cuando una campaña termina, sus aportes aprobados se publican como datos abiertos. El servicio es
        gratuito.
      </p>
    ),
  },
  {
    id: "cuenta",
    titulo: "Tu cuenta",
    contenido: (
      <ul>
        <li>Debes dar datos verdaderos y verificar tu correo. Cada persona usa una sola cuenta.</li>
        <li>
          Cuida tu contraseña: lo que se haga desde tu cuenta es tu responsabilidad. Si sospechas que alguien más entró,
          cámbiala desde Mi cuenta.
        </li>
        <li>Varios intentos fallidos de inicio de sesión bloquean la cuenta por un tiempo, para protegerla.</li>
        <li>
          Puedes eliminar tu cuenta cuando quieras desde Mi cuenta → Eliminar cuenta; se borra de forma definitiva a los{" "}
          {PLAZO_DE_GRACIA}.
        </li>
      </ul>
    ),
  },
  {
    id: "campanas",
    titulo: "Campañas",
    contenido: (
      <ul>
        <li>
          Quien crea una campaña es responsable de que su objetivo sea legítimo, de describir con claridad qué se pide y
          de no solicitar datos personales ni contenido sensible.
        </li>
        <li>
          Toda campaña pasa por supervisión antes de publicarse. La supervisión puede rechazarla, pausarla o finalizarla
          explicando el motivo, y sancionar a quien la creó si incumple estos términos.
        </li>
        <li>Quien crea una campaña no puede aportar a ella ni supervisarla.</li>
        <li>
          Quien organiza revisa los aportes, puede invitar revisores y puede impedir que una persona siga participando en
          su campaña.
        </li>
      </ul>
    ),
  },
  {
    id: "aportes",
    titulo: "Aportes",
    contenido: (
      <>
        <p>Antes de aportar a una campaña aceptas dos acuerdos. Al aceptarlos confirmas que:</p>
        <ul>
          <li>Tu aporte corresponde a la temática y a la descripción de la campaña.</li>
          <li>
            No contiene contenido inadecuado o sensible (por ejemplo, violencia explícita, desnudos o datos personales de
            otras personas).
          </li>
          <li>Lo creaste tú o tienes derecho a compartirlo.</li>
          <li>
            DataForGood y quien organiza la campaña pueden usarlo para los fines de la campaña y, si se aprueba,
            publicarlo como dato abierto con licencia{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.es"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              CC BY 4.0
            </a>{" "}
            cuando la campaña termine, sin tu nombre ni tu correo.
          </li>
        </ul>
        <p>
          Cada campaña fija cuántos aportes puede enviar cada persona y qué tipos de archivo acepta. Un aporte puede ser
          aprobado o rechazado; la decisión no se cambia después. Puedes borrar un aporte que te rechazaron.
        </p>
      </>
    ),
  },
  {
    id: "conducta",
    titulo: "Lo que no está permitido",
    contenido: (
      <ul>
        <li>Subir contenido ilegal, violento, sexual, discriminatorio o que dañe a otras personas.</li>
        <li>Publicar datos personales de terceros sin su permiso.</li>
        <li>Enviar aportes falsos, repetidos o que no corresponden a la campaña.</li>
        <li>Crear campañas engañosas o con fines comerciales encubiertos.</li>
        <li>Usar varias cuentas, hacerse pasar por otra persona o intentar evadir una sanción.</li>
        <li>Intentar dañar, saturar o acceder sin permiso a la plataforma o a cuentas ajenas.</li>
      </ul>
    ),
  },
  {
    id: "sanciones",
    titulo: "Reportes y sanciones",
    contenido: (
      <>
        <p>
          Cualquier persona con cuenta puede reportar una campaña, y quien organiza o revisa puede reportar un aporte. La
          supervisión revisa cada reporte y lo descarta o aplica una sanción. Las sanciones van subiendo:
        </p>
        <ul>
          <li>Primer aviso: un mensaje con el motivo.</li>
          <li>Segundo aviso: suspensión de la cuenta por 2 días.</li>
          <li>Tercer aviso: suspensión por 7 días.</li>
          <li>Cuarto aviso: baneo de la cuenta; su correo ya no puede volver a registrarse.</li>
        </ul>
        <p>
          Según la gravedad, la supervisión puede suspender directamente por 2 o 7 días o banear sin avisos previos. Un
          aporte inadecuado puede rechazarse, marcarse como inapropiado o eliminarse. Siempre verás el motivo de la
          sanción.
        </p>
      </>
    ),
  },
  {
    id: "datos-abiertos",
    titulo: "Datos abiertos",
    contenido: (
      <p>
        Los aportes aprobados de las campañas terminadas se publican en{" "}
        <Link href="/datos" className="text-brand-600 hover:underline">
          Datos abiertos
        </Link>{" "}
        con licencia CC BY 4.0: cualquiera puede descargarlos, usarlos y compartirlos citando su origen. Se publican sin
        nombres ni correos de quienes participaron. Una vez descargados, DataForGood no puede retirarlos de las copias que
        otras personas ya tengan.
      </p>
    ),
  },
  {
    id: "responsabilidad",
    titulo: "Limitación de responsabilidad",
    contenido: (
      <>
        <p>
          La plataforma se ofrece tal como está. Procuramos que funcione sin interrupciones y que los datos sean
          confiables, pero no garantizamos que siempre esté disponible ni que la información aportada por la comunidad sea
          exacta.
        </p>
        <p>
          Cada persona responde por lo que publica. Quien organiza una campaña responde por el uso que da a los aportes
          que recibe.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios y contacto",
    contenido: (
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión en esta página con su fecha de actualización; seguir
        usando la plataforma significa que aceptas la nueva versión. Estos términos se rigen por las leyes de los Estados
        Unidos Mexicanos. Para dudas o aclaraciones escribe a{" "}
        <Pendiente valor={RESPONSABLE.correo} falta="correo de contacto" />.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      introduccion={
        <p>
          Estas son las reglas para usar DataForGood. Las escribimos para que se entiendan sin ser abogado: qué puedes
          hacer, qué no y qué pasa si alguien no las respeta.
        </p>
      }
      secciones={SECCIONES}
      otroTexto={{ href: "/privacidad", etiqueta: "el Aviso de privacidad" }}
    />
  );
}
