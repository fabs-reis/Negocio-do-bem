import { z } from "zod";
import { campoEmail, campoMunicipio, campoSite } from "@/lib/formulario";
import { normalizarTexto } from "@/lib/texto";
import { conferirMunicipio } from "@/lib/municipios";
import { CATEGORIAS_SERVICOS } from "@/lib/servicos/dominio";
export { CATEGORIAS_SERVICOS } from "@/lib/servicos/dominio";

/** Domínio compartilhado entre o navegador e o servidor: sem acesso ao banco. */
export const ESTADOS_SERVICO = {
  pendente: "Em análise",
  publicado: "Publicado",
  rejeitado: "Não aprovado",
  suspenso: "Suspenso pela moderação",
} as const;

export const POR_PAGINA_SERVICOS = 18;
export const MAX_PAGINAS_SERVICOS = 500;

export function numeroPagina(valor: unknown): number {
  if (typeof valor !== "string" || !/^[1-9]\d{0,5}$/.test(valor)) return 1;
  return Math.min(Number(valor), MAX_PAGINAS_SERVICOS);
}

export function limitarPagina(pagina: number, total: number, tamanho = POR_PAGINA_SERVICOS) {
  const paginas = Math.min(MAX_PAGINAS_SERVICOS, Math.max(1, Math.ceil(total / tamanho)));
  return { pagina: Math.min(Math.max(1, pagina), paginas), paginas };
}

export const esquemaPerfilProfissional = z.object({
  nomePublico: z.string().trim().min(2, "Informe um nome profissional.").max(80),
  apresentacao: z.string().trim().min(20, "Conte um pouco sobre seu trabalho (mínimo 20 caracteres).").max(1200),
  municipio: campoMunicipio,
  remoto: z.boolean(),
  presencial: z.boolean(),
  emailContato: campoEmail,
  site: campoSite,
  publicado: z.boolean(),
})
  .refine((perfil) => perfil.remoto || perfil.presencial, {
    path: ["modalidade"], message: "Escolha pelo menos uma modalidade.",
  })
  .refine((perfil) => !perfil.publicado || !!perfil.emailContato || !!perfil.site, {
    path: ["emailContato"], message: "Para publicar, informe um e-mail profissional ou site.",
  });

/** Valida até dez municípios oficiais, um por linha, com UF quando o nome é ambíguo. */
export const esquemaAreasAtendimento = z.string().trim().max(1300).transform((valor, ctx) => {
  const linhas = valor.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
  if (linhas.length > 10) {
    ctx.addIssue({ code: "custom", message: "Informe no máximo 10 municípios." });
    return z.NEVER;
  }
  const areas: { cidade: string; uf: string }[] = [];
  const identificadores = new Set<string>();
  for (const linha of linhas) {
    const resultado = conferirMunicipio(linha);
    if ("erro" in resultado) {
      ctx.addIssue({ code: "custom", message: `Município "${linha}": ${resultado.erro}` });
      return z.NEVER;
    }
    const { nome: cidade, uf } = resultado.municipio;
    const identificador = `${cidade}/${uf}`;
    if (!identificadores.has(identificador)) {
      identificadores.add(identificador);
      areas.push({ cidade, uf });
    }
  }
  return areas;
});

export const esquemaServico = z.object({
  prestador: z.enum(["profissional", "empresa"]),
  empresaId: z.string().max(80).optional(),
  titulo: z.string().trim().min(5, "Informe o título do serviço.").max(100),
  descricao: z.string().trim().min(30, "Descreva o serviço em pelo menos 30 caracteres.").max(2500),
  categoria: z.enum(CATEGORIAS_SERVICOS),
  remoto: z.boolean(),
  presencial: z.boolean(),
  precoReferencia: z.string().trim().max(100).transform((valor) => valor || null),
  areasAtendimento: esquemaAreasAtendimento,
})
  .refine((servico) => servico.remoto || servico.presencial, {
    path: ["modalidade"], message: "Escolha pelo menos uma modalidade.",
  })
  .refine((servico) => !servico.presencial || (Array.isArray(servico.areasAtendimento) && servico.areasAtendimento.length > 0), {
    path: ["areasAtendimento"], message: "Indique pelo menos um município para atendimento presencial.",
  })
  .refine((servico) => servico.prestador !== "empresa" || !!servico.empresaId, {
    path: ["empresaId"], message: "Escolha a empresa.",
  })
  .refine((servico) => servico.prestador !== "profissional" || !servico.empresaId, {
    path: ["empresaId"], message: "O serviço pessoal não pode estar vinculado a uma empresa.",
  });

export const esquemaModeracaoServico = z.discriminatedUnion("decisao", [
  z.object({ decisao: z.literal("aprovar") }),
  z.object({
    decisao: z.literal("rejeitar"),
    motivo: z.string().trim().min(10, "Informe o motivo da recusa (mínimo 10 caracteres).").max(500),
  }),
  z.object({
    decisao: z.literal("suspender"),
    motivo: z.string().trim().min(10, "Informe o motivo da suspensão (mínimo 10 caracteres).").max(500),
  }),
]);

export function idServicoValido(valor: string): boolean {
  return /^[a-z0-9]{1,40}$/.test(valor);
}

export function buscaServico(dados: { titulo: string; descricao: string; categoria: string }) {
  // Cidade do prestador não representa onde o serviço atende; filtros geográficos usam a relação própria.
  return normalizarTexto([dados.titulo, dados.descricao, dados.categoria].join(" "));
}
