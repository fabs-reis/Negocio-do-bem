import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { CausaBadge } from "@/components/CausaBadge";
import { EmpresaCard } from "@/components/EmpresaCard";
import { CAUSAS } from "@/lib/causas";
import { lerFiltros, listarEmpresas, type FiltrosDiretorio } from "@/lib/consultas";
import { UFS } from "@/lib/dominio";

export default function Inicio(props: PageProps<"/">) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-coral-100/70 via-amber-50/60 to-emerald-50/50 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-coral/20 bg-superficie/70 px-4 py-1.5 text-sm font-medium text-coral-700">
            <span aria-hidden="true">🌱</span>
            <span>
              Um movimento do bem<span className="hidden sm:inline">, feito pela comunidade</span>
            </span>
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl">
            Compre de quem <span className="italic text-coral">faz o bem.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-suave text-balance sm:text-xl">
            Encontre negócios com consciência social e raízes na comunidade. Indique quem você admira, conte sua
            experiência e fortaleça quem compartilha dos seus valores.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="#diretorio" className="botao-coral px-6 py-3 text-base">
              Explorar negócios
            </Link>
            <Link href="/indicar" className="botao-claro px-6 py-3 text-base">
              Indicar um negócio
            </Link>
          </div>
        </div>
      </section>

      <section id="diretorio" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
        <Suspense fallback={<DiretorioCarregando />}>
          <Diretorio searchParams={props.searchParams} />
        </Suspense>
      </section>

      <ComoFunciona />
    </>
  );
}

async function Diretorio({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const filtros = lerFiltros(await searchParams);
  const { itens, temMais } = await listarEmpresas(filtros);
  const filtrando = filtros.q || filtros.uf || filtros.causas.length > 0;

  return (
    <div className="space-y-6">
      <Form action="/" scroll={false} className="cartao flex flex-col gap-2 p-2 shadow-sm shadow-tinta/5 sm:flex-row">
        {filtros.causas.map((causa) => (
          <input key={causa} type="hidden" name="causa" value={causa} />
        ))}
        <label className="sr-only" htmlFor="busca">
          Buscar
        </label>
        <input
          id="busca"
          name="q"
          defaultValue={filtros.q}
          placeholder="Busque por nome, cidade ou o que você procura…"
          className="campo flex-1 border-transparent"
        />
        <label className="sr-only" htmlFor="uf">
          Estado
        </label>
        <select id="uf" name="uf" defaultValue={filtros.uf ?? ""} className="campo border-transparent sm:w-44">
          <option value="">Todo o Brasil</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        <button type="submit" className="botao-coral">
          Buscar
        </button>
      </Form>

      <div>
        <p className="mb-3 text-sm font-medium text-suave">Filtre pelas causas que importam para você</p>
        <div className="flex flex-wrap gap-2">
          {CAUSAS.map((causa) => {
            const ativa = filtros.causas.includes(causa.slug);
            return (
              <Link
                key={causa.slug}
                href={hrefComCausa(filtros, causa.slug)}
                scroll={false}
                aria-pressed={ativa}
                className={`rounded-full transition ${ativa ? "ring-2 ring-coral ring-offset-2 ring-offset-papel" : "opacity-80 hover:opacity-100"}`}
              >
                <CausaBadge slug={causa.slug} />
              </Link>
            );
          })}
        </div>
      </div>

      {filtrando && (
        <div className="flex items-center justify-between text-sm text-suave">
          <span>{itens.length === 0 ? "Nenhum resultado" : "Resultados da sua busca"}</span>
          <Link href="/#diretorio" scroll={false} className="link">
            Limpar filtros
          </Link>
        </div>
      )}

      {itens.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((empresa) => (
            <EmpresaCard key={empresa.instagramUsername} empresa={empresa} />
          ))}
        </div>
      ) : (
        <div className="cartao px-6 py-16 text-center">
          <p className="font-serif text-2xl">
            {filtrando ? "Ainda não encontramos ninguém com esses filtros." : "O diretório está começando agora."}
          </p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            Conhece um negócio que faz o bem? Indique e ajude a comunidade a encontrá-lo.
          </p>
          <Link href="/indicar" className="botao-coral mt-6">
            Indicar um negócio
          </Link>
        </div>
      )}

      {(filtros.pagina > 1 || temMais) && (
        <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Paginação">
          {filtros.pagina > 1 && (
            <Link href={hrefPagina(filtros, filtros.pagina - 1)} className="botao-claro">
              ← Anteriores
            </Link>
          )}
          {temMais && (
            <Link href={hrefPagina(filtros, filtros.pagina + 1)} className="botao-claro">
              Mais negócios →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function parametros(filtros: FiltrosDiretorio, causas = filtros.causas, pagina = 1): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.uf) params.set("uf", filtros.uf);
  for (const causa of causas) params.append("causa", causa);
  if (pagina > 1) params.set("pagina", String(pagina));
  const texto = params.toString();
  return texto ? `/?${texto}#diretorio` : "/#diretorio";
}

function hrefComCausa(filtros: FiltrosDiretorio, causa: string): string {
  const causas = filtros.causas.includes(causa)
    ? filtros.causas.filter((c) => c !== causa)
    : [...filtros.causas, causa];
  return parametros(filtros, causas);
}

function hrefPagina(filtros: FiltrosDiretorio, pagina: number): string {
  return parametros(filtros, filtros.causas, pagina);
}

function DiretorioCarregando() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-16 animate-pulse rounded-3xl bg-superficie" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="h-7 w-28 animate-pulse rounded-full bg-superficie" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-60 animate-pulse rounded-3xl bg-superficie" />
        ))}
      </div>
    </div>
  );
}

function ComoFunciona() {
  const passos = [
    {
      emoji: "💌",
      titulo: "A comunidade indica",
      texto: "Qualquer pessoa pode indicar um negócio pelo @ do Instagram e contar por que ele faz o bem.",
    },
    {
      emoji: "🔑",
      titulo: "O dono assume o perfil",
      texto: "Quem cuida do negócio envia CNPJ, site e Instagram, a moderação confere e o perfil passa a contar a própria história.",
    },
    {
      emoji: "🤝",
      titulo: "Todo mundo fortalece",
      texto: "Clientes deixam depoimentos, escolhem pelas causas que importam e espalham a palavra.",
    },
  ];
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <h2 className="text-center font-serif text-4xl font-semibold tracking-tight">Como funciona</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {passos.map((passo, i) => (
          <div key={passo.titulo} className="cartao p-7">
            <span className="text-3xl" aria-hidden="true">
              {passo.emoji}
            </span>
            <p className="mt-4 text-xs font-semibold tracking-wide text-coral-700 uppercase">Passo {i + 1}</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold">{passo.titulo}</h3>
            <p className="mt-2 leading-relaxed text-suave">{passo.texto}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-3xl bg-tinta px-8 py-10 text-papel sm:flex-row">
        <div>
          <p className="font-serif text-3xl font-semibold">Tem um negócio do bem?</p>
          <p className="mt-1 text-papel/70">Cadastre, mostre as causas que você abraça e conte a sua história.</p>
        </div>
        <Link href="/sobre#dono" className="botao-coral shrink-0 px-6 py-3 text-base">
          Sou dono de um negócio
        </Link>
      </div>
    </section>
  );
}
