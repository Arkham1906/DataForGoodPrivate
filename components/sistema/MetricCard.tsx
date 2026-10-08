// Tarjeta de métrica del panel del SuperUsuario.

import Link from "next/link";

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Segundo contador opcional, al lado del principal y separado por una línea. */
  secundario?: { label: string; value: string | number };
  /** Enlaces opcionales al pie de la tarjeta, p. ej. a un dashboard o una lista. */
  links?: { label: string; href: string }[];
  /** Centra el contenido de la tarjeta. */
  centrado?: boolean;
}

function Contador({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="mb-1 text-[12px] text-system-600">{label}</p>
      <p className="text-2xl font-extrabold text-system-900">{value}</p>
    </div>
  );
}

export default function MetricCard({ label, value, secundario, links, centrado = false }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-system-200 bg-white p-4">
      {secundario ? (
        <div className="flex items-stretch">
          <div className="flex-1 pr-4">
            <div className={centrado ? "text-center" : undefined}>
              <Contador label={label} value={value} />
            </div>
          </div>
          <div className="flex-1 border-l border-system-200 pl-4">
            <div className={centrado ? "text-center" : undefined}>
              <Contador label={secundario.label} value={secundario.value} />
            </div>
          </div>
        </div>
      ) : (
        <div className={centrado ? "text-center" : undefined}>
          <Contador label={label} value={value} />
        </div>
      )}
      {links && links.length > 0 && (
        <div className={`mt-4 flex items-center border-t border-system-200 pt-3 ${centrado ? "justify-center" : ""}`}>
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[12px] font-semibold text-brand-600 hover:text-brand-800 hover:underline ${
                i > 0 ? "ml-3.5 border-l border-system-300 pl-3.5" : ""
              }`}
            >
              {link.label} <span aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
