"use server";

import { redirect } from "next/navigation";
import { caminhoSeguro, exigirUsuario } from "@/lib/auth/sessao";
import { ehDono } from "@/lib/consultas";
import { db } from "@/lib/db";
import { texto } from "@/lib/formulario";
import { medir } from "@/lib/medicao-servidor";

/** O caminho com o aviso na URL, mesmo quando ele já tem outros parâmetros (`/seguindo?pagina=2`). */
function comAviso(caminho: string, aviso: string): string {
  const url = new URL(caminho, "http://origem.invalid");
  url.searchParams.set("aviso", aviso);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Seguir (`seguir=sim`) ou deixar de seguir um negócio. Só um negócio do diretório pode
 * ser seguido, e o dono não segue o próprio. Deixar de seguir vale sempre, mesmo depois
 * que o negócio saiu do diretório.
 */
export async function alternarSeguir(dados: FormData): Promise<void> {
  const empresa = await db.empresa.findUnique({
    where: { id: texto(dados, "empresaId") },
    include: { membros: { select: { usuarioId: true } } },
  });
  if (!empresa) redirect("/");
  const voltar = caminhoSeguro(texto(dados, "voltar"), `/empresas/${empresa.instagramUsername}`);
  const usuario = await exigirUsuario(voltar);

  if (dados.get("seguir") !== "sim") {
    await db.empresaSeguidor.deleteMany({ where: { empresaId: empresa.id, usuarioId: usuario.id } });
    redirect(comAviso(voltar, "deixou_de_seguir"));
  }

  // A página não mostra o botão nesses casos; a regra vale aqui também.
  if (empresa.moderacao !== "aprovada" || empresa.oculta || ehDono(empresa, usuario)) redirect(voltar);

  // Com dois toques seguidos em "Seguir", só o primeiro grava e só ele conta no Analytics.
  const { count } = await db.empresaSeguidor.createMany({
    data: [{ empresaId: empresa.id, usuarioId: usuario.id }],
    skipDuplicates: true,
  });
  if (count > 0) await medir({ nome: "negocio_seguido", params: { categoria: empresa.categoria, uf: empresa.uf } });
  redirect(comAviso(voltar, "seguindo"));
}
