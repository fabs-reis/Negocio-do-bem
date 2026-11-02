import type { CSSProperties } from "react";
import Link from "next/link";
import { CausaBadge } from "@/components/CausaBadge";
import { Monograma } from "@/components/Monograma";
import { SeloStatus } from "@/components/SeloStatus";
import { filtrarCausas } from "@/lib/causas";
import { tintaDoNegocio, type Recomendacao } from "@/lib/cortejo";
import { temInstagram } from "@/lib/endereco";
import { ehFotoDoSite } from "@/lib/fotos";

export type EmpresaResumo = {
  instagramUsername: string;
  nome: string;
  fotoUrl: string | null;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  status: string;
  causas: { causa: string }[];
  _count: { depoimentos: number };
  recomendacao?: Recomendacao | null;
};

const MAX_BADGES = 3;

/** Uma apresentação do negócio, com a voz da comunidade quando ela é pública. */
export function EmpresaCard({ empresa, compacta = false }: { empresa: EmpresaResumo; compacta?: boolean }) {
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const depoimentos = empresa._count.depoimentos;
  const href = `/empresas/${empresa.instagramUsername}`;
  const tinta = tintaDoNegocio(empresa.instagramUsername);
  const cores = {
    "--tinta-negocio": `var(--color-${tinta})`,
    "--texto-negocio": `var(--color-${tinta}-texto)`,
  } as CSSProperties;

  return (
    <article className="@container min-w-0 border-t border-linha py-6 sm:py-8" style={cores}>
      <div className={`grid min-w-0 items-start gap-x-4 gap-y-4 sm:gap-x-6 ${compacta ? "grid-cols-[4rem_minmax(0,1fr)]" : "grid-cols-[5.5rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[10rem_minmax(0,1fr)]"}`}>
        <Link href={href} aria-label={`Conhecer ${empresa.nome}`} className="group block min-w-0 self-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[0.4rem] bg-superficie">
            {ehFotoDoSite(empresa.fotoUrl) ? (
              // As fotos já chegam reduzidas pelo site.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.fotoUrl} alt="" width={320} height={320} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.035]" />
            ) : (
              <Monograma nome={empresa.nome} chave={empresa.instagramUsername} tamanho="md" />
            )}
          </div>
          <span aria-hidden="true" className="mt-2 block h-1 w-9 rounded-full bg-[var(--tinta-negocio)]" />
        </Link>

        <div className="min-w-0">
          <h3 className={`font-display leading-[1.08] font-extrabold tracking-tight [overflow-wrap:anywhere] ${compacta ? "text-xl sm:text-2xl" : "text-2xl @min-[34rem]:text-[2rem]"}`}>
            <Link href={href} className="decoration-[var(--tinta-negocio)] decoration-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
              {empresa.nome}
            </Link>
          </h3>
          {temInstagram(empresa.instagramUsername) && <p className="truncate text-sm text-suave">@{empresa.instagramUsername}</p>}
          <p className="mt-2 text-sm leading-relaxed text-suave [overflow-wrap:anywhere]">
            <span className="font-semibold text-[var(--texto-negocio)]">{empresa.cidade}, {empresa.uf}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            {empresa.categoria}
          </p>
          <p className={`mt-3 max-w-[65ch] leading-relaxed text-tinta/90 [overflow-wrap:anywhere] ${compacta ? "text-sm" : "text-[15px] sm:text-base"}`}>
            {empresa.resumo}
          </p>

          {causas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {causas.slice(0, MAX_BADGES).map((slug) => <CausaBadge key={slug} slug={slug} />)}
              {causas.length > MAX_BADGES && (
                <span className="px-1.5 py-1 text-xs font-semibold text-suave" title={`${causas.length - MAX_BADGES} outras causas no perfil`}>
                  +{causas.length - MAX_BADGES}
                </span>
              )}
            </div>
          )}
        </div>

        {empresa.recomendacao && (
          <blockquote className="col-span-full mt-1 max-w-[65ch] text-sm leading-relaxed [overflow-wrap:anywhere] @min-[34rem]:col-start-2">
            <p className="mb-1 text-xs font-bold text-[var(--texto-negocio)]">Por que indiquei</p>
            <p className="line-clamp-3 text-tinta/85">“{empresa.recomendacao.motivo}”</p>
            {empresa.recomendacao.indicadoPor && <footer className="mt-1 text-xs text-suave">{empresa.recomendacao.indicadoPor}</footer>}
          </blockquote>
        )}

        <div className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 @min-[34rem]:col-start-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <SeloStatus status={empresa.status} />
            {depoimentos > 0 && <span className="text-xs text-suave">{depoimentos} {depoimentos === 1 ? "depoimento" : "depoimentos"}</span>}
          </div>
          <Link href={href} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--texto-negocio)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
            Conhecer a história
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
