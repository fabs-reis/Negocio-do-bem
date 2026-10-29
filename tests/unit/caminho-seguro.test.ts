import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "@/lib/auth/sessao";

const ORIGEM = "http://origem.invalid";

describe("caminhoSeguro", () => {
  it.each([
    "/",
    "/painel",
    "/painel/meu_negocio",
    "/entrar?voltar=%2Fpainel",
    "/busca?cidade=S%C3%A3o+Paulo&causa=educacao#resultados",
    "/moderacao?aba=empresas&pagina=2",
    "/a/b/../c",
    "/%09/x",
  ])("mantém o caminho interno %j sem mudar", (valor) => {
    expect(caminhoSeguro(valor)).toBe(valor);
  });

  it.each([
    ["TAB", "/\t/destino.invalid"],
    ["LF", "/\n/destino.invalid"],
    ["CR", "/\r/destino.invalid"],
    ["TAB no começo do caminho", "/\tdestino.invalid"],
    ["TAB depois da barra dupla", "/\t/\tdestino.invalid"],
    ["NUL", "/\u0000/destino.invalid"],
    ["US (U+001F)", "/\u001f/destino.invalid"],
    ["DEL (U+007F)", "/\u007f/destino.invalid"],
    ["TAB no fim", "/painel\t"],
    ["barra dupla", "//destino.invalid"],
    ["barra invertida", "/\\destino.invalid"],
    ["sem barra inicial", "destino.invalid"],
    ["URL absoluta", "https://destino.invalid/x"],
    ["esquema javascript", "javascript:alert(1)"],
    ["texto vazio", ""],
  ])("recusa %s e volta ao padrão", (_nome, valor) => {
    expect(caminhoSeguro(valor)).toBe("/");
    expect(caminhoSeguro(valor, "/painel/negocio")).toBe("/painel/negocio");
  });

  it.each([undefined, null, 42, {}, ["/painel"]])("recusa o valor que não é texto %j", (valor) => {
    expect(caminhoSeguro(valor, "/inicio")).toBe("/inicio");
  });

  it("nenhum valor aceito sai da origem depois da interpretação WHATWG", () => {
    const candidatos: string[] = ["/", "/painel", "/a?b=c#d"];
    for (let codigo = 0; codigo < 0x100; codigo++) {
      const c = String.fromCharCode(codigo);
      candidatos.push(`/${c}/destino.invalid`, `/${c}${c}destino.invalid`, `/${c}`);
    }
    for (const valor of candidatos) {
      const aceito = caminhoSeguro(valor, "/padrao");
      expect(new URL(aceito, ORIGEM).origin).toBe(ORIGEM);
    }
  });
});

describe("quem usa o voltar passa por caminhoSeguro", () => {
  const ler = (arquivo: string) => readFileSync(path.resolve(import.meta.dirname, "../..", arquivo), "utf8");

  it("PaginaConta filtra o voltar antes do redirect e do campo oculto", () => {
    const fonte = ler("src/components/PaginaConta.tsx");
    expect(fonte).toMatch(/const voltar = caminhoSeguro\(/);
    expect(fonte).not.toMatch(/redirect\(\s*(?!voltar\b)/);
  });

  it("as ações entrar e cadastrar filtram o voltar antes do redirect", () => {
    const fonte = ler("src/acoes/conta.ts");
    const redirecionamentos = fonte.match(/redirect\([^)]*\)+/g) ?? [];
    expect(redirecionamentos.length).toBeGreaterThanOrEqual(2);
    for (const r of redirecionamentos.filter((x) => x.includes("voltar"))) {
      expect(r).toContain("caminhoSeguro(");
    }
    expect(fonte.match(/redirect\(caminhoSeguro\(texto\(dados, "voltar"\)\)\)/g)).toHaveLength(2);
  });
});
