import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alternarServico } from "@/acoes/servicos";
import { FormularioPerfilProfissional } from "@/components/FormularioPerfilProfissional";
import { FormularioServico } from "@/components/FormularioServico";
import { IconeRede } from "@/components/IconeRede";
import { Paginacao } from "@/components/Paginacao";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { limitarPagina, numeroPagina } from "@/lib/servicos";

export const metadata: Metadata = { title: "Meus serviços" };

export default function MeusServicos(props: PageProps<"/painel/servicos">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <nav aria-label="Você está em" className="mb-7 flex items-center gap-2 text-sm text-suave">
        <Link href="/painel" className="inline-flex items-center gap-2 font-medium text-coral-700 hover:underline">
          <IconeRede nome="voltar" className="h-4 w-4" /> Meu painel
        </Link>
        <span aria-hidden="true">/</span>
        <span>Serviços</span>
      </nav>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-semibold tracking-widest text-coral-700 uppercase">Seu espaço de trabalho</span>
          <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Gerencie seus serviços</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-suave sm:text-base">Crie seu perfil, anuncie serviços e acompanhe o que está publicado no diretório.</p>
        </div>
        <Link href="/servicos" className="botao-claro min-h-11 w-full sm:w-auto">
          <IconeRede nome="buscar" className="h-4 w-4" /> Explorar serviços
        </Link>
      </div>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const ESTADOS: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Em análise", classe: "bg-amber-50 text-amber-800" },
  publicado: { texto: "Publicado", classe: "bg-folha-50 text-folha" },
  rejeitado: { texto: "Não aprovado", classe: "bg-coral-50 text-coral-700" },
  suspenso: { texto: "Suspenso", classe: "bg-coral-50 text-coral-700" },
};

async function Conteudo({ searchParams }: Pick<PageProps<"/painel/servicos">, "searchParams">) {
  const usuario = await exigirUsuario("/painel/servicos");
  const [perfil, membros] = await Promise.all([
    db.perfilProfissional.findUnique({ where: { usuarioId: usuario.id } }),
    db.empresaMembro.findMany({ where: { usuarioId: usuario.id }, include: { empresa: true } }),
  ]);
  const empresas = membros.filter(({ empresa }) => empresa.status === "verificada" && empresa.moderacao === "aprovada" && !empresa.oculta)
    .map(({ empresa }) => ({ id: empresa.id, nome: empresa.nome }));
  const where = { OR: [{ perfilUsuarioId: usuario.id }, { empresaId: { in: membros.map(({ empresaId }) => empresaId) } }] };
  const total = await db.servico.count({ where });
  const params = await searchParams;
  const { pagina, paginas } = limitarPagina(numeroPagina(params.pagina), total, 20);
  const servicos = await db.servico.findMany({
    where,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * 20,
    take: 20,
  });
  return (
    <div className="mt-8 space-y-10">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FormularioPerfilProfissional perfil={perfil} />
        {(perfil?.publicado || empresas.length > 0) ? (
          <FormularioServico temPerfil={!!perfil?.publicado} empresas={empresas} />
        ) : (
          <div className="cartao flex min-h-72 flex-col justify-center bg-papel/40 p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-folha-50 text-folha">
              <IconeRede nome="servicos" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-semibold">Seu próximo passo</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-suave">Publique seu perfil profissional ou verifique um negócio. Depois disso, você poderá oferecer seus serviços para a comunidade.</p>
          </div>
        )}
      </div>

      <section aria-labelledby="meus-anuncios" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-coral-700 uppercase">Acompanhamento</p>
            <h2 id="meus-anuncios" className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">Meus anúncios</h2>
          </div>
          <span className="rounded-full bg-superficie px-3 py-1.5 text-xs font-semibold text-suave ring-1 ring-linha">{total} {total === 1 ? "serviço" : "serviços"}</span>
        </div>
        {servicos.length === 0 ? (
          <div className="cartao flex flex-col items-center px-6 py-12 text-center">
            <IconeRede nome="servicos" className="h-9 w-9 text-coral-700" />
            <h3 className="mt-4 font-serif text-xl font-semibold">Você ainda não anunciou nenhum serviço</h3>
            <p className="mt-2 text-sm text-suave">Preencha o formulário acima para criar seu primeiro anúncio.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {servicos.map((servico) => {
              const estado = ESTADOS[servico.status] ?? ESTADOS.pendente!;
              return (
                <article key={servico.id} className="cartao flex min-w-0 flex-col justify-between gap-5 p-5 transition hover:border-coral/30 sm:p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${estado.classe}`}>{estado.texto}</span>
                      {servico.oculto && <span className="rounded-full bg-papel px-3 py-1.5 text-xs font-semibold text-suave">Oculto</span>}
                    </div>
                    <h3 className="mt-4 break-words font-serif text-xl font-semibold leading-tight">{servico.titulo}</h3>
                    <p className="mt-2 text-xs text-suave">{servico.categoria} · {servico.cidade}, {servico.uf}</p>
                  </div>
                  {servico.status === "suspenso" && servico.motivoSuspensao && (
                    <p role="status" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">
                      Suspenso pela moderação: {servico.motivoSuspensao}
                    </p>
                  )}
                  {servico.status === "rejeitado" && servico.motivoRecusa && (
                    <p role="status" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">
                      Motivo da recusa: {servico.motivoRecusa}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/painel/servicos/${servico.id}`} className="botao-coral min-h-11 w-full sm:w-auto">
                      Editar anúncio
                    </Link>
                  </div>
                  <form action={alternarServico}>
                    <input type="hidden" name="id" value={servico.id} />
                    <input type="hidden" name="oculto" value={servico.oculto ? "nao" : "sim"} />
                    <button type="submit" className="botao-claro min-h-11 w-full sm:w-auto">
                      <IconeRede nome={servico.oculto ? "olho" : "ocultar"} className="h-4 w-4" />
                      {servico.oculto ? "Reexibir anúncio" : "Ocultar anúncio"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <Paginacao atual={pagina} total={paginas} href={(p) => p === 1 ? "/painel/servicos" : `/painel/servicos?pagina=${p}`} />
    </div>
  );
}
