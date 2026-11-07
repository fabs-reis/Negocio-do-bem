// O agricultor: homem pardo de uns sessenta anos, de boné, com uma cestinha de verduras. Placa "O BEM".
// Agricultor familiar de hoje: camisa polo, calça jeans, botina e boné. Estilo e rig da padeira (ver ../RIG.md).

import { Brilho, Figura, Forma, pivo, Placa, SombraNoChao, usePrefixo, type Paleta } from "./base";
import type { PropsDaFigura } from "./tipos";

const LARGURA = 220;

// Tons pelo valor da cor: a pele média fica em hachura na xilogravura, e o cabelo, a sobrancelha
// e o bigode grisalhos ficam claros por cima dela. O boné escuro emoldura o rosto.
// A camisa escura e a calça média separam o braço do tronco em todas as técnicas.
const PALETA: Paleta = {
  pele: ["#9a5b36", "medio"],
  cabelo: ["#d6d0c6", "claro"],
  roupa: ["var(--color-verde-escuro, #1f5a3c)", "escuro"],
  "roupa-2": ["#5a78ab", "medio"],
  acessorio: ["var(--color-terracota, #b4502c)", "escuro"],
  "acessorio-2": ["#d9a441", "claro"],
  sapato: ["#4a2c22", "escuro"],
  objeto: ["var(--color-verde-escuro, #1f5a3c)", "escuro"],
  placa: ["#ead1a0", "claro"],
  letra: ["#1e1a16", "escuro"],
  traco: ["#2e1b12", "escuro"],
};

// Quadril (pivô das coxas), joelho e tornozelo: as medidas do RIG.md.
const QUADRIL = [104, 232] as const;
const JOELHO = [104, 308] as const;
const TORNOZELO = [104, 374] as const;

// Jeans reto, um pouco mais largo que a calça da padeira.
const COXA = "M 88 224 C 88 214 120 214 120 224 L 118 306 C 118 316 90 316 90 306 Z";
const CANELA = "M 90.5 300 L 117.5 300 L 117 360 L 91 360 Z";
// A barra do jeans fica por cima do cano da botina: vem depois do pé.
const BARRA = "M 90.8 350 L 117.2 350 C 118 354.6 118.6 359 118.8 363.6 C 111 366 97 366 89.2 363.6 C 89.4 359 90 354.6 90.8 350 Z";
const BOTINA =
  "M 91 380 C 90.2 373 90.4 366 91.6 360 C 99 358 109.6 358 116.6 360 C 117.6 364 119.6 366.8 124.6 368.4 C 132 370.6 137 373.8 137.8 379 L 137.8 380 Z";
const SOLA = "M 90.4 379.5 L 138.2 379.5 C 138.2 383.5 135.8 385 130.6 385 L 95 385 C 91.6 385 90.4 383.5 90.4 379.5 Z";

function Perna({ p, lado }: { p: string; lado: "frente" | "tras" }) {
  const longe = lado === "tras";
  return (
    <g className={`r-perna-${lado}`} style={pivo(...QUADRIL)}>
      <Forma p={p} d={COXA} papel="roupa-2" volume="h" longe={longe} />
      <g className={`r-canela-${lado}`} style={pivo(...JOELHO)}>
        <Forma p={p} d={CANELA} papel="roupa-2" volume="h" longe={longe} />
        <g className={`r-pe-${lado}`} style={pivo(...TORNOZELO)}>
          <Forma p={p} d={BOTINA} papel="sapato" volume="v" longe={longe} />
          <Forma p={p} d={SOLA} papel="acessorio-2" longe={longe} />
          <path className="t-linha" d="M 98.6 363 Q 103.2 371.6 107.8 363 M 121.6 368.6 Q 126.4 372.6 127.6 379" opacity="0.5" />
          <Brilho p={p} cx={128} cy={372} rx={7} ry={2.4} />
        </g>
        <Forma p={p} d={BARRA} papel="roupa-2" volume="h" longe={longe} />
        <path className="t-linha" d="M 89.8 360.6 C 98 363 110 363 118.4 360.6" opacity="0.4" />
      </g>
    </g>
  );
}

