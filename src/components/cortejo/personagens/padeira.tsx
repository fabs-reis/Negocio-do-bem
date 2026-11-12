// A padeira: mulher branca de uns cinquenta anos, de avental, com a placa "COMPRE".
// Referência de estilo para as outras figuras (ver ../RIG.md).

import { Brilho, Figura, Forma, pivo, Placa, SombraNoChao, usePrefixo, type Paleta } from "./base";
import type { PropsDaFigura } from "./tipos";

const LARGURA = 220;

const PALETA: Paleta = {
  pele: ["#f1c7a6", "claro"],
  cabelo: ["#b9b2aa", "medio"],
  roupa: ["var(--color-rosa, #d27ea0)", "medio"],
  "roupa-2": ["var(--color-azul, #2f63c8)", "escuro"],
  acessorio: ["var(--color-amarelo, #f2c230)", "claro"],
  "acessorio-2": ["var(--color-terracota, #b4502c)", "escuro"],
  sapato: ["#4a2c22", "escuro"],
  objeto: ["#e9d2a4", "claro"],
  placa: ["#ead1a0", "claro"],
  letra: ["#1e1a16", "escuro"],
  traco: ["#4a2c22", "escuro"],
};

// Quadril (pivô das coxas), joelho e tornozelo: as medidas do RIG.md.
const QUADRIL = [104, 232] as const;
const JOELHO = [104, 308] as const;
const TORNOZELO = [104, 374] as const;

const COXA = "M 89 224 C 89 215 119 215 119 224 L 117 306 C 117 316 91 316 91 306 Z";
const CANELA = "M 91.5 300 L 116.5 300 L 116 365 C 116 371 92 371 92 365 Z";
const SAPATO = "M 93 371 C 91 363 101 360 111 362 C 121 364 130 367 135 373 C 139 379 136 384 129 384 L 97 384 C 92 384 91 377 93 371 Z";
const SOLA = "M 92 379.5 L 136.6 379.5 C 136.6 383.5 134 385 129 385 L 97 385 C 93 385 92 383 92 379.5 Z";

function Perna({ p, lado }: { p: string; lado: "frente" | "tras" }) {
  const longe = lado === "tras";
  return (
    <g className={`r-perna-${lado}`} style={pivo(...QUADRIL)}>
      <Forma p={p} d={COXA} papel="roupa-2" volume="h" longe={longe} />
      <g className={`r-canela-${lado}`} style={pivo(...JOELHO)}>
        <Forma p={p} d={CANELA} papel="roupa-2" volume="h" longe={longe} />
        <path className="t-linha" d="M 95 360 Q 104 363 113 360" opacity="0.55" />
        <g className={`r-pe-${lado}`} style={pivo(...TORNOZELO)}>
          <Forma p={p} d={SAPATO} papel="sapato" volume="v" longe={longe} />
          <Forma p={p} d={SOLA} papel="acessorio-2" longe={longe} />
          <Brilho p={p} cx={118} cy={367} rx={8} ry={2.6} />
        </g>
      </g>
    </g>
  );
}

