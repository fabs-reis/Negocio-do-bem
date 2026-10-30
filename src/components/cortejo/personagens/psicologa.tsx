// A psicóloga: mulher negra de uns trinta anos, numa cadeira de rodas ativa, com a placa "FAZ" no colo.
// Ela mesma empurra a cadeira, sentada reta. Segue o rig da cadeira de ../RIG.md e o estilo da padeira.

import { Brilho, Figura, Forma, pivo, Placa, SombraNoChao, usePrefixo, type Paleta } from "./base";
import type { PropsDaFigura } from "./tipos";

const LARGURA = 300;

// Pele escura pede traço claro: o rosto aparece nas quatro técnicas.
// O cabelo fica no tom médio para separar o rosto do cabelo na xilogravura e no azulejo.
const PALETA: Paleta = {
  pele: ["#6a3e27", "escuro"],
  cabelo: ["#1f1512", "medio"],
  roupa: ["var(--color-amarelo, #f2c230)", "claro"],
  "roupa-2": ["var(--color-verde-escuro, #1f5a3c)", "escuro"],
  acessorio: ["var(--color-terracota, #b4502c)", "escuro"],
  "acessorio-2": ["#dcd7cf", "claro"],
  sapato: ["#2a2320", "escuro"],
  objeto: ["var(--color-rosa, #d27ea0)", "medio"],
  placa: ["#ead1a0", "claro"],
  letra: ["#1e1a16", "escuro"],
  traco: ["#1a100c", "claro"],
};

// Medidas do ciclo de empurrar (gerar-ciclos.mjs): roda, rodízio, quadril, ombro, braço 56 e antebraço 58.
const RODA = [126, 322] as const;
const RODIZIO = [200, 368] as const;
const QUADRIL = [122, 262] as const;
const OMBRO = [118, 172] as const;
const COTOVELO = [118, 228] as const;
const PESCOCO = [124, 160] as const;

// Cachos do black power: arcos curtos que seguem o volume, longe do rosto.
const CACHOS =
  "M 110.6 91.8 Q 112.7 88.4 115.7 90.9 M 121.7 92.4 Q 125.2 90.4 126.6 94.2 M 100.9 97.8 Q 100.9 93.8 104.9 94.5 M 96.4 108.3 Q 94.4 104.8 98.2 103.4 M 97.8 119 Q 94.3 117 96.9 113.9 M 104.1 127.2 Q 100.1 127.1 100.8 123.2 M 110 104.1 Q 111.1 100.3 114.7 101.9 M 106.7 112.9 Q 104.4 109.6 108 107.9 M 110.5 119.8 Q 106.6 119 107.9 115.2 M 115.5 100.8 Q 118.3 98.1 120.6 101.3";

/** Anel (pneu, aro) centrado em (cx, cy), de raio r1 a r2. Os dois círculos giram em sentidos opostos: o meio fica vazio. */
function anel(cx: number, cy: number, r1: number, r2: number) {
  return `M ${cx - r2} ${cy} a ${r2} ${r2} 0 1 0 ${2 * r2} 0 a ${r2} ${r2} 0 1 0 ${-2 * r2} 0 Z M ${cx - r1} ${cy} a ${r1} ${r1} 0 1 1 ${2 * r1} 0 a ${r1} ${r1} 0 1 1 ${-2 * r1} 0 Z`;
}

// Perna sentada: coxa no assento, canela reta até o apoio dos pés, tênis de sola clara.
const COXA = "M 102 252 C 122 247 182 247 204 248 C 216 249 221 257 220 266 C 219 275 211 280 200 280 L 112 281 C 100 281 95 274 95.5 266 C 96 259 98 254 102 252 Z";
const CANELA = "M 195.5 254 L 220.5 254 L 220 321 C 220 327 196 327 196 321 Z";
const TENIS = "M 197 327 C 195 319 205 316 215 318 C 225 320 234 323 239 329 C 243 335 240 340 233 340 L 201 340 C 196 340 195 333 197 327 Z";
const SOLA = "M 196 335.5 L 240.6 335.5 C 240.6 339.5 238 341 233 341 L 201 341 C 197 341 196 339 196 335.5 Z";

