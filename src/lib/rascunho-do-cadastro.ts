// O formato do rascunho do cadastro por etapas. Sem imports: o navegador também lê
// o rascunho, quando ele fica guardado no aparelho durante o login ou o cadastro.

/** Os campos do cadastro por etapas que o rascunho guarda, com o tamanho máximo de cada um. */
const CAMPOS_DO_RASCUNHO = {
  instagram: 80,
  souDono: 3,
  nome: 80,
  categoria: 60,
  municipio: 120,
  resumo: 160,
  motivo: 600,
  site: 200,
  whatsapp: 30,
  emailContato: 200,
} as const;

export type Rascunho = Partial<Record<keyof typeof CAMPOS_DO_RASCUNHO, string>> & { causas?: string[] };

/**
 * Lê um rascunho guardado (no banco ou no navegador): só os campos conhecidos, só
 * texto, no tamanho de cada campo. Sem nenhum campo, não há rascunho.
 */
export function lerRascunho(dados: unknown): Rascunho | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const origem = dados as Record<string, unknown>;
  const rascunho: Rascunho = {};
  for (const [campo, maximo] of Object.entries(CAMPOS_DO_RASCUNHO) as [keyof typeof CAMPOS_DO_RASCUNHO, number][]) {
    const valor = origem[campo];
    if (typeof valor === "string" && valor.trim()) rascunho[campo] = valor.slice(0, maximo);
  }
  if (Array.isArray(origem.causas)) {
    const causas = origem.causas.filter((c): c is string => typeof c === "string" && /^[a-z0-9-]{1,40}$/.test(c));
    if (causas.length > 0) rascunho.causas = causas.slice(0, 40);
  }
  return Object.keys(rascunho).length > 0 ? rascunho : null;
}
