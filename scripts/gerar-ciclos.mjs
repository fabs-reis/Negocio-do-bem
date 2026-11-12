// Gera ciclos.css, os três ciclos do cortejo: a caminhada, o empurrar da cadeira e o trote.
// Rode `npm run cortejo:ciclos`.
//
// Cada ciclo é uma curva suave amostrada em 24 quadros. O corpo sobe e desce na medida
// certa para o pé (ou a pata) de apoio ficar sempre no chão; a conta usa as medidas do RIG.md.

const QUADROS = 24;
const graus = (rad) => (rad * 180) / Math.PI;
const rad = (g) => (g * Math.PI) / 180;
const fmt = (n) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(2).replace(/\.?0+$/, ""));

/** Gaussiana circular: um "morro" centrado em c, de largura w, no ciclo de 0 a 1. */
function morro(f, c, w) {
  let d = Math.abs(f - c);
  d = Math.min(d, 1 - d);
  return Math.exp(-((d / w) ** 2) / 2);
}

/** Interpolação suave (cosseno) entre pontos [fase, valor] de um ciclo fechado. */
function curva(pontos) {
  return (f) => {
    const p = [...pontos, [pontos[0][0] + 1, pontos[0][1]]];
    const x = ((f % 1) + 1) % 1;
    for (let i = 0; i < p.length - 1; i++) {
      const [f0, v0] = p[i];
      const [f1, v1] = p[i + 1];
      if (x >= f0 && x <= f1) {
        const t = (x - f0) / (f1 - f0);
        return v0 + (v1 - v0) * (1 - Math.cos(Math.PI * t)) / 2;
      }
    }
    return p[0][1];
  };
}

/** Gira (x, y) em `g` graus no sentido do SVG (horário na tela). */
function girar([x, y], g) {
  const c = Math.cos(rad(g));
  const s = Math.sin(rad(g));
  return [x * c - y * s, x * s + y * c];
}
const somar = (a, b) => [a[0] + b[0], a[1] + b[1]];

function keyframes(nome, quadros) {
  const linhas = quadros.map(({ f, t }) => `  ${fmt(f * 100)}% { transform: ${t}; }`);
  return `@keyframes ${nome} {\n${linhas.join("\n")}\n}\n`;
}
const fases = Array.from({ length: QUADROS + 1 }, (_, i) => i / QUADROS);

// ---------------------------------------------------------------- caminhada (bípede)
// Coxa 76, canela 66, do tornozelo à sola 10: do quadril ao chão são 152.
// O pé vai do calcanhar (-12) à ponta (+30) em relação ao tornozelo.
const COXA = 76;
const CANELA = 66;
const SOLA = 10;
const coxa = (f) => -23 * Math.cos(2 * Math.PI * (f + 0.03)) - 1;
const joelho = (f) => 4 + 12 * morro(f, 0.12, 0.07) + 54 * morro(f, 0.7, 0.11);
const peNoChao = curva([
  [0, -14],
  [0.08, 0],
  [0.42, 0],
  [0.56, 30],
  [0.68, 18],
  [0.84, 0],
  [0.95, -12],
]);
const tornozelo = (f) => peNoChao(f) - (coxa(f) + joelho(f));

function pontoMaisBaixo(f) {
  const a = coxa(f);
  const b = a + joelho(f);
  const c = b + tornozelo(f);
  const j = girar([0, COXA], a);
  const t = somar(j, girar([0, CANELA], b));
  const calcanhar = somar(t, girar([-12, SOLA], c));
  const ponta = somar(t, girar([30, SOLA], c));
  return Math.max(calcanhar[1], ponta[1]);
}
const descida = (f) => COXA + CANELA + SOLA - Math.max(pontoMaisBaixo(f), pontoMaisBaixo(f + 0.5));

