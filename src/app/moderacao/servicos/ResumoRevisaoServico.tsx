import type { ReactNode } from "react";

/** Apenas os campos públicos do prestador e do anúncio, sem dados da conta pessoal. */
export type ServicoParaRevisao = {
  categoria: string;
  cidade: string;
  uf: string;
  remoto: boolean;
  presencial: boolean;
  precoReferencia: string | null;
  areasAtendimento: { cidade: string; uf: string }[];
  perfil: { nomePublico: string; site: string | null; emailContato: string | null } | null;
  empresa: { nome: string; instagramUsername: string } | null;
};

/** Não cria links clicáveis para URLs com protocolos não permitidos. */
function enderecoExternoSeguro(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return ["https:", "http:"].includes(url.protocol) && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-suave">{titulo}</dt>
      <dd className="mt-1 min-w-0 text-sm text-tinta [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Mostra os dados que serão aprovados junto com a versão atual do anúncio. */
export function ResumoRevisaoServico({ servico }: { servico: ServicoParaRevisao }) {
  const site = enderecoExternoSeguro(servico.perfil?.site ?? null);

  return (
    <section aria-label="Dados públicos para revisão" className="min-w-0 rounded-2xl border border-linha bg-papel p-4">
      <h3 className="text-sm font-semibold">Dados públicos para aprovação</h3>
      <dl className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
        <Campo titulo="Origem do prestador">{servico.cidade}, {servico.uf}</Campo>
        <Campo titulo="Modalidades">
          {servico.remoto && "Remoto"}
          {servico.remoto && servico.presencial && " e "}
          {servico.presencial && "Presencial"}
        </Campo>
        <Campo titulo="Municípios atendidos presencialmente">
          {servico.presencial
            ? servico.areasAtendimento.length
              ? servico.areasAtendimento.map(({ cidade, uf }) => `${cidade}, ${uf}`).join(" · ")
              : "Nenhum município declarado"
            : "Não se aplica — atendimento remoto"}
        </Campo>
        <Campo titulo="Preço indicativo">{servico.precoReferencia || "Valor a combinar"}</Campo>
        {servico.perfil ? (
          <>
            <Campo titulo="Site ou portfólio profissional">
              {site ? (
                <a className="link [overflow-wrap:anywhere]" href={site} target="_blank" rel="noopener noreferrer nofollow">
                  {site}
                </a>
              ) : "Não informado"}
            </Campo>
            <Campo titulo="E-mail profissional">
              {servico.perfil.emailContato ? (
                <a className="link [overflow-wrap:anywhere]" href={`mailto:${servico.perfil.emailContato}`}>
                  {servico.perfil.emailContato}
                </a>
              ) : "Não informado"}
            </Campo>
          </>
        ) : servico.empresa ? (
          <Campo titulo="Perfil público da empresa">
            <a className="link [overflow-wrap:anywhere]" href={`/empresas/${encodeURIComponent(servico.empresa.instagramUsername)}`}>
              Conferir perfil do negócio
            </a>
          </Campo>
        ) : null}
      </dl>
    </section>
  );
}
