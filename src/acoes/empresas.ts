"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { apagarFoto, conferirFoto, guardarFoto } from "@/lib/armazenamento";
import { registrarAuditoria } from "@/lib/auditoria";
import { caminhoSeguro, exigirUsuario } from "@/lib/auth/sessao";
import { filtrarCausas } from "@/lib/causas";
import { db } from "@/lib/db";
import { CATEGORIAS, UFS } from "@/lib/dominio";
import {
  campoEmail,
  campoSite,
  campoWhatsapp,
  errosPorCampo,
  texto,
  valoresDoFormulario,
  type EstadoFormulario,
} from "@/lib/formulario";
import { normalizarUsername } from "@/lib/instagram";
import { textoDeBusca } from "@/lib/texto";

const LIMITE_INDICACOES_POR_DIA = 10;

const camposComuns = {
  nome: z.string().trim().min(2, "Qual é o nome do negócio?").max(80, "Nome muito longo."),
  categoria: z.enum(CATEGORIAS, { error: "Escolha uma categoria." }),
  cidade: z.string().trim().min(2, "Em que cidade fica?").max(60, "Nome de cidade muito longo."),
  uf: z.enum(UFS, { error: "Escolha o estado." }),
  resumo: z.string().trim().min(10, "Escreva uma frase sobre o negócio.").max(160, "Use até 160 caracteres."),
};

const camposContato = {
  site: campoSite,
  whatsapp: campoWhatsapp,
  emailContato: campoEmail,
};

function lerContato(dados: FormData) {
  return { site: texto(dados, "site"), whatsapp: texto(dados, "whatsapp"), emailContato: texto(dados, "emailContato") };
}

const esquemaIndicacao = z.object({
  ...camposComuns,
  ...camposContato,
  instagram: z.string().transform((valor, ctx) => {
    const username = normalizarUsername(valor);
    if (!username) {
      ctx.addIssue({ code: "custom", message: "Digite o @ do Instagram do negócio (ex.: @padariadobairro)." });
      return z.NEVER;
    }
    return username;
  }),
  motivo: z.string().trim().max(600, "Use até 600 caracteres.").optional(),
});

export async function indicarEmpresa(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario("/indicar");
  const valores = valoresDoFormulario(dados, ["causas"]);

  const resultado = esquemaIndicacao.safeParse({
    instagram: texto(dados, "instagram"),
    nome: texto(dados, "nome"),
    categoria: texto(dados, "categoria"),
    cidade: texto(dados, "cidade"),
    uf: texto(dados, "uf"),
    resumo: texto(dados, "resumo"),
    motivo: texto(dados, "motivo") || undefined,
    ...lerContato(dados),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  const { instagram, motivo, ...campos } = resultado.data;
  const souDono = dados.get("souDono") === "sim";

  const existente = await db.empresa.findUnique({ where: { instagramUsername: instagram } });
  if (existente) {
    return {
      erros: { instagram: `@${instagram} já está no Negócio do Bem.` },
      existente: instagram,
      valores,
    };
  }

  const recentes = await db.empresa.count({
    where: { indicadaPorId: usuario.id, criadoEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recentes >= LIMITE_INDICACOES_POR_DIA) {
    return { erro: "Você já fez muitas indicações hoje. Obrigado pela energia! Tente de novo amanhã.", valores };
  }

  const empresa = await db.empresa.create({
    data: {
      ...campos,
      instagramUsername: instagram,
      motivoIndicacao: souDono ? null : motivo || null,
      indicadaPorId: usuario.id,
      // Indicações de moderadores já entram publicadas.
      moderacao: usuario.moderador ? "aprovada" : "pendente",
      busca: textoDeBusca({ ...campos, instagramUsername: instagram }),
      causas: { create: filtrarCausas(dados.getAll("causas").map(String)).map((causa) => ({ causa })) },
    },
  });
  await registrarAuditoria(db, {
    usuarioId: usuario.id,
    acao: "empresa.indicada",
    alvoTipo: "empresa",
    alvoId: empresa.id,
  });

  redirect(souDono ? `/empresas/${instagram}/reivindicar` : `/empresas/${instagram}?aviso=indicada`);
}

const esquemaEdicao = z.object({
  ...camposComuns,
  ...camposContato,
  historia: z.string().max(20_000, "A história pode ter até 20 mil caracteres.").default(""),
});

async function exigirDono(empresaId: string, voltarPara: string) {
  const usuario = await exigirUsuario(voltarPara);
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId: usuario.id } },
    include: { empresa: true },
  });
  if (!membro) redirect("/painel");
  return { usuario, empresa: membro.empresa };
}

