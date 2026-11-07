// O caramelo: vira-lata de pelo caramelo, magro e alegre, trotando junto da última pessoa.
// Não é link e não carrega placa. Orelhas em pé, rabo em foice, coleira azul (ver ../RIG.md).

import { Brilho, Figura, Forma, pivo, SombraNoChao, usePrefixo, type Paleta } from "./base";

const LARGURA = 230;

const PALETA: Paleta = {
  pele: ["#c98a44", "medio"],
  cabelo: ["#f4dfbd", "claro"],
  roupa: ["#c98a44", "medio"],
  "roupa-2": ["#9e5b27", "escuro"],
  acessorio: ["var(--color-azul, #2f63c8)", "escuro"],
  "acessorio-2": ["var(--color-amarelo, #f2c230)", "claro"],
  sapato: ["#2a1a12", "escuro"],
  objeto: ["#c98a44", "medio"],
  placa: ["#ead1a0", "claro"],
  letra: ["#1e1a16", "escuro"],
  traco: ["#2a1a12", "escuro"],
};

// Medidas do trote (RIG.md e gerar-ciclos.mjs): ombro (152, 312) e quadril (64, 312),
// perna 34 até a junta em y 346, canela 34 até y 380 e pata 4, com a sola no chão (y 384).
const OMBRO = [152, 312] as const;
const QUADRIL = [64, 312] as const;
const PESCOCO = [182, 261] as const;

// A pata de cada perna, desenhada a partir do eixo x: calcanhar atrás, dedos à frente, sola em y 384.
function pata(x: number) {
  return `M ${x - 6} 376.5 C ${x - 7} 372 ${x - 2} 370 ${x + 3} 370.5 C ${x + 7} 371 ${x + 11} 374.5 ${x + 11.5} 378.5 C ${x + 12} 382 ${x + 10} 384 ${x + 7} 384 L ${x - 3.5} 384 C ${x - 6.5} 384 ${x - 7.2} 380 ${x - 6} 376.5 Z`;
}
function dedos(x: number) {
  return `M ${x + 5.5} 377.5 Q ${x + 6.5} 380.5 ${x + 6} 383.4 M ${x + 9} 376.6 Q ${x + 10} 379.6 ${x + 9.8} 382.8`;
}

function PataDaFrente({ p, n, longe }: { p: string; n: 1 | 2; longe?: boolean }) {
  return (
    <g className={`r-pata-${n}`} style={pivo(...OMBRO)}>
      {/* Paleta e antebraço: o ombro arredondado afina até a junta, com o cotovelo para trás. */}
      <Forma
        p={p}
        d="M 141 296 C 141 285 163 283 165 296 C 166 304 162 314 159 322 L 158 346 C 158 351 146 351 146 346 L 145.5 330 C 143 327 141.5 322 141.5 316 C 141 308 141 302 141 296 Z"
        papel="pele"
        volume="h"
        longe={longe}
      />
      <g className={`r-pata-${n}-baixo`} style={pivo(152, 346)}>
        <Forma p={p} d="M 146.5 346 C 146.5 340.5 157.5 340.5 157.5 346 L 156.6 377 L 147.4 377 Z" papel="pele" volume="h" longe={longe} />
        <Forma p={p} d={pata(152)} papel="cabelo" volume="v" longe={longe} />
        <path className="t-linha" d={dedos(152)} opacity="0.45" />
      </g>
    </g>
  );
}