export function Agricultor({ placa = "O BEM" }: PropsDaFigura) {
  const p = usePrefixo();
  return (
    <Figura p={p} nome="agricultor" rig="bipede" largura={LARGURA} paleta={PALETA}>
      <SombraNoChao cx={110} rx={58} />
      <g className="r-corpo" style={pivo(...QUADRIL)}>
        {/* Braço de lá: manga curta da polo, braço e mão. */}
        <g className="r-braco-tras" style={pivo(98, 154)}>
          <Forma p={p} d="M 89 176 L 107.5 176 L 107 206 C 107 212 89.5 212 89.5 206 Z" papel="pele" volume="h" longe />
          <Forma p={p} d="M 86 156 C 86 142 110 142 110 156 L 109.6 183 C 104 186.5 92 186.5 86.4 183 Z" papel="roupa" volume="h" longe />
          <g className="r-antebraco-tras" style={pivo(98, 206)}>
            <Forma p={p} d="M 89.5 205 C 89.5 199 107 199 107 205 L 106 250 C 106 256 91 256 91 250 Z" papel="pele" volume="h" longe />
            <Forma
              p={p}
              d="M 88 248 C 85 259 87 271 96 274 C 105 276.5 112 267 110 257 C 109 250 105 246 99 246 C 93 246 89 245 88 248 Z"
              papel="pele"
              volume="r"
              longe
            />
          </g>
        </g>

        <Perna p={p} lado="tras" />
        <Perna p={p} lado="frente" />

        {/* Tronco: a polo, de ombros largos e uma barriga discreta. */}
        <Forma
          p={p}
          d="M 81 157 C 83 144 97 137 111 137 C 126 137 136 146 140 160 C 145 177 147 195 147 212 C 147 228 143 243 137 252 C 125 261 94 261 82 252 C 75 240 76 222 77 204 C 78 186 77 169 81 157 Z"
          papel="roupa"
          volume="h"
          longe
        />

        {/* Pescoço e a gola da polo. */}
        <Forma p={p} d="M 104 119 L 125 121 L 123.5 146 C 117.5 150 108.5 150 103 146 Z" papel="pele" volume="h" />
        <Forma
          p={p}
          d="M 100.6 145.6 C 100 139.6 101.4 134.4 104 131.6 C 106.6 135.6 110.4 138.6 114.8 140.6 C 118.6 142.2 122.4 143 125.8 143 C 127.6 146.4 128 150.6 127.2 153.6 C 121 152.6 114.6 150.4 109 147.4 C 106 146.8 103 146.4 100.6 145.6 Z"
          papel="roupa"
          volume="v"
        />
        <g className="r-cabeca" style={pivo(113, 136)}>
          <Cabeca p={p} />
        </g>

        {/* Braço de cá: a manga curta e o braço descem por trás da placa. */}
        <g className="r-braco-frente" style={pivo(114, 154)}>
          <g transform="rotate(-36 114 154)">
            <Forma p={p} d="M 104.5 176 L 124 176 L 123 236 L 105.5 236 Z" papel="pele" volume="h" />
            <Forma p={p} d="M 101 156 C 101 141 127 141 127 156 L 126.6 183 C 120 187 108 187 101.4 183 Z" papel="roupa" volume="h" />
            <path className="t-linha" d="M 102 179.4 C 108 182.4 120 182.4 126 179.4" opacity="0.45" />
          </g>
        </g>

        {/* A placa, presa pela mão na borda da frente. A mesma mão leva a cesta. */}
        <g className="r-placa" style={pivo(186, 216)}>
          <g transform="rotate(1.5 112 232)">
            <Placa p={p} x={40} y={192} largura={142} altura={82} palavra={placa} />
            <Cesta p={p} />
            <Forma
              p={p}
              d="M 175 205 C 177 198 188.5 197.5 193 201.5 C 197.6 208 198 222.5 192.6 229.6 C 187 234.6 176.4 233 174.4 226.6 C 172.4 219.6 173 211 175 205 Z"
              papel="pele"
              volume="r"
            />
            <path className="t-linha" d="M 175.6 211 Q 180.6 212.6 186.2 210.6 M 174.6 217.6 Q 179.6 219.2 185.8 217.2 M 175.6 224.2 Q 180.2 225.6 185.2 223.8" />
          </g>
        </g>
      </g>
    </Figura>
  );
}

