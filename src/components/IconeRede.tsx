import type { ReactNode, SVGProps } from "react";

type NomeIcone =
  | "buscar" | "seta" | "voltar" | "local" | "pessoa" | "empresa"
  | "remoto" | "presencial" | "seguro" | "adicionar" | "globo"
  | "email" | "servicos" | "verificar" | "olho" | "ocultar" | "filtro";

/** Ícones leves, sem dependência externa, integrados à paleta e ao modo escuro. */
export function IconeRede({ nome, ...props }: SVGProps<SVGSVGElement> & { nome: NomeIcone }) {
  const formas: Record<NomeIcone, ReactNode> = {
    buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    seta: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    voltar: <><path d="m12 19-7-7 7-7M5 12h14" /></>,
    local: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    pessoa: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    empresa: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M9 7V4h6v3M4 12h16M10 12v2h4v-2" /></>,
    remoto: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    presencial: <><path d="m3 9 9-6 9 6v11H3V9Z" /><path d="M9 20v-7h6v7" /></>,
    seguro: <><path d="m12 2 8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    adicionar: <><path d="M12 5v14M5 12h14" /></>,
    globo: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 4.5 6 4.5 9s-1.5 6-4.5 9M12 3c-3 3-4.5 6-4.5 9s1.5 6 4.5 9" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    servicos: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
    verificar: <><path d="m5 12 4 4L19 6" /></>,
    olho: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    ocultar: <><path d="m3 3 18 18M10.6 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.1 3.7M6 6.9C3.5 8.6 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1" /></>,
    filtro: <><path d="M4 7h16M7 12h10m-7 5h4" /></>,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {formas[nome]}
    </svg>
  );
}
