"use server";

import { redirect } from "next/navigation";
import { exigirModerador } from "@/lib/auth/sessao";
import { ErroClube, liberarParaClube, suspenderDoClube } from "@/lib/clube";
import { db } from "@/lib/db";
import { texto } from "@/lib/formulario";

function voltarParaFicha(username: string, aviso: string): never {
  redirect(`/moderacao/negocios/${username}?aviso=${aviso}#clube`);
}

/** Libera um dono do negócio para o Clube do Bem, com o CNPJ conferido na Receita. Só a moderação. */
export async function liberarDonoParaClube(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") }, select: { id: true, instagramUsername: true } });
  if (!empresa) redirect("/moderacao?aba=negocios");
  try {
    await liberarParaClube({
      empresaId: empresa.id,
      usuarioId: texto(dados, "usuarioId"),
      cnpj: texto(dados, "cnpj"),
      moderadorId: moderador.id,
    });
  } catch (erro) {
    if (erro instanceof ErroClube) voltarParaFicha(empresa.instagramUsername, `clube_${erro.motivo}`);
    throw erro;
  }
  voltarParaFicha(empresa.instagramUsername, "clube_liberado");
}

/** Suspende a liberação de um dono, com o motivo. Só a moderação. */
export async function suspenderDonoDoClube(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Sem motivo informado";
  const username = await suspenderDoClube({ liberacaoId: texto(dados, "liberacaoId"), moderadorId: moderador.id, motivo });
  if (!username) redirect("/moderacao?aba=negocios");
  voltarParaFicha(username, "clube_suspenso");
}
