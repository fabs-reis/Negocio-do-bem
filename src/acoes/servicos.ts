"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirModerador, exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import {
  buscaServico, esquemaModeracaoServico, esquemaPerfilProfissional,
  esquemaServico, idServicoValido,
} from "@/lib/servicos";
import { filtroDePropriedadeServico, identificarPrestador, podeGerirServico, sincronizarMunicipioServicos } from "@/lib/servicos/permissoes";
import { estadoAposRevisao } from "@/lib/servicos/transicoes";

const PAINEL = "/painel/servicos";
const FILA = "/moderacao/servicos";

function atualizarPaginas() {
  revalidatePath("/servicos");
  revalidatePath(PAINEL);
  revalidatePath(FILA);
}

export async function salvarPerfilProfissional(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario(PAINEL);
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaPerfilProfissional.safeParse({
    nomePublico: texto(dados, "nomePublico"), apresentacao: texto(dados, "apresentacao"),
    municipio: texto(dados, "municipio"), remoto: dados.get("remoto") === "sim",
    presencial: dados.get("presencial") === "sim", emailContato: texto(dados, "emailContato"),
    site: texto(dados, "site"), publicado: dados.get("publicado") === "sim",
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  if (resultado.data.publicado && !usuario.emailConfirmado) {
    return { erro: "Confirme seu e-mail antes de publicar o perfil.", valores };
  }
  const { municipio, ...perfil } = resultado.data;
  await db.$transaction(async (tx) => {
    const anterior = await tx.perfilProfissional.findUnique({ where: { usuarioId: usuario.id } });
    const alterouInformacaoPublica = anterior && (
      anterior.nomePublico !== perfil.nomePublico ||
      anterior.apresentacao !== perfil.apresentacao ||
      anterior.cidade !== municipio.nome || anterior.uf !== municipio.uf ||
      anterior.remoto !== perfil.remoto || anterior.presencial !== perfil.presencial ||
      anterior.emailContato !== perfil.emailContato || anterior.site !== perfil.site
    );
    await tx.perfilProfissional.upsert({
      where: { usuarioId: usuario.id },
      create: { usuarioId: usuario.id, ...perfil, cidade: municipio.nome, uf: municipio.uf },
      update: { ...perfil, cidade: municipio.nome, uf: municipio.uf },
    });
    // O município exibido pelos anúncios (inclusive pendentes, rejeitados e suspensos)
    // não pode ficar desatualizado após a alteração do perfil.
    if (anterior && (anterior.cidade !== municipio.nome || anterior.uf !== municipio.uf)) {
      await sincronizarMunicipioServicos(tx, usuario.id, municipio);
    }
    // Mudanças em dados públicos exigem nova análise apenas dos publicados;
    // não revertem suspensões ou recusas anteriores.
    if (alterouInformacaoPublica) {
      await tx.servico.updateMany({
        where: { perfilUsuarioId: usuario.id, status: "publicado" },
        data: { status: "pendente", cidade: municipio.nome, uf: municipio.uf, motivoRecusa: null, moderadoEm: null },
      });
    }
    await registrarAuditoria(tx, {
      usuarioId: usuario.id, acao: "perfil_profissional.salvo",
      alvoTipo: "perfilProfissional", alvoId: usuario.id,
    });
  });
  atualizarPaginas();
  redirect(`${PAINEL}?aviso=perfil_salvo`);
}

/** A mesma action cria ou revisa um serviço; em ambos os casos há validação de propriedade. */
export async function salvarServico(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario(PAINEL);
  const valores = valoresDoFormulario(dados);
  if (!usuario.emailConfirmado) return { erro: "Confirme seu e-mail antes de anunciar serviços.", valores };
  const id = texto(dados, "id");
  if (id && !idServicoValido(id)) return { erro: "Anúncio inválido.", valores };
  const validado = esquemaServico.safeParse({
    prestador: texto(dados, "prestador"), empresaId: texto(dados, "empresaId") || undefined,
    titulo: texto(dados, "titulo"), descricao: texto(dados, "descricao"),
    categoria: texto(dados, "categoria"), remoto: dados.get("remoto") === "sim",
    presencial: dados.get("presencial") === "sim", precoReferencia: texto(dados, "precoReferencia"),
    areasAtendimento: texto(dados, "areasAtendimento"),
  });
  if (!validado.success) return { erros: errosPorCampo(validado.error), valores };
  const { prestador, empresaId, areasAtendimento, ...conteudo } = validado.data;

  const resultado = await db.$transaction(async (tx) => {
    const destino = await identificarPrestador(tx, usuario.id, prestador, empresaId);
    if (!destino) return { erro: "Publique seu perfil ou escolha um negócio verificado que você administra." };

    if (id) {
      const anuncio = await podeGerirServico(tx, usuario.id, id);
      if (!anuncio) return { erro: "O serviço não existe ou você não pode editá-lo." };
      if (anuncio.perfilUsuarioId !== destino.perfilUsuarioId || anuncio.empresaId !== destino.empresaId) {
        return { erro: "Não é permitido transferir um anúncio entre prestadores." };
      }
      await tx.servico.update({
        where: { id, ...filtroDePropriedadeServico(usuario.id) },
        data: {
          ...conteudo, cidade: destino.cidade, uf: destino.uf,
          busca: buscaServico(conteudo),
          areasAtendimento: { deleteMany: {}, create: areasAtendimento },
          status: estadoAposRevisao(), motivoRecusa: null, motivoSuspensao: null, moderadoEm: null,
        },
      });
      await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "servico.reenviado", alvoTipo: "servico", alvoId: id });
      return { ok: true };
    }

    const criado = await tx.servico.create({
      data: {
        ...conteudo, ...destino,
        busca: buscaServico(conteudo),
        areasAtendimento: { create: areasAtendimento },
        status: "pendente",
      },
    });
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "servico.criado", alvoTipo: "servico", alvoId: criado.id });
    return { ok: true };
  });

  if ("erro" in resultado) return { erro: resultado.erro, valores };
  atualizarPaginas();
  redirect(`${PAINEL}?aviso=servico_enviado`);
}