function Perna({ p, lado }: { p: string; lado: "frente" | "tras" }) {
  const longe = lado === "tras";
  // A perna de lá aparece um pouco atrás e acima da de cá.
  const desvio = longe ? "translate(-5 -3)" : undefined;
  return (
    <g transform={desvio}>
      <Forma p={p} d={CANELA} papel="roupa-2" volume="h" longe={longe} />
      <path className="t-linha" d="M 199 316 Q 208 319 217 316" opacity="0.55" />
      <Forma p={p} d={TENIS} papel="sapato" volume="v" longe={longe} />
      <Forma p={p} d={SOLA} papel="acessorio-2" longe={longe} />
      <Brilho p={p} cx={222} cy={323} rx={8} ry={2.6} />
      <Forma p={p} d={COXA} papel="roupa-2" volume="v" longe={longe} />
    </g>
  );
}

function Braco({ p, lado }: { p: string; lado: "frente" | "tras" }) {
  const longe = lado === "tras";
  return (
    <g className={`r-braco-${lado}`} style={pivo(...OMBRO)}>
      {/* O antebraço vem antes da manga: ele sai de baixo da barra quando o braço dobra. */}
      <g className={`r-antebraco-${lado}`} style={pivo(...COTOVELO)}>
        <Forma p={p} d="M 109.8 228 C 109.8 217 126.2 217 126.2 228 L 125 274 C 125 280 111 280 111 274 Z" papel="pele" volume="h" longe={longe} />
        {/* A mão fecha no aro: a pega fica no meio dela. */}
        <Forma
          p={p}
          d="M 107.5 277 C 104.5 286 106.5 297 115.5 300 C 124.5 302.5 132 294.5 130.5 285 C 129.5 278.5 126 273.5 119.5 273.5 C 113.5 273.5 108.5 274 107.5 277 Z"
          papel="pele"
          volume="r"
          longe={longe}
        />
        {/* Dedos por baixo do aro e o polegar por cima. */}
        <path className="t-linha" d="M 109 287 Q 113 289.5 117 288 M 109.5 292.5 Q 113.5 295 117.5 293.5 M 123.6 279.5 Q 127.4 283.5 126.4 289.5" opacity="0.7" />
      </g>
      {/* Manga até o cotovelo, com a ponta redonda em volta do pivô: a junta fica inteira quando o braço dobra. */}
      <Forma p={p} d="M 106.5 172 C 106.5 158 129.5 158 129.5 172 L 128.6 228 C 128.6 242 107.4 242 107.4 228 Z" papel="roupa" volume="h" longe={longe} />
      <path className="t-linha" d="M 108.6 232 C 112 237.5 124 237.5 127.4 232" opacity="0.4" />
    </g>
  );
}

function Cadeira({ p }: { p: string }) {
  return (
    <g className="r-cadeira" style={pivo(...RODA)}>
      {/* Encosto baixo, sem manoplas: quem empurra é ela. */}
      <Forma p={p} d="M 84 206 C 84 200 98 200 98 206 L 99 268 C 99 272 87 272 87 268 Z" papel="sapato" volume="h" />
      <Forma p={p} d="M 83 206 C 83 201 89 199.5 90.5 204 L 95 290 L 89 290.5 Z" papel="objeto" volume="h" />
      {/* Placa do eixo, atrás da roda. */}
      <Forma p={p} d="M 120 286 L 133 286 L 130.5 322 L 121.5 322 Z" papel="sapato" volume="h" />
      {/* Quadro rígido: trilho do assento e a frente que desce até o apoio dos pés. */}
      <Forma
        p={p}
        d="M 88 287 L 192 282 C 200 282 204 288 204 296 L 203 330 L 210 340 L 204 344 L 196 333 L 196 297 C 196 292 194 290 190 290 L 89 294 Z"
        papel="objeto"
        volume="v"
      />
      {/* Garfo do rodízio. */}
      <Forma p={p} d="M 196.5 334 L 203.5 334 L 204 366 L 196 366 Z" papel="objeto" volume="h" />
      {/* Almofada do assento. */}
      <Forma p={p} d="M 92 278 C 120 276 170 275 194 275 C 199 275 200 283 195 284 C 170 285 120 286 93 288 C 89 288 88 279 92 278 Z" papel="sapato" volume="v" />
      {/* Apoio dos pés. */}
      <Forma p={p} d="M 193 341 L 246 341 C 249.5 341 249.5 347 246 347 L 193 347 C 190 347 190 341 193 341 Z" papel="objeto" volume="v" />
    </g>
  );
}

