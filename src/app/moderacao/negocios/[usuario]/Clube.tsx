import { liberarDonoParaClube, suspenderDonoDoClube } from "@/acoes/clube";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { quemBateComAConta } from "@/lib/clube";
import { cnpjValido, consultarCnpj, formatarCnpj, limparCnpj, type DadosCnpj } from "@/lib/cnpj";
import { db } from "@/lib/db";
import { formatarDataCurta, formatarTelefone, normalizarTexto } from "@/lib/texto";

type Negocio = { id: string; instagramUsername: string; cidade: string; uf: string };

/**
 * O Clube do Bem na ficha do negócio, só para a moderação: a liberação de cada dono e a
 * consulta do CNPJ na Receita, com os sócios. A consulta vem do `?cnpj=` da página e nada
 * dela é guardado: só o CNPJ, quando a moderação libera.
 */
export async function Clube({ empresa, cnpjDaUrl, aviso }: { empresa: Negocio; cnpjDaUrl?: string; aviso?: string }) {
  const [membros, liberacoes] = await Promise.all([
    db.empresaMembro.findMany({
      where: { empresaId: empresa.id },
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      orderBy: { criadoEm: "asc" },
    }),
    db.liberacaoClube.findMany({ where: { empresaId: empresa.id }, include: { decididoPor: { select: { nome: true } } } }),
  ]);
  const liberacaoDe = new Map(liberacoes.map((liberacao) => [liberacao.usuarioId, liberacao]));
  const cnpj = cnpjDaUrl ? limparCnpj(cnpjDaUrl) : "";
  const ficha = cnpj && cnpjValido(cnpj) ? await consultarCnpj(cnpj) : null;
  const ultimoCnpj = liberacoes[0]?.cnpj;

  return (
    <section id="clube" className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Clube do Bem</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          Só negócio com CNPJ ativo na Receita (o MEI também tem CNPJ). Confira a ficha e se o nome da conta bate com um dos
          sócios. Cada dono precisa da própria liberação para criar ofertas.
        </p>
      </div>

      <AvisoDaUrl codigo={aviso} />

      {membros.length === 0 ? (
        <p className="cartao p-5 text-sm text-suave">Este negócio ainda não tem dono. Só um dono pode ser liberado.</p>
      ) : (
        <>
          <ul className="cartao divide-y divide-linha">
            {membros.map(({ usuario }) => {
              const liberacao = liberacaoDe.get(usuario.id);
              return (
                <li key={usuario.id} className="space-y-2 p-4 text-sm">
                  <p>
                    <span className="font-medium">{usuario.nome}</span> <span className="text-suave">· {usuario.email}</span>
                  </p>
                  {!liberacao ? (
                    <p className="text-suave">Não liberado.</p>
                  ) : liberacao.status === "liberada" ? (
                    <>
                      <p className="text-folha">
                        Liberado em {formatarDataCurta(liberacao.decididoEm)}
                        {liberacao.decididoPor && ` por ${liberacao.decididoPor.nome}`} · CNPJ {formatarCnpj(liberacao.cnpj)}
                      </p>
                      <form action={suspenderDonoDoClube} className="flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="liberacaoId" value={liberacao.id} />
                        <label htmlFor={`motivo-${liberacao.id}`} className="sr-only">
                          Motivo da suspensão
                        </label>
                        <input
                          id={`motivo-${liberacao.id}`}
                          name="motivo"
                          maxLength={500}
                          placeholder="Motivo da suspensão"
                          className="campo py-1.5 sm:text-sm"
                        />
                        <BotaoEnviar className="botao-claro botao-pequeno whitespace-nowrap" enviando="Suspendendo…">
                          Suspender
                        </BotaoEnviar>
                      </form>
                    </>
                  ) : (
                    <p className="text-coral-700">
                      Suspenso em {formatarDataCurta(liberacao.decididoEm)}
                      {liberacao.decididoPor && ` por ${liberacao.decididoPor.nome}`}. Motivo: {liberacao.motivo}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <form action={`/moderacao/negocios/${empresa.instagramUsername}#clube`} method="get" className="cartao space-y-3 p-4">
            <label htmlFor="cnpj-clube" className="rotulo">
              CNPJ do negócio
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="cnpj-clube"
                name="cnpj"
                inputMode="numeric"
                defaultValue={cnpjDaUrl ?? (ultimoCnpj ? formatarCnpj(ultimoCnpj) : "")}
                placeholder="00.000.000/0000-00"
                className="campo"
              />
              <button type="submit" className="botao whitespace-nowrap">
                Consultar na Receita
              </button>
            </div>
          </form>

          {cnpjDaUrl &&
            (!cnpjValido(cnpj) ? (
              <p className="cartao p-4 text-sm text-coral-700">CNPJ inválido. Confira os números.</p>
            ) : !ficha ? (
              <p className="cartao p-4 text-sm text-coral-700">
                Não foi possível consultar a Receita agora, e sem a consulta não há liberação. Tente de novo em alguns minutos.
              </p>
            ) : (
              <Ficha empresa={empresa} cnpj={cnpj} ficha={ficha} donos={membros.map(({ usuario }) => usuario)} />
            ))}
        </>
      )}
    </section>
  );
}

function Ficha({
  empresa,
  cnpj,
  ficha,
  donos,
}: {
  empresa: Negocio;
  cnpj: string;
  ficha: DadosCnpj;
  donos: { id: string; nome: string }[];
}) {
  const ativa = normalizarTexto(ficha.situacao ?? "") === "ativa";
  const mesmaCidade =
    normalizarTexto(ficha.municipio ?? "") === normalizarTexto(empresa.cidade) && (ficha.uf ?? "").toUpperCase() === empresa.uf;
  const linha = "grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]";
  return (
    <div className="cartao space-y-4 p-4 text-sm">
      <h3 className="font-medium">Ficha da Receita · CNPJ {formatarCnpj(cnpj)}</h3>
      <dl className="space-y-2">
        <div className={linha}>
          <dt className="text-suave">Razão social</dt>
          <dd className="break-words">{ficha.razaoSocial}</dd>
        </div>
        {ficha.nomeFantasia && (
          <div className={linha}>
            <dt className="text-suave">Nome fantasia</dt>
            <dd className="break-words">{ficha.nomeFantasia}</dd>
          </div>
        )}
        <div className={linha}>
          <dt className="text-suave">Situação</dt>
          <dd className={ativa ? "font-medium text-folha" : "font-medium text-coral-700"}>{ficha.situacao ?? "Desconhecida"}</dd>
        </div>
        <div className={linha}>
          <dt className="text-suave">Cidade</dt>
          <dd>
            {ficha.municipio ? `${ficha.municipio}, ${ficha.uf}` : "Não informada"}{" "}
            <span className={mesmaCidade ? "text-folha" : "text-coral-700"}>
              {mesmaCidade ? "· a mesma do perfil" : `· o perfil diz ${empresa.cidade}, ${empresa.uf}`}
            </span>
          </dd>
        </div>
        {(ficha.telefone || ficha.email) && (
          <div className={linha}>
            <dt className="text-suave">Contato na Receita</dt>
            <dd className="break-words">
              {[ficha.telefone && formatarTelefone(`55${ficha.telefone}`), ficha.email].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
        <div className={linha}>
          <dt className="text-suave">Sócios</dt>
          <dd>
            {ficha.socios.length === 0 ? (
              <span className="text-suave">Nenhum na Receita. No MEI, o nome da pessoa está na razão social.</span>
            ) : (
              <ul className="space-y-0.5">
                {ficha.socios.map((socio) => (
                  <li key={`${socio.nome}-${socio.qualificacao}`}>
                    {socio.nome}
                    {socio.qualificacao && <span className="text-suave"> · {socio.qualificacao}</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <ul className="space-y-3 border-t border-linha pt-4">
        {donos.map((dono) => {
          const bate = quemBateComAConta(dono.nome, ficha);
          return (
            <li key={dono.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-medium">{dono.nome}</span>{" "}
                {bate ? (
                  <span className="text-folha">· o nome bate com {bate}</span>
                ) : (
                  <span className="text-coral-700">· o nome não bate com ninguém da ficha. Confira com a pessoa antes de liberar.</span>
                )}
              </p>
              {ativa ? (
                <form action={liberarDonoParaClube}>
                  <input type="hidden" name="empresaId" value={empresa.id} />
                  <input type="hidden" name="usuarioId" value={dono.id} />
                  <input type="hidden" name="cnpj" value={cnpj} />
                  <BotaoEnviar className="botao botao-pequeno whitespace-nowrap" enviando="Liberando…">
                    Liberar {dono.nome.split(" ")[0]}
                  </BotaoEnviar>
                </form>
              ) : (
                <span className="text-coral-700">O CNPJ precisa estar ativo para liberar.</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