// A cestinha pende da mão, à direita da palavra: nunca cobre as letras. O alto da alça fica dentro da mão.
function Cesta({ p }: { p: string }) {
  return (
    <>
      <Forma
        p={p}
        d="M 176.6 246 C 176.6 231 183 224.6 192.6 224.6 C 202.2 224.6 208.6 231 208.6 246 L 205.8 246 C 205.8 233 200.8 227.4 192.6 227.4 C 184.4 227.4 179.4 233 179.4 246 Z"
        papel="acessorio-2"
        volume="h"
      />
      {/* A boca da cesta, por dentro. */}
      <Forma p={p} d="M 175 246 C 175 242 210 242 210 246 C 210 250 175 250 175 246 Z" papel="acessorio-2" longe />
      {/* Cheiro-verde e um pé de couve. */}
      <Forma p={p} d="M 197 247 C 198 237 202 229 208.6 222.6 C 209 231 205.6 240 202 248 Z" papel="objeto" />
      <Forma
        p={p}
        d="M 178.6 247 C 175.6 239 179.6 232 186.2 233 C 188.6 228 196.6 228.4 198.2 234.4 C 203.6 234 206.6 240.4 204.2 247 Z"
        papel="objeto"
        volume="r"
      />
      <path className="t-linha" d="M 186.4 246 C 186.8 240 188.6 236.4 191.2 234.2 M 196.2 246 C 196.6 242 198.6 239 201 237.6" opacity="0.5" />
      {/* Tomates: o vermelho só na pintura. */}
      <Forma p={p} d="M 180.6 246.6 A 5.4 5.4 0 1 0 191.4 246.6 A 5.4 5.4 0 1 0 180.6 246.6 Z" papel="acessorio" volume="r" />
      <Forma p={p} d="M 191.8 247.4 A 5 5 0 1 0 201.8 247.4 A 5 5 0 1 0 191.8 247.4 Z" papel="acessorio" volume="r" />
      <path
        className="t-so-pintura"
        d="M 180.6 246.6 A 5.4 5.4 0 1 0 191.4 246.6 A 5.4 5.4 0 1 0 180.6 246.6 Z M 191.8 247.4 A 5 5 0 1 0 201.8 247.4 A 5 5 0 1 0 191.8 247.4 Z"
        fill="#d8432b"
        opacity="0.55"
      />
      <Brilho p={p} cx={184} cy={243.8} rx={2.2} ry={1.4} />
      <Brilho p={p} cx={195} cy={244.8} rx={2} ry={1.3} />
      {/* O corpo trançado e a borda. */}
      <Forma
        p={p}
        d="M 175 247 L 210 247 C 209.6 254 208 259.6 205 263.4 C 202 266.8 183 266.8 180 263.4 C 177 259.6 175.4 254 175 247 Z"
        papel="acessorio-2"
        volume="v"
      />
      <path
        className="t-linha"
        d="M 176.4 254 Q 192.5 257 208.6 254 M 178.4 260 Q 192.5 263 206.6 260 M 184.4 250.6 L 185.2 265 M 192.5 251 L 192.5 266 M 200.6 250.6 L 199.8 265"
        opacity="0.5"
      />
      <Forma p={p} d="M 174 245.4 C 180 247.6 205 247.6 211 245.4 L 211 249 C 205 251.4 180 251.4 174 249 Z" papel="acessorio-2" volume="v" />
    </>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <>
      <Forma
        p={p}
        d="M 116 76 C 128 76 136.5 84 137.5 95 C 138 98.5 139 101 142.8 105.6 C 145 108.6 143 111.2 139.2 111.6 C 139.7 114 140.2 116.6 138.6 118.6 C 139.6 121 138.2 124.6 135.2 126.6 C 132.2 132 124.4 134.2 117 133.2 C 105 132 95 124 94 108 C 93 91 103 76 116 76 Z"
        papel="pele"
        volume="r"
      />
      {/* Bochecha, sombra da aba e lábio: cor só na pintura. */}
      <ellipse className="t-so-pintura" cx="127" cy="112" rx="6.5" ry="4" fill="#c2553e" opacity="0.28" />
      <path
        className="t-so-pintura"
        d="M 125 93 C 131 92.4 136.6 92.6 139.6 93.6 C 139.6 96 139.2 97.6 138.4 98.6 C 133.6 96.6 129 95.8 125 96.4 Z"
        fill="#3b2140"
        opacity="0.22"
      />
      <path className="t-so-pintura" d="M 135.4 120.2 Q 137.6 121.8 139.6 120 Q 137.6 119.4 135.4 120.2 Z" fill="#6e2c20" />
      {/* Cabelo grisalho curto: a nuca e a costeleta, por baixo do boné. */}
      <Forma
        p={p}
        d="M 94.4 111 C 93.4 104 93.8 99 95 95 L 104 95.5 C 102.4 101 101.6 107 102 113 C 101.2 117 99.6 120.5 98 123 C 96 120 94.8 116 94.4 111 Z"
        papel="cabelo"
        volume="r"
      />
      <Forma p={p} d="M 107 95 L 113 95 C 112 98.5 111.5 102 111.6 105.5 C 110.2 106.2 108.6 106 107.6 105 C 107 101.5 106.8 98 107 95 Z" papel="cabelo" />
      <Forma p={p} d="M 104.5 100 C 99.5 100 98.5 110.5 102.5 114.5 C 106.5 116.5 109.5 112 108.5 106.5 C 108 102.5 107 100 104.5 100 Z" papel="pele" volume="r" />
      <path className="t-linha" d="M 104.6 104 Q 102.4 107.5 104.4 111" opacity="0.5" />
      {/* Boné de aba curva, com o fecho atrás. */}
      <Forma
        p={p}
        d="M 92.5 98 C 89.5 82 100 68.5 116 67.5 C 130 67 139.5 75.5 140 88.5 C 140 90 139.8 91.2 139.4 92 C 126 90.5 106 93 92.5 98 Z"
        papel="acessorio"
        volume="r"
      />
      <Forma p={p} d="M 93.2 97.6 C 93.4 93 96 90.6 99.6 91 C 101 93 101.4 95.2 101 96.8 C 98.4 96.9 95.6 97.2 93.2 97.6 Z" papel="cabelo" />
      <Forma p={p} d="M 130 89 C 139 86.4 150.5 86 158.5 89.2 C 159.6 91.4 158 93.4 154.4 93.6 C 146 94 138 93.6 131 93.2 Z" papel="acessorio" volume="v" />
      <path className="t-linha" d="M 118 68 C 121.5 75 122.5 83 121.5 90.6" opacity="0.45" />
      <circle className="t-acessorio" cx="117" cy="67.8" r="2" />
      <Brilho p={p} cx={109} cy={73} rx={8} ry={3} />
      {/* Rosto sereno: olho amendoado, sobrancelha e bigode grisalhos, sorriso discreto e as marcas da idade. */}
      <path className="t-traco" d="M 124 101.8 C 126 99.4 130 99 132.6 100.9 C 130 102.8 126.4 103.2 124 101.8 Z" />
      <path className="t-linha" d="M 123.2 100.4 Q 127.8 97 133.2 99.8" />
      <Forma p={p} d="M 121.6 96.6 C 125.4 94 131 93.8 135.2 95.6 L 134.8 97.8 C 130.8 96.6 125.8 96.8 122.4 98.6 Z" papel="cabelo" />
      <path className="t-linha" d="M 121 101.4 L 118.6 103 M 121 99 L 118.4 98.4 M 125 105.2 Q 128.4 106.6 131.8 105.2 M 134 107.4 Q 131 112 132.6 116.6" opacity="0.5" />
      <Forma
        p={p}
        d="M 131.6 113.2 C 134 110.8 139 110.6 141.4 112.4 C 142 114.6 140.6 116.8 137.6 116.9 C 134.8 117 132.6 115.6 131.6 113.2 Z"
        papel="cabelo"
        volume="r"
      />
      <path className="t-linha" d="M 135.6 120.4 Q 137.8 121.6 139.8 120.2" />
    </>
  );
}
