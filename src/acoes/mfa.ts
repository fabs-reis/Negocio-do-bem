"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verificarSenha } from "@/lib/auth/senha";
import { caminhoSeguro, encerrarSessao, sessaoAtual } from "@/lib/auth/sessao";
import {
  criptografarSegredoMfa,
  descriptografarSegredoMfa,
  gerarCodigosRecuperacao,
  gerarSegredoMfa,
  hashCodigoRecuperacao,
  validarCodigoMfa,
} from "@/lib/auth/mfa";
import { ipDoCabecalho, reservarTentativaDoEmail, zerarTentativasDoEmail } from "@/lib/auth/tentativas";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";

export type EstadoMfa = { erro?: string; segredo?: string; codigos?: string[] } | undefined;

async function contextoModerador() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar?voltar=%2Fseguranca%2Fmfa");
  if (sessao.usuario.papel !== "moderador") redirect("/painel");
  return sessao;
}

/**
 * Limite por conta, partilhado entre sessões: um atacante não pode reiniciar
 * as tentativas do MFA voltando ao login com uma senha já comprometida.
 */
async function reservarTentativaMfa(usuarioId: string): Promise<boolean> {
  const agora = new Date();
  const inicio = new Date(agora.getTime() - 15 * 60_000);
  const [linha] = await db.$queryRaw<{ contagem: number }[]>`
    INSERT INTO "MfaLimite" ("usuarioId", "contagem", "janelaIniciadaEm")
    VALUES (${usuarioId}, 1, ${agora})
    ON CONFLICT ("usuarioId") DO UPDATE SET
      "contagem" = CASE WHEN "MfaLimite"."janelaIniciadaEm" >= ${inicio}
        THEN "MfaLimite"."contagem" + 1 ELSE 1 END,
      "janelaIniciadaEm" = CASE WHEN "MfaLimite"."janelaIniciadaEm" >= ${inicio}
        THEN "MfaLimite"."janelaIniciadaEm" ELSE EXCLUDED."janelaIniciadaEm" END
    RETURNING "contagem"
  `;
  return linha!.contagem <= 10;
}

async function limitarTentativa(email: string, usuarioId: string): Promise<{ permitido: boolean; ip: string | null }> {
  const ip = ipDoCabecalho(await headers());
  const permitidoMfa = await reservarTentativaMfa(usuarioId);
  return { permitido: permitidoMfa && await reservarTentativaDoEmail(email, ip), ip };
}

/** O primeiro cadastro do segundo fator exige uma nova prova da senha atual. */
export async function iniciarConfiguracaoMfa(_estado: EstadoMfa, dados: FormData): Promise<EstadoMfa> {
  const sessao = await contextoModerador();
  if (sessao.usuario.mfaAtivadoEm) return { erro: "O segundo fator já está ativo." };
  if (!sessao.usuario.senhaHash) {
    return { erro: "Crie primeiro uma senha pelo link de recuperação no seu painel; depois volte para configurar o MFA." };
  }
  const limite = await limitarTentativa(sessao.usuario.email, sessao.usuarioId);
  if (!limite.permitido) return { erro: "Muitas tentativas. Tente novamente em 15 minutos." };
  const senha = dados.get("senha");
  if (typeof senha !== "string" || !(await verificarSenha(senha, sessao.usuario.senhaHash))) {
    return { erro: "Senha atual incorreta." };
  }
  await zerarTentativasDoEmail(sessao.usuario.email, limite.ip);
  const segredo = gerarSegredoMfa();
  await db.usuario.update({
    where: { id: sessao.usuarioId },
    data: { mfaSegredoPendente: criptografarSegredoMfa(segredo) },
  });
  return { segredo };
}

