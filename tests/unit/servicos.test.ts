import { describe, expect, it } from "vitest";
import {
  buscaServico, esquemaModeracaoServico, esquemaPerfilProfissional, esquemaServico,
  numeroPagina, limitarPagina, idServicoValido,
} from "@/lib/servicos";
import { estadoAposDecisao, estadoAposRevisao } from "@/lib/servicos/transicoes";

const modelo = {
  prestador: "profissional",
  titulo: "Desenvolvimento web",
  descricao: "Criação de sites responsivos para pequenos negócios.",
  categoria: "Tecnologia",
  remoto: true, presencial: false, precoReferencia: "", areasAtendimento: "",
};

describe("validação de serviços", () => {
  it("normaliza preço vazio", () => {
    expect(esquemaServico.parse(modelo).precoReferencia).toBeNull();
  });
  it("rejeita prestador ou categoria inválidos", () => {
    expect(esquemaServico.safeParse({ ...modelo, prestador: "terceiro" }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...modelo, categoria: "Inventada" }).success).toBe(false);
  });
  it("obriga empresa a ter identificador e uma modalidade", () => {
    expect(esquemaServico.safeParse({ ...modelo, prestador: "empresa" }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...modelo, remoto: false }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...modelo, prestador: "empresa", empresaId: "empresa1" }).success).toBe(true);
  });
  it("valida municípios de atendimento e elimina duplicidades", () => {
    const validado = esquemaServico.parse({
      ...modelo, presencial: true, areasAtendimento: "Recife, PE\nOlinda, PE\nRecife, PE",
    });
    expect(validado.areasAtendimento).toEqual([
      { cidade: "Recife", uf: "PE" }, { cidade: "Olinda", uf: "PE" },
    ]);
    expect(esquemaServico.safeParse({ ...modelo, presencial: true }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...modelo, areasAtendimento: "Cidade inventada, PE" }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...modelo, areasAtendimento: Array(11).fill("Recife, PE").join("\n") }).success).toBe(false);
  });
  it("proíbe identificar empresa num serviço pessoal", () => {
    expect(esquemaServico.safeParse({ ...modelo, empresaId: "empresa1" }).success).toBe(false);
  });
  it("exige contato para publicar o perfil", () => {
    const perfil = {
      nomePublico: "Pessoa Prestadora", apresentacao: "Trabalho com serviços de tecnologia.",
      municipio: "Recife, PE", remoto: true, presencial: false,
      emailContato: "", site: "", publicado: true,
    };
    expect(esquemaPerfilProfissional.safeParse(perfil).success).toBe(false);
    expect(esquemaPerfilProfissional.safeParse({ ...perfil, publicado: false }).success).toBe(true);
    expect(esquemaPerfilProfissional.safeParse({ ...perfil, emailContato: "contato@example.com" }).success).toBe(true);
  });
  it("exige motivo de rejeição suficientemente claro", () => {
    expect(esquemaModeracaoServico.safeParse({ decisao: "rejeitar", motivo: "x" }).success).toBe(false);
    expect(esquemaModeracaoServico.safeParse({ decisao: "rejeitar", motivo: "Conteúdo incompleto no anúncio." }).success).toBe(true);
    expect(esquemaModeracaoServico.safeParse({ decisao: "suspender", motivo: "x" }).success).toBe(false);
    expect(esquemaModeracaoServico.safeParse({ decisao: "suspender", motivo: "Violação das regras de publicação." }).success).toBe(true);
  });
  it("controla os estados do anúncio", () => {
    expect(estadoAposRevisao()).toBe("pendente");
    expect(estadoAposDecisao("pendente", "aprovar")).toBe("publicado");
    expect(estadoAposDecisao("publicado", "rejeitar")).toBeNull();
    expect(estadoAposDecisao("publicado", "suspender")).toBe("suspenso");
    expect(estadoAposDecisao("pendente", "suspender")).toBeNull();
  });
  it("não repete a última página da busca", () => {
    expect(numeroPagina("999999")).toBe(500);
    expect(numeroPagina("1abc")).toBe(1);
    expect(limitarPagina(100, 19)).toEqual({ pagina: 2, paginas: 2 });
    expect(limitarPagina(500, 0)).toEqual({ pagina: 1, paginas: 1 });
  });
  it("normaliza os termos buscados", () => {
    expect(buscaServico({ titulo: "Criação", descricao: "Páginas", categoria: "Tecnologia" }))
      .toBe("criacao paginas tecnologia");
    expect(idServicoValido("../123")).toBe(false);
  });
});
