import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { normalizarEndereco } from "@/lib/instagram";
import { FormCorrecao } from "./FormCorrecao";

export const metadata: Metadata = { title: "Avisar um erro no perfil", robots: { index: false } };

export default function CorrigirPerfil(props: PageProps<"/empresas/[usuario]/corrigir">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/empresas/[usuario]/corrigir">, "params">) {
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const empresa = await db.empresa.findFirst({
    where: { instagramUsername: username, moderacao: "aprovada", oculta: false, membros: { none: {} } },
    select: { id: true, nome: true },
  });
  if (!empresa) notFound();
  await exigirUsuario(`/empresas/${username}/corrigir`);
  return (
    <div className="space-y-6">
      <Link href={`/empresas/${username}`} className="link">← Voltar ao perfil</Link>
      <h1 className="font-serif text-3xl font-semibold">Avisar um erro em {empresa.nome}</h1>
      <p className="text-suave">Ajude a moderação a corrigir os dados enviados pela comunidade.</p>
      <FormCorrecao empresaId={empresa.id} />
    </div>
  );
}
