// Tarjeta de métrica de la zona de usuario.

import Link from "next/link";

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Enlaces opcionales al pie de la tarjeta, p. ej. a un dashboard o una lista. */
  links?: { label: string; href: string }[];
}

export default function MetricCard({ label, value, links }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-system-200 bg-white p-4">
      <p className="mb-1 text-[12px] text-system-600">{label}</p>
      <p className="text-2xl font-extrabold text-system-900">{value}</p>
      {links && links.length > 0 && (
        <div className="mt-4 flex items-center border-t border-system-200 pt-3">
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
