import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { usuarioAtual } from "@/lib/auth/sessao";
import { lerPreenchimento } from "@/lib/indicacao";
import { metadadosDaPagina } from "@/lib/seo";
import { FormIndicar } from "./FormIndicar";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Indicar um negócio",
  descricao: "Conhece um negócio que faz o bem? Indique para o diretório: a moderação confere e publica, e o dono pode assumir o perfil depois.",
  caminho: "/indicar",
});

export default function Indicar(props: PageProps<"/indicar">) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-14 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Indicar</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Conhece um negócio que faz o bem?
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-suave">
        Conte pra comunidade. A indicação entra no ar na hora e, depois, o dono pode assumir o perfil e contar a própria
        história.
      </p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
          <Conteudo searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/indicar">, "searchParams">) {
  const [usuario, busca] = await Promise.all([usuarioAtual(), searchParams]);
  const preenchimento = lerPreenchimento(busca);
  // Quem chega da /participar volta para o formulário com o @ depois de entrar.
  const params = new URLSearchParams();
  if (preenchimento.instagram) params.set("instagram", preenchimento.instagram);
  if (preenchimento.souDono) params.set("dono", "sim");
  const destino = params.size > 0 ? `/indicar?${params}` : "/indicar";
  const voltar = encodeURIComponent(destino);
  if (!usuario) {
    return (
      <div className="cartao p-8 text-center">
        <p className="font-serif text-2xl">Entre para indicar</p>
        <p className="mx-auto mt-2 max-w-sm text-suave">
          Pedimos uma conta para manter a comunidade segura e saber a quem agradecer.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/entrar?voltar=${voltar}`} className="botao">
            Entrar
          </Link>
          <Link href={`/cadastrar?voltar=${voltar}`} className="botao-claro">
            Criar conta
          </Link>
        </div>
      </div>
    );
  }
  if (!usuario.emailConfirmado) return <ConfirmarEmail email={usuario.email} para="indicar" voltar={destino} />;
  return <FormIndicar preenchimento={preenchimento} />;
}
