import { describe, expect, it } from "vitest";
import { configuracaoDoBanco } from "@/lib/banco";

const url = "postgresql://localhost/negocio_do_bem_teste";
const primeiro = "11111111-1111-4111-8111-111111111111";
const segundo = "22222222-2222-4222-8222-222222222222";

describe("esquema de preview Cloudflare", () => {
  it("separa dois builds da mesma branch", () => {
    const a = configuracaoDoBanco(url, "preview", primeiro);
    const b = configuracaoDoBanco(url, "preview", segundo);
    expect(a.esquema).toMatch(/^preview_[a-f0-9]{55}$/);
    expect(a.esquema).not.toBe(b.esquema);
    expect(new URL(a.url!).searchParams.get("schema")).toBe(a.esquema);
  });

  it.each([undefined, "", "inválido"])("recusa identidade ausente ou inválida: %s", (id) => {
    expect(() => configuracaoDoBanco(url, "preview", id)).toThrow();
  });
});