function PataDeTras({ p, n, longe }: { p: string; n: 3 | 4; longe?: boolean }) {
  return (
    <g className={`r-pata-${n}`} style={pivo(...QUADRIL)}>
      {/* Coxa cheia, a canela da perna e o jarrete apontando para trás. */}
      <Forma
        p={p}
        d="M 44 292 C 48 280 76 278 84 296 C 88 306 86 318 80 326 C 75 332 71 338 70 346 C 70 351 58 351.5 58 346.5 C 57 343 55 341 55.5 337 C 50 326 42 312 42 300 C 42 297 43 294.5 44 292 Z"
        papel="pele"
        volume="h"
        longe={longe}
      />
      <g className={`r-pata-${n}-baixo`} style={pivo(64, 346)}>
        <Forma p={p} d="M 58.5 346 C 58.5 340.5 69.5 340.5 69.5 346 L 68.8 377 L 59.4 377 Z" papel="pele" volume="h" longe={longe} />
        <Forma p={p} d={pata(64)} papel="cabelo" volume="v" longe={longe} />
        <path className="t-linha" d={dedos(64)} opacity="0.45" />
      </g>
    </g>
  );
}

export function Caramelo() {
  const p = usePrefixo();
  return (
    <Figura p={p} nome="caramelo" rig="quadrupede" largura={LARGURA} paleta={PALETA}>
      <SombraNoChao cx={112} rx={66} />
      <g className="r-corpo" style={pivo(108, 312)}>
        <PataDaFrente p={p} n={2} longe />
        <PataDeTras p={p} n={4} longe />

        {/* Rabo enrolado sobre a garupa, alto e contente, com a ponta clara. */}
        <g className="r-rabo" style={pivo(50, 281)}>
          <Forma
            p={p}
            d="M 43.6 283 C 43.2 280.1 40.7 271.2 41.5 265.4 C 42.4 259.6 45 252.7 48.8 248.5 C 52.6 244.3 59 240.8 64.2 240.1 C 69.4 239.3 75.9 241.6 79.9 244.2 C 83.8 246.7 86.5 251.7 88 255.5 C 89.5 259.3 88.6 265.2 88.8 267.1 C 89.2 270.4 83.7 271.2 83.2 267.9 C 82.9 266.3 82.4 261.2 81 258.5 C 79.7 255.8 77.7 253.3 75.1 251.8 C 72.6 250.4 68.8 249.3 65.8 249.9 C 62.8 250.5 59.3 252.7 57.2 255.5 C 55.2 258.3 53.6 262.4 53.5 266.6 C 53.3 270.8 55.9 278.6 56.4 281 Z"
            papel="pele"
            volume="h"
          />
          <Forma p={p} d="M 88.5 261.8 C 88.6 262.7 88.7 266.2 88.8 267.1 C 89.2 270.4 83.7 271.2 83.2 267.9 C 83 267 82.2 263.6 82 262.7 Z" papel="cabelo" />
        </g>

        {/* Tronco: cernelha, lombo, garupa, barriga recolhida e peito fundo, com o pescoço até a coleira. */}
        <Forma
          p={p}
          d="M 170 249 C 164 257 156 265 145 269 C 132 273 116 275 100 274 C 84 273 66 271 54 275 C 45 278 40 288 40 298 C 40 310 47 320 58 325 C 70 330 84 325 96 320 C 112 323 130 331 148 333 C 162 334 173 329 178 319 C 182 310 184 298 186 290 C 188 283 191 277 194.5 272 Z"
          papel="pele"
          volume="v"
        />
        {/* Peito claro. */}
        <Forma
          p={p}
          d="M 194.5 272 C 191 277 188 283 186 290 C 184 298 182 310 178 319 C 175 325 170 329 164 331.5 C 168 320 172 306 175 294 C 177 284 180 272 184.7 262.8 Z"
          papel="cabelo"
          volume="h"
        />
        <Brilho p={p} cx={106} cy={279} rx={30} ry={4.5} />

        <PataDaFrente p={p} n={1} />
        <PataDeTras p={p} n={3} />

        <g className="r-cabeca" style={pivo(...PESCOCO)}>
          <Cabeca p={p} />
        </g>
      </g>
    </Figura>
  );
}

