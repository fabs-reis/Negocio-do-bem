import { unstable_cache } from "next/cache";
import { cache } from "react";

// Validação de CNPJ, incluindo o formato alfanumérico que a Receita Federal
// passou a emitir em julho de 2026 (12 caracteres de A-Z/0-9 + 2 dígitos).

export function limparCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function digitoVerificador(base: string): number {
  const pesos =
    base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  // No CNPJ alfanumérico cada caractere vale seu código ASCII menos 48 (0-9 → 0-9, A → 17...).
  const soma = [...base].reduce((total, c, i) => total + (c.charCodeAt(0) - 48) * pesos[i]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj.slice(0, 12));
  const segundo = digitoVerificador(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function formatarCnpj(valor: string): string {
  const c = limparCnpj(valor);
  if (c.length !== 14) return valor;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
};

/** Persiste só a projeção pública bem-sucedida. O React compartilha a consulta durante a renderização. */
const consultarCnpjNormalizado = cache(unstable_cache(
  async (cnpj: string): Promise<DadosCnpj> => {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { "User-Agent": "NegocioDoBem/1.0 (+https://github.com/fabs-reis/Negocio-do-bem)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) throw new Error("A consulta à BrasilAPI falhou.");
    const dados = (await resposta.json()) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      razaoSocial: texto(dados.razao_social) ?? "(sem razão social)",
      nomeFantasia: texto(dados.nome_fantasia),
      situacao: texto(dados.descricao_situacao_cadastral),
      municipio: texto(dados.municipio),
      uf: texto(dados.uf),
    };
  },
  ["brasilapi-cnpj-v1"],
  { revalidate: 86400 },
));

/**
 * Consulta pública na BrasilAPI, para a moderação conferir o nome registrado.
 * Normaliza antes de compartilhar. Converte falhas fora do cache persistente para permitir nova tentativa.
 * Retorna null se a consulta falhar: é só um apoio, nunca bloqueia a análise.
 */
export async function consultarCnpj(valor: string): Promise<DadosCnpj | null> {
  const cnpj = limparCnpj(valor);
  if (!cnpjValido(cnpj)) return null;
  try {
    return await consultarCnpjNormalizado(cnpj);
  } catch {
    return null;
  }
}
