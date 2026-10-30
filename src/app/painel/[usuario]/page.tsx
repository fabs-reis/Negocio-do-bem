import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alternarVisibilidade } from "@/acoes/empresas";
import { responderDepoimento } from "@/acoes/depoimentos";
import { AvisoDaUrl } from "@/components/Avisos";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { exigirUsuario } from "@/lib/auth/sessao";
import { checklistDoPerfil } from "@/lib/boas-vindas";
import { db } from "@/lib/db";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { donoConfirmado, prazoDaConfirmacao } from "@/lib/donos";
import { configLogin, normalizarUsername, perfilOficial } from "@/lib/instagram";
import { formatarData, formatarDataHora } from "@/lib/texto";
import { EdicaoEmpresa } from "./EdicaoEmpresa";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Editar perfil", robots: FORA_DA_BUSCA };

export default function EditarEmpresa(props: PageProps<"/painel/[usuario]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/painel/[usuario]">, "params" | "searchParams">) {
  const username = normalizarUsername((await params).usuario);
  if (!username) notFound();
  const usuario = await exigirUsuario(`/painel/${username}`);
  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: username },
    include: {
      membros: { select: { usuarioId: true, confirmadoEm: true, confirmacaoPedidaEm: true } },
      causas: { select: { causa: true } },
      depoimentos: {
        where: { status: "publicado" },
        orderBy: { criadoEm: "desc" },
        include: { autor: { select: { nome: true } } },
      },
    },
  });
  const membro = empresa?.membros.find((m) => m.usuarioId === usuario.id);
  if (!empresa || !membro) notFound();
  // Quem não confirmou que cuida do negócio vê o painel, mas não edita (src/lib/donos.ts).
  const confirmado = donoConfirmado(membro);
  const { aviso } = await searchParams;
  const checklist = checklistDoPerfil(empresa, !!perfilOficial() || !!configLogin());

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href="/painel" className="text-sm text-suave hover:text-tinta">
          ← Meu painel
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">{empresa.nome}</h1>
            <p className="text-suave">
              @{empresa.instagramUsername} · {empresa.oculta ? "Oculto do diretório" : MODERACAO_EMPRESA[empresa.moderacao]}
            </p>
          </div>
          <Link href={`/empresas/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
            Ver perfil público ↗
          </Link>
        </div>
        <AvisoDaUrl codigo={aviso} />
      </div>

      {/* Quem confirmou pela DM antes do e-mail confirma o e-mail aqui, para receber os avisos. */}
      {!usuario.emailConfirmado && (
        <ConfirmarEmail email={usuario.email} para="receber os avisos do seu negócio" voltar={`/painel/${empresa.instagramUsername}`} />
      )}

      {!confirmado ? (
        <ConfirmarDono username={empresa.instagramUsername} pedidaEm={membro.confirmacaoPedidaEm} />
      ) : (
        <>
          {checklist.mostrar && (
            <BoasVindas nome={usuario.nome.split(" ")[0]!} username={empresa.instagramUsername} checklist={checklist} />
          )}
          <EdicaoEmpresa empresa={empresa} voltar={`/painel/${empresa.instagramUsername}`} />
        </>
      )}

      <section id="depoimentos" className="scroll-mt-24">
        <h2 className="font-serif text-2xl font-semibold">Depoimentos</h2>
        <p className="mt-1 text-sm text-suave">
          {confirmado ? "Você pode responder a cada depoimento." : "Depois de confirmar, você pode responder a cada depoimento."}{" "}
          Para manter a confiança da comunidade, donos não apagam depoimentos: se algum for ofensivo, use
          &ldquo;Denunciar&rdquo; no perfil público e a moderação avalia.
        </p>
        <div className="mt-4 space-y-4">
          {empresa.depoimentos.length === 0 && <p className="text-suave italic">Nenhum depoimento ainda.</p>}
          {empresa.depoimentos.map((d) => (
            <div key={d.id} className="cartao p-5">
              <p className="font-serif text-lg leading-relaxed whitespace-pre-line">{d.texto}</p>
              <p className="mt-2 text-sm text-suave">
                {d.autor.nome} · {formatarData(d.criadoEm)}
              </p>
              {d.resposta && !confirmado && <p className="mt-3 text-sm text-suave">Sua resposta: {d.resposta}</p>}
              {confirmado && (
                <form action={responderDepoimento} className="mt-4 space-y-2">
                  <input type="hidden" name="depoimentoId" value={d.id} />
                  <label htmlFor={`resposta-${d.id}`} className="sr-only">
                    Sua resposta
                  </label>
                  <textarea
                    id={`resposta-${d.id}`}
                    name="resposta"
                    rows={2}
                    maxLength={1000}
                    defaultValue={d.resposta ?? ""}
                    placeholder="Escreva uma resposta (opcional)…"
                    className="campo sm:text-sm"
                  />
                  <BotaoEnviar className="botao-claro botao-pequeno" enviando="Salvando…">
                    {d.resposta ? "Atualizar resposta" : "Responder"}
                  </BotaoEnviar>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {confirmado && (
        <section className="cartao p-6">
          <h2 className="font-serif text-2xl font-semibold">Aparecer no diretório</h2>
          <p className="mt-1 text-sm leading-relaxed text-suave">
            {empresa.oculta
              ? "Seu negócio está oculto: ninguém encontra o perfil no diretório nem pelo link."
              : "Se preferir, você pode tirar seu negócio do diretório a qualquer momento. O perfil fica guardado e você pode voltar quando quiser."}
          </p>
          <form action={alternarVisibilidade} className="mt-4">
            <input type="hidden" name="empresaId" value={empresa.id} />
            <input type="hidden" name="ocultar" value={empresa.oculta ? "nao" : "sim"} />
            <BotaoEnviar className={empresa.oculta ? "botao-coral" : "botao-claro"} enviando="Salvando…">
              {empresa.oculta ? "Voltar a aparecer no diretório" : "Ocultar meu negócio"}
            </BotaoEnviar>
          </form>
        </section>
      )}
    </div>
  );
}

/** Para o dono que não confirmou: por que a edição está pausada e como confirmar. */
function ConfirmarDono({ username, pedidaEm }: { username: string; pedidaEm: Date | null }) {
  return (
    <section id="confirmar" className="scroll-mt-24 rounded-3xl border border-coral/20 bg-coral-50/60 p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-semibold">Confirme que você cuida deste negócio</h2>
      <p className="mt-2 leading-relaxed text-suave">
        Você assumiu este perfil sem confirmar pelo Instagram do negócio. Para proteger os negócios de quem se passa
        por eles, a edição fica pausada até a confirmação. É rápido: você pede um código, manda um &ldquo;Oi&rdquo;
        pelo Instagram do negócio e cola o código que chegar.
      </p>
      {pedidaEm && (
        <p className="mt-3 text-sm font-medium">
          Prazo: até {formatarDataHora(prazoDaConfirmacao(pedidaEm))}. Depois disso, sem um pedido em andamento, o perfil
          volta a ficar sem dono.
        </p>
      )}
      <Link href={`/empresas/${username}/reivindicar`} className="botao-coral mt-5">
        Confirmar agora
      </Link>
    </section>
  );
}

/** Enquanto falta algo no perfil, o painel recebe o dono e mostra o que falta. */
function BoasVindas({
  nome,
  username,
  checklist,
}: {
  nome: string;
  username: string;
  checklist: ReturnType<typeof checklistDoPerfil>;
}) {
  return (
    <section className="rounded-3xl border border-coral/20 bg-coral-50/60 p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-semibold">Que bom ter você aqui, {nome}!</h2>
      <p className="mt-1 text-suave">Três coisas deixam o perfil com a sua cara:</p>
      <ul className="mt-4 space-y-2">
        {checklist.itens.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="group inline-flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${item.feito ? "bg-folha text-papel" : "border-2 border-coral/40"}`}
              >
                {item.feito ? "✓" : ""}
              </span>
              <span className={item.feito ? "text-suave line-through" : "font-medium group-hover:text-coral-700"}>
                {item.rotulo}
              </span>
              <span className="sr-only">{item.feito ? "(feito)" : "(falta)"}</span>
            </a>
          </li>
        ))}
      </ul>
      {checklist.pedirSelo && (
        <p className="mt-5 text-sm">
          Quer o selo de perfil oficial?{" "}
          <Link href={`/empresas/${username}/reivindicar`} className="link">
            Confirme pelo Instagram do negócio.
          </Link>
        </p>
      )}
    </section>
  );
}
