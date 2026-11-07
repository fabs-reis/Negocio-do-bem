// Peças comuns das figuras do cortejo. As regras estão em ../RIG.md.

import { useId, type CSSProperties, type ReactNode, type SVGProps } from "react";
import { linhasDaPlaca, medidasDaPlaca } from "../rotulos";
import "../cortejo.css";
import "../ciclos.css";
import type { Rig } from "./tipos";

/** Altura comum do viewBox e linha do chão de todas as figuras. */
export const ALTURA = 400;
export const CHAO = 384;

/** Papel de pintura de cada forma: a técnica do palco decide a tinta de cada papel. */
export type Papel =
  | "pele"
  | "cabelo"
  | "roupa"
  | "roupa-2"
  | "acessorio"
  | "acessorio-2"
  | "sapato"
  | "objeto"
  | "placa"
  | "letra"
  | "traco";

/** Valor do papel nas técnicas de uma tinta só (xilogravura, barro, azulejo). */
export type Tom = "escuro" | "medio" | "claro";

/** A cor de cada papel na pintura e o seu tom nas outras técnicas. */
export type Paleta = Record<Papel, readonly [cor: string, tom: Tom]>;

/** As variáveis CSS da paleta, no elemento raiz da figura. */
export function estiloDaPaleta(paleta: Paleta): CSSProperties {
  const estilo: Record<string, string> = {};
  for (const [papel, [cor, tom]] of Object.entries(paleta)) {
    estilo[`--${papel}`] = cor;
    estilo[`--${papel}-tom`] = `var(--tom-${tom})`;
    estilo[`--${papel}-contorno`] = `var(--contorno-${tom})`;
    estilo[`--${papel}-solido`] = `var(--solido-${tom})`;
  }
  return estilo as CSSProperties;
}

/** Pivô de uma peça do rig, em unidades do viewBox. */
export function pivo(x: number, y: number): CSSProperties {
  return { transformOrigin: `${x}px ${y}px` };
}

/** Prefixo dos ids desta instância (gradientes, padrões, recortes). */
export function usePrefixo(): string {
  return useId();
}

type Volume = "h" | "v" | "r";

type PropsDaForma = Omit<SVGProps<SVGPathElement>, "d" | "className" | "fill"> & {
  p: string;
  d: string;
  papel: Papel;
  /** Sombra modelada: h (tubo em pé), v (de cima para baixo), r (esfera). */
  volume?: Volume;
  /** Peça do lado de lá do corpo: um pouco mais escura. */
  longe?: boolean;
};

/** Uma forma pintada com o seu papel, com a sombra modelada e o escurecido do lado de lá por cima. */
export function Forma({ p, d, papel, volume, longe, ...resto }: PropsDaForma) {
  return (
    <>
      <path d={d} className={`t-${papel}`} {...resto} />
      {volume && <path d={d} className="t-volume" fill={`url(#${p}-v-${volume})`} />}
      <path d={d} className="t-grao" />
      {longe && <path d={d} className="t-longe" />}
    </>
  );
}

/** Um brilho suave (luz na pintura, lustro no barro, entalhe na xilogravura). */
export function Brilho({ p, ...resto }: Omit<SVGProps<SVGEllipseElement>, "className" | "fill"> & { p: string }) {
  return <ellipse className="t-brilho" fill={`url(#${p}-brilho)`} {...resto} />;
}