export async function salvarEmpresa(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa } = await exigirDono(texto(dados, "empresaId"), "/painel");
  const valores = valoresDoFormulario(dados, ["causas"]);

  const resultado = esquemaEdicao.safeParse({
    nome: texto(dados, "nome"),
    categoria: texto(dados, "categoria"),
    cidade: texto(dados, "cidade"),
    uf: texto(dados, "uf"),
    resumo: texto(dados, "resumo"),
    historia: texto(dados, "historia").replace(/\r\n/g, "\n"),
    ...lerContato(dados),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  const campos = resultado.data;
  const causas = filtrarCausas(dados.getAll("causas").map(String));

  await db.$transaction([
    db.empresa.update({
      where: { id: empresa.id },
      data: { ...campos, busca: textoDeBusca({ ...campos, instagramUsername: empresa.instagramUsername }) },
    }),
    db.empresaCausa.deleteMany({ where: { empresaId: empresa.id } }),
    db.empresaCausa.createMany({ data: causas.map((causa) => ({ empresaId: empresa.id, causa })) }),
  ]);
  await registrarAuditoria(db, { usuarioId: usuario.id, acao: "empresa.editada", alvoTipo: "empresa", alvoId: empresa.id });

  redirect(`/painel/${empresa.instagramUsername}?aviso=salvo`);
}

export async function alternarVisibilidade(dados: FormData): Promise<void> {
  const { usuario, empresa } = await exigirDono(texto(dados, "empresaId"), "/painel");
  const oculta = dados.get("ocultar") === "sim";
  await db.empresa.update({ where: { id: empresa.id }, data: { oculta } });
  await registrarAuditoria(db, {
    usuarioId: usuario.id,
    acao: oculta ? "empresa.ocultada" : "empresa.reexibida",
    alvoTipo: "empresa",
    alvoId: empresa.id,
  });
  redirect(`/painel/${empresa.instagramUsername}?aviso=${oculta ? "oculta" : "visivel"}`);
}

async function buscarParaFoto(dados: FormData) {
  const voltar = caminhoSeguro(texto(dados, "voltar"), "/painel");
  const usuario = await exigirUsuario(voltar);
  const empresa = await db.empresa.findUnique({
    where: { id: texto(dados, "empresaId") },
    include: { membros: { select: { usuarioId: true } } },
  });
  if (!empresa) redirect("/");
  const dono = empresa.membros.some((m) => m.usuarioId === usuario.id);
  return { usuario, empresa, dono, voltar };
}

/** Troca a foto do perfil: o dono, ou a moderação enquanto o negócio não tem dono. */
export async function trocarFoto(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa, dono, voltar } = await buscarParaFoto(dados);
  if (!dono && !(usuario.moderador && empresa.membros.length === 0)) {
    return { erro: "Só o dono pode trocar a foto deste perfil." };
  }
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return { erro: foto.erro };

  let fotoUrl: string;
  try {
    fotoUrl = await guardarFoto(foto, "perfis");
  } catch (erro) {
    console.error("Falha ao guardar a foto do perfil", erro);
    return { erro: "Não conseguimos guardar a foto agora. Tente de novo em instantes." };
  }
  await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl } });
  await apagarFoto(empresa.fotoUrl);
  await registrarAuditoria(db, { usuarioId: usuario.id, acao: "empresa.foto_trocada", alvoTipo: "empresa", alvoId: empresa.id });
  redirect(`${voltar}?aviso=foto_salva`);
}

/** Tira a foto do perfil: o dono, ou a moderação em qualquer negócio. */
export async function removerFoto(dados: FormData): Promise<void> {
  const { usuario, empresa, dono, voltar } = await buscarParaFoto(dados);
  if (!dono && !usuario.moderador) redirect(voltar);
  await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl: null } });
  await apagarFoto(empresa.fotoUrl);
  await registrarAuditoria(db, { usuarioId: usuario.id, acao: "empresa.foto_removida", alvoTipo: "empresa", alvoId: empresa.id });
  redirect(`${voltar}?aviso=foto_removida`);
}

/** Guarda uma foto para a história e devolve o endereço, que o editor coloca no texto. */
export async function enviarFotoDaHistoria(dados: FormData): Promise<{ url?: string; erro?: string }> {
  const { empresa } = await exigirDono(texto(dados, "empresaId"), "/painel");
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return { erro: foto.erro };
  try {
    return { url: await guardarFoto(foto, "historias") };
  } catch (erro) {
    console.error("Falha ao guardar a foto da história", empresa.id, erro);
    return { erro: "Não conseguimos guardar a foto agora. Tente de novo em instantes." };
  }
}
