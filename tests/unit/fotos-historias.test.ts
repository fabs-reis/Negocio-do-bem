import { describe, expect, it } from "vitest";
import { fotosDaHistoria, identidadeDaFoto } from "@/lib/fotos-historias";

const FOTO = "https://cicloteste.public.blob.vercel-storage.com/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";

describe("referências das fotos", () => {
  it.each([
    `![Foto](${FOTO})`,
    `![Foto](<${FOTO}>)`,
    `![Foto][imagem]\n\n[imagem]: ${FOTO}?x=1&amp;y=2#legenda "Legenda"`,
    `[Arquivo](${FOTO}#arquivo)`,
    `<${FOTO}>`,
    `![Foto](${FOTO.replace("/aaaaaaaa", "/%61aaaaaaa")})`,
    `![Foto](${FOTO}?x=%)`,
    `![Foto](${FOTO}?x=..)`,
    `![Foto](${FOTO.replace("https://", "https://usuario@")})`,
    `![Foto](${FOTO.replace(".com/", ".com:444/")})`,
    `![Foto](${FOTO.replace("/historias/", "/perfis/../historias/")})`,
    `[reservada]: ${FOTO}`,
  ])("encontra a mesma identidade em Markdown: %s", (historia) => {
    expect([...fotosDaHistoria(historia)]).toEqual([FOTO]);
  });

  it("normaliza uma foto local sem confundir perfil e história", () => {
    const local = "/enviados/perfis/bbbbbbbbbbbbbbbbbbbbbbbb.webp";
    expect(identidadeDaFoto(`${local}?cache=1#foto`)).toBe(local);
    expect([...fotosDaHistoria(`![Foto](${local})`)]).toEqual([local]);
  });

  it.each([
    "/enviados/historias/../perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "/enviados/historias/%2e%2e/perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "/enviados/historias/%252e%252e/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "/enviados/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg\\outra",
    "https://outro-site.example/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "https://cicloteste.public.blob.vercel-storage.com:444/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "https://usuario@cicloteste.public.blob.vercel-storage.com/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "/enviados/historias/nome-fora-do-padrao.jpg",
  ])("recusa identidade ambígua ou não administrada: %s", (valor) => {
    expect(identidadeDaFoto(valor)).toBeNull();
  });

  it("não interpreta exemplos de código como fotos usadas", () => {
    expect([...fotosDaHistoria(`\`![Exemplo](${FOTO})\``)]).toEqual([]);
  });
});
