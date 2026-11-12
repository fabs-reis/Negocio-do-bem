// A costureira: mulher parda jovem, cabelo cacheado preso, fita métrica no pescoço, placa "DE QUEM".
// Segue o estilo e o rig da padeira (ver ../RIG.md).

import { Brilho, Figura, Forma, pivo, Placa, SombraNoChao, usePrefixo, type Paleta } from "./base";
import type { PropsDaFigura } from "./tipos";

const LARGURA = 220;

// Tom pelo valor da cor: a pele (#9a6040) tem o valor da terracota, que a padeira chama de escuro.
// Pele escura pede traço claro: olho, sobrancelha e boca saem claros nas técnicas de uma tinta só.
// As marcas da fita métrica são o acessorio-2, escuro, para aparecer sobre a fita clara em toda técnica.
const PALETA: Paleta = {
  pele: ["#9a6040", "escuro"],
  cabelo: ["#2b1c15", "escuro"],
  roupa: ["var(--color-verde, #3f9a5c)", "medio"],
  "roupa-2": ["var(--color-terracota, #b4502c)", "escuro"],
  acessorio: ["var(--color-amarelo, #f2c230)", "claro"],
  "acessorio-2": ["#2e2622", "escuro"],
  sapato: ["var(--color-azul, #2f63c8)", "escuro"],
  objeto: ["#f1ebe0", "claro"],
  placa: ["#ead1a0", "claro"],
  letra: ["#1e1a16", "escuro"],
  traco: ["#2e1c14", "claro"],
};

// Quadril (pivô das coxas), joelho e tornozelo: as medidas do RIG.md.
const QUADRIL = [104, 232] as const;
const JOELHO = [104, 308] as const;
const TORNOZELO = [104, 374] as const;

// Calça pantacourt larga: a barra fica acima do tornozelo.
const COXA = "M 87.5 224 C 87.5 214 120.5 214 120.5 224 L 119.5 306 C 119.5 316.5 88.5 316.5 88.5 306 Z";
const CANELA = "M 89 300 L 119 300 L 122.5 347 C 113 351.5 95 351.5 85.5 347 Z";
const TORNOZELO_PELE = "M 96 344 L 112.5 344 L 112 368 L 96.5 368 Z";
// Tênis de lona, com biqueira e sola de borracha.
const TENIS = "M 95.5 361 C 99 358.5 104 359.6 108 359.2 C 116 360.4 124 364 130.5 368 C 136.5 371.5 139 375 138.2 378 L 93 378 C 91.5 373 92.5 365 95.5 361 Z";
const BIQUEIRA = "M 127.6 368.2 C 132.6 369.8 137.6 373 138.3 378 L 124.8 378 C 124.8 374.2 125.8 370.8 127.6 368.2 Z";
const SOLA = "M 91.5 376.5 L 139 376.5 C 139.8 381.5 137 385 131 385 L 97 385 C 93 385 91.5 382.5 91.5 376.5 Z";

const CADARCO = "M 109.6 360.4 L 113.4 364.4 M 113.8 361 L 117.6 365.6 M 118 362.4 L 121.4 367";

// Pesponto: a costura tracejada nas barras da roupa.
const PESPONTO = { strokeDasharray: "2.4 2.2", opacity: 0.7 } as const;

function Perna({ p, lado }: { p: string; lado: "frente" | "tras" }) {
  const longe = lado === "tras";
  return (
    <g className={`r-perna-${lado}`} style={pivo(...QUADRIL)}>
      <Forma p={p} d={COXA} papel="roupa-2" volume="h" longe={longe} />
      <g className={`r-canela-${lado}`} style={pivo(...JOELHO)}>
        <Forma p={p} d={TORNOZELO_PELE} papel="pele" volume="h" longe={longe} />
        <Forma p={p} d={CANELA} papel="roupa-2" volume="h" longe={longe} />
        <path className="t-linha" d="M 87.5 343.6 C 97 347 111 347 120.6 343.6" {...PESPONTO} />
        <g className={`r-pe-${lado}`} style={pivo(...TORNOZELO)}>
          <Forma p={p} d={TENIS} papel="sapato" volume="v" longe={longe} />
          <Forma p={p} d={BIQUEIRA} papel="objeto" volume="v" longe={longe} />
          <Forma p={p} d={SOLA} papel="objeto" volume="v" longe={longe} />
          {/* Cadarço: claro nas técnicas de uma tinta só pelo traço, branco na pintura. */}
          <path className="t-linha" d={CADARCO} />
          <path className="t-so-pintura" d={CADARCO} fill="none" stroke="#f6f1e8" strokeWidth="1.6" strokeLinecap="round" />
          <Brilho p={p} cx={112} cy={364} rx={7} ry={2} />
        </g>
      </g>
    </g>
  );
}

