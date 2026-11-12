import { buscarCausa, type GrupoCausa } from "@/lib/causas";

// Cada grupo de causas tem a sua tinta: trabalho é azul, diversidade é rosa e
// "Comunidade e planeta" (planeta) é verde. Fundo claro da tinta, texto na
// versão -texto da tinta (contraste AA) e um ponto cheio na cor pura.
const TINTA: Record<GrupoCausa, { selo: string; ponto: string }> = {
  trabalho: { selo: "bg-azul/12 text-azul-texto ring-azul/30 escuro:bg-azul/24", ponto: "bg-azul" },
  diversidade: { selo: "bg-rosa/14 text-rosa-texto ring-rosa/40 escuro:bg-rosa/24", ponto: "bg-rosa" },
  planeta: { selo: "bg-verde/12 text-verde-texto ring-verde/35 escuro:bg-verde/24", ponto: "bg-verde" },
};

export function CausaBadge({ slug, grande = false }: { slug: string; grande?: boolean }) {
  const causa = buscarCausa(slug);
  if (!causa) return null;
  const tinta = TINTA[causa.grupo];
  return (
    <span
      title={causa.descricao}
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${tinta.selo} ${
        grande ? "gap-2 px-3.5 py-1.5 text-sm" : "gap-1.5 px-2.5 py-1 text-xs"
      }`}
    >
      <span aria-hidden="true" className={`shrink-0 rounded-full ${tinta.ponto} ${grande ? "h-2.5 w-2.5" : "h-2 w-2"}`} />
      {causa.nome}
    </span>
  );
}
