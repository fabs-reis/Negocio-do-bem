import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumoRevisaoServico, type ServicoParaRevisao } from "@/app/moderacao/servicos/ResumoRevisaoServico";

const exemplo: ServicoParaRevisao = {
  categoria: "Tecnologia",
  cidade: "Recife",
  uf: "PE",
  remoto: false,
  presencial: true,
  precoReferencia: "R$ 250",
  areasAtendimento: [{ cidade: "Olinda", uf: "PE" }],
  perfil: {
    nomePublico: "Profissional de tecnologia",
    site: "https://portfolio.example.test/",
    emailContato: "contato@example.test",
  },
  empresa: null,
};

describe("revisão de anúncios de serviços", () => {
  it("separa origem e municípios atendidos e permite conferir os contatos profissionais", () => {
    const html = renderToStaticMarkup(<ResumoRevisaoServico servico={exemplo} />);
    expect(html).toContain("Origem do prestador");
    expect(html).toContain("Recife, PE");
    expect(html).toContain("Municípios atendidos presencialmente");
    expect(html).toContain("Olinda, PE");
    expect(html).toContain('href="https://portfolio.example.test/"');
    expect(html).toContain('href="mailto:contato@example.test"');
    expect(html).not.toContain("dados da conta pessoal");
  });

  it("mostra a empresa sem expor um contato privado nem abrir URL maliciosa", () => {
    const empresa = renderToStaticMarkup(<ResumoRevisaoServico servico={{
      ...exemplo,
      remoto: true,
      presencial: false,
      areasAtendimento: [],
      perfil: null,
      empresa: { nome: "Negócio", instagramUsername: "negocio.exemplo" },
    }} />);
    expect(empresa).toContain('href="/empresas/negocio.exemplo"');
    expect(empresa).not.toContain("contato@example.test");
    expect(empresa).toContain("Não se aplica");

    const inseguro = renderToStaticMarkup(<ResumoRevisaoServico servico={{
      ...exemplo,
      perfil: { ...exemplo.perfil!, site: "javascript:alert(1)" },
    }} />);
    expect(inseguro).not.toContain('href="javascript:');
  });
});

describe("contenção de textos longos no catálogo", () => {
  it("protege títulos, preços e áreas contra palavras sem espaços", () => {
    const codigo = readFileSync(resolve(process.cwd(), "src/app/servicos/page.tsx"), "utf8");
    expect(codigo).toMatch(/<h3 className="[^"]*min-w-0[^"]*\[overflow-wrap:anywhere\][^"]*">\{servico\.titulo\}<\/h3>/);
    expect(codigo).toMatch(/\[overflow-wrap:anywhere\]">\{servico\.precoReferencia \|\| "Valor a combinar"\}/);
    expect(codigo).toContain("flex-wrap items-center gap-1.5 rounded-full bg-papel");
  });
});
