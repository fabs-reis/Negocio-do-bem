/**
 * `verificado`: a moderação conferiu o CNPJ, o nome e o CPF do dono e o liberou no Clube do
 * Bem (#293). Sem isso, o perfil só está "assumido": uma conta assumiu, sem conferência.
 */
export function SeloStatus({ status, verificado = false }: { status: string; verificado?: boolean }) {
  if (status === "verificada" && verificado) {
    return (
      <span
        title="A moderação conferiu o CNPJ e a identidade de quem cuida deste perfil."
        className="inline-flex items-center gap-1 rounded-full bg-folha-50 px-2.5 py-1 text-xs font-semibold text-folha"
      >
        <span aria-hidden="true">✓</span>
        Perfil verificado
      </span>
    );
  }
  if (status === "verificada") {
    return (
      <span
        title="Uma conta assumiu este perfil. O selo não certifica a identidade nem as causas do negócio."
        className="inline-flex items-center gap-1 rounded-full border border-linha bg-superficie px-2.5 py-1 text-xs font-semibold text-suave"
      >
        <span aria-hidden="true" className="text-sm leading-none">•</span>
        Perfil assumido
      </span>
    );
  }
  return (
    <span
      title="Indicado por alguém da comunidade; o dono ainda não reivindicou o perfil"
      className="inline-flex items-center gap-1.5 rounded-full bg-amarelo py-1 pr-3 pl-2 text-xs font-semibold text-sobre-amarelo"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path fill="currentColor" d="M6 .5c.4 2.9 1.6 4.1 5.5 5.5-3.9 1.4-5.1 2.6-5.5 5.5C5.6 8.6 4.4 7.4.5 6 4.4 4.6 5.6 3.4 6 .5Z" />
      </svg>
      Indicado pela comunidade
    </span>
  );
}