export function Padeira({ placa = "COMPRE" }: PropsDaFigura) {
  const p = usePrefixo();
  return (
    <Figura p={p} nome="padeira" rig="bipede" largura={LARGURA} paleta={PALETA}>
      <SombraNoChao cx={110} rx={58} />
      <g className="r-corpo" style={pivo(...QUADRIL)}>
        {/* Braço de lá: manga dobrada até o cotovelo, antebraço e mão. */}
        <g className="r-braco-tras" style={pivo(98, 154)}>
          <Forma p={p} d="M 87 156 C 87 143 109 143 109 156 L 107.5 202 C 107.5 210 88.5 210 88.5 202 Z" papel="roupa" volume="h" longe />
          <g className="r-antebraco-tras" style={pivo(98, 206)}>
            <Forma p={p} d="M 90 200 L 106 200 L 105 250 C 105 256 91 256 91 250 Z" papel="pele" volume="h" longe />
            <Forma p={p} d="M 89 199 C 89 194 107 194 107 199 L 107.5 207 C 102 210 94 210 88.5 207 Z" papel="roupa" volume="v" longe />
            <Forma
              p={p}
              d="M 89 248 C 86 258 88 270 96 273 C 104 275 111 267 109 257 C 108 251 105 246 99 246 C 94 246 90 246 89 248 Z"
              papel="pele"
              volume="r"
              longe
            />
          </g>
        </g>

        <Perna p={p} lado="tras" />
        <Perna p={p} lado="frente" />

        {/* Tronco: blusa, avental e o laço nas costas. */}
        <Forma
          p={p}
          d="M 84 158 C 86 146 98 140 110 140 C 124 140 134 148 138 162 C 144 178 142 196 137 210 C 134 222 137 236 131 246 C 123 255 92 255 82 246 C 74 236 76 218 78 200 C 80 184 80 170 84 158 Z"
          papel="roupa"
          volume="h"
          longe
        />
        <Forma p={p} d="M 108 152 C 118 150 131 153 138 162 C 143 174 143 186 141 198 L 112 200 C 110 184 108 168 108 152 Z" papel="acessorio" volume="h" />
        <Forma
          p={p}
          d="M 94 228 L 136 225 C 143 248 147 274 149 299 C 131 307 106 307 91 300 C 91 276 92 250 94 228 Z"
          papel="acessorio"
          volume="h"
        />
        <path className="t-acessorio-2" d="M 91.4 288.5 C 106 294 132 294 148.2 287.5 L 148.6 292.5 C 132 299 106 299 91.3 293.5 Z" />
        <path className="t-linha" d="M 112 262 C 112.5 276 113 288 113.5 300" opacity="0.4" />
        {/* Pó de farinha no avental: só na pintura. */}
        <g className="t-so-pintura" fill="#fffaf0" opacity="0.75">
          <circle cx="128" cy="278" r="2.2" />
          <circle cx="133" cy="283" r="1.4" />
          <circle cx="124" cy="285" r="1.1" />
        </g>

        {/* Pescoço e cabeça. */}
        <Forma p={p} d="M 106 122 L 123 124 L 121 147 C 116 150 108 150 104 147 Z" papel="pele" volume="h" />
        {/* A alça do avental passa pelo pescoço. */}
        <Forma p={p} d="M 109 154 C 108 146 106.5 138 104.5 131 L 109 129.5 C 111.5 137 113 145 113.5 153 Z" papel="acessorio" volume="h" />
        <g className="r-cabeca" style={pivo(112, 138)}>
          <Cabeca p={p} />
        </g>

        {/* Braço de cá: a manga desce por trás da placa. */}
        <g className="r-braco-frente" style={pivo(114, 154)}>
          <g transform="rotate(-31 114 154)">
            <Forma p={p} d="M 102 156 C 102 142 126 142 126 156 L 124 214 L 104 214 Z" papel="roupa" volume="h" />
          </g>
        </g>

        {/* A placa, presa pela mão na borda da frente. */}
        <g className="r-placa" style={pivo(182, 214)}>
          <g transform="rotate(-3 112 232)">
            <Placa p={p} x={40} y={192} largura={142} altura={82} palavra={placa} />
            <Forma
              p={p}
              d="M 172 205 C 174 199 184 199 188 203 C 192 209 192 222 187 228 C 182 233 173 231 171 225 C 169 219 170 211 172 205 Z"
              papel="pele"
              volume="r"
            />
            <path className="t-linha" d="M 172 212 Q 177 213.5 182 211.5 M 171 218.5 Q 176 220 181.5 218 M 172.5 224.5 Q 177 226 181 224" />
          </g>
        </g>
      </g>
    </Figura>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <>
      {/* Coque atrás. */}
      <Forma p={p} d="M 82 92 C 82 84 89 80 95 81 C 102 82 105 88 104 95 C 103 101 97 104 91 103 C 85 102 82 98 82 92 Z" papel="cabelo" volume="r" />
      <Forma
        p={p}
        d="M 116 78 C 128 78 136 86 137 97 C 137.5 100 138 102 141 106 C 143 109 141 111 138 111.5 C 138.5 114 139 116 137.5 118 C 138.5 120 137 123 134 125 C 131 130 124 132 118 131 C 106 130 96 122 95 108 C 94 92 103 78 116 78 Z"
        papel="pele"
        volume="r"
      />
      {/* Bochecha e boca: cor só na pintura. */}
      <ellipse className="t-so-pintura" cx="127" cy="112" rx="6.5" ry="4" fill="#e58f86" opacity="0.38" />
      <path className="t-so-pintura" d="M 133.5 119.8 Q 136 121.8 137.8 119.6 Q 136 118.8 133.5 119.8 Z" fill="#c4655d" />
      {/* Cabelo grisalho, puxado para trás. */}
      <Forma
        p={p}
        d="M 96 114 C 90 97 97 77 116 74.5 C 130 73 139.5 82 138 95 C 132 88.5 122 87 114 90 C 110 96 108.5 103 107 110 C 105 116 101 120 98 121 C 96.5 119 96 116.5 96 114 Z"
        papel="cabelo"
        volume="r"
      />
      <path className="t-linha" d="M 113 79 Q 103 82 99 93 M 125 81 Q 113 83 106 95 M 132 86 Q 121 86 112 93" opacity="0.5" />
      <Brilho p={p} cx={114} cy={80} rx={9} ry={3.5} />
      {/* Orelha e brinco. */}
      <Forma p={p} d="M 104 103 C 99.5 103 98.5 112 102.5 115.5 C 106 117 108.5 112.5 107.5 108 C 107 105 106 103 104 103 Z" papel="pele" volume="r" />
      <circle className="t-acessorio" cx="103.5" cy="118" r="1.9" />
      {/* Rosto sereno: olho amendoado, sobrancelha, sorriso discreto e as marcas da idade. */}
      <path className="t-traco" d="M 123.5 100.6 C 125.5 98.2 129.5 97.8 132.2 99.7 C 129.6 101.6 126 102 123.5 100.6 Z" />
      <path className="t-linha" d="M 122.6 99.2 Q 127.4 95.6 132.8 98.6" />
      <path className="t-linha" d="M 121.8 93.4 Q 127.6 90.4 133.4 92.6" strokeWidth="2.2" />
      <path className="t-linha" d="M 120.8 101.4 L 118.6 103 M 133.6 112 Q 131.4 115.8 133 119.4" opacity="0.5" />
      <path className="t-linha" d="M 133.8 120.4 Q 136 121.6 138 120.2" />
    </>
  );
}