function Cabeca({ p }: { p: string }) {
  return (
    <>
      {/* Orelha de lá, um pouco à frente da de cá. */}
      <Forma p={p} d="M 187 233 C 187 223 189 214 193.5 207 C 195 205 197 205.5 197.8 207.5 C 200 215 201.5 222 202 230 Z" papel="roupa-2" volume="h" longe />
      {/* Pescoço da coleira para cima. A borda de baixo fica sob a coleira. */}
      <Forma p={p} d="M 170 249 C 173 242 177 238 182 234 L 198 250 C 199 258 198 265 194.5 272 Z" papel="pele" />
      <Forma p={p} d="M 194.5 272 C 198 265 199 258 198 250 L 191 254 C 189 258 187 261 184.7 262.8 Z" papel="cabelo" />
      {/* Cabeça: crânio redondo, stop suave e focinho médio. */}
      <Forma
        p={p}
        d="M 178 240 C 178 230 188 225 197 226 C 203 226.6 207 230 209.5 234.5 C 213 236.5 217 238.5 221.5 240 C 226 241.2 228 245 226 249 C 224 252 218 253 212 253 C 209.5 253 207.5 254 206 256 C 202 261 194 262 189 259 C 183 255 178 248 178 240 Z"
        papel="pele"
        volume="r"
      />
      {/* Bochecha, lado do focinho e queixo claros, e a marca clara sobre o olho: o olho fica entre os dois. */}
      <Forma
        p={p}
        d="M 193.5 260.4 C 194.5 252 196.5 245 199.3 241.8 C 202 242.8 206 242.6 209 241.2 C 210.5 244.5 211.5 248.5 212 252.8 L 221 255.5 C 223.5 255.5 224 258.5 222 260 C 216 263.5 206 264 198 263 C 196 262.6 194.4 261.7 193.5 260.4 Z"
        papel="cabelo"
      />
      <Forma p={p} d="M 200.4 235.4 C 202 233.2 206 232.9 207.8 234.6 C 206 235.6 202.2 236 200.4 235.4 Z" papel="cabelo" />
      {/* Boca entreaberta, a língua (só na pintura) e o nariz. */}
      <path className="t-traco" d="M 206 253 C 211 252.6 217 251.8 223 251 L 222.5 254.5 C 217 255.5 212 255.6 207 254.4 Z" />
      <path className="t-so-pintura" d="M 211 254.2 C 213 253.4 218 253 220 254 C 220.5 257 219 260.5 215.5 260.5 C 212.5 260.5 211 257.5 211 254.2 Z" fill="#d9746b" />
      <path className="t-traco" d="M 221 240 C 224.5 238.5 228.6 240 229 243.5 C 229.3 246.8 227 249 224.5 249 C 222 249 220.4 246.6 220.2 244 C 220.1 242.4 220.3 241 221 240 Z" />
      <Brilho p={p} cx={224} cy={241.6} rx={2.6} ry={1.2} />
      {/* Olho amendoado e sereno. */}
      <path className="t-traco" d="M 199.6 239.6 C 201.6 236.8 206.2 236.5 208.8 239 C 206.4 241.6 202.2 242 199.6 239.6 Z" />
      <Brilho p={p} cx={192} cy={232} rx={6} ry={2.5} />
      {/* Orelha de cá, em pé, com a borda de dentro clara. */}
      <Forma p={p} d="M 182 234 C 181 224 182.5 214 186.5 207 C 188 205 190 205 191 207 C 194 214 196.5 222 197.5 230 Z" papel="roupa-2" volume="h" />
      <Forma p={p} d="M 191.2 209.5 C 193.6 215 195.4 221.5 196.4 229.4 L 193.2 230.2 C 192.8 223 192.2 216 191.2 209.5 Z" papel="cabelo" />
      {/* Coleira azul e a plaquinha. */}
      <Forma p={p} d="M 171.2 246.2 C 179.2 255.1 188 263.2 197.4 270.7 L 193.4 274.9 C 184 267.4 175.3 259.3 167.3 250.4 Z" papel="acessorio" volume="v" />
      <Forma p={p} d="M 189.8 279.2 A 3.4 3.4 0 1 0 196.6 279.2 A 3.4 3.4 0 1 0 189.8 279.2 Z" papel="acessorio-2" volume="r" />
    </>
  );
}
