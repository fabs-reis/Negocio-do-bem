"use client";

// O palco do cortejo: as pessoas andam no lugar com as placas e o desenho troca de técnica.
// Cada pessoa é um link para o seu tipo de negócio. As regras das figuras estão em RIG.md.

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ControleMovimento } from "./ControleMovimento";
import type { PersonagemDoCortejo, PessoaDoCortejo } from "./dados";
import { estadoDoPalco } from "./estado";
import { useAbaOculta, useMovimentoPausado, useMovimentoReduzido } from "./movimento";
import { PERSONAGENS } from "./personagens";
import { rotuloDoLink, textoDoTotal } from "./rotulos";
import { filtrarTecnicas, tecnicaNoTempo, tempoAteATroca } from "./tecnicas";
import "./cortejo.css";

// Cada vaga começa num ponto diferente do ciclo: ninguém marcha junto.
const FASES = ["-0.1s", "-0.52s", "-0.9s", "-0.31s"];
const FASE_DO_CARAMELO = "-0.17s";

type Props = {
  personagens: PersonagemDoCortejo[];
  tecnicas: readonly string[];
  className?: string;
};

export function Cortejo({ personagens, tecnicas, className = "" }: Props) {
  const p = useId();
  const palco = useRef<HTMLDivElement>(null);
  const lista = filtrarTecnicas(tecnicas);
  const montado = useSyncExternalStore(
    inscreverEmNada,
    () => true,
    () => false,
  );
  const movimentoReduzido = useMovimentoReduzido();
  const visitantePausou = useMovimentoPausado();
  const abaOculta = useAbaOculta();
  const foraDaTela = useForaDaTela(palco);
  const estado = estadoDoPalco({ montado, movimentoReduzido, visitantePausou, abaOculta, foraDaTela });
  const tecnica = lista[useIndiceDaTecnica(lista.length, estado.rodando)];

  const pessoas = personagens.filter((personagem): personagem is PessoaDoCortejo => personagem.id !== "caramelo");
  const temCaramelo = personagens.some((personagem) => personagem.id === "caramelo");
  const Caramelo = PERSONAGENS.caramelo.Figura;

  const texturas = {
    "--xilo-madeira": `url(#${p}-madeira)`,
    "--xilo-hachura": `url(#${p}-hachura)`,
    "--xilo-sombra": `url(#${p}-sombra)`,
    "--xilo-entalhe": `url(#${p}-entalhe)`,
    "--textura-grao": `url(#${p}-grao)`,
    "--textura-falhas": `url(#${p}-falhas)`,
  } as CSSProperties;

  return (
    <div
      ref={palco}
      className={`cortejo ${tecnica} ${className}`.trim()}
      data-estado={estado.rodando ? "rodando" : "parado"}
      data-motivo={estado.motivo ?? ""}
      style={texturas}
    >
      <TexturasDoPalco p={p} />
      <div className="cortejo-palco">
        <div className="cortejo-camada cortejo-azulejos" aria-hidden="true" />
        <div className="cortejo-camada cortejo-papel" aria-hidden="true" />
        <ul className="cortejo-fila">
          {pessoas.map((pessoa, i) => {
            const { Figura } = PERSONAGENS[pessoa.id];
            const idDaEtiqueta = `${p}-etiqueta-${pessoa.id}`;
            const ultima = i === pessoas.length - 1;
            return (
              <li key={pessoa.id} className="cortejo-vaga" style={{ "--fase": FASES[i % FASES.length] } as CSSProperties}>
                <Link
                  href={pessoa.href}
                  className="cortejo-pessoa"
                  aria-label={rotuloDoLink(pessoa.rotulo)}
                  aria-describedby={idDaEtiqueta}
                >
                  <Figura placa={pessoa.placa} />
                  <span className="cortejo-etiqueta" id={idDaEtiqueta}>
                    <span className="cortejo-etiqueta-rotulo">{pessoa.rotulo}</span>
                    <span className="sr-only">: </span>
                    <span className="cortejo-etiqueta-total">{textoDoTotal(pessoa.total)}</span>
                  </span>
                </Link>
                {ultima && temCaramelo && (
                  <div className="cortejo-cachorro" aria-hidden="true" style={{ "--fase": FASE_DO_CARAMELO } as CSSProperties}>
                    <Caramelo />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="cortejo-camada cortejo-rejunte" aria-hidden="true" />
      </div>
      <div className="cortejo-controle">
        <ul className="cortejo-tecnicas" aria-hidden="true">
          {lista.map((nome) => (
            <li key={nome} data-atual={nome === tecnica ? "" : undefined}>
              {nome}
            </li>
          ))}
        </ul>
        {/* Sem JavaScript as figuras já ficam paradas e o botão não teria efeito. */}
        <ControleMovimento oculto={!montado} />
      </div>
    </div>
  );
}

function inscreverEmNada() {
  return () => {};
}

/**
 * Índice da técnica no palco. O relógio só corre enquanto o palco anda.
 * Cada técnica fica a sua duração inteira na tela: um atraso do navegador não encurta a próxima.
 */
function useIndiceDaTecnica(total: number, rodando: boolean): number {
  const [indice, setIndice] = useState(0);
  const decorrido = useRef(0);
  useEffect(() => {
    if (!rodando || total <= 1) return;
    let inicio = performance.now();
    let espera: number | undefined;
    const agendar = () => {
      const falta = tempoAteATroca(decorrido.current, total);
      if (falta === null) return;
      espera = window.setTimeout(() => {
        decorrido.current += falta;
        inicio = performance.now();
        setIndice(tecnicaNoTempo(decorrido.current, total));
        agendar();
      }, falta);
    };
    agendar();
    return () => {
      window.clearTimeout(espera);
      decorrido.current += performance.now() - inicio;
    };
  }, [rodando, total]);
  return total > 1 ? indice % total : 0;
}

/** true enquanto o palco está fora da tela. */
function useForaDaTela(alvo: React.RefObject<HTMLElement | null>): boolean {
  const [fora, setFora] = useState(false);
  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([entrada]) => setFora(!entrada.isIntersecting));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [alvo]);
  return fora;
}

// Texturas fixas, desenhadas uma vez pelo navegador e só repetidas nos padrões:
// o grão da tinta e as falhas de tinta da impressão.
// A imagem tem o triplo da resolução em que é usada, para o grão ficar fino em telas densas.
function imagemDeRuido(lado: number, turbulencia: string, cor: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${lado * 3}' height='${lado * 3}' viewBox='0 0 ${lado} ${lado}'><filter id='r' x='0' y='0' width='100%' height='100%' filterRes='${lado * 3}'>${turbulencia}<feColorMatrix values='${cor}'/></filter><rect width='${lado}' height='${lado}' filter='url(#r)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const GRAO = imagemDeRuido(
  200,
  "<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='7' stitchTiles='stitch'/>",
  "0 0 0 0 0.22 0 0 0 0 0.14 0 0 0 0 0.1 0.8 0 0 0 -0.4",
);
const FALHAS = imagemDeRuido(
  240,
  "<feTurbulence type='fractalNoise' baseFrequency='0.035 0.3' numOctaves='3' seed='11' stitchTiles='stitch'/>",
  "0 0 0 0 0.97 0 0 0 0 0.94 0 0 0 0 0.87 5 0 0 0 -3.15",
);

/** Hachuras, veios e texturas das técnicas. As figuras usam por variáveis CSS do palco. */
function TexturasDoPalco({ p }: { p: string }) {
  const papel = "#f7efdf";
  const tinta = "#1e1a16";
  return (
    <svg className="cortejo-texturas" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${p}-grao`} width="200" height="200" patternUnits="userSpaceOnUse">
          <image href={GRAO} width="200" height="200" />
        </pattern>
        <pattern id={`${p}-falhas`} width="240" height="240" patternUnits="userSpaceOnUse">
          <image href={FALHAS} width="240" height="240" />
        </pattern>
        <pattern id={`${p}-hachura`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width="6" height="6" fill={papel} />
          <rect width="6" height="2.4" fill={tinta} />
        </pattern>
        <pattern id={`${p}-madeira`} width="48" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <rect width="48" height="22" fill={tinta} />
          <path d="M 0 6 C 12 4 26 8.5 48 6" stroke={papel} strokeWidth="0.9" fill="none" opacity="0.5" />
          <path d="M 0 16 C 16 18.5 31 13 48 16" stroke={papel} strokeWidth="0.7" fill="none" opacity="0.35" />
        </pattern>
        <pattern id={`${p}-sombra`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
          <rect width="5" height="1.8" fill={tinta} />
        </pattern>
        <pattern id={`${p}-entalhe`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width="6" height="1.5" fill={papel} />
        </pattern>
      </defs>
    </svg>
  );
}
