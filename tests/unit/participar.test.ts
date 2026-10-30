import { describe, expect, it } from "vitest";
import { boaCompanhia, decidirProcura } from "@/app/participar/procura";
import { caminhoSeguro } from "@/lib/auth/sessao";

const NO_DIRETORIO = { moderacao: "aprovada", oculta: false, donos: 0 };

describe("decidirProcura", () => {
  it("negócio que ainda não está aqui: vai para a indicação, já marcado como seu", () => {
    expect(decidirProcura("padaria.flor", null, true)).toEqual({
      caso: "indicar",
      destino: "/indicar?instagram=padaria.flor&dono=sim",
    });
  });

  it("sem conta, cria a conta antes e volta para a indicação com o @", () => {
    const { caso, destino } = decidirProcura("padaria.flor", null, false);

    expect(caso).toBe("indicar");
    const url = new URL(destino, "https://exemplo.org");
    expect(url.pathname).toBe("/cadastrar");
    // O cadastro aceita o voltar com a busca inteira.
    expect(caminhoSeguro(url.searchParams.get("voltar"))).toBe("/indicar?instagram=padaria.flor&dono=sim");
  });

  it("no diretório e sem dono: confirma que é seu, na própria página", () => {
    expect(decidirProcura("padaria.flor", NO_DIRETORIO, false)).toEqual({
      caso: "confirmar",
      destino: "/participar?instagram=padaria.flor#resultado",
    });
  });

  it("no diretório e com dono: pede revisão", () => {
    expect(decidirProcura("padaria.flor", { ...NO_DIRETORIO, donos: 2 }, true)).toEqual({
      caso: "revisao",
      destino: "/participar?instagram=padaria.flor#resultado",
    });
  });

  it.each([
    ["tirado do ar sem dono", { ...NO_DIRETORIO, moderacao: "rejeitada" }],
    ["tirado do ar com dono", { ...NO_DIRETORIO, moderacao: "rejeitada", donos: 1 }],
    ["esperando a moderação", { ...NO_DIRETORIO, moderacao: "pendente" }],
    ["oculto pelo dono", { ...NO_DIRETORIO, oculta: true, donos: 1 }],
  ])("fora do diretório (%s): a mesma resposta, sem dizer o motivo", (_, negocio) => {
    expect(decidirProcura("padaria.flor", negocio, true)).toEqual({
      caso: "indisponivel",
      destino: "/participar?instagram=padaria.flor#resultado",
    });
  });
});

describe("boaCompanhia", () => {
  it("usa o singular quando é um só", () => {
    expect(boaCompanhia(1, 1)).toBe("Você vai estar em boa companhia: 1 negócio em 1 cidade.");
  });

  it("usa o plural e o separador de milhar", () => {
    expect(boaCompanhia(1234, 5)).toBe("Você vai estar em boa companhia: 1.234 negócios em 5 cidades.");
  });
});