export async function alternarServico(dados: FormData): Promise<void> {
  const usuario = await exigirUsuario(PAINEL);
  if (!usuario.emailConfirmado) redirect(PAINEL);
  const id = texto(dados, "id");
  const acao = texto(dados, "oculto");
  if (!idServicoValido(id) || !["sim", "nao"].includes(acao)) redirect(PAINEL);
  const oculto = acao === "sim";
  await db.$transaction(async (tx) => {
    // Autorização e escrita numa só condição, evitando alterações por IDs de terceiros.
    const { count } = await tx.servico.updateMany({
      where: {
        id,
        ...filtroDePropriedadeServico(usuario.id),
      },
      data: { oculto },
    });
    if (count) await registrarAuditoria(tx, {
      usuarioId: usuario.id, acao: oculto ? "servico.oculto" : "servico.reativado",
      alvoTipo: "servico", alvoId: id,
    });
  });
  atualizarPaginas();
  redirect(PAINEL);
}

export async function moderarServico(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const id = texto(dados, "id");
  const validado = esquemaModeracaoServico.safeParse({
    decisao: texto(dados, "decisao"), motivo: texto(dados, "motivo"),
  });
  if (!idServicoValido(id) || !validado.success) redirect(`${FILA}?aviso=dados_invalidos`);

  const decisao = validado.data;
  const status = decisao.decisao === "aprovar" ? "publicado" : decisao.decisao === "suspender" ? "suspenso" : "rejeitado";
  const resultado = await db.$transaction(async (tx) => {
    const { count } = await tx.servico.updateMany({
      where: {
        id, status: status === "suspenso" ? "publicado" : "pendente",
        ...(status === "publicado" ? {
          OR: [
            { perfil: { is: { publicado: true } } },
            { empresa: { is: { status: "verificada", moderacao: "aprovada", oculta: false } } },
          ],
        } : {}),
      },
      data: {
        status, moderadoEm: new Date(),
        motivoRecusa: decisao.decisao === "rejeitar" ? decisao.motivo : null,
        motivoSuspensao: decisao.decisao === "suspender" ? decisao.motivo : null,
      },
    });
    if (count) await registrarAuditoria(tx, {
      usuarioId: moderador.id, acao: `servico.${status}`, alvoTipo: "servico", alvoId: id,
    });
    return count;
  });
  atualizarPaginas();
  redirect(`${FILA}?aviso=${resultado ? "feito" : "indisponivel"}`);
}