/** Os gradientes da sombra modelada. A cor vem da técnica do palco (--volume-cor, --brilho-cor). */
function Gradientes({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-v-h`} x1="0" y1="0" x2="1" y2="0">
        <stop className="e-volume" offset="0" stopOpacity="0.32" />
        <stop className="e-volume" offset="0.3" stopOpacity="0" />
        <stop className="e-volume" offset="0.55" stopOpacity="0" />
        <stop className="e-volume" offset="1" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id={`${p}-v-v`} x1="0" y1="0" x2="0" y2="1">
        <stop className="e-volume" offset="0" stopOpacity="0" />
        <stop className="e-volume" offset="0.45" stopOpacity="0" />
        <stop className="e-volume" offset="1" stopOpacity="0.85" />
      </linearGradient>
      <radialGradient id={`${p}-v-r`} cx="0.36" cy="0.3" r="0.82">
        <stop className="e-volume" offset="0" stopOpacity="0" />
        <stop className="e-volume" offset="0.5" stopOpacity="0.05" />
        <stop className="e-volume" offset="1" stopOpacity="0.9" />
      </radialGradient>
      <radialGradient id={`${p}-brilho`}>
        <stop className="e-brilho" offset="0" stopOpacity="0.95" />
        <stop className="e-brilho" offset="1" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** A raiz de toda figura: viewBox comum, fora da árvore de acessibilidade, paleta em variáveis CSS. */
export function Figura({
  p,
  nome,
  rig,
  largura,
  paleta,
  children,
}: {
  p: string;
  nome: string;
  rig: Rig;
  largura: number;
  paleta: Paleta;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${largura} ${ALTURA}`}
      width={largura}
      height={ALTURA}
      className={`figura figura-${nome} rig-${rig}`}
      style={estiloDaPaleta(paleta)}
      aria-hidden="true"
      focusable="false"
    >
      <Gradientes p={p} />
      {children}
    </svg>
  );
}

/** Sombra no chão, embaixo da figura. Não anda. */
export function SombraNoChao({ cx, rx }: { cx: number; rx: number }) {
  return <ellipse className="t-chao" cx={cx} cy={CHAO + 1} rx={rx} ry={5} />;
}

/**
 * A placa de papelão com a palavra. Desenhada a partir do canto (x, y), com a largura e a altura dadas;
 * a palavra fica centrada na área útil, do tamanho que couber.
 */
export function Placa({
  p,
  x,
  y,
  largura,
  altura,
  palavra,
}: {
  p: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  palavra: string;
}) {
  const margem = Math.round(altura * 0.16);
  const area = { largura: largura - 2 * margem, altura: altura - 2 * margem };
  const medidas = medidasDaPlaca(linhasDaPlaca(palavra), area);
  // Cantos cortados à mão: nem todos iguais.
  const d = `M ${x + 3} ${y + 1} L ${x + largura - 2} ${y} Q ${x + largura + 1} ${y + 1} ${x + largura} ${y + 4}
    L ${x + largura + 1} ${y + altura - 3} Q ${x + largura} ${y + altura + 1} ${x + largura - 4} ${y + altura}
    L ${x + 2} ${y + altura + 1} Q ${x - 1} ${y + altura} ${x} ${y + altura - 4} L ${x - 1} ${y + 3} Q ${x} ${y} ${x + 3} ${y + 1} Z`;
  return (
    <>
      <Forma p={p} d={d} papel="placa" volume="v" />
      <path className="t-placa-fibra" d={`M ${x + 6} ${y + altura * 0.34} H ${x + largura - 8} M ${x + 9} ${y + altura * 0.7} H ${x + largura - 5}`} />
      {/* O miolo mantém as letras legíveis sem retirar a textura das bordas da placa. */}
      <rect className="t-placa-leitura" x={x + margem - 4} y={y + margem - 4} width={area.largura + 8} height={area.altura + 8} rx={2} />
      <text className="t-letra cortejo-letra" fontSize={medidas.tamanho} textAnchor="middle" dominantBaseline="central">
        {medidas.linhas.map((linha, i) => (
          <tspan
            key={i}
            x={x + largura / 2}
            y={y + margem + linha.y + medidas.tamanho * 0.04}
            textLength={linha.comprimento}
            lengthAdjust="spacingAndGlyphs"
          >
            {linha.texto}
          </tspan>
        ))}
      </text>
    </>
  );
}
