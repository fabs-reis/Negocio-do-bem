import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconeRede } from "@/components/IconeRede";
import { CATEGORIAS_SERVICOS } from "@/lib/servicos";
import { listarServicosPublicos } from "@/lib/servicos/consultas";

export const metadata: Metadata = {
  title: "Serviços da comunidade",
  description: "Encontre profissionais e negócios que oferecem serviços na comunidade.",
};

export default function Servicos(props: PageProps<"/servicos">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <nav aria-label="Você está em" className="mb-7 flex items-center gap-2 text-sm text-suave">
        <Link href="/" className="inline-flex items-center gap-2 font-medium text-coral-700 hover:underline">
          <IconeRede nome="voltar" className="h-4 w-4" /> Início
        </Link>
        <span aria-hidden="true">/</span>
        <span>Serviços</span>
      </nav>

      <header className="relative isolate overflow-hidden rounded-[2rem] border border-linha bg-superficie px-6 py-9 shadow-sm shadow-tinta/5 sm:px-10 sm:py-12 lg:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -top-28 -right-24 -z-10 h-72 w-72 rounded-full bg-coral-50 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 -z-10 h-72 w-72 rounded-full bg-folha-50 blur-3xl" />
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.85fr)] lg:gap-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-coral/20 bg-coral-50 px-3 py-1.5 text-xs font-semibold text-coral-700">
              <IconeRede nome="seguro" className="h-4 w-4" /> Rede colaborativa
            </span>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
              Encontre quem pode <span className="text-coral-700">fazer acontecer.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-suave sm:text-lg">
              Conecte-se a profissionais e negócios da comunidade. Descubra serviços, valorize talentos e fortaleça a economia local.
            </p>
            <Link href="/painel/servicos" className="botao-coral mt-7 min-h-12 w-full px-6 sm:w-auto">
              <IconeRede nome="adicionar" className="h-5 w-5" /> Oferecer um serviço
              <IconeRede nome="seta" className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="Como participar">
            <div className="rounded-2xl border border-linha bg-papel/75 p-4 sm:p-5">
              <IconeRede nome="buscar" className="h-6 w-6 text-coral-700" />
              <p className="mt-3 text-sm font-semibold">Encontre</p>
              <p className="mt-1 text-xs leading-relaxed text-suave">Explore serviços por especialidade.</p>
            </div>
            <div className="rounded-2xl border border-linha bg-papel/75 p-4 sm:p-5">
              <IconeRede nome="pessoa" className="h-6 w-6 text-folha" />
              <p className="mt-3 text-sm font-semibold">Conecte-se</p>
              <p className="mt-1 text-xs leading-relaxed text-suave">Conheça quem oferece o serviço.</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-linha bg-papel/75 p-4 sm:col-span-1 sm:p-5">
              <IconeRede nome="empresa" className="h-6 w-6 text-coral-700" />
              <p className="mt-3 text-sm font-semibold">Colabore</p>
              <p className="mt-1 text-xs leading-relaxed text-suave">Fortaleça profissionais e negócios.</p>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Lista searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Lista({ searchParams }: Pick<PageProps<"/servicos">, "searchParams">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const categoria = typeof params.categoria === "string" && CATEGORIAS_SERVICOS.some((c) => c === params.categoria) ? params.categoria : "";
  const municipio = typeof params.municipio === "string" ? params.municipio.slice(0, 120) : "";
  const modalidade = params.modalidade === "remoto" || params.modalidade === "presencial" ? params.modalidade : "";
  const { total, itens, pagina, paginas, municipioInvalido } = await listarServicosPublicos({ q, categoria, municipio, modalidade, pagina: params.pagina });

  function endereco(p: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (categoria) qs.set("categoria", categoria);
    if (municipio) qs.set("municipio", municipio);
    if (modalidade) qs.set("modalidade", modalidade);
    if (p > 1) qs.set("pagina", String(p));
    return `/servicos${qs.size ? `?${qs}` : ""}`;
  }

  return (
    <section className="mt-8" aria-label="Catálogo de serviços">
      <form role="search" aria-label="Encontrar serviços" className="cartao grid gap-3 p-3 shadow-sm shadow-tinta/5 sm:grid-cols-2 sm:p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]" action="/servicos" method="get">
        <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-linha bg-papel/60 px-4 transition focus-within:border-coral focus-within:ring-2 focus-within:ring-coral-100">
          <IconeRede nome="buscar" className="h-5 w-5 shrink-0 text-coral-700" />
          <span className="min-w-0 flex-1 py-2">
            <span className="block text-xs font-medium text-suave">O que você precisa?</span>
            <input id="busca-servico" type="search" name="q" maxLength={100} defaultValue={q} placeholder="Design, transporte, tecnologia…" className="min-h-7 w-full bg-transparent text-[15px] text-tinta placeholder:text-suave/70 focus:outline-none" />
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-linha bg-papel/60 px-4 focus-within:border-coral focus-within:ring-2 focus-within:ring-coral-100">
          <IconeRede nome="filtro" className="h-5 w-5 shrink-0 text-suave" />
          <span className="min-w-0 flex-1 py-2">
            <span className="block text-xs font-medium text-suave">Categoria</span>
            <select name="categoria" defaultValue={categoria} aria-label="Categoria do serviço" className="min-h-7 w-full bg-transparent text-[15px] text-tinta focus:outline-none">
              <option value="">Todas as categorias</option>
              {CATEGORIAS_SERVICOS.map((nome) => <option value={nome} key={nome}>{nome}</option>)}
            </select>
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-linha bg-papel/60 px-4 focus-within:border-coral focus-within:ring-2 focus-within:ring-coral-100">
          <IconeRede nome="local" className="h-5 w-5 shrink-0 text-suave" />
          <span className="min-w-0 flex-1 py-2">
            <span className="block text-xs font-medium text-suave">Onde precisa?</span>
            <input name="municipio" type="search" maxLength={120} defaultValue={municipio} placeholder="Recife, PE" aria-invalid={municipioInvalido} aria-describedby={municipioInvalido ? "aviso-municipio" : undefined} className="min-h-7 w-full bg-transparent text-[15px] text-tinta placeholder:text-suave/70 focus:outline-none" />
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-linha bg-papel/60 px-4 focus-within:border-coral focus-within:ring-2 focus-within:ring-coral-100">
          <IconeRede nome="remoto" className="h-5 w-5 shrink-0 text-suave" />
          <span className="min-w-0 flex-1 py-2">
            <span className="block text-xs font-medium text-suave">Atendimento</span>
            <select name="modalidade" defaultValue={modalidade} className="min-h-7 w-full bg-transparent text-[15px] text-tinta focus:outline-none">
              <option value="">Todos</option>
              <option value="remoto">Remoto</option>
              <option value="presencial">Presencial</option>
            </select>
          </span>
        </label>
        <button type="submit" className="botao-coral min-h-14 w-full rounded-2xl px-7 text-base sm:col-span-2 xl:col-span-1 xl:w-auto">
          Buscar <IconeRede nome="seta" className="h-4 w-4" />
        </button>
      </form>

      {municipioInvalido && <p id="aviso-municipio" role="alert" className="mt-3 rounded-xl border border-coral/30 bg-coral-50 p-3 text-sm text-coral-700">Cidade não reconhecida. Digite um município brasileiro com UF, por exemplo: Recife, PE.</p>}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-coral-700 uppercase">Oportunidades da comunidade</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Serviços disponíveis</h2>
        </div>
        <p className="text-sm text-suave" aria-live="polite">
          <strong className="font-semibold text-tinta tabular-nums">{total.toLocaleString("pt-BR")}</strong> {total === 1 ? "serviço encontrado" : "serviços encontrados"}
        </p>
      </div>

      {itens.length === 0 ? (
        <div className="cartao mt-5 flex flex-col items-center px-6 py-12 text-center sm:py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-50 text-coral-700"><IconeRede nome="buscar" className="h-7 w-7" /></div>
          <h3 className="mt-5 font-serif text-2xl font-semibold">Nenhum serviço por aqui ainda</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-suave">Tente outra palavra ou categoria. Você também pode ser um dos primeiros a oferecer serviços à comunidade.</p>
          <div className="mt-5 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
            <Link className="botao-claro min-h-11" href="/servicos">Limpar filtros</Link>
            <Link className="botao-coral min-h-11" href="/painel/servicos">Oferecer serviço</Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((servico) => (
            <article key={servico.id} className="cartao group flex min-w-0 flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-coral/30 hover:shadow-xl hover:shadow-coral/5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-folha-50 px-3 py-1.5 text-xs font-semibold text-folha">
                  <IconeRede nome="servicos" className="h-3.5 w-3.5 shrink-0" /> {servico.categoria}
                </span>
              </div>
              <h3 className="mt-5 font-serif text-2xl leading-tight font-semibold tracking-tight text-balance group-hover:text-coral-700">{servico.titulo}</h3>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                <IconeRede nome={servico.empresa ? "empresa" : "pessoa"} className="h-4 w-4 shrink-0 text-suave" />
                <span className="min-w-0 break-words">{servico.empresa?.nome ?? servico.perfil?.nomePublico}</span>
              </p>
              <p className="mt-4 line-clamp-4 flex-1 whitespace-pre-line break-words text-sm leading-relaxed text-suave">{servico.descricao}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-suave">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-papel px-2.5 py-1.5">
                  <IconeRede nome="local" className="h-3.5 w-3.5" /> {servico.presencial && servico.areasAtendimento.length ? servico.areasAtendimento.map(({ cidade, uf }) => `${cidade}, ${uf}`).join(" · ") : "Atendimento online"}
                </span>
                {servico.remoto && <span className="rounded-full bg-papel px-2.5 py-1.5">Remoto</span>}
                {servico.presencial && <span className="rounded-full bg-papel px-2.5 py-1.5">Presencial</span>}
              </div>
              <div className="mt-5 border-t border-linha pt-4">
                <p className="text-sm font-semibold text-tinta">{servico.precoReferencia || "Valor a combinar"}</p>
                {servico.empresa ? (
                  <Link href={`/empresas/${servico.empresa.instagramUsername}`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-coral-700 hover:underline">
                    Ver estabelecimento <IconeRede nome="seta" className="h-4 w-4" />
                  </Link>
                ) : servico.perfil?.site ? (
                  <a href={servico.perfil.site} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-coral-700 hover:underline">
                    Site ou portfólio <IconeRede nome="globo" className="h-4 w-4" />
                  </a>
                ) : servico.perfil?.emailContato ? (
                  <a href={`mailto:${servico.perfil.emailContato}`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-coral-700 hover:underline">
                    Contato profissional <IconeRede nome="email" className="h-4 w-4" />
                  </a>
                ) : <p className="mt-3 text-xs text-suave">Contato não informado</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      {total > 18 && (
        <nav aria-label="Paginação de serviços" className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {pagina > 1 && <Link className="botao-claro min-h-11" href={endereco(pagina - 1)}><IconeRede nome="voltar" className="h-4 w-4" /> Anterior</Link>}
          <span className="inline-flex min-h-11 items-center text-sm text-suave">Página {pagina}</span>
          {pagina < paginas && <Link className="botao-claro min-h-11" href={endereco(pagina + 1)}>Próxima <IconeRede nome="seta" className="h-4 w-4" /></Link>}
        </nav>
      )}
    </section>
  );
}
