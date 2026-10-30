import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Rótulo + campo + ajuda ou erro, no padrão dos formulários do site. */
export function Campo({
  id,
  rotulo,
  erro,
  ajuda,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  children: ReactNode;
}) {
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined;
  const campo = isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type)
    ? cloneElement(children as ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>, {
      "aria-invalid": !!erro,
      "aria-describedby": [children.props && (children.props as { "aria-describedby"?: string })["aria-describedby"], descricao].filter(Boolean).join(" ") || undefined,
    })
    : children;
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      {campo}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="ajuda">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} className="erro-campo">{erro}</p>}
    </div>
  );
}
