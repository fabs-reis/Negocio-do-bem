import { describe, expect, it } from "vitest";
import { configuracaoDoBanco } from "@/lib/banco";

const url = "postgresql://localhost/negocio_do_bem_test?schema=public&connection_limit=2";

describe("configuração do banco de preview", () => {
  it("seleciona um esquema estável por deployment", () => {
    const primeiro = configuracaoDoBanco(url, "preview", "dpl_Primeiro123", "vercel");
    const repetido = configuracaoDoBanco(url, "preview", "dpl_Primeiro123", "vercel");
    const outro = configuracaoDoBanco(url, "preview", "dpl_Segundo456", "vercel");

    expect(primeiro).toEqual(repetido);
    expect(primeiro.esquema).toMatch(/^preview_[a-f0-9]{55}$/);
    expect(primeiro.esquema).not.toBe(outro.esquema);
    expect(primeiro.esquema).toHaveLength(63);
    expect(new URL(primeiro.url!).searchParams.get("schema")).toBe(primeiro.esquema);
    expect(new URL(primeiro.url!).searchParams.get("connection_limit")).toBe("2");
  });

  it("seleciona o mesmo esquema nas conexões direta e normal", () => {
    const normal = configuracaoDoBanco(url, "preview", "dpl_Primeiro123", "vercel");
    const direta = configuracaoDoBanco("postgresql://direto/negocio_do_bem_test", "preview", "dpl_Primeiro123", "vercel");
    expect(normal.esquema).toBe(direta.esquema);
    expect(new URL(direta.url!).hostname).toBe("direto");
  });

  it.each([undefined, "", " ", "dpl_", "outro_formato", "dpl_id com espaço"])("recusa preview com identidade inválida: %s", (id) => {
    expect(() => configuracaoDoBanco(url, "preview", id)).toThrow("VERCEL_DEPLOYMENT_ID");
  });

  it.each([undefined, "", "não é uma URL", "https://banco.example.test/"])("recusa preview sem conexão PostgreSQL válida", (conexao) => {
    expect(() => configuracaoDoBanco(conexao, "preview", "dpl_Primeiro123", "vercel")).toThrow("DATABASE_URL");
  });

  it.each([undefined, "development", "production"])("preserva a URL fora de preview: %s", (ambiente) => {
    expect(configuracaoDoBanco(url, ambiente, undefined)).toEqual({ url, esquema: "public" });
    expect(configuracaoDoBanco(undefined, ambiente, undefined)).toEqual({ url: undefined, esquema: undefined });
  });

  it("respeita o esquema explícito de desenvolvimento sem reescrever a URL", () => {
    const conexao = new URL(url);
    conexao.searchParams.set("schema", 'local"teste');
    expect(configuracaoDoBanco(conexao.toString(), "development", undefined)).toEqual({
      url: conexao.toString(),
      esquema: 'local"teste',
    });
  });

  it("não expõe uma conexão inválida na mensagem", () => {
    try {
      configuracaoDoBanco("conexao-invalida-da-fixture", "preview", "dpl_Primeiro123", "vercel");
      expect.fail("A conexão inválida deveria ser recusada.");
    } catch (erro) {
      expect(String(erro)).not.toContain("conexao-invalida-da-fixture");
    }
  });
});