let css = `/* Gerado por gerar-ciclos.mjs. Não edite à mão: mude a curva e gere de novo. */\n\n`;
css += keyframes("passo-corpo", fases.map((f) => ({ f, t: `translateY(${fmt(descida(f))}px)` })));
css += keyframes("passo-coxa", fases.map((f) => ({ f, t: `rotate(${fmt(coxa(f))}deg)` })));
css += keyframes("passo-joelho", fases.map((f) => ({ f, t: `rotate(${fmt(joelho(f))}deg)` })));
css += keyframes("passo-tornozelo", fases.map((f) => ({ f, t: `rotate(${fmt(tornozelo(f))}deg)` })));
// O braço de trás vai à frente junto com a perna da frente (braço e perna opostos).
css += keyframes("passo-braco", fases.map((f) => ({ f, t: `rotate(${fmt(-17 * Math.cos(2 * Math.PI * f) - 2)}deg)` })));
css += keyframes("passo-cotovelo", fases.map((f) => ({ f, t: `rotate(${fmt(-(18 + 12 * Math.cos(2 * Math.PI * f)))}deg)` })));
// O braço da frente segura a placa: só acompanha o passo.
css += keyframes("passo-segura", fases.map((f) => ({ f, t: `rotate(${fmt(1.2 * Math.sin(4 * Math.PI * f - 0.6))}deg)` })));
css += keyframes("passo-placa", fases.map((f) => ({ f, t: `rotate(${fmt(1.8 * Math.sin(4 * Math.PI * f - 1.2))}deg)` })));
css += keyframes("passo-cabeca", fases.map((f) => ({ f, t: `rotate(${fmt(-1.4 * Math.sin(4 * Math.PI * f - 0.9))}deg)` })));

// ---------------------------------------------------------------- cadeira de rodas
// Roda traseira com centro (126, 322) e aro de impulsão de raio 54. Ombro em (118, 172),
// quadril em (122, 262). Braço 56, antebraço até a pega 58. A mão empurra o aro de -30° a +35°
// (0° no alto, horário para a frente) em 40% do ciclo e volta por cima no resto.
const RODA = [126, 322];
const ARO = 54;
const QUADRIL = [122, 262];
const OMBRO = [118, 172];
const BRACO = 56;
const ANTEBRACO = 58;
const IMPULSO = 0.4;
const inclinacao = curva([
  [0, 0],
  [0.3, 5],
  [0.5, 3],
  [0.85, 0],
]);
function maoNoAro(f) {
  const x = ((f % 1) + 1) % 1;
  let angulo;
  let raio = ARO;
  if (x < IMPULSO) {
    const t = x / IMPULSO;
    angulo = -30 + 65 * (1 - Math.cos(Math.PI * t)) / 2;
  } else {
    const t = (x - IMPULSO) / (1 - IMPULSO);
    angulo = 35 - 65 * (1 - Math.cos(Math.PI * t)) / 2;
    raio = ARO + 18 * Math.sin(Math.PI * t);
  }
  return somar(RODA, [raio * Math.sin(rad(angulo)), -raio * Math.cos(rad(angulo))]);
}
/** Ângulos (absolutos, a partir da vertical para baixo) do braço e do antebraço, cotovelo para trás. */
function ik(ombro, alvo) {
  const dx = alvo[0] - ombro[0];
  const dy = alvo[1] - ombro[1];
  const d = Math.min(Math.hypot(dx, dy), BRACO + ANTEBRACO - 0.01);
  const base = Math.atan2(dy, dx);
  const abre = Math.acos((BRACO ** 2 + d ** 2 - ANTEBRACO ** 2) / (2 * BRACO * d));
  // Cotovelo para trás (à esquerda, atrás do corpo).
  const anguloBraco = base + abre;
  const cotovelo = somar(ombro, [BRACO * Math.cos(anguloBraco), BRACO * Math.sin(anguloBraco)]);
  const anguloAntebraco = Math.atan2(alvo[1] - cotovelo[1], alvo[0] - cotovelo[0]);
  // De "direção do vetor" para "rotação a partir da vertical para baixo".
  const daVertical = (a) => graus(a) - 90;
  return [daVertical(anguloBraco), daVertical(anguloAntebraco)];
}
function ombroInclinado(f) {
  const rel = [OMBRO[0] - QUADRIL[0], OMBRO[1] - QUADRIL[1]];
  return somar(QUADRIL, girar(rel, inclinacao(f)));
}
const empurrar = fases.map((f) => {
  const ombro = ombroInclinado(f);
  const [b, a] = ik(ombro, maoNoAro(f));
  return { f, ombro, b, a };
});
css += keyframes("empurra-corpo", empurrar.map(({ f }) => ({ f, t: `rotate(${fmt(inclinacao(f))}deg)` })));
// Braço de trás: dentro do corpo, que já inclina; a rotação é relativa a ele.
css += keyframes("empurra-braco-tras", empurrar.map(({ f, b }) => ({ f, t: `rotate(${fmt(b - inclinacao(f))}deg)` })));
// Braço da frente: fora do corpo (fica à frente da roda), então acompanha o ombro com translate.
css += keyframes(
  "empurra-braco-frente",
  empurrar.map(({ f, b, ombro }) => ({
    f,
    t: `translate(${fmt(ombro[0] - OMBRO[0])}px, ${fmt(ombro[1] - OMBRO[1])}px) rotate(${fmt(b)}deg)`,
  })),
);
css += keyframes("empurra-antebraco", empurrar.map(({ f, b, a }) => ({ f, t: `rotate(${fmt(a - b)}deg)` })));
css += keyframes("empurra-cabeca", fases.map((f) => ({ f, t: `rotate(${fmt(-inclinacao(f) * 0.6)}deg)` })));
css += keyframes("empurra-placa", fases.map((f) => ({ f, t: `rotate(${fmt(0.8 * Math.sin(2 * Math.PI * f - 0.8))}deg)` })));
// As rodas giram 65° no impulso, como a mão no aro, e 115° no embalo: 180° por ciclo, e os raios a cada 30°
// fecham o laço sem salto. O rodízio (raio 16) gira 2 voltas por ciclo; a cruz dele repete a cada 90°.
const giro = (total) => (f) => {
  // O último quadro (f = 1) fecha a volta em `total`, não em zero.
  const x = f >= 1 ? 1 : ((f % 1) + 1) % 1;
  if (x <= IMPULSO) return total * (65 / 180) * (x / IMPULSO) ** 1.35;
  const t = (x - IMPULSO) / (1 - IMPULSO);
  return total * (65 / 180 + (115 / 180) * (1 - (1 - t) ** 1.35));
};
css += keyframes("empurra-roda", fases.map((f) => ({ f, t: `rotate(${fmt(giro(180)(f))}deg)` })));
css += keyframes("empurra-rodizio", fases.map((f) => ({ f, t: `rotate(${fmt(giro(720)(f))}deg)` })));

