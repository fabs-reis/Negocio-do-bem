import { describe, expect, it } from "vitest";
import { linhasDaPlaca, medidasDaPlaca, rotuloDoLink, textoDoTotal } from "@/components/cortejo/rotulos";

describe("rotuloDoLink", () => {
  it("diz para onde o link leva, com o tipo de negócio em minúscula", () => {
    expect(rotuloDoLink("Café e padaria")).toBe("Ver negócios de café e padaria");
    expect(rotuloDoLink("Moda e acessórios")).toBe("Ver negócios de moda e acessórios");
    expect(rotuloDoLink("Saúde")).toBe("Ver negócios de saúde");
    expect(rotuloDoLink("Mercado e empório")).toBe("Ver negócios de mercado e empório");
  });
});

describe("textoDoTotal", () => {
  it("conta os negócios em português", () => {
    expect(textoDoTotal(0)).toBe("Nenhum negócio ainda");
    expect(textoDoTotal(1)).toBe("1 negócio");
    expect(textoDoTotal(12)).toBe("12 negócios");
    expect(textoDoTotal(1234)).toBe("1.234 negócios");
  });
});

describe("linhasDaPlaca", () => {
  it("palavras curtas ficam numa linha só", () => {
    expect(linhasDaPlaca("COMPRE")).toEqual(["COMPRE"]);
    expect(linhasDaPlaca("FAZ")).toEqual(["FAZ"]);
    expect(linhasDaPlaca("O BEM")).toEqual(["O BEM"]);
  });

  it("uma frase longa quebra nos espaços", () => {
    expect(linhasDaPlaca("DE QUEM")).toEqual(["DE", "QUEM"]);
  });

  it("limpa os espaços e põe em maiúsculas", () => {
    expect(linhasDaPlaca("  faz  ")).toEqual(["FAZ"]);
    expect(linhasDaPlaca("   ")).toEqual([]);
  });
});

describe("medidasDaPlaca", () => {
  const area = { largura: 140, altura: 72 };

  it("nenhuma linha passa da largura da placa", () => {
    for (const placa of ["COMPRE", "DE QUEM", "FAZ", "O BEM", "PALAVRAMUITOLONGA"]) {
      const medidas = medidasDaPlaca(linhasDaPlaca(placa), area);
      for (const linha of medidas.linhas) expect(linha.comprimento).toBeLessThanOrEqual(area.largura);
    }
  });

  it("as linhas cabem na altura da placa", () => {
    for (const placa of ["COMPRE", "DE QUEM", "FAZ"]) {
      const medidas = medidasDaPlaca(linhasDaPlaca(placa), area);
      expect(medidas.tamanho * medidas.linhas.length * 0.92).toBeLessThanOrEqual(area.altura);
    }
  });

  it("palavra curta não estica até a borda", () => {
    const [linha] = medidasDaPlaca(["FAZ"], area).linhas;
    expect(linha.comprimento).toBeLessThan(area.largura * 0.8);
  });

  it("as linhas ficam centradas na vertical, em ordem", () => {
    const { linhas } = medidasDaPlaca(["DE", "QUEM"], area);
    expect(linhas[0].y).toBeLessThan(linhas[1].y);
    expect((linhas[0].y + linhas[1].y) / 2).toBeCloseTo(area.altura / 2, 0);
  });

  it("sem linhas, não desenha nada", () => {
    expect(medidasDaPlaca([], area).linhas).toEqual([]);
  });
});