/** A fita métrica: uma faixa amarela com as marcas do centímetro. */
function Marcas({ d }: { d: string }) {
  return <path className="t-acessorio-2" d={d} />;
}

export function Costureira({ placa = "DE QUEM" }: PropsDaFigura) {
  const p = usePrefixo();
  return (
    <Figura p={p} nome="costureira" rig="bipede" largura={LARGURA} paleta={PALETA}>
      <SombraNoChao cx={112} rx={56} />
      <g className="r-corpo" style={pivo(...QUADRIL)}>
        {/* Braço de lá: manga curta, braço, antebraço e mão. */}
        <g className="r-braco-tras" style={pivo(98, 154)}>
          <Forma p={p} d="M 89.5 172 L 106.5 172 L 106 206 C 106 212 90 212 90 206 Z" papel="pele" volume="h" longe />
          <Forma p={p} d="M 87 156 C 87 143 109 143 109 156 L 108.5 179 C 102 182.5 94 182.5 87.5 179 Z" papel="roupa" volume="h" longe />
          <path className="t-linha" d="M 88 175.6 C 94.5 178.6 101.5 178.6 108 175.6" {...PESPONTO} />
          <g className="r-antebraco-tras" style={pivo(98, 206)}>
            <Forma p={p} d="M 90.5 206 C 90.5 197 105.5 197 105.5 206 L 104.5 250 C 104.5 256 91.5 256 91.5 250 Z" papel="pele" volume="h" longe />
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

        {/* Tronco: bata de manga curta, solta até o quadril, com pesponto na barra. */}
        <Forma
          p={p}
          d="M 87 158 C 89 147 99 141 111 141 C 124 141 133 148 137 160 C 142 172 142.5 186 138.5 198 C 135.5 208 134.5 219 136 230 C 137.5 240 138.5 249 135.5 255 C 124 261 94 261 82 255 C 78 245 80 232 82 220 C 84 204 83 190 84 176 C 84.5 168 85 162 87 158 Z"
          papel="roupa"
          volume="h"
          longe
        />
        <path className="t-linha" d="M 82.6 250.6 C 95 256 123 256 136.4 250.6" {...PESPONTO} />

        {/* Pescoço. */}
        <Forma p={p} d="M 107 121 L 122 123.5 L 120.5 148 C 116 151.5 109 151.5 105 148 Z" papel="pele" volume="h" />
        {/* A fita métrica dá a volta no pescoço; a ponta de cá cai por cima do braço. */}
        <Forma p={p} d="M 101.5 132.5 C 107.5 139 115 143.2 124 144.6 L 123.4 149.8 C 113.5 148.6 105.5 144.2 99.5 137.4 Z" papel="acessorio" volume="h" />
        <Marcas d="M 107.2 138.4 L 108.6 136.6 L 109.4 137.2 L 108 139 Z M 111.6 141.4 L 112.6 139.4 L 113.5 139.8 L 112.5 141.8 Z M 116.4 143.4 L 117 141.2 L 118 141.4 L 117.4 143.6 Z M 121 144.6 L 121.3 142.4 L 122.3 142.5 L 122 144.7 Z" />

        <g className="r-cabeca" style={pivo(112, 140)}>
          <Cabeca p={p} />
        </g>

        {/* Braço de cá: a manga e o braço descem por trás da placa. A ponta da fita cai por cima. */}
        <g className="r-braco-frente" style={pivo(114, 154)}>
          <g transform="rotate(-31 114 154)">
            <Forma p={p} d="M 104 178 L 124 178 L 123.5 214 L 104.5 214 Z" papel="pele" volume="h" />
            <Forma p={p} d="M 102 156 C 102 142 126 142 126 156 L 125.5 183 C 119 187 109 187 102.5 183 Z" papel="roupa" volume="h" />
            <path className="t-linha" d="M 103 179.6 C 109.5 182.8 118.5 182.8 125 179.6" {...PESPONTO} />
          </g>
          <Forma p={p} d="M 119 144 C 121.5 157 122.6 172 122.4 187.5 L 127.4 187.5 C 127.6 171.5 126.5 156 124 143.6 Z" papel="acessorio" volume="h" />
          <Marcas d="M 121.4 151 L 123.4 150.6 L 123.5 151.6 L 121.5 152 Z M 122.2 157 L 125.4 156.6 L 125.5 157.6 L 122.3 158 Z M 122.6 163 L 124.8 162.8 L 124.9 163.8 L 122.7 164 Z M 122.9 169 L 126.2 168.8 L 126.3 169.8 L 123 170 Z M 123 175 L 125.2 174.9 L 125.3 175.9 L 123.1 176 Z M 123 181 L 126.6 181 L 126.6 182 L 123 182 Z" />
          {/* Ponteira de metal na ponta da fita. */}
          <Forma p={p} d="M 122 186.4 L 127.8 186.4 L 127.8 190.2 C 126 191.4 123.8 191.4 122 190.2 Z" papel="acessorio-2" />
        </g>

        {/* A placa, presa pela mão na borda da frente. */}
        <g className="r-placa" style={pivo(182, 214)}>
          <g transform="rotate(2 112 232)">
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
      {/* Rabo de cavalo cacheado, preso no alto e solto atrás. */}
      <Forma
        p={p}
        d="M 99 84 C 96 76 86 74 81 79 C 74 78 69 85 71 92 C 65 97 66 106 71 110 C 66 116 68 125 74 128 C 71 135 76 143 83 143 C 85 150 94 152 98 146 C 103 141 103 132 100 126 C 103 116 102 104 100 96 Z"
        papel="cabelo"
        volume="r"
      />
      {/* Os cachos: arcos que repetem a borda de cada mecha. */}
      <path
        className="t-linha"
        d="M 82 83.5 C 77 83 74 86.5 75 90.5 M 74.5 95.5 C 70.5 98.5 70.5 104 73.5 107 M 74.5 113.5 C 71 116.5 71.5 121.5 75 124 M 77.5 131 C 75.5 134.5 77.5 139 81.5 139.5 M 86.5 143.5 C 88 147 92.5 148 95 145 M 86 95 C 82.5 98 83.5 103 87 104.5 M 85.5 114 C 82.5 117 83.5 122 87 123 M 91 128 C 88.5 131 89.5 135.5 93 136"
        opacity="0.5"
      />
      <Forma
        p={p}
        d="M 116 78 C 128 78 136 86 137 97 C 137.5 100.5 138.5 102.5 141 106 C 142.8 108.8 141.2 111.4 138 111.6 C 139 113.6 139.8 115.8 138.2 117.8 C 139.6 119.8 138.6 122.6 135 124.6 C 132 129.6 124.5 132 118 131 C 106 130 96 122 95 108 C 94 92 103 78 116 78 Z"
        papel="pele"
        volume="r"
      />
      {/* Bochecha e boca: cor só na pintura. */}
      <ellipse className="t-so-pintura" cx="127" cy="112" rx="6.5" ry="4" fill="#c4604a" opacity="0.3" />
      <path className="t-so-pintura" d="M 133.6 118.4 Q 136.4 120.6 138.2 117.9 Q 136.2 117 133.6 118.4 Z" fill="#7d3a30" />
      {/* Cabelo puxado para trás, com volume no alto. */}
      <Forma
        p={p}
        d="M 95 113 C 89 96 96 75 116 72 C 131 70.5 140.5 80.5 138.5 94.5 C 133 88 123.5 86 115.5 88.5 C 111 94 109.5 101 108 108 C 106.5 114 102.5 118.5 98.5 120 C 96.5 118 95.5 115.5 95 113 Z"
        papel="cabelo"
        volume="r"
      />
      <path className="t-linha" d="M 112 77 Q 103 80 99 91 M 124 78.5 Q 113 81 106 93 M 132.5 84 Q 121 84 111.5 91" opacity="0.5" />
      <Brilho p={p} cx={116} cy={78} rx={9} ry={3.2} />
      {/* Xuxinha do mesmo tecido da bata, em volta do rabo de cavalo. */}
      <Forma
        p={p}
        d="M 91.9 78.2 C 95.5 77.4 99.6 79.6 101.2 83 C 103 86.4 103.4 89.8 102.1 91.8 C 99.6 93 95.6 91.4 93.8 88.2 C 92 85 90.6 80.4 91.9 78.2 Z"
        papel="roupa"
        volume="r"
      />
      <path className="t-linha" d="M 94.6 80.6 L 97.4 79.6 M 95.8 84.6 L 99.8 82.8 M 97.6 88.6 L 101.6 86.8" opacity="0.5" />
      {/* Orelha e argola. */}
      <Forma p={p} d="M 104 103 C 99.5 103 98.5 112 102.5 115.5 C 106 117 108.5 112.5 107.5 108 C 107 105 106 103 104 103 Z" papel="pele" volume="r" />
      <path className="t-linha" d="M 104 106.6 C 102.4 108.6 102.6 111.6 104.6 113" opacity="0.6" />
      <circle className="t-linha" cx="103.4" cy="119.4" r="2.8" />
      {/* Rosto sereno: olho amendoado, sobrancelha e um sorriso discreto. */}
      <path className="t-traco" d="M 123.5 100.6 C 125.5 98.2 129.5 97.8 132.2 99.7 C 129.6 101.6 126 102 123.5 100.6 Z" />
      <path className="t-linha" d="M 122.6 99.2 Q 127.4 95.6 132.8 98.6 M 123.2 99.6 L 120.9 98.2" />
      <path className="t-linha" d="M 121.6 93.2 Q 127.6 89.8 133.6 92.2" strokeWidth="2.4" />
      <path className="t-linha" d="M 133.8 118.6 Q 136.2 119.8 138.2 118" />
    </>
  );
}
