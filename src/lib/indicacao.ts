import { normalizarUsername } from "@/lib/instagram";

export type Preenchimento = { instagram: string; souDono: boolean };

/**
 * Valores iniciais do cadastro por etapas vindos da URL (/participar?instagram=<@>&dono=sim),
 * como os links antigos do /indicar trazem. São só sugestões: o envio valida tudo de novo.
 */
export function lerPreenchimento(busca: Record<string, string | string[] | undefined>): Preenchimento {
  const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
  return {
    instagram: normalizarUsername(primeiro(busca.instagram)) ?? "",
    souDono: primeiro(busca.dono) === "sim",
  };
}

/**
 * Quem indica não publica contatos: site, WhatsApp e e-mail ficam com o dono, depois
 * de confirmar (#105). O servidor apaga o que vier, mesmo que alguém mande.
 */
export function semContatosDeTerceiros<T extends { site: unknown; whatsapp: unknown; emailContato: unknown }>(
  campos: T,
  souDono: boolean,
): T {
  return souDono ? campos : { ...campos, site: null, whatsapp: null, emailContato: null };
}
