/** Regras puras das transições; verificações de permissão ficam no servidor. */
export type EstadoServico = "pendente" | "publicado" | "rejeitado" | "suspenso";
export type DecisaoModeracao = "aprovar" | "rejeitar" | "suspender";

export function estadoAposRevisao(): EstadoServico {
  // Edição de um anúncio aprovado não pode contornar a moderação.
  return "pendente";
}

export function estadoAposDecisao(estado: string, decisao: DecisaoModeracao): EstadoServico | null {
  if (decisao === "suspender") return estado === "publicado" ? "suspenso" : null;
  if (estado !== "pendente") return null;
  return decisao === "aprovar" ? "publicado" : "rejeitado";
}
