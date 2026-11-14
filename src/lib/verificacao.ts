import type { Prisma } from "@/lib/db";

/**
 * O que a consulta precisa trazer para saber se um perfil é verificado. Entra no
 * `include` de qualquer consulta que mostre o selo do negócio.
 */
export const INCLUIR_VERIFICACAO = {
  membros: { select: { usuarioId: true } },
  liberacoesClube: { where: { status: "liberada" }, select: { usuarioId: true } },
} satisfies Prisma.EmpresaInclude;

/**
 * Perfil verificado (#293): um dono que ainda é dono foi liberado no Clube do Bem pela
 * moderação, que conferiu o CNPJ, o nome e o CPF. A mesma pessoa é o "Parceiro do Clube
 * do Bem" na página do perfil. Sem esses dados, o perfil não conta como verificado.
 */
export function perfilVerificado(empresa: {
  membros?: { usuarioId: string }[];
  liberacoesClube?: { usuarioId: string; status?: string }[];
}): boolean {
  const membros = new Set((empresa.membros ?? []).map((m) => m.usuarioId));
  return (empresa.liberacoesClube ?? []).some((l) => (l.status ?? "liberada") === "liberada" && membros.has(l.usuarioId));
}
