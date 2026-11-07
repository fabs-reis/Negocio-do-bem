// Quem anda no cortejo. Sem banco e sem React: o palco é sempre o mesmo.
// As figuras não levam a nenhum tipo de negócio. A ligação entre a pessoa e a
// categoria era arbitrária (a padeira não representa "Café e padaria").

export type IdPessoa = "padeira" | "costureira" | "psicologa" | "agricultor";
export type IdPersonagem = IdPessoa | "caramelo";

/** Uma pessoa do cortejo e a palavra da sua placa. */
export type PessoaDoCortejo = { id: IdPessoa; placa: string };
/** O caramelo anda junto, sem placa. */
export type PersonagemDoCortejo = PessoaDoCortejo | { id: "caramelo" };

/** As placas, em ordem, formam a frase "COMPRE DE QUEM FAZ O BEM". */
export const PESSOAS_DO_CORTEJO = [
  { id: "padeira", placa: "COMPRE" },
  { id: "costureira", placa: "DE QUEM" },
  { id: "psicologa", placa: "FAZ" },
  { id: "agricultor", placa: "O BEM" },
] as const satisfies readonly PessoaDoCortejo[];

/** Os cinco do cortejo, na ordem do palco. */
export const PERSONAGENS_DO_CORTEJO: readonly PersonagemDoCortejo[] = [...PESSOAS_DO_CORTEJO, { id: "caramelo" }];
