import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmpresaCard } from "@/components/EmpresaCard";
import { EmpresaLinha } from "@/components/EmpresaLinha";

const negocio = {
  id: "empresa-recife",
  instagramUsername: "padaria-recife",
  nome: "Padaria Recife",
  fotoUrl: null,
  resumo: "Pães da comunidade",
  categoria: "Padaria",
  cidade: "Recife",
  uf: "PE",
  status: "indicada",
  causas: [],
  _count: { depoimentos: 0 },
  recomendacao: { motivo: "Pães feitos com cuidado", indicadoPor: "Ana" },
};

describe("cartão do negócio", () => {
  it("preserva o endereço sem apresentá-lo como Instagram e mostra a recomendação", () => {
    const html = renderToStaticMarkup(<EmpresaCard empresa={negocio} />);
    expect(html).toContain('href="/empresas/padaria-recife"');
    expect(html).not.toContain("@padaria-recife");
    expect(html).toContain("Pães feitos com cuidado");
    expect(html).toContain("Ana");
  });

  it("identifica o Instagram quando o endereço é um usuário", () => {
    const html = renderToStaticMarkup(<EmpresaCard empresa={{ ...negocio, instagramUsername: "padaria.recife" }} />);
    expect(html).toContain('href="/empresas/padaria.recife"');
    expect(html).toContain("@padaria.recife");
  });

  const logado = { empresaId: "empresa-recife", logado: true, favorito: false, voltar: "/explorar" };
  const deslogado = { ...logado, logado: false };
  const apresentacoes = [
    ["EmpresaCard", (extra: object, favorito?: typeof logado) => <EmpresaCard empresa={{ ...negocio, ...extra }} favorito={favorito} />],
    ["EmpresaLinha", (extra: object, favorito?: typeof logado) => <EmpresaLinha empresa={{ ...negocio, ...extra }} favorito={favorito} />],
  ] as const;

  for (const [nome, desenhar] of apresentacoes) {
    describe(nome, () => {
      it("sem favorito, não desenha o coração", () => {
        const html = renderToStaticMarkup(desenhar({}));
        expect(html).not.toContain("favoritar");
        expect(html).not.toContain("<form");
        expect(html).not.toContain("<button");
      });

      it("mostra o coração de quem entrou, fora de todo link", () => {
        const html = renderToStaticMarkup(desenhar({}, logado));
        expect(html).toContain('aria-label="Favoritar Padaria Recife"');
        expect(html).toMatch(/<form/);
        expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<(?:form|button)/);
      });

      it("mostra o link de entrada de quem não entrou, fora de todo link", () => {
        const html = renderToStaticMarkup(desenhar({}, deslogado));
        expect(html).toContain('aria-label="Entre para favoritar Padaria Recife"');
        // Cada <a> se fecha antes de o próximo abrir: nenhum link fica dentro de outro.
        expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /);
      });

      it("mostra o selo de cupom só quando há oferta valendo", () => {
        expect(renderToStaticMarkup(desenhar({ ofertas: [{ id: "oferta-1" }] }))).toContain("🎟️ Cupom");
        expect(renderToStaticMarkup(desenhar({ ofertas: [] }))).not.toContain("🎟️ Cupom");
        expect(renderToStaticMarkup(desenhar({}))).not.toContain("🎟️ Cupom");
      });
    });
  }
});
