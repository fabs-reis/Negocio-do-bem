// As técnicas do cortejo e o ritmo da troca. Sem React, para valer nos testes.

/** As técnicas, na ordem em que o palco troca: cada uma é uma classe no palco (ver cortejo.css). */
export const TECNICAS = ["pintura", "xilogravura", "barro", "azulejo"] as const;
export type Tecnica = (typeof TECNICAS)[number];

export const DURACAO_MINIMA = 3000;
export const DURACAO_MAXIMA = 4000;

// Durações diferentes dão um ritmo vivo, sem parecer um relógio.
const RITMO = [3500, 3200, 3700, 3300];

export function ehTecnica(nome: string): nome is Tecnica {
  return (TECNICAS as readonly string[]).includes(nome);
}

/** Só as técnicas conhecidas, na ordem pedida e sem repetir. Sem nenhuma, fica a pintura. */
export function filtrarTecnicas(nomes: readonly string[]): Tecnica[] {
  const lista = [...new Set(nomes)].filter(ehTecnica);
  return lista.length > 0 ? lista : ["pintura"];
}

/** Quanto tempo (ms) a técnica de índice `indice` fica no palco. */
export function duracaoDaTecnica(indice: number): number {
  return RITMO[((indice % RITMO.length) + RITMO.length) % RITMO.length];
}

export function proximoIndice(indice: number, total: number): number {
  return total > 1 ? (indice + 1) % total : 0;
}

function duracaoDoCiclo(total: number): number {
  let soma = 0;
  for (let i = 0; i < total; i++) soma += duracaoDaTecnica(i);
  return soma;
}

/** Índice da técnica depois de `ms` milissegundos de palco andando. */
export function tecnicaNoTempo(ms: number, total: number): number {
  if (total <= 1) return 0;
  let resto = ms % duracaoDoCiclo(total);
  for (let i = 0; i < total; i++) {
    if (resto < duracaoDaTecnica(i)) return i;
    resto -= duracaoDaTecnica(i);
  }
  return 0;
}

/** Quantos milissegundos faltam para a próxima troca. Com uma técnica só, nunca troca (null). */
export function tempoAteATroca(ms: number, total: number): number | null {
  if (total <= 1) return null;
  let resto = ms % duracaoDoCiclo(total);
  for (let i = 0; i < total; i++) {
    if (resto < duracaoDaTecnica(i)) return duracaoDaTecnica(i) - resto;
    resto -= duracaoDaTecnica(i);
  }
  return duracaoDaTecnica(0);
}
