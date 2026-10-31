import { describe, expect, it } from "vitest";
import { configuracaoDoBanco } from "@/lib/banco";

const url = "postgresql://localhost/negocio_do_bem_teste";
const primeiro = "11111111-1111-4111-8111-111111111111";
const segundo = "22222222-2222-4222-8222-222222222222";

describe("esquema de preview Cloudflare", () => {
  it("não usa o esquema público quando apenas o Cloudflare informa o preview", () => {
    const banco = configuracaoDoBanco(url, "preview", primeiro);
    expect(banco.esquema ?? "public").not.toBe("public");
  });

  it("separa dois builds da mesma branch", () => {
    const a = configuracaoDoBanco(url, "preview", primeiro);
    const b = configuracaoDoBanco(url, "preview", segundo);
    expect(a.esquema).toMatch(/^preview_[a-f0-9]{55}$/);
    expect(a.esquema).not.toBe(b.esquema);
    expect(new URL(a.url!).searchParams.get("schema")).toBe(a.esquema);
  });

  it("não mistura identidades de provedores", () => {
    expect(() => configuracaoDoBanco(url, "preview", "dpl_abc", "cloudflare")).toThrow();
    expect(() => configuracaoDoBanco(url, "preview", primeiro, "vercel")).toThrow();
    expect(configuracaoDoBanco(url, "preview", primeiro, "cloudflare").esquema).toMatch(/^preview_/);
    expect(configuracaoDoBanco(url, "preview", "dpl_abc", "vercel").esquema).toMatch(/^preview_/);
  });

  it.each([undefined, "", "inválido"])("recusa identidade ausente ou inválida: %s", (id) => {
    expect(() => configuracaoDoBanco(url, "preview", id)).toThrow();
  });
});
