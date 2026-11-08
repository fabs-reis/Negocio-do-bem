"use client";

import { useActionState, useState } from "react";
import { salvarServico } from "@/acoes/servicos";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { IconeRede } from "@/components/IconeRede";
import { SeletorModalidades } from "@/components/SeletorModalidades";
import { enviarSemLimpar } from "@/components/envio";
import { CATEGORIAS_SERVICOS } from "@/lib/servicos/dominio";

export type ServicoEditavel = {
  id: string;
  perfilUsuarioId: string | null;
  empresaId: string | null;
  titulo: string;
  descricao: string;
  categoria: string;
  remoto: boolean;
  presencial: boolean;
  precoReferencia: string | null;
  areasAtendimento: { cidade: string; uf: string }[];
};

export function FormularioServico({
  temPerfil, empresas, servico,
}: {
  temPerfil: boolean;
  empresas: { id: string; nome: string }[];
  servico?: ServicoEditavel;
}) {
  const [estado, acao, pendente] = useActionState(salvarServico, undefined);
  const valores = estado?.valores ?? {};
  const valor = (chave: string, inicial = "") =>
    typeof valores[chave] === "string" ? valores[chave] as string : inicial;
  const temValores = Object.keys(valores).length > 0;
  const modoInicial = servico ? (servico.perfilUsuarioId ? "profissional" : "empresa") : temPerfil ? "profissional" : "empresa";
  const [prestador, setPrestador] = useState<"profissional" | "empresa">(modoInicial);
  const nomeEmpresa = empresas.find((empresa) => empresa.id === servico?.empresaId)?.nome ?? "Negócio";

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="cartao overflow-hidden shadow-sm shadow-tinta/5">
      {servico && <input type="hidden" name="id" value={servico.id} />}
      <div className="border-b border-linha bg-folha-50/50 p-5 sm:p-7">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-folha-50 text-folha ring-1 ring-folha/15">
          <IconeRede nome="servicos" className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          {servico ? "Revisar anúncio" : "Anunciar um serviço"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          {servico
            ? "Ao salvar, o anúncio retorna à moderação. Uma versão publicada sai temporariamente do catálogo até nova aprovação."
            : "Apresente seu trabalho à comunidade. Os anúncios passam por análise antes de serem publicados."}
        </p>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-widest text-folha uppercase">Quem oferece o serviço</h3>
          {servico ? (
            <div className="rounded-2xl bg-papel p-4 text-sm">
              <strong>{servico.perfilUsuarioId ? "Meu perfil profissional" : nomeEmpresa}</strong>
              <p className="mt-1 text-suave">O prestador deste anúncio não pode ser alterado.</p>
              <input type="hidden" name="prestador" value={modoInicial} />
              {servico.empresaId && <input type="hidden" name="empresaId" value={servico.empresaId} />}
            </div>
          ) : (
            <>
              <Campo id="prestador" rotulo="Anunciar como" erro={estado?.erros?.prestador}>
                <select id="prestador" name="prestador" value={prestador} onChange={(evento) => setPrestador(evento.target.value as "profissional" | "empresa")} className="campo min-h-12">
                  {temPerfil && <option value="profissional">Meu perfil profissional</option>}
                  {empresas.length > 0 && <option value="empresa">Um dos meus negócios</option>}
                </select>
              </Campo>
              {prestador === "empresa" && empresas.length > 0 && (
                <Campo id="empresaId" rotulo="Negócio responsável" erro={estado?.erros?.empresaId}>
                  <select id="empresaId" name="empresaId" required defaultValue={valor("empresaId")} className="campo min-h-12">
                    <option value="" disabled>Selecione um negócio</option>
                    {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
                  </select>
                </Campo>
              )}
            </>
          )}
        </div>

        <div className="space-y-4 border-t border-linha pt-6">
          <h3 className="text-xs font-semibold tracking-widest text-folha uppercase">Detalhes do anúncio</h3>
          <Campo id="titulo" rotulo="Título do serviço" erro={estado?.erros?.titulo}>
            <input id="titulo" name="titulo" required minLength={5} maxLength={100} defaultValue={valor("titulo", servico?.titulo)} placeholder="Ex.: Desenvolvimento de sites para pequenos negócios" className="campo min-h-12" />
          </Campo>
          <Campo id="descricao" rotulo="Descrição" erro={estado?.erros?.descricao} ajuda="Explique o que está incluído e como funciona o atendimento.">
            <textarea id="descricao" name="descricao" required minLength={30} maxLength={2500} rows={5} defaultValue={valor("descricao", servico?.descricao)} placeholder="Descreva o serviço, sua experiência e como pode ajudar…" className="campo min-h-36 resize-y" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="categoria" rotulo="Categoria" erro={estado?.erros?.categoria}>
              <select id="categoria" name="categoria" required defaultValue={valor("categoria", servico?.categoria)} className="campo min-h-12">
                <option value="" disabled>Selecione…</option>
                {CATEGORIAS_SERVICOS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            </Campo>
            <Campo id="precoReferencia" rotulo="Preço indicativo (opcional)" erro={estado?.erros?.precoReferencia} ajuda="Ex.: Sob orçamento; a partir de R$ 100.">
              <input id="precoReferencia" name="precoReferencia" maxLength={100} defaultValue={valor("precoReferencia", servico?.precoReferencia ?? "")} placeholder="Sob orçamento" className="campo min-h-12" />
            </Campo>
          </div>
          <SeletorModalidades
            remoto={temValores ? valores.remoto === "sim" : (servico?.remoto ?? false)}
            presencial={temValores ? valores.presencial === "sim" : (servico?.presencial ?? false)}
            erro={estado?.erros?.modalidade}
          />
          <Campo
            id="areasAtendimento"
            rotulo="Municípios atendidos presencialmente"
            erro={estado?.erros?.areasAtendimento}
          >
            <textarea
              id="areasAtendimento"
              name="areasAtendimento"
              rows={3}
              maxLength={1300}
              aria-invalid={!!estado?.erros?.areasAtendimento}
              aria-describedby="areasAtendimento-dica"
              defaultValue={valor("areasAtendimento", servico?.areasAtendimento.map(({ cidade, uf }) => `${cidade}, ${uf}`).join("\n") ?? "")}
              placeholder={"Recife, PE\nOlinda, PE"}
              className="campo min-h-28 w-full resize-y leading-relaxed"
            />
            <p id="areasAtendimento-dica" className="ajuda">Uma cidade por linha, com UF. Ex.: Recife, PE; Olinda, PE. Até 10 cidades. Para serviços apenas remotos, pode deixar vazio.</p>
          </Campo>
        </div>

        <div className="rounded-2xl border border-linha bg-papel/70 p-4">
          <div className="flex items-start gap-3">
            <IconeRede nome="seguro" className="mt-0.5 h-5 w-5 shrink-0 text-folha" />
            <div>
              <p className="text-sm font-semibold">Publicação com moderação</p>
              <p className="mt-1 text-xs leading-relaxed text-suave">Somente anúncios aprovados aparecem no catálogo. Você pode ocultá-los a qualquer momento.</p>
            </div>
          </div>
        </div>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        <BotaoEnviar pendente={pendente} enviando="Salvando…" className="botao-coral min-h-12 w-full px-6 sm:w-auto">
          <IconeRede nome="adicionar" className="h-4 w-4" />
          {servico ? "Salvar e enviar para revisão" : "Enviar serviço para análise"}
        </BotaoEnviar>
      </div>
    </form>
  );
}