// ---------------------------------------------------------------- trote (quadrúpede)
// Ombro (152, 312) e quadril (64, 312). Perna 34 + canela 34 + pata 4: 72 até o chão.
// Pares em diagonal: pata-1 (frente, perto) com pata-4 (trás, longe); pata-2 com pata-3.
const PERNA = 34;
const CANELA_PATA = 34;
const PATA = 4;
const frente = (f) => -24 * Math.cos(2 * Math.PI * f);
const tras = (f) => -20 * Math.cos(2 * Math.PI * f) + 3;
const dobraFrente = (f) => 4 + 58 * morro(f, 0.73, 0.1);
const dobraTras = (f) => -(4 + 46 * morro(f, 0.73, 0.1));
function pataMaisBaixa(f, cima, baixo) {
  const a = cima(f);
  const b = a + baixo(f);
  const j = girar([0, PERNA], a);
  const p = somar(j, girar([0, CANELA_PATA], b));
  return Math.max(somar(p, girar([-4, PATA], b))[1], somar(p, girar([10, PATA], b))[1]);
}
const descidaTrote = (f) =>
  PERNA +
  CANELA_PATA +
  PATA -
  Math.max(
    pataMaisBaixa(f, frente, dobraFrente),
    pataMaisBaixa(f, tras, dobraTras),
    pataMaisBaixa(f + 0.5, frente, dobraFrente),
    pataMaisBaixa(f + 0.5, tras, dobraTras),
  );
css += keyframes("trote-corpo", fases.map((f) => ({ f, t: `translateY(${fmt(descidaTrote(f))}px)` })));
css += keyframes("trote-frente", fases.map((f) => ({ f, t: `rotate(${fmt(frente(f))}deg)` })));
css += keyframes("trote-frente-baixo", fases.map((f) => ({ f, t: `rotate(${fmt(dobraFrente(f))}deg)` })));
css += keyframes("trote-tras", fases.map((f) => ({ f, t: `rotate(${fmt(tras(f))}deg)` })));
css += keyframes("trote-tras-baixo", fases.map((f) => ({ f, t: `rotate(${fmt(dobraTras(f))}deg)` })));
css += keyframes("trote-rabo", fases.map((f) => ({ f, t: `rotate(${fmt(10 * Math.sin(4 * Math.PI * f) + 4)}deg)` })));
css += keyframes("trote-cabeca", fases.map((f) => ({ f, t: `rotate(${fmt(2 * Math.sin(4 * Math.PI * f - 1))}deg)` })));

process.stdout.write(css);
