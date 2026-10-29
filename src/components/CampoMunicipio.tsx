"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Campo } from "@/components/Campo";
import type { Municipio } from "@/lib/municipios";
import { formatarMunicipio } from "@/lib/texto";

type ModuloMunicipios = typeof import("@/lib/municipios");

// A lista do IBGE só é baixada na primeira vez que alguém mexe no campo.
let carregamento: Promise<ModuloMunicipios> | null = null;
function carregarMunicipios() {
  carregamento ??= import("@/lib/municipios").catch((erro) => {
    carregamento = null;
    throw erro;
  });
  return carregamento;
}

/**
 * Cidade com sugestões da lista de municípios do IBGE. Envia "Cidade, UF" no campo
 * `municipio`, e o servidor confere na mesma lista (ver campoMunicipio). Sem
 * JavaScript, é um campo de texto comum: "Recife, PE" digitado à mão também vale.
 */
export function CampoMunicipio({ valorInicial, erro }: { valorInicial: string; erro?: string }) {
  const [texto, setTexto] = useState(valorInicial);
  const [municipios, setMunicipios] = useState<ModuloMunicipios | null>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [escolhido, setEscolhido] = useState<Municipio | null>(null);
  const [aviso, setAviso] = useState<string>();
  const lista = useId();

  const sugestoes = aberta && municipios && !escolhido ? municipios.sugerirMunicipios(texto) : [];
  const destacada = Math.min(ativa, sugestoes.length - 1);
  const semResultado = aberta && !!municipios && !escolhido && texto.trim().length >= 2 && sugestoes.length === 0;

  function preparar() {
    if (!municipios) carregarMunicipios().then(setMunicipios, () => {});
  }

  function escolher(municipio: Municipio) {
    setTexto(formatarMunicipio(municipio.nome, municipio.uf));
    setEscolhido(municipio);
    setAberta(false);
    setAviso(undefined);
  }

  function aoSair() {
    setAberta(false);
    if (!municipios || escolhido || !texto.trim()) return;
    const resultado = municipios.conferirMunicipio(texto);
    if ("municipio" in resultado) escolher(resultado.municipio);
    else setAviso(resultado.erro);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAberta(true);
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setAtiva(Math.max(0, Math.min(destacada + passo, sugestoes.length - 1)));
    } else if (evento.key === "Enter" && sugestoes[destacada]) {
      // Escolhe a sugestão em vez de enviar o formulário.
      evento.preventDefault();
      escolher(sugestoes[destacada]);
    } else if (evento.key === "Escape") {
      setAberta(false);
    }
  }

  return (
    <Campo
      id="municipio"
      rotulo="Cidade"
      erro={aviso ?? (escolhido ? undefined : erro)}
      ajuda={escolhido ? undefined : "Digite e escolha na lista. O estado vem junto."}
    >
      <div className="relative">
        <input
          id="municipio"
          name="municipio"
          required
          maxLength={120}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setEscolhido(null);
            setAberta(true);
            setAtiva(0);
            setAviso(undefined);
            preparar();
          }}
          onFocus={() => {
            preparar();
            setAberta(true);
          }}
          onBlur={aoSair}
          onKeyDown={aoTeclar}
          placeholder="Comece a digitar o nome"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={sugestoes.length > 0}
          aria-controls={lista}
          aria-activedescendant={sugestoes.length > 0 ? `${lista}-${destacada}` : undefined}
          aria-invalid={!!aviso || (!escolhido && !!erro)}
          className="campo pr-10"
        />
        {escolhido && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-folha" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m4.5 10.5 3.5 3.5 7.5-8" />
            </svg>
          </span>
        )}
        <ul
          id={lista}
          role="listbox"
          aria-label="Cidades"
          className={`absolute z-20 mt-1.5 max-h-80 w-full min-w-64 overflow-auto rounded-2xl border border-linha bg-superficie p-1.5 shadow-xl shadow-tinta/10 ${sugestoes.length > 0 ? "" : "hidden"}`}
        >
          {sugestoes.map((sugestao, i) => (
            <li
              key={`${sugestao.nome}-${sugestao.uf}`}
              id={`${lista}-${i}`}
              role="option"
              aria-selected={i === destacada}
              // mousedown, e não click, para escolher antes de o campo perder o foco.
              onMouseDown={(evento) => {
                evento.preventDefault();
                escolher(sugestao);
              }}
              onMouseMove={() => setAtiva(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-[15px] ${i === destacada ? "bg-coral-50" : ""}`}
            >
              <span>
                {sugestao.nome.slice(0, sugestao.inicio)}
                <strong className="font-semibold text-coral-700">{sugestao.nome.slice(sugestao.inicio, sugestao.fim)}</strong>
                {sugestao.nome.slice(sugestao.fim)}
              </span>
              <span className="shrink-0 text-xs font-medium text-suave">{sugestao.uf}</span>
            </li>
          ))}
        </ul>
        {semResultado && (
          <p className="absolute z-20 mt-1.5 w-full rounded-2xl border border-linha bg-superficie px-4 py-3 text-sm text-suave shadow-xl shadow-tinta/10">
            Nenhuma cidade com esse nome. Confira a grafia.
          </p>
        )}
      </div>
    </Campo>
  );
}
