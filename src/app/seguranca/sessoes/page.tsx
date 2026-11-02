import type { Metadata } from "next";
import Link from "next/link";
import { encerrarTodasSessoes } from "@/acoes/mfa";
import { exigirUsuario } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Gerenciar sessões", robots: { index: false } };

export default async function GerenciarSessoes() {
  await exigirUsuario("/seguranca/sessoes");
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Sessões e segurança</h1>
      <section className="cartao space-y-4 p-6">
        <h2 className="font-semibold">Encerrar todas as sessões</h2>
        <p className="text-sm text-suave">
          Encerra o acesso em todos os dispositivos, incluindo este. Não altera a senha,
          a configuração do MFA nem as contas de outras pessoas.
        </p>
        <form action={encerrarTodasSessoes}>
          <button type="submit" className="botao">Sair de todos os dispositivos</button>
        </form>
      </section>
      <Link href="/painel" className="link block text-sm">Voltar ao painel</Link>
    </main>
  );
}
