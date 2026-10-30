import { normalizarUsername } from "@/lib/instagram";

export type Preenchimento = { instagram: string; souDono: boolean };

/**
 * Valores iniciais do formulário vindos da URL (/indicar?instagram=<@>&dono=sim),
 * como a página /participar manda. São só sugestões: o envio valida tudo de novo.
 */
export function lerPreenchimento(busca: Record<string, string | string[] | undefined>): Preenchimento {
  const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
  return {
    instagram: normalizarUsername(primeiro(busca.instagram)) ?? "",
    souDono: primeiro(busca.dono) === "sim",
  };
}