export function Psicologa({ placa = "FAZ" }: PropsDaFigura) {
  const p = usePrefixo();
  const raios = Array.from({ length: 6 }, (_, i) => i * 30);
  return (
    <Figura p={p} nome="psicologa" rig="cadeira" largura={LARGURA} paleta={PALETA}>
      <SombraNoChao cx={152} rx={104} />
      {/* Roda de lá: só uma fresta atrás da de cá. */}
      <Forma p={p} d={anel(118, 321, 55, 62)} papel="sapato" longe />

      <Cadeira p={p} />

      {/* Pernas no assento e pés no apoio: paradas. */}
      <Perna p={p} lado="tras" />
      <Perna p={p} lado="frente" />

      <g className="r-corpo" style={pivo(...QUADRIL)}>
        <Braco p={p} lado="tras" />
        {/* Tronco: blusa solta, a barra cai sobre o colo. */}
        <Forma
          p={p}
          d="M 112 160 C 101 162 95 172 95 186 C 94 204 96 224 97 242 C 97.5 254 99.5 262 106 267 C 120 270 136 269 148 266 C 151 258 151 248 149 238 C 148 226 152 210 153 196 C 154 180 147 166 134 162 C 127 160 119 159 112 160 Z"
          papel="roupa"
          volume="h"
          longe
        />
        <path className="t-linha" d="M 104 266 C 118 268.5 134 268 147 265" opacity="0.35" />

        {/* Pescoço e o decote em V. */}
        <Forma
          p={p}
          d="M 117 140 L 134 142 C 134.5 152 137 159 141 164 C 144 168 146.5 173 147.5 179 L 144 180 C 136 174 125 169 114 166 Z"
          papel="pele"
          volume="h"
        />
        <g className="r-cabeca" style={pivo(...PESCOCO)}>
          <Cabeca p={p} />
        </g>
      </g>

      {/* A placa no colo, encostada nela. */}
      <g className="r-placa" style={pivo(210, 262)}>
        <g transform="rotate(-4 210 262)">
          <Placa p={p} x={160} y={190} largura={100} altura={72} palavra={placa} />
        </g>
      </g>

      {/* Roda de cá: pneu, raios a cada 30°, aro de impulsão e cubo (a simetria fecha o laço sem salto). */}
      <g className="r-roda-tras" style={pivo(...RODA)}>
        <path className="t-sapato" d={anel(...RODA, 56, 63)} />
        {raios.map((angulo) => (
          <rect key={angulo} className="t-sapato" x={125.2} y={272} width={1.6} height={100} transform={`rotate(${angulo} ${RODA[0]} ${RODA[1]})`} />
        ))}
        <path className="t-acessorio-2" d={anel(...RODA, 51.5, 55)} />
        <circle className="t-objeto" cx={RODA[0]} cy={RODA[1]} r={8} />
        <circle className="t-acessorio-2" cx={RODA[0]} cy={RODA[1]} r={3} />
      </g>
      {/* Luz e grão do pneu: parados, como a luz de verdade, e não saltam no laço. */}
      <path className="t-volume" d={anel(...RODA, 56, 63)} fill={`url(#${p}-v-r)`} />
      <path className="t-grao" d={anel(...RODA, 56, 63)} />

      <g className="r-roda-frente" style={pivo(...RODIZIO)}>
        <path className="t-sapato" d={anel(...RODIZIO, 10, 16)} />
        <rect className="t-acessorio-2" x={199} y={358} width={2} height={20} />
        <rect className="t-acessorio-2" x={190} y={367} width={20} height={2} />
        <circle className="t-objeto" cx={RODIZIO[0]} cy={RODIZIO[1]} r={3.5} />
      </g>
      <path className="t-volume" d={anel(...RODIZIO, 10, 16)} fill={`url(#${p}-v-r)`} />
      <path className="t-grao" d={anel(...RODIZIO, 10, 16)} />

      <Braco p={p} lado="frente" />
    </Figura>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <>
      <Forma
        p={p}
        d="M 126 96 C 139 96 147 104 147.5 115 C 148 119 149 121.5 151.2 124.6 C 153.4 127.8 151.6 130.4 148.4 130.6 C 149.6 132.4 150.2 134.2 148.8 135.8 C 149.8 137.6 149.4 140.6 146.2 142.4 C 145.8 145.2 144.6 147.6 141.6 148.8 C 137 150.8 131.6 150.6 127 149.6 C 116 148 106 140 105 126 C 104 110 113 96 126 96 Z"
        papel="pele"
        volume="r"
      />
      {/* Luz quente na testa e na maçã do rosto, e a boca: cor só na pintura. */}
      <ellipse className="t-so-pintura" cx="140" cy="107" rx="4.5" ry="2.2" fill="#d39a6c" opacity="0.28" />
      <ellipse className="t-so-pintura" cx="138" cy="128.5" rx="6" ry="3.6" fill="#b2603f" opacity="0.2" />
      <path
        className="t-so-pintura"
        d="M 145.4 132.4 C 147.4 131.8 149.4 132.2 150 134 C 149.9 135.3 149 136 148.4 136.3 C 149.5 137.3 149.6 139.6 148 141 C 146.8 141.9 145.4 141.8 144.6 141.2 C 145.6 139.6 145.4 137.8 144.2 136.6 C 145.2 135.6 145.6 133.8 145.4 132.4 Z"
        fill="#7d3a31"
      />
      {/* Cabelo natural: black power redondo, com o contorno de cachos. */}
      <Forma
        p={p}
        d="M 143 109 Q 147.6 102.8 145.5 99 Q 146.4 92.4 141.5 90 Q 140 84.4 134 84.5 Q 130.6 79.9 124.5 82 Q 119.8 78.7 114.5 82.5 Q 108.9 80.8 105 86 Q 99.1 86 97 92 Q 91.4 94 91.5 100.5 Q 86.8 104.4 89 110.5 Q 85.7 116 89.5 121 Q 88 127.5 93 131 Q 93.7 137.6 99.5 139 Q 102.2 145 108 144.5 Q 112 149.1 117 146.5 C 118.5 140 118.5 133 120.5 127 C 123.5 119.5 132 114 143 109 Z"
        papel="cabelo"
        volume="r"
      />
      {/* Cachos: traço claro nas técnicas de uma tinta só, castanho na pintura. */}
      <path className="t-linha" d={CACHOS} opacity="0.5" />
      <path className="t-so-pintura" d={CACHOS} fill="none" stroke="#5a3d2e" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <Brilho p={p} cx={116} cy={88} rx={10} ry={3.6} />
      {/* Orelha e argola. */}
      <Forma p={p} d="M 114 121 C 109.5 121 108.5 130 112.5 133.5 C 116 135 118.5 130.5 117.5 126 C 117 123 116 121 114 121 Z" papel="pele" volume="r" />
      <path className="t-acessorio" d={anel(113.6, 138.8, 1.3, 2.6)} />
      {/* Rosto sereno: olho amendoado com a íris, pálpebra, sobrancelha, narina e boca. */}
      <path className="t-traco" d="M 133.2 118.8 C 135.4 115.9 139.8 115.4 142.6 117.6 C 140 119.9 136 120.4 133.2 118.8 Z" />
      <circle className="t-sapato" cx="139.4" cy="117.9" r="1.6" />
      <path className="t-linha" d="M 132.4 117.2 Q 137.4 113.4 143.2 116.4" />
      <path className="t-linha" d="M 131.6 111 Q 137.6 107.8 143.6 110.2" strokeWidth="2.2" />
      <path className="t-linha" d="M 147.6 127.4 Q 146 129 147.8 130.2" opacity="0.6" />
      <path className="t-linha" d="M 143.8 136.8 Q 146 137.8 148.2 136.4" />
    </>
  );
}
