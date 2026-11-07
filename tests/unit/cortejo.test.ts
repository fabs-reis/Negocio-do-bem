import { describe, expect, it } from "vitest";
import { CAUSAS, GRUPOS } from "@/lib/causas";
import { FAIXAS_DE_CAUSAS, numerosDaInicial, recomendacaoPublica, TINTAS, tintaDoNegocio } from "@/lib/cortejo";

describe("tintaDoNegocio", () => {
  it("dá sempre a mesma tinta para o mesmo @", () => {
    // Valores fixos: a cor de um negócio não muda de uma versão para outra.
    expect(tintaDoNegocio("horta.da.vila")).toBe("azul");
    expect(tintaDoNegocio("doceria.mel")).toBe("rosa");
    expect(tintaDoNegocio("costura.viva")).toBe("amarelo");
    expect(tintaDoNegocio("padaria.florescer")).toBe("verde");
    expect(tintaDoNegocio("atelie.raiz")).toBe("terracota");
    expect(tintaDoNegocio("doceria.mel")).toBe(tintaDoNegocio("doceria.mel"));
  });

  it("usa só as cinco tintas, e cada uma fica com cerca de um quinto dos negócios", () => {
    expect(TINTAS).toEqual(["azul", "rosa", "amarelo", "verde", "terracota"]);
    for (const prefixo of ["negocio", "padaria.", "cafe_do_"]) {
      const contagem = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        const tinta = tintaDoNegocio(`${prefixo}${i}`);
        contagem.set(tinta, (contagem.get(tinta) ?? 0) + 1);
      }
      expect([...contagem.keys()].sort()).toEqual([...TINTAS].sort());
      for (const total of contagem.values()) {
        expect(total).toBeGreaterThanOrEqual(160);
        expect(total).toBeLessThanOrEqual(240);
      }
    }
  });

  it("vale também para um @ vazio ou com acento", () => {
    expect(TINTAS).toContain(tintaDoNegocio(""));
    expect(TINTAS).toContain(tintaDoNegocio("açaí.da.esquina"));
  });
});

describe("FAIXAS_DE_CAUSAS", () => {
  it("tem os três grupos, cada um com a sua tinta", () => {
    expect(FAIXAS_DE_CAUSAS.map((f) => [f.grupo, f.nome, f.tinta])).toEqual([
      ["trabalho", GRUPOS.trabalho, "azul"],
      ["diversidade", GRUPOS.diversidade, "rosa"],
      ["planeta", GRUPOS.planeta, "verde"],
    ]);
  });

  it("traz cada causa uma vez, no seu grupo e na ordem oficial, com o link para a página da causa", () => {
    for (const faixa of FAIXAS_DE_CAUSAS) {
      expect(faixa.causas.map((c) => c.slug)).toEqual(CAUSAS.filter((c) => c.grupo === faixa.grupo).map((c) => c.slug));
    }
    const todas = FAIXAS_DE_CAUSAS.flatMap((f) => f.causas);
    expect(todas).toHaveLength(CAUSAS.length);
    for (const causa of todas) {
      expect(causa.nome).toBe(CAUSAS.find((c) => c.slug === causa.slug)!.nome);
      expect(causa.href).toBe(`/causas/${causa.slug}`);
    }
  });
});

describe("recomendacaoPublica", () => {
  const indicada = { historia: "", motivoIndicacao: "Pão de fermentação natural e gente muito boa.", indicadaPor: { nome: "Ana" } };

  it("mostra o motivo e quem indicou enquanto o dono não escreveu a história", () => {
    expect(recomendacaoPublica(indicada)).toEqual({ motivo: "Pão de fermentação natural e gente muito boa.", indicadoPor: "Ana" });
    expect(recomendacaoPublica({ ...indicada, historia: "  \n\t " })).toEqual({
      motivo: "Pão de fermentação natural e gente muito boa.",
      indicadoPor: "Ana",
    });
  });

  it("some quando o dono escreveu a história", () => {
    expect(recomendacaoPublica({ ...indicada, historia: "Começamos em 2019, no quintal de casa." })).toBeNull();
  });

  it("some sem motivo da indicação", () => {
    expect(recomendacaoPublica({ ...indicada, motivoIndicacao: null })).toBeNull();
    expect(recomendacaoPublica({ ...indicada, motivoIndicacao: "   " })).toBeNull();
  });

  it("sem a conta de quem indicou, mostra só o motivo", () => {
    expect(recomendacaoPublica({ ...indicada, indicadaPor: null })).toEqual({
      motivo: "Pão de fermentação natural e gente muito boa.",
      indicadoPor: null,
    });
  });
});

describe("numerosDaInicial", () => {
  it("mostra o total, as cidades, os indicados e os administrados pelo dono", () => {
    const numeros = numerosDaInicial({ total: 1046, verificados: 702, cidades: 276, estados: 25 });
    expect(numeros).toEqual([
      { valor: "1.046", rotulo: "negócios do bem no diretório", tinta: "verde" },
      { valor: "276", rotulo: "cidades, em 25 estados", tinta: "terracota" },
      { valor: "344", rotulo: "indicados pela comunidade", tinta: "azul" },
      { valor: "702", rotulo: "administrados pelo próprio dono", tinta: "rosa" },
    ]);
  });

  it("indicados e administrados somam o total", () => {
    const resumo = { total: 37, verificados: 12, cidades: 9, estados: 4 };
    const [, , indicados, administrados] = numerosDaInicial(resumo);
    expect(Number(indicados!.valor) + Number(administrados!.valor)).toBe(resumo.total);
  });

  it("usa o singular quando o número é 1", () => {
    const numeros = numerosDaInicial({ total: 2, verificados: 1, cidades: 1, estados: 1 });
    expect(numeros.map((n) => n.rotulo)).toEqual([
      "negócios do bem no diretório",
      "cidade, em 1 estado",
      "indicado pela comunidade",
      "administrado pelo próprio dono",
    ]);
    expect(numerosDaInicial({ total: 1, verificados: 0, cidades: 1, estados: 1 })[0]!.rotulo).toBe("negócio do bem no diretório");
  });

  it("sem negócios no diretório, a faixa não aparece", () => {
    expect(numerosDaInicial({ total: 0, verificados: 0, cidades: 0, estados: 0 })).toEqual([]);
  });
});