/** Ativa MFA e entrega códigos de recuperação uma única vez, sem os persistir em claro. */
export async function confirmarConfiguracaoMfa(_estado: EstadoMfa, dados: FormData): Promise<EstadoMfa> {
  const sessao = await contextoModerador();
  const pendente = await db.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { mfaSegredoPendente: true, mfaAtivadoEm: true },
  });
  if (!pendente?.mfaSegredoPendente || pendente.mfaAtivadoEm) {
    return { erro: "Inicie a configuração novamente." };
  }
  const codigo = dados.get("codigo");
  const limite = await limitarTentativa(sessao.usuario.email, sessao.usuarioId);
  if (!limite.permitido) return { erro: "Muitas tentativas. Tente novamente em 15 minutos." };
  const periodo = validarCodigoMfa(
    descriptografarSegredoMfa(pendente.mfaSegredoPendente),
    typeof codigo === "string" ? codigo.trim() : "",
  );
  if (periodo === null) return { erro: "Código inválido. Confira o relógio do telemóvel." };

  const codigos = gerarCodigosRecuperacao();
  const agora = new Date();
  const configurado = await db.$transaction(async (tx) => {
    const { count } = await tx.usuario.updateMany({
      where: { id: sessao.usuarioId, mfaAtivadoEm: null, mfaSegredoPendente: pendente.mfaSegredoPendente },
      data: {
        mfaSegredo: pendente.mfaSegredoPendente,
        mfaSegredoPendente: null,
        mfaAtivadoEm: agora,
        mfaUltimoPeriodo: periodo,
      },
    });
    if (!count) return false;
    await tx.mfaCodigoRecuperacao.createMany({
      data: codigos.map((valor) => ({ usuarioId: sessao.usuarioId, hash: hashCodigoRecuperacao(valor)! })),
    });
    await tx.sessao.deleteMany({ where: { usuarioId: sessao.usuarioId, id: { not: sessao.id } } });
    await tx.sessao.update({ where: { id: sessao.id }, data: { mfaVerificadoEm: agora, tentativasMfa: 0 } });
    await registrarAuditoria(tx, { usuarioId: sessao.usuarioId, acao: "usuario.mfa_ativado", alvoTipo: "usuario", alvoId: sessao.usuarioId });
    return true;
  });
  if (!configurado) return { erro: "O MFA já foi configurado noutra sessão. Atualize a página." };
  await db.mfaLimite.deleteMany({ where: { usuarioId: sessao.usuarioId } });
  await zerarTentativasDoEmail(sessao.usuario.email, limite.ip);
  return { codigos };
}

/** Necessário após senha, Google ou link, e para a reautenticação de ações críticas. */
export async function validarSegundoFator(_estado: EstadoMfa, dados: FormData): Promise<EstadoMfa> {
  const sessao = await contextoModerador();
  if (!sessao.usuario.mfaAtivadoEm || !sessao.usuario.mfaSegredo) {
    return { erro: "Configure o segundo fator antes de continuar." };
  }
  const codigo = typeof dados.get("codigo") === "string" ? String(dados.get("codigo")).trim() : "";
  const limite = await limitarTentativa(sessao.usuario.email, sessao.usuarioId);
  if (!limite.permitido) return { erro: "Muitas tentativas. Tente novamente em 15 minutos." };

  const { count } = await db.sessao.updateMany({
    where: { id: sessao.id, usuarioId: sessao.usuarioId, tentativasMfa: { lt: 5 } },
    data: { tentativasMfa: { increment: 1 } },
  });
  if (!count) return { erro: "Sessão bloqueada após 5 tentativas. Entre novamente." };

  const periodo = validarCodigoMfa(descriptografarSegredoMfa(sessao.usuario.mfaSegredo), codigo);
  const recuperacaoHash = periodo === null ? hashCodigoRecuperacao(codigo) : null;
  const agora = new Date();
  const valido = await db.$transaction(async (tx) => {
    if (periodo !== null) {
      const { count: consumido } = await tx.usuario.updateMany({
        where: {
          id: sessao.usuarioId,
          OR: [{ mfaUltimoPeriodo: null }, { mfaUltimoPeriodo: { lt: periodo } }],
        },
        data: { mfaUltimoPeriodo: periodo },
      });
      if (!consumido) return false;
    } else if (recuperacaoHash) {
      const { count: consumido } = await tx.mfaCodigoRecuperacao.deleteMany({
        where: { usuarioId: sessao.usuarioId, hash: recuperacaoHash },
      });
      if (!consumido) return false;
    } else {
      return false;
    }
    const { count: atualizada } = await tx.sessao.updateMany({
      where: { id: sessao.id, usuarioId: sessao.usuarioId },
      data: { mfaVerificadoEm: agora, tentativasMfa: 0 },
    });
    if (!atualizada) throw new Error("Sessão terminada durante a autenticação.");
    if (recuperacaoHash) {
      await registrarAuditoria(tx, {
        usuarioId: sessao.usuarioId,
        acao: "usuario.mfa_recuperacao_usada",
        alvoTipo: "usuario",
        alvoId: sessao.usuarioId,
      });
    }
    return true;
  });
  if (!valido) return { erro: "Código inválido, já usado ou expirado." };
  await db.mfaLimite.deleteMany({ where: { usuarioId: sessao.usuarioId } });
  await zerarTentativasDoEmail(sessao.usuario.email, limite.ip);
  redirect(caminhoSeguro(dados.get("voltar"), "/moderacao"));
}

/** Auto-contenção disponível para qualquer pessoa autenticada. */
export async function encerrarTodasSessoes(): Promise<void> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  await db.$transaction(async (tx) => {
    await tx.sessao.deleteMany({ where: { usuarioId: sessao.usuarioId } });
    await registrarAuditoria(tx, {
      usuarioId: sessao.usuarioId,
      acao: "usuario.sessoes_revogadas",
      alvoTipo: "usuario",
      alvoId: sessao.usuarioId,
    });
  });
  await encerrarSessao();
  redirect("/entrar?aviso=sessoes_encerradas");
}
