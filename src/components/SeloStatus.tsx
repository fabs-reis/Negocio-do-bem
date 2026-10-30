/**
 * O selo diz como o perfil está: indicado pela comunidade, assumido por uma conta
 * ou confirmado pelo Instagram do negócio (perfil oficial).
 */
export function SeloStatus({ status, oficial }: { status: string; oficial: boolean }) {
  if (status === "verificada" && oficial) {
    return (
      <span
        title="Quem cuida do negócio confirmou pelo Instagram que o perfil é seu."
        className="inline-flex items-center gap-1 rounded-full bg-folha-50 px-2.5 py-1 text-xs font-semibold text-folha"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 1.5 12.2 3l2.6-.2.9 2.5 2.3 1.3-.6 2.6.6 2.6-2.3 1.3-.9 2.5-2.6-.2L10 17l-2.2-1.5-2.6.2-.9-2.5L2 11.9l.6-2.6L2 6.6l2.3-1.3.9-2.5 2.6.2L10 1.5Zm3.5 6-1-1-3.6 3.6-1.6-1.6-1 1 2.6 2.6 4.6-4.6Z"
          />
        </svg>
        Perfil oficial
      </span>
    );
  }
  if (status === "verificada") {
    return (
      <span
        title="Uma conta assumiu este perfil. O selo não certifica a identidade nem as causas do negócio."
        className="inline-flex items-center gap-1 rounded-full border border-linha bg-superficie px-2.5 py-1 text-xs font-semibold text-suave"
      >
        <span aria-hidden="true">•</span>
        Perfil assumido
      </span>
    );
  }
  return (
    <span
      title="Indicado por alguém da comunidade. Quem cuida do negócio ainda não assumiu o perfil."
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
    >
      <span aria-hidden="true">✦</span>
      Indicado pela comunidade
    </span>
  );
}
