export function SeloStatus({ status }: { status: string }) {
  if (status === "verificada") {
    return (
      <span
        title="O dono assumiu este perfil e a moderação conferiu os dados do negócio"
        className="inline-flex items-center gap-1.5 rounded-full bg-verde-escuro py-1 pr-3 pl-2 text-xs font-semibold text-sobre-verde-escuro"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 1.5 12.2 3l2.6-.2.9 2.5 2.3 1.3-.6 2.6.6 2.6-2.3 1.3-.9 2.5-2.6-.2L10 17l-2.2-1.5-2.6.2-.9-2.5L2 11.9l.6-2.6L2 6.6l2.3-1.3.9-2.5 2.6.2L10 1.5Zm3.5 6-1-1-3.6 3.6-1.6-1.6-1 1 2.6 2.6 4.6-4.6Z"
          />
        </svg>
        Verificado pelo dono
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
