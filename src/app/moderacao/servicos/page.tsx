import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { moderarServico } from "@/acoes/servicos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { IconeRede } from "@/components/IconeRede";
import { Paginacao } from "@/components/Paginacao";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { limitarPagina, numeroPagina } from "@/lib/servicos";

const POR_PAGINA = 30;

export const metadata: Metadata = { title: "Moderar serviços", robots: { index: false } };

export default function ModeracaoServicos(props: PageProps<"/moderacao/servicos">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <nav aria-label="Você está em" className="mb-7 text-sm">
        <Link href="/moderacao" className="link">← Moderação</Link>
      </nav>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Analisar anúncios de serviços</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-suave">
        Analise os anúncios novos e suspenda serviços publicados que não respeitem as regras. Toda decisão fica registrada.
      </p>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-superficie" />}>
        <Publicados searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/moderacao/servicos">, "searchParams">) {
  await exigirModerador();
  const params = await searchParams;
  const total = await db.servico.count({ where: { status: "pendente" } });
  const { pagina, paginas } = limitarPagina(numeroPagina(params.pagina), total, POR_PAGINA);
  const pendentes = await db.servico.findMany({
    where: { status: "pendente" },
    select: {
      id: true, titulo: true, descricao: true, categoria: true,
      cidade: true, uf: true, remoto: true, presencial: true, precoReferencia: true,
      perfil: { select: { nomePublico: true } }, empresa: { select: { nome: true } },
    },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
  });
  return (
    <section className="mt-8 space-y-5">
      {params.aviso === "dados_invalidos" && <p role="alert" className="text-coral-700">Informe uma decisão e um motivo válido.</p>}
      {params.aviso === "feito" && <p role="status" className="rounded-xl bg-folha-50 p-3 text-sm text-folha">Decisão registrada com sucesso.</p>}
      {params.aviso === "indisponivel" && <p role="alert" className="text-coral-700">O anúncio já foi analisado ou o prestador não pode publicá-lo.</p>}
      <p className="text-sm text-suave">{total} {total === 1 ? "anúncio pendente" : "anúncios pendentes"}</p>
      {pendentes.length === 0 ? (
        <p className="cartao p-8 text-center text-suave">Nenhum anúncio aguardando análise.</p>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((servico) => (
            <article className="cartao min-w-0 space-y-4 p-5 sm:p-7" key={servico.id}>
              <header className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <h2 className="font-serif text-2xl font-semibold">{servico.titulo}</h2>
                  <p className="text-sm text-suave">{servico.perfil?.nomePublico ?? servico.empresa?.nome}</p>
                </div>
                <span className="text-sm text-suave">{servico.categoria} · {servico.cidade}, {servico.uf}</span>
              </header>
              <p className="whitespace-pre-wrap break-words rounded-2xl bg-papel p-4 text-sm leading-relaxed">{servico.descricao}</p>
              <p className="text-sm text-suave">
                {servico.remoto && "Remoto"}{servico.remoto && servico.presencial && " · "}{servico.presencial && "Presencial"}
                {servico.precoReferencia && ` · ${servico.precoReferencia}`}
              </p>
              <div className="grid gap-4 border-t border-linha pt-4 sm:grid-cols-2">
                <form action={moderarServico} className="flex flex-col justify-end">
                  <input type="hidden" name="id" value={servico.id} />
                  <input type="hidden" name="decisao" value="aprovar" />
                  <BotaoEnviar className="botao-coral min-h-11 w-full"><IconeRede nome="verificar" className="h-4 w-4" /> Aprovar anúncio</BotaoEnviar>
                </form>
                <form action={moderarServico} className="space-y-2">
                  <input type="hidden" name="id" value={servico.id} />
                  <input type="hidden" name="decisao" value="rejeitar" />
                  <label htmlFor={`motivo-${servico.id}`} className="rotulo">Motivo da recusa</label>
                  <textarea id={`motivo-${servico.id}`} name="motivo" required minLength={10} maxLength={500} rows={2} className="campo w-full" placeholder="Explique o que deve ser corrigido." />
                  <BotaoEnviar className="botao-claro min-h-11 w-full">Recusar anúncio</BotaoEnviar>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
      <Paginacao atual={pagina} total={paginas} href={(p) => p === 1 ? "/moderacao/servicos" : `/moderacao/servicos?pagina=${p}`} />
    </section>
  );
}


/** Serviços publicados: retirada motivada, sem apagar o histórico nem permitir suspensões anónimas. */
async function Publicados({ searchParams }: Pick<PageProps<"/moderacao/servicos">, "searchParams">) {
  await exigirModerador();
  const params = await searchParams;
  const q = typeof params.buscarPublicado === "string" ? params.buscarPublicado.trim().slice(0, 100) : "";
  const where = {
    status: "publicado",
    ...(q ? { titulo: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const total = await db.servico.count({ where });
  const { pagina, paginas } = limitarPagina(numeroPagina(params.paginaPublicados), total, 20);
  const itens = await db.servico.findMany({
    where,
    select: {
      id: true, titulo: true, categoria: true, criadoEm: true,
      perfil: { select: { nomePublico: true } },
      empresa: { select: { nome: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * 20,
    take: 20,
  });
  const linkPagina = (p: number) => {
    const query = new URLSearchParams();
    if (q) query.set("buscarPublicado", q);
    if (p > 1) query.set("paginaPublicados", String(p));
    return `/moderacao/servicos${query.size ? `?${query}` : ""}#publicados`;
  };
  return (
    <section id="publicados" aria-labelledby="titulo-publicados" className="mt-12 space-y-5 border-t border-linha pt-8">
      <div>
        <h2 id="titulo-publicados" className="font-serif text-3xl font-semibold">Serviços publicados</h2>
        <p className="mt-2 text-sm text-suave">A suspensão retira imediatamente o anúncio da pesquisa e exige uma justificativa.</p>
      </div>
      <form method="get" action="/moderacao/servicos" role="search" aria-label="Buscar serviços publicados" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="space-y-2">
          <span className="block text-sm font-medium">Título do anúncio</span>
          <input name="buscarPublicado" type="search" defaultValue={q} maxLength={100} placeholder="Procurar serviço publicado" className="campo min-h-12 w-full" />
        </label>
        <button type="submit" className="botao-claro min-h-12 self-end">Pesquisar</button>
      </form>
      <p className="text-sm text-suave" aria-live="polite">{total} {total === 1 ? "anúncio publicado" : "anúncios publicados"}</p>
      {itens.length === 0 ? <p className="cartao p-6 text-sm text-suave">Nenhum serviço publicado encontrado.</p> : (
        <div className="grid gap-4">
          {itens.map((servico) => (
            <article key={servico.id} className="cartao grid min-w-0 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)] sm:p-6">
              <div className="min-w-0">
                <h3 className="break-words font-serif text-xl font-semibold">{servico.titulo}</h3>
                <p className="mt-2 text-sm text-suave">{servico.perfil?.nomePublico ?? servico.empresa?.nome} · {servico.categoria}</p>
              </div>
              <form action={moderarServico} className="space-y-2">
                <input type="hidden" name="id" value={servico.id} />
                <input type="hidden" name="decisao" value="suspender" />
                <label htmlFor={`suspender-${servico.id}`} className="rotulo">Justificativa da suspensão</label>
                <textarea id={`suspender-${servico.id}`} name="motivo" required minLength={10} maxLength={500} rows={2} className="campo w-full" placeholder="Descreva a regra violada e como corrigir." />
                <BotaoEnviar className="botao-claro min-h-11 w-full">Suspender publicação</BotaoEnviar>
              </form>
            </article>
          ))}
        </div>
      )}
      <Paginacao atual={pagina} total={paginas} href={linkPagina} />
    </section>
  );
}
