// O rascunho do cadastro por etapas, guardado na conta de quem ainda não confirmou
// o e-mail. Indicar pede o e-mail confirmado, e o link do e-mail pode ser aberto em
// outro aparelho: com o rascunho no banco, as respostas esperam a pessoa voltar.

import { db } from "@/lib/db";
import { lerRascunho, type Rascunho } from "@/lib/rascunho-do-cadastro";

/** Depois disso, o rascunho some na próxima leitura. */
const VALIDADE_DIAS = 30;
const DIA = 24 * 60 * 60 * 1000;

export async function guardarRascunho(usuarioId: string, dados: unknown): Promise<boolean> {
  const rascunho = lerRascunho(dados);
  if (!rascunho) return false;
  await db.rascunhoCadastro.upsert({
    where: { usuarioId },
    create: { usuarioId, dados: rascunho },
    update: { dados: rascunho },
  });
  return true;
}

export async function rascunhoDe(usuarioId: string): Promise<Rascunho | null> {
  const guardado = await db.rascunhoCadastro.findUnique({ where: { usuarioId } });
  if (!guardado) return null;
  if (guardado.atualizadoEm.getTime() < Date.now() - VALIDADE_DIAS * DIA) {
    await apagarRascunho(usuarioId);
    return null;
  }
  return lerRascunho(guardado.dados);
}

export async function apagarRascunho(usuarioId: string): Promise<void> {
  await db.rascunhoCadastro.deleteMany({ where: { usuarioId } });
}
