"use client";

import { useActionState, useRef, useState } from "react";
import { enviarFotoDaHistoria, salvarEmpresa } from "@/acoes/empresas";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { Campo } from "@/components/Campo";
import { Historia } from "@/components/Historia";
import { reduzirFoto } from "@/components/reduzirFoto";
import { SeletorCausas } from "@/components/SeletorCausas";
import { CATEGORIAS, UFS } from "@/lib/dominio";

type DadosEmpresa = {
  id: string;
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  site: string;
  whatsapp: string;
  emailContato: string;
  historia: string;
  causas: string[];
};

export function FormEmpresa({ empresa }: { empresa: DadosEmpresa }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, undefined);
  const erros = estado?.erros ?? {};
  const valores = estado?.valores;
  const valor = (campo: keyof DadosEmpresa) => {
    const v = valores?.[campo];
    return typeof v === "string" ? v : String(empresa[campo]);
  };
  const causas = Array.isArray(valores?.causas) ? valores.causas : empresa.causas;
  const [historia, setHistoria] = useState(empresa.historia);
  const [aba, setAba] = useState<"escrever" | "ver">("escrever");
  const campoHistoria = useRef<HTMLTextAreaElement>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  // Envia a foto e coloca ![](endereço) onde está o cursor da história.
  async function inserirFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      let foto: File;
      try {
        foto = await reduzirFoto(arquivo, { lado: 1600 });
      } catch {
        setErroFoto("Não conseguimos abrir essa imagem. Use uma foto JPG, PNG ou WebP.");
        return;
      }
      const dados = new FormData();
      dados.set("empresaId", empresa.id);
      dados.set("foto", foto);
      const resposta = await enviarFotoDaHistoria(dados);
      if (!resposta.url) {
        setErroFoto(resposta.erro ?? "Não conseguimos enviar a foto.");
        return;
      }
      const posicao = campoHistoria.current?.selectionStart ?? historia.length;
      const trecho = `\n\n![](${resposta.url})\n\n`;
      setHistoria((atual) => (atual.slice(0, posicao) + trecho + atual.slice(posicao)).replace(/^\n+/, ""));
    } catch {
      setErroFoto("Não conseguimos enviar a foto. Confira a conexão e tente de novo.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-8">
      <input type="hidden" name="empresaId" value={empresa.id} />

      <section className="cartao space-y-5 p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Informações</h2>
        <Campo id="nome" rotulo="Nome do negócio" erro={erros.nome}>
          <input id="nome" name="nome" required maxLength={80} defaultValue={valor("nome")} className="campo" />
        </Campo>
        <Campo id="resumo" rotulo="Em uma frase" erro={erros.resumo} ajuda="Aparece nos cards do diretório. Até 160 caracteres.">
          <input id="resumo" name="resumo" required maxLength={160} defaultValue={valor("resumo")} className="campo" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
          <Campo id="categoria" rotulo="Categoria" erro={erros.categoria}>
            <select id="categoria" name="categoria" defaultValue={valor("categoria")} className="campo">
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
          <Campo id="cidade" rotulo="Cidade" erro={erros.cidade}>
            <input id="cidade" name="cidade" required maxLength={60} defaultValue={valor("cidade")} className="campo" />
          </Campo>
          <Campo id="uf" rotulo="Estado" erro={erros.uf}>
            <select id="uf" name="uf" defaultValue={valor("uf")} className="campo">
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      <section className="cartao space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Contato</h2>
          <p className="mt-1 text-sm text-suave">Tudo opcional. O que você preencher vira botão no perfil.</p>
        </div>
        <Campo id="site" rotulo="Site" erro={erros.site}>
          <input id="site" name="site" maxLength={200} placeholder="www.meunegocio.com.br" defaultValue={valor("site")} className="campo" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="whatsapp" rotulo="WhatsApp" erro={erros.whatsapp}>
            <input id="whatsapp" name="whatsapp" type="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={valor("whatsapp")} className="campo" />
          </Campo>
          <Campo id="emailContato" rotulo="E-mail de contato" erro={erros.emailContato}>
            <input id="emailContato" name="emailContato" type="email" maxLength={200} placeholder="contato@meunegocio.com.br" defaultValue={valor("emailContato")} className="campo" />
          </Campo>
        </div>
      </section>

      <section className="cartao space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Causas que vocês abraçam</h2>
          <p className="mt-1 text-sm text-suave">Elas viram selos no perfil e filtros na busca. Marque só o que é verdade no dia a dia.</p>
        </div>
        <SeletorCausas key={causas.join()} selecionadas={causas} />
      </section>

      <section className="cartao p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Nossa história</h2>
            <p className="mt-1 text-sm text-suave">Como tudo começou, o que move vocês, quem faz acontecer.</p>
          </div>
          <div className="flex rounded-full bg-papel p-1 text-sm" role="tablist">
            {(["escrever", "ver"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="tab"
                aria-selected={aba === opcao}
                onClick={() => setAba(opcao)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${aba === opcao ? "bg-white shadow-sm" : "text-suave"}`}
              >
                {opcao === "escrever" ? "Escrever" : "Pré-visualizar"}
              </button>
            ))}
          </div>
        </div>

        <div className={`mt-5 flex flex-wrap items-center gap-3 ${aba === "escrever" ? "" : "hidden"}`}>
          <input ref={entradaFoto} type="file" accept="image/*" className="hidden" onChange={inserirFoto} />
          <button type="button" className="botao-claro botao-pequeno" disabled={enviandoFoto} onClick={() => entradaFoto.current?.click()}>
            {enviandoFoto ? "Enviando foto…" : "Inserir foto"}
          </button>
          <span className="text-sm text-suave">A foto entra onde está o cursor.</span>
          {erroFoto && <p className="erro-campo w-full">{erroFoto}</p>}
        </div>

        <textarea
          ref={campoHistoria}
          name="historia"
          value={historia}
          onChange={(e) => setHistoria(e.target.value)}
          rows={18}
          maxLength={20000}
          aria-label="Nossa história"
          placeholder={"Tudo começou na cozinha da minha avó…\n\n## O que nos move\n\nAcreditamos que…"}
          className={`campo mt-3 resize-y font-serif text-lg leading-relaxed ${aba === "escrever" ? "" : "hidden"}`}
        />
        {aba === "ver" && (
          <div className="mt-5 min-h-48 rounded-2xl border border-linha p-6">
            {historia.trim() ? <Historia markdown={historia} /> : <p className="text-suave italic">Nada escrito ainda.</p>}
          </div>
        )}
        {erros.historia && <p className="erro-campo">{erros.historia}</p>}
        <p className="ajuda">
          Dicas: <code>## Título</code> cria um intertítulo, <code>**texto**</code> deixa em negrito, <code>&gt; frase</code> vira
          citação e uma linha com <code>---</code> separa capítulos. Para pôr legenda numa foto, escreva entre os colchetes:{" "}
          <code>![Nossa primeira fornada](…)</code>.
        </p>
      </section>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.erros && Object.keys(estado.erros).length > 0 && <Aviso tipo="erro">Confira os campos destacados acima.</Aviso>}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <BotaoEnviar pendente={pendente} className="botao-coral px-8 py-3 text-base shadow-lg shadow-coral/20" enviando="Salvando…">
          Salvar alterações
        </BotaoEnviar>
      </div>
    </form>
  );
}
