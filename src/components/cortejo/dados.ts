// Quem anda no cortejo e para onde cada pessoa leva. Sem banco e sem React:
// a página inicial passa a contagem de resumoDoDiretorio().porCategoria.

import { hrefDiretorio, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";

export type IdPessoa = "padeira" | "costureira" | "psicologa" | "agricultor";
export type IdPersonagem = IdPessoa | "caramelo";

/** Uma pessoa do cortejo: a palavra da placa e o link para o seu tipo de negócio. */
export type PessoaDoCortejo = { id: IdPessoa; placa: string; href: string; rotulo: string; total: number };
/** O caramelo anda junto, mas não é link nem carrega placa. */
export type PersonagemDoCortejo = PessoaDoCortejo | { id: "caramelo" };

/** As placas, em ordem, formam a frase "COMPRE DE QUEM FAZ O BEM". */
export const PESSOAS_DO_CORTEJO = [
  { id: "padeira", placa: "COMPRE", rotulo: "Café e padaria" },
  { id: "costureira", placa: "DE QUEM", rotulo: "Moda e acessórios" },
  { id: "psicologa", placa: "FAZ", rotulo: "Saúde" },
  { id: "agricultor", placa: "O BEM", rotulo: "Mercado e empório" },
] as const satisfies readonly { id: IdPessoa; placa: string; rotulo: string }[];

/** Os cinco do cortejo, na ordem do palco, com a contagem de cada tipo de negócio. */
export function personagensDoCortejo(porCategoria: Partial<Record<string, number>>): PersonagemDoCortejo[] {
  return [
    ...PESSOAS_DO_CORTEJO.map((pessoa) => ({
      ...pessoa,
      // A página do tipo pode ser lida pelos buscadores; sem ela, o diretório filtrado.
      href: temPaginaDeTipo(pessoa.rotulo) ? hrefTipo(pessoa.rotulo) : hrefDiretorio({ tipos: [pessoa.rotulo] }),
      total: porCategoria[pessoa.rotulo] ?? 0,
    })),
    { id: "caramelo" },
  ];
}
