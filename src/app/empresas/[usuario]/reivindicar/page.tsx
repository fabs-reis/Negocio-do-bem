import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelarReivindicacao } from "@/acoes/reivindicacoes";
import { Aviso } from "@/components/Aviso";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { METODOS_REIVINDICACAO, STATUS_REIVINDICACAO } from "@/lib/dominio";
import { configLogin, linkPerfil, normalizarUsername, perfilOficial } from "@/lib/instagram";
import { LIMITE_ENVIOS, LIMITE_TENTATIVAS } from "@/lib/reivindicacao";
import { formatarDataHora } from "@/lib/texto";
import { FormConfirmarCodigo, FormDocumento, FormOutroEnvio, FormPedirCodigo } from "./Formularios";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Assumir o perfil", robots: FORA_DA_BUSCA };

export default function PaginaReivindicar(props: PageProps<"/empresas/[usuario]/reivindicar">) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Reivindicar params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Reivindicar({
  params,
  searchParams,
}: Pick<PageProps<"/empresas/[usuario]/reivindicar">, "params" | "searchParams">) {
  const username = normalizarUsername((await params).usuario);
  if (!username) notFound();
  const [empresa, usuario, busca] = await Promise.all([
    db.empresa.findUnique({ where: { instagramUsername: username }, include: { membros: true } }),
    usuarioAtual(),
    searchParams,
  ]);
  if (!empresa || empresa.moderacao === "rejeitada") notFound();

  const caminho = `/empresas/${username}/reivindicar`;
  const conectada = normalizarUsername(busca.conectada);
  const loginDisponivel = !!configLogin();
  const oficial = perfilOficial();
  const peloInstagram = loginDisponivel || !!oficial;
  const membro = usuario ? empresa.membros.find((m) => m.usuarioId === usuario.id) : undefined;
  const dono = !!membro;
  // Dono que nunca confirmou (src/lib/donos.ts): confirma aqui para voltar a editar.
  const faltaConfirmar = !!membro && !membro.confirmadoEm;
  // Quem já é dono e ainda não confirmou, ou não tem o selo, confirma pelo Instagram nesta mesma página.
  const pedirSelo = dono && (faltaConfirmar || !empresa.oficial) && peloInstagram;

  const cabecalho = (
    <div className="mb-8 space-y-4">
      <Link href={`/empresas/${username}`} className="text-sm text-suave hover:text-tinta">
        ← Voltar para o perfil
      </Link>
      <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight">
        {faltaConfirmar ? "Confirme que o negócio é seu" : pedirSelo ? "Confirme pelo Instagram" : "Este negócio é seu?"}
      </h1>
      <p className="text-lg leading-relaxed text-suave">
        {faltaConfirmar ? (
          <>
            Você assumiu o perfil de <strong className="font-semibold text-tinta">@{username}</strong>, mas ainda não
            confirmou que cuida do negócio. Confirme para editar o perfil
            {peloInstagram ? " e ganhar o selo de perfil oficial." : "."}
          </>
        ) : pedirSelo ? (
          <>
            Você já cuida do perfil de <strong className="font-semibold text-tinta">@{username}</strong>. Confirme pelo
            Instagram do negócio e ganhe o selo de perfil oficial.
          </>
        ) : (
          <>
            {peloInstagram ? "Confirme pelo Instagram do negócio" : "Peça uma análise manual"} para assumir o perfil de{" "}
            <strong className="font-semibold text-tinta">@{username}</strong>. Depois disso, você conta a sua história,
            escolhe as causas e responde à comunidade.
          </>
        )}
      </p>
      <AvisoDaUrl codigo={busca.aviso} />
      {busca.aviso === "ig_conta_diferente" && conectada && (
        <p className="text-sm text-suave">
          Você entrou como <strong>@{conectada}</strong>, mas este perfil é de <strong>@{username}</strong>.
        </p>
      )}
    </div>
  );

  if (!usuario) {
    return (
      <>
        {cabecalho}
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Primeiro, entre na sua conta</p>
          <p className="mt-2 text-suave">É nela que o perfil do negócio vai ficar guardado.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/entrar?voltar=${encodeURIComponent(caminho)}`} className="botao">
              Entrar
            </Link>
            <Link href={`/cadastrar?voltar=${encodeURIComponent(caminho)}`} className="botao-claro">
              Criar conta
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (dono && !pedirSelo && !faltaConfirmar) {
    return (
      <>
        {cabecalho}
        <Aviso tipo="sucesso">
          Você já é dono deste perfil.{" "}
          <Link href={`/painel/${username}`} className="font-semibold underline">
            Ir para o painel
          </Link>
        </Aviso>
      </>
    );
  }

  const solicitacoes = await db.reivindicacao.findMany({
    where: { empresaId: empresa.id, usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 5,
  });
  const agora = new Date();
  const pedido = solicitacoes.find((r) => r.metodo === "codigo_dm" && r.status === "pendente");
  const outrasPendentes = solicitacoes.filter((r) => r.status === "pendente" && r.id !== pedido?.id);
  const dadosEmAnalise = outrasPendentes.some((r) => r.metodo === "documento");
  const vencido = !!pedido && pedido.expiraEm <= agora;
  const bloqueado = !!pedido && pedido.tentativas >= LIMITE_TENTATIVAS;
  const esgotado = !!pedido && pedido.envios >= LIMITE_ENVIOS;

  return (
    <>
      {cabecalho}

      {empresa.membros.length > 0 && !dono && (
        <div className="mb-6">
          <Aviso tipo="info">
            Este perfil já tem um dono. Se você também cuida deste negócio ou se houve troca de responsáveis, confirme
            pela DM ou peça uma análise: a moderação decide com cuidado.
          </Aviso>
        </div>
      )}

      {outrasPendentes.length > 0 && (
        <div className="mb-6 space-y-2">
          {outrasPendentes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linha bg-superficie px-4 py-3 text-sm">
              <span>
                <strong>{METODOS_REIVINDICACAO[r.metodo]}</strong> · {STATUS_REIVINDICACAO[r.status]} desde{" "}
                {formatarDataHora(r.criadoEm)}
              </span>
              <form action={cancelarReivindicacao}>
                <input type="hidden" name="empresaId" value={empresa.id} />
                <input type="hidden" name="reivindicacaoId" value={r.id} />
                <BotaoEnviar className="text-xs text-suave underline hover:text-coral-700" enviando="…">
                  Cancelar
                </BotaoEnviar>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {loginDisponivel && (
          <section className="cartao p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-semibold">Entrar com Instagram</h2>
              <span className="rounded-full bg-folha-50 px-2.5 py-0.5 text-xs font-semibold text-folha">Instantâneo</span>
            </div>
            <p className="mt-2 leading-relaxed text-suave">
              Entre na conta <strong>@{username}</strong> e pronto: o Instagram confirma pra gente que ela é sua. Funciona
              com contas comerciais ou de criador de conteúdo. Só lemos o nome de usuário, nada mais.
            </p>
            <a href={`/api/instagram/entrar?empresa=${empresa.id}`} className="botao mt-5">
              <InstagramIcone /> Continuar com Instagram
            </a>
          </section>
        )}

        {oficial && (
          <section id="codigo" className="cartao scroll-mt-24 p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold">
              {loginDisponivel ? "Ou confirme pela DM" : "Confirme pela DM do Instagram"}
            </h2>
            <p className="mt-2 font-medium">
              Só quem cuida do Instagram do negócio recebe o código. Confirme e ganhe o selo de perfil oficial.
            </p>
            <p className="mt-1 leading-relaxed text-suave">Funciona com qualquer conta do Instagram, inclusive pessoal ou privada.</p>

            {pedido?.codigoConfirmadoEm ? (
              <div className="mt-6">
                <Aviso tipo="info">
                  Você já colou o código certo. Como este perfil precisa de uma decisão da moderação, o resultado chega por
                  e-mail e aparece no{" "}
                  <Link href="/painel" className="font-semibold underline">
                    seu painel
                  </Link>
                  .
                </Aviso>
              </div>
            ) : (
              <>
                <ol className="mt-6 space-y-5">
                  <Passo numero={1} feito={!!pedido}>
                    {pedido ? (
                      "Código pedido."
                    ) : (
                      <>
                        Peça o código aqui.
                        <FormPedirCodigo empresaId={empresa.id} />
                      </>
                    )}
                  </Passo>
                  <Passo numero={2}>
                    No Instagram do negócio, <strong>@{username}</strong>, siga o{" "}
                    <a href={linkPerfil(oficial)} target="_blank" rel="noopener noreferrer" className="link">
                      @{oficial}
                    </a>{" "}
                    e mande um &ldquo;Oi&rdquo; na DM.
                    <a href={`https://ig.me/m/${oficial}`} target="_blank" rel="noopener noreferrer" className="link mt-2 block text-sm">
                      Abrir a conversa com @{oficial} ↗
                    </a>
                    <span className="mt-1 block text-sm text-suave">
                      Assim a nossa resposta cai na conversa, e não em &ldquo;Solicitações de mensagem&rdquo;.
                    </span>
                  </Passo>
                  <Passo numero={3}>
                    A gente responde com o seu código nessa conversa. Não passe o código para ninguém.
                    {pedido ? (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-suave">
                          {pedido.envios === 0
                            ? "Aguardando a DM."
                            : pedido.reenvioPedidoEm
                              ? "Você pediu outro envio. Aguardando a DM com o código novo."
                              : `Código enviado em ${formatarDataHora(pedido.enviadoEm!)}. Vale até ${formatarDataHora(pedido.expiraEm)}.`}
                        </p>
                        {vencido || bloqueado ? (
                          <Aviso tipo="erro">
                            {vencido ? "Este código venceu." : "O código foi digitado errado muitas vezes."}{" "}
                            {esgotado ? "Peça uma análise manual logo abaixo." : "Peça outro envio em “Não chegou?”."}
                          </Aviso>
                        ) : (
                          <FormConfirmarCodigo empresaId={empresa.id} />
                        )}
                      </div>
                    ) : (
                      <span className="mt-1 block text-sm text-suave">O campo para colar o código aparece depois do pedido.</span>
                    )}
                  </Passo>
                </ol>

                {pedido && (
                  <>
                    <details className="mt-6 rounded-2xl border border-linha p-4" open={vencido || bloqueado}>
                      <summary className="cursor-pointer font-semibold">Não chegou?</summary>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                        <li>Olhe em &ldquo;Solicitações de mensagem&rdquo;, no Instagram do negócio.</li>
                        <li>Confira se você seguiu o @{oficial} pelo perfil do negócio, e não pelo seu perfil pessoal.</li>
                        <li>Mande o &ldquo;Oi&rdquo; de novo para o @{oficial}.</li>
                      </ul>
                      <div className="mt-4 text-sm">
                        {pedido.envios === 0 ? (
                          <p className="text-suave">A gente ainda não mandou o primeiro código. Ele chega depois do seu &ldquo;Oi&rdquo;.</p>
                        ) : pedido.reenvioPedidoEm ? (
                          <p className="text-suave">Você já pediu outro envio. Aguarde a DM.</p>
                        ) : esgotado ? (
                          <p className="text-suave">
                            Já mandamos o código {LIMITE_ENVIOS} vezes. Sem problema: peça uma análise manual logo abaixo.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-suave">
                              Já mandamos {pedido.envios} de {LIMITE_ENVIOS} vezes. O código novo substitui o anterior.
                            </p>
                            <FormOutroEnvio empresaId={empresa.id} />
                          </div>
                        )}
                      </div>
                    </details>
                    <form action={cancelarReivindicacao} className="mt-4 text-sm text-suave">
                      <input type="hidden" name="empresaId" value={empresa.id} />
                      <input type="hidden" name="reivindicacaoId" value={pedido.id} />
                      <BotaoEnviar className="underline hover:text-coral-700" enviando="Cancelando…">
                        Cancelar o pedido de código
                      </BotaoEnviar>
                    </form>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {dono && !faltaConfirmar ? null : dadosEmAnalise ? (
          <Aviso tipo="info">
            Seu pedido de análise está com a moderação. O resultado chega por e-mail e aparece no{" "}
            <Link href="/painel" className="font-semibold underline">
              seu painel
            </Link>
            .
          </Aviso>
        ) : peloInstagram ? (
          <details className="group cartao p-6 sm:p-8" open={esgotado}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-serif text-2xl font-semibold">Pedir uma análise manual</span>
                <span className="mt-1 block text-suave">
                  Para quem não tem acesso ao Instagram do negócio ou não recebeu o código.
                </span>
              </span>
              <span aria-hidden="true" className="text-2xl text-suave transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-suave">
              A moderação confere por outros meios, como o telefone que aparece no Google ou no Instagram do negócio, e
              decide. O resultado chega por e-mail.
            </p>
            {usuario.emailConfirmado ? (
              <FormDocumento empresaId={empresa.id} />
            ) : (
              <div className="mt-6">
                <ConfirmarEmail email={usuario.email} para="pedir a análise manual" voltar={caminho} />
              </div>
            )}
          </details>
        ) : (
          <section className="cartao p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold">Peça uma análise manual</h2>
            <p className="mt-2 leading-relaxed text-suave">
              A moderação confere os dados e decide. O resultado chega por e-mail e aparece no seu painel.
            </p>
            {usuario.emailConfirmado ? (
              <FormDocumento empresaId={empresa.id} />
            ) : (
              <div className="mt-6">
                <ConfirmarEmail email={usuario.email} para="pedir a análise manual" voltar={caminho} />
              </div>
            )}
          </section>
        )}
      </div>

      <p className="mt-10 text-center text-sm leading-relaxed text-suave">
        Os dados ficam registrados e ajudam a moderação se houver disputa pelo perfil. Dúvidas?{" "}
        <Link href="/sobre#dono" className="link">
          Veja como funciona
        </Link>
        .
      </p>
    </>
  );
}

function Passo({ numero, feito, children }: { numero: number; feito?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${feito ? "bg-folha-50 text-folha" : "bg-coral-50 text-coral-700"}`}
      >
        {feito ? "✓" : numero}
      </span>
      <div className="pt-0.5 leading-relaxed">{children}</div>
    </li>
  );
}

function InstagramIcone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
