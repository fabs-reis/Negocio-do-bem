"use server";

import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { normalizarUsername } from "@/lib/instagram";
import { decidirProcura } from "@/lib/participacao";

/** Recebe o @ da porta de /participar e leva ao próximo passo. Só lê o banco. */
export async function procurarNegocio(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const instagram = normalizarUsername(texto(dados, "instagram"));
  if (!instagram) {
    return { erros: { instagram: "Esse @ não parece certo. Confira e tente de novo." }, valores: valoresDoFormulario(dados) };
  }
  const [empresa, usuario] = await Promise.all([
    db.empresa.findUnique({
      where: { instagramUsername: instagram },
      select: { moderacao: true, oculta: true, _count: { select: { membros: true } } },
    }),
    usuarioAtual(),
  ]);
  const negocio = empresa && { moderacao: empresa.moderacao, oculta: empresa.oculta, donos: empresa._count.membros };
  redirect(decidirProcura(instagram, negocio, !!usuario).destino);
}
