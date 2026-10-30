import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { caminhoSeguro, usuarioAtual } from "@/lib/auth/sessao";
import "@/app/area-interna.css";

/** Moldura das páginas de entrar/cadastrar: quem já está logado segue direto. */
export function PaginaConta({
  titulo,
  subtitulo,
  searchParams,
  formulario,
}: {
  titulo: string;
  subtitulo: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  formulario: (voltar: string) => ReactNode;
}) {
  return (
    <div className={`acesso-conta container-editorial pagina-operacional`}>
      <Link href="/explorar" className="conta-voltar">← Voltar para os negócios</Link>
      <div className="conta-composicao">
        <aside className="conta-contexto" aria-label="Participar da comunidade">
          <p className="conta-assinatura">Negócio do Bem</p>
          <p className="conta-mensagem">Quem faz o bem merece ser encontrado.</p>
          <p>Faça parte de uma comunidade que indica negócios, compartilha experiências e fortalece quem está perto.</p>
          <ul><li>Indique negócios que você conhece.</li><li>Deixe depoimentos sobre suas experiências.</li><li>Cuide do perfil do seu negócio.</li></ul>
        </aside>
        <section className="conta-formulario" aria-labelledby="titulo-conta">
          <header><h1 id="titulo-conta">{titulo}</h1><p>{subtitulo}</p></header>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-papel" />}>
          <Conteudo searchParams={searchParams} formulario={formulario} />
        </Suspense>
        </section>
      </div>
    </div>
  );
}

async function Conteudo({
  searchParams,
  formulario,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  formulario: (voltar: string) => ReactNode;
}) {
  const voltar = caminhoSeguro((await searchParams).voltar);
  if (await usuarioAtual()) redirect(voltar);
  return formulario(voltar);
}
