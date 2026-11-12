import { describe, expect, it } from "vitest";
import { estadoDoPalco } from "@/components/cortejo/estado";
import {
  DURACAO_MAXIMA,
  DURACAO_MINIMA,
  TECNICAS,
  duracaoDaTecnica,
  filtrarTecnicas,
  proximoIndice,
  tecnicaNoTempo,
  tempoAteATroca,
} from "@/components/cortejo/tecnicas";

describe("TECNICAS", () => {
  it("são as quatro técnicas do cortejo, na ordem em que aparecem", () => {
    expect(TECNICAS).toEqual(["pintura", "xilogravura", "barro", "azulejo"]);
  });
});

describe("filtrarTecnicas", () => {
  it("mantém só as técnicas conhecidas, na ordem pedida e sem repetir", () => {
    expect(filtrarTecnicas(["barro", "guache", "barro", "azulejo"])).toEqual(["barro", "azulejo"]);
  });

  it("sem nenhuma técnica conhecida, fica na pintura", () => {
    expect(filtrarTecnicas([])).toEqual(["pintura"]);
    expect(filtrarTecnicas(["aquarela"])).toEqual(["pintura"]);
  });
});

describe("duracaoDaTecnica", () => {
  it("cada técnica fica entre três e quatro segundos", () => {
    expect(DURACAO_MINIMA).toBe(3000);
    expect(DURACAO_MAXIMA).toBe(4000);
    for (let i = 0; i < 40; i++) {
      expect(duracaoDaTecnica(i)).toBeGreaterThanOrEqual(DURACAO_MINIMA);
      expect(duracaoDaTecnica(i)).toBeLessThanOrEqual(DURACAO_MAXIMA);
    }
  });

  it("o ritmo varia de uma troca para outra", () => {
    const duracoes = new Set([0, 1, 2, 3].map(duracaoDaTecnica));
    expect(duracoes.size).toBeGreaterThan(1);
  });
});

describe("proximoIndice", () => {
  it("percorre todas as técnicas e volta à primeira", () => {
    const vistos = [0];
    for (let i = 0; i < 4; i++) vistos.push(proximoIndice(vistos.at(-1)!, 4));
    expect(vistos).toEqual([0, 1, 2, 3, 0]);
  });

  it("com uma técnica só, não troca", () => {
    expect(proximoIndice(0, 1)).toBe(0);
  });
});

describe("tecnicaNoTempo e tempoAteATroca", () => {
  it("troca exatamente ao fim de cada duração, em ciclo", () => {
    const d0 = duracaoDaTecnica(0);
    const ciclo = [0, 1, 2, 3].reduce((soma, i) => soma + duracaoDaTecnica(i), 0);
    expect(tecnicaNoTempo(0, 4)).toBe(0);
    expect(tecnicaNoTempo(d0 - 1, 4)).toBe(0);
    expect(tecnicaNoTempo(d0, 4)).toBe(1);
    expect(tecnicaNoTempo(ciclo, 4)).toBe(0);
    expect(tecnicaNoTempo(ciclo + d0, 4)).toBe(1);
  });

  it("diz quanto falta para a próxima troca", () => {
    const d0 = duracaoDaTecnica(0);
    expect(tempoAteATroca(0, 4)).toBe(d0);
    expect(tempoAteATroca(500, 4)).toBe(d0 - 500);
    expect(tempoAteATroca(d0, 4)).toBe(duracaoDaTecnica(1));
  });

  it("com uma técnica só, nunca troca", () => {
    expect(tecnicaNoTempo(999_999, 1)).toBe(0);
    expect(tempoAteATroca(0, 1)).toBeNull();
  });
});

describe("estadoDoPalco", () => {
  const livre = {
    montado: true,
    movimentoReduzido: false,
    visitantePausou: false,
    abaOculta: false,
    foraDaTela: false,
  };

  it("anda quando nada impede", () => {
    expect(estadoDoPalco(livre)).toEqual({ rodando: true, motivo: null });
  });

  it("fica parado até o JavaScript assumir o palco", () => {
    expect(estadoDoPalco({ ...livre, montado: false })).toEqual({ rodando: false, motivo: "carregando" });
  });

  it("para pelo visitante, pela aba oculta e fora da tela", () => {
    expect(estadoDoPalco({ ...livre, visitantePausou: true })).toEqual({ rodando: false, motivo: "visitante" });
    expect(estadoDoPalco({ ...livre, abaOculta: true })).toEqual({ rodando: false, motivo: "aba-oculta" });
    expect(estadoDoPalco({ ...livre, foraDaTela: true })).toEqual({ rodando: false, motivo: "fora-da-tela" });
  });

  it("movimento reduzido vence qualquer outro motivo", () => {
    const tudo = { montado: true, movimentoReduzido: true, visitantePausou: true, abaOculta: true, foraDaTela: true };
    expect(estadoDoPalco(tudo)).toEqual({ rodando: false, motivo: "movimento-reduzido" });
  });

  it("a pausa do visitante aparece antes da aba oculta e da tela", () => {
    expect(estadoDoPalco({ ...livre, visitantePausou: true, abaOculta: true, foraDaTela: true }).motivo).toBe("visitante");
    expect(estadoDoPalco({ ...livre, abaOculta: true, foraDaTela: true }).motivo).toBe("aba-oculta");
  });
});
