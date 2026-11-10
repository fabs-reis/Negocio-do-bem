import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { caminhoSeguro, sessaoAtual } from "@/lib/auth/sessao";
import { PainelMfa } from "./PainelMfa";

export const metadata: Metadata = { title: "Segurança da moderação", robots: { index: false } };

export default async function PaginaMfa({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string; revalidar?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar?voltar=%2Fseguranca%2Fmfa");
  if (sessao.usuario.papel !== "moderador") redirect("/painel");
  const params = await searchParams;
  const voltar = caminhoSeguro(params.voltar, "/moderacao");
  const configurado = sessao.usuario.mfaAtivadoEm !== null;
  const verificado = Boolean(sessao.mfaVerificadoEm);
  const revalidar = params.revalidar === "1";
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-coral-700">Segurança</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Autenticação da moderação</h1>
        <p className="mt-3 text-sm text-suave">
          O segundo fator é obrigatório para atuar na moderação, mesmo depois de entrar com Google ou link de e-mail.
        </p>
      </div>
      <PainelMfa configurado={configurado} verificado={verificado} revalidar={revalidar} voltar={voltar} />
      <Link href="/seguranca/sessoes" className="link block text-sm">Gerenciar as minhas sessões</Link>
    </main>
  );
}
