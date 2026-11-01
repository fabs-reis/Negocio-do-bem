import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormularioServico } from "@/components/FormularioServico";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { idServicoValido } from "@/lib/servicos";

export const metadata: Metadata = { title: "Revisar serviço", robots: { index: false } };

export default function EditarServico(props: PageProps<"/painel/servicos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/painel/servicos/[id]">, "params">) {
  const usuario = await exigirUsuario("/painel/servicos");
  const id = (await params).id;
  if (!idServicoValido(id)) notFound();
  const [servico, perfil, membros] = await Promise.all([
    db.servico.findFirst({
      include: { areasAtendimento: { select: { cidade: true, uf: true } } },
      where: {
        id,
        OR: [
          { perfilUsuarioId: usuario.id },
          { empresa: { is: { membros: { some: { usuarioId: usuario.id } } } } },
        ],
      },
    }),
    db.perfilProfissional.findUnique({ where: { usuarioId: usuario.id }, select: { publicado: true } }),
    db.empresaMembro.findMany({
      where: { usuarioId: usuario.id },
      include: { empresa: { select: { id: true, nome: true, status: true, moderacao: true, oculta: true } } },
    }),
  ]);
  if (!servico) notFound();
  const empresas = membros.filter(({ empresa }) => empresa.status === "verificada" && empresa.moderacao === "aprovada" && !empresa.oculta)
    .map(({ empresa }) => ({ id: empresa.id, nome: empresa.nome }));

  return (
    <div className="space-y-6">
      <Link href="/painel/servicos" className="link text-sm">← Voltar aos meus serviços</Link>
      <h1 className="font-serif text-4xl font-semibold">Revisar serviço</h1>
      {servico.status === "suspenso" && servico.motivoSuspensao && (
        <p role="status" className="rounded-2xl bg-coral-50 p-4 text-sm text-coral-700">
          Suspenso pela moderação: {servico.motivoSuspensao}. Corrija o anúncio e envie para nova análise.
        </p>
      )}
      {servico.status === "rejeitado" && servico.motivoRecusa && (
        <p role="status" className="rounded-2xl bg-coral-50 p-4 text-sm text-coral-700">
          Motivo da recusa: {servico.motivoRecusa}
        </p>
      )}
      <FormularioServico temPerfil={!!perfil?.publicado} empresas={empresas} servico={servico} />
    </div>
  );
}
