// Pantalla /privacidad (pública): aviso de privacidad. Texto fijo que describe los datos que de
// verdad guarda la app (lib/db-schema.ts); el responsable y el correo salen de lib/legal.ts.
// Se enlaza desde /registro (casilla de aceptación) y el pie de las pantallas públicas.

import Link from "next/link";
import type { Metadata } from "next";
import PaginaLegal, { Pendiente, type SeccionLegal } from "@/components/layout/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";
import { PLAZO_DE_GRACIA } from "@/lib/usuarios/baja-opciones";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Qué datos personales recaba DataForGood, para qué los usa y cómo ejercer tus derechos.",
};

const correo = <Pendiente valor={RESPONSABLE.correo} falta="correo de contacto" />;

const SECCIONES: SeccionLegal[] = [
  {
    id: "responsable",
    titulo: "Responsable de tus datos",
    contenido: (
      <p>
        El responsable del tratamiento de tus datos personales es{" "}
        <Pendiente valor={RESPONSABLE.nombre} falta="nombre del responsable" />, con domicilio en{" "}
        <Pendiente valor={RESPONSABLE.domicilio} falta="domicilio" />. Para cualquier asunto sobre tus datos
        puedes escribir a {correo}.
      </p>
    ),
  },
  {
    id: "datos",
    titulo: "Datos que recabamos",
    contenido: (
      <>
        <p>Al crear y usar tu cuenta:</p>
        <ul>
          <li>Nombre, apellidos y correo electrónico.</li>
          <li>
            Tu contraseña, que guardamos cifrada (nadie puede leerla). Si entras con Google, recibimos de Google tu
            nombre, tu correo y un identificador de tu cuenta, nunca tu contraseña de Google.
          </li>
          <li>Estado y municipio, especialidad e intereses, si los escribes en tu perfil.</li>
          <li>El ícono o la foto de perfil que elijas.</li>
          <li>Tus preferencias de notificaciones y, si activas los avisos en tu teléfono o navegador, los datos técnicos para enviártelos.</li>
          <li>
            Tu actividad en la plataforma: campañas que creas, aportes que envías (archivos, descripción y lo que
            marques), revisiones, puntos de experiencia y, en su caso, reportes y sanciones.
          </li>
          <li>
            En acciones sensibles de tu cuenta (por ejemplo cambios de rol, sanciones o decisiones de supervisión), la
            fecha y la dirección IP desde donde se hicieron, en una bitácora de seguridad.
          </li>
        </ul>
        <p>
          <strong className="text-system-900">Tu ubicación, solo si la activas.</strong> Si usas «Usar mi ubicación» o
          «Mi ubicación actual» y das permiso en tu navegador, este nos manda tus coordenadas al abrir la plataforma y cada
          cierto tiempo mientras la usas. Con ellas calculamos en qué estado y municipio de México estás, sin enviarlas a
          otros servicios, y las descartamos: no guardamos las coordenadas ni tu recorrido. Guardamos solo tu último estado
          y municipio detectados, que únicamente ves tú, y los lugares de los que ya te avisamos, para no repetir el aviso.
          Puedes usar la plataforma sin compartir tu ubicación, escribiendo tu estado y municipio en tu perfil u omitiéndolos.
        </p>
        <p>
          <strong className="text-system-900">Fotos y documentos sin metadatos.</strong> Antes de guardar una foto le
          quitamos los datos ocultos que traen las cámaras (como la ubicación GPS), y a los PDF y documentos de Word sus
          autores y propiedades. Los videos y audios se guardan como los subes y pueden conservar esos datos: la
          pantalla para aportar te lo avisa.
        </p>
        <p>
          <strong className="text-system-900">Si aportas sin cuenta</strong> desde el enlace de una campaña, solo
          guardamos lo que envías y un identificador aleatorio de tu dispositivo (en una cookie), para respetar la cuota
          de la campaña. No guardamos tu dirección IP ni tu nombre.
        </p>
        <p>
          No te pedimos datos personales sensibles (como salud, religión, origen étnico o datos biométricos). Te pedimos
          no incluirlos en tus aportes, ni datos personales de otras personas.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para qué los usamos",
    contenido: (
      <>
        <p>Finalidades necesarias para darte el servicio:</p>
        <ul>
          <li>Crear tu cuenta, verificar tu correo e iniciar sesión, y ayudarte a recuperar el acceso.</li>
          <li>Que participes en campañas, envíes aportes y que estos se revisen y supervisen.</li>
          <li>Avisarte en la plataforma de lo que pasa con tus aportes, tus campañas, tus roles y tu cuenta.</li>
          <li>Cuidar la seguridad de la plataforma: atender reportes, aplicar sanciones e impedir que una cuenta baneada vuelva a registrarse.</li>
          <li>Publicar como datos abiertos los aportes aprobados de las campañas que terminan (ver la sección 4).</li>
        </ul>
        <p>
          Si activas tu ubicación, la usamos para mostrarte las campañas de donde estás, avisarte cuando llegues a otra
          zona y llenar por ti el estado y el municipio de tu perfil o de la campaña que estás creando. Lo que llenes en
          una campaña se ve junto con ella. Puedes dejar de usarla cuando quieras (ver la sección 7).
        </p>
        <p>Finalidades que puedes apagar en Preferencias de tu cuenta, sin que afecte el servicio:</p>
        <ul>
          <li>Avisarte de campañas nuevas que coinciden con tus intereses y tu ubicación.</li>
          <li>Recordatorios semanales y el resumen mensual de tu actividad.</li>
        </ul>
        <p>No usamos tus datos para publicidad ni los vendemos.</p>
      </>
    ),
  },
  {
    id: "quien-los-ve",
    titulo: "Quién ve tus datos",
    contenido: (
      <ul>
        <li>
          <strong className="text-system-900">Quien organiza una campaña y sus revisores</strong> ven los aportes que
          envías a esa campaña y tu nombre, para poder revisarlos.
        </li>
        <li>
          <strong className="text-system-900">Quien crea una campaña</strong>, al buscar revisores para ella, ve tu
          nombre y apellidos y tu correo oculto (por ejemplo, «an***@gmail.com»). Tu correo completo no se muestra;
          solo te encuentra por correo quien ya lo conoce y lo escribe completo.
        </li>
        <li>
          <strong className="text-system-900">Supervisores y la administración de la plataforma</strong> ven lo
          necesario para revisar campañas, atender reportes y aplicar sanciones.
        </li>
        <li>
          <strong className="text-system-900">Cualquier persona</strong>, en{" "}
          <Link href="/datos" className="text-brand-600 hover:underline">
            Datos abiertos
          </Link>
          : los aportes aprobados de campañas ya terminadas, con licencia CC BY 4.0. Ahí no aparecen tu nombre ni tu
          correo: cada participante sale como «Participante 1», «Participante 2»… o «Anónimo».
        </li>
        <li>
          <strong className="text-system-900">Proveedores que nos ayudan a operar</strong>: el servicio de correo con el
          que enviamos los códigos de verificación y recuperación, Google si eliges entrar con tu cuenta de Google, y el
          servicio de avisos de tu teléfono o navegador si los activas. Solo reciben lo indispensable para esa tarea.
        </li>
        <li>Autoridades, solo cuando una ley o una orden lo exija.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies",
    contenido: (
      <p>
        Usamos solo las cookies necesarias para que la plataforma funcione: la de tu sesión (dura 30 días o hasta que
        cierres sesión) y, si aportas sin cuenta, la del identificador aleatorio de tu dispositivo. No usamos cookies de
        publicidad ni de seguimiento de terceros.
      </p>
    ),
  },
  {
    id: "conservacion",
    titulo: "Cuánto tiempo los conservamos",
    contenido: (
      <>
        <p>
          Mientras tengas tu cuenta. Puedes eliminarla desde{" "}
          <strong className="text-system-900">Mi cuenta → Eliminar cuenta</strong>: se borra de forma definitiva a los{" "}
          {PLAZO_DE_GRACIA} (si vuelves a iniciar sesión antes, la baja se cancela). Al pedirla eliges qué pasa con
          tus aportes: borrarlos, conservarlos de forma anónima o conservarlos con tu nombre; tu correo se borra en todos
          los casos.
        </p>
        <p>
          Tu última zona detectada y los lugares de los que te avisamos se borran al dar «Dejar de usar mi ubicación» o al
          eliminar tu cuenta. Los avisos que ya recibiste siguen en tus notificaciones hasta que los borres, y el estado y
          municipio de tu perfil se quedan hasta que los cambies.
        </p>
        <p>
          Los aportes ya publicados como datos abiertos siguen disponibles sin tu nombre. Si tu cuenta fue baneada,
          conservamos tu correo en una lista para impedir un nuevo registro. La bitácora de seguridad se conserva para
          poder revisar lo ocurrido.
        </p>
      </>
    ),
  },
  {
    id: "derechos",
    titulo: "Tus derechos",
    contenido: (
      <>
        <p>
          Puedes acceder a tus datos, corregirlos, pedir que se cancelen u oponerte a su uso (derechos ARCO), así como
          revocar tu consentimiento. Mucho de esto lo haces tú mismo:
        </p>
        <ul>
          <li>Ver y corregir tus datos en Mi cuenta.</li>
          <li>Apagar los avisos opcionales en Mi cuenta → Preferencias.</li>
          <li>
            Dejar de usar tu ubicación en Mi cuenta → Preferencias o con «Dejar de usar mi ubicación» en Explorar
            campañas, y quitar el permiso en tu navegador. El permiso se da por navegador: en otro dispositivo se activa aparte.
          </li>
          <li>Borrar tus notificaciones, y los aportes que te rechazaron, desde sus pantallas.</li>
          <li>Eliminar tu cuenta en Mi cuenta → Eliminar cuenta.</li>
        </ul>
        <p>
          Para lo demás, escribe a {correo} con tu nombre, el correo de tu cuenta y lo que solicitas. Te responderemos en
          los plazos que marca la ley. Si consideras que no atendimos tu solicitud, puedes acudir a la autoridad
          competente en protección de datos personales.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios a este aviso",
    contenido: (
      <p>
        Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de actualización.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Aviso de privacidad"
      introduccion={
        <p>
          DataForGood conecta a quienes quieren ayudar con quienes están en el lugar de los hechos. Crea una campaña y deja
          que tu comunidad la alimente con fotos, videos, audios, documentos o testimonios para causas sociales, ambientales
          y comunitarias. Este aviso explica qué datos personales recabamos, para qué los usamos, con quién los compartimos
          y cómo puedes ejercer tus derechos, conforme a la legislación mexicana de protección de datos personales.
        </p>
      }
      secciones={SECCIONES}
      otroTexto={{ href: "/terminos", etiqueta: "los Términos de uso" }}
    />
  );
}
