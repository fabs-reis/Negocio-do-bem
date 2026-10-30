// Dados do "cortejo do bem": a tinta de cada negócio, as faixas das causas e a
// regra que decide quando a indicação aparece fora do perfil.
// Sem banco, para valer no servidor, no navegador e nos testes.
// A consulta dos negócios recentes fica em src/lib/consultas.ts (recentesComFoto).

import { CAUSAS, GRUPOS, type GrupoCausa } from "@/lib/causas";
import { hrefCausa } from "@/lib/diretorio";

/** As tintas dos negócios. Os nomes são os tokens de cor (`--color-<tinta>`). */
export const TINTAS = ["azul", "rosa", "amarelo", "verde", "terracota"] as const;
export type Tinta = (typeof TINTAS)[number];

/**
 * A tinta de um negócio, sempre a mesma para o mesmo @ (hash FNV-1a de 32 bits).
 * Mudar a conta muda a cor de todos os negócios: os testes fixam alguns valores.
 */
export function tintaDoNegocio(instagramUsername: string): Tinta {
  let hash = 0x811c9dc5;
  for (const letra of instagramUsername) {
    hash ^= letra.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TINTAS[hash % TINTAS.length]!;
}

export const TINTA_DO_GRUPO: Record<GrupoCausa, Tinta> = { trabalho: "azul", diversidade: "rosa", planeta: "verde" };

export type FaixaDeCausas = {
  grupo: GrupoCausa;
  nome: string;
  tinta: Tinta;
  causas: { slug: string; nome: string; emoji: string; href: string }[];
};

/** Uma faixa por grupo de causas, na ordem de GRUPOS, com o link de cada causa para a página dela. */
export const FAIXAS_DE_CAUSAS: FaixaDeCausas[] = (Object.keys(GRUPOS) as GrupoCausa[]).map((grupo) => ({
  grupo,
  nome: GRUPOS[grupo],
  tinta: TINTA_DO_GRUPO[grupo],
  causas: CAUSAS.filter((c) => c.grupo === grupo).map((c) => ({
    slug: c.slug,
    nome: c.nome,
    emoji: c.emoji,
    href: hrefCausa(c.slug),
  })),
}));

export type Recomendacao = { motivo: string; indicadoPor: string | null };

/**
 * O motivo da indicação e o nome de quem indicou, como no perfil (SemHistoria):
 * só enquanto o dono não escreveu a história. Use só com negócios do diretório
 * (NO_DIRETORIO). Ver "Motivo da indicação" em docs/regras-de-negocio.md.
 */
export function recomendacaoPublica(empresa: {
  historia: string;
  motivoIndicacao: string | null;
  indicadaPor: { nome: string } | null;
}): Recomendacao | null {
  const motivo = empresa.motivoIndicacao?.trim();
  if (empresa.historia.trim() || !motivo) return null;
  return { motivo, indicadoPor: empresa.indicadaPor?.nome ?? null };
}
