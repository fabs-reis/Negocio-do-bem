import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cortejo } from "@/components/cortejo/Cortejo";
import { PERSONAGENS_DO_CORTEJO } from "@/components/cortejo/dados";

// O HTML que o servidor manda: o que aparece sem JavaScript e o que o leitor de tela lê.
const html = renderToStaticMarkup(
  createElement(Cortejo, {
    personagens: PERSONAGENS_DO_CORTEJO,
    tecnicas: ["pintura", "xilogravura", "barro", "azulejo"],
  }),
);

function links(): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
}

describe("ciclos gerados", () => {
  it("o gerador de scripts reproduz o CSS do cortejo", () => {
    const script = fileURLToPath(new URL("../../scripts/gerar-ciclos.mjs", import.meta.url));
    const css = readFileSync(new URL("../../src/components/cortejo/ciclos.css", import.meta.url), "utf8");
    expect(execFileSync(process.execPath, [script], { encoding: "utf8" })).toBe(css);
  });
});

describe("Cortejo no servidor", () => {
  it("as figuras não levam a nenhuma categoria nem mostram contagem", () => {
    // A ligação entre a figura e a categoria era arbitrária (#278).
    expect(links()).toEqual([]);
    expect(html).not.toContain("/tipos/");
    expect(html).not.toContain("cortejo-etiqueta");
    expect(html).not.toMatch(/\d+ negócios?</);
  });

  it("o palco fica fora do leitor de tela, porque as placas repetem o título", () => {
    expect(html).toMatch(/<ul class="cortejo-fila" aria-hidden="true">/);
  });

  it("começa parado, na primeira técnica, até o JavaScript assumir", () => {
    expect(html).toMatch(/class="cortejo pintura[^"]*"/);
    expect(html).toContain('data-estado="parado"');
    expect(html).toContain('data-motivo="carregando"');
  });

  it("traz o controle de pausa, escondido até o JavaScript assumir (sem ele, o botão não faria nada)", () => {
    const [botao] = html.match(/<button\b[^>]*>/) ?? [""];
    expect(botao).toContain('type="button"');
    expect(botao).toMatch(/\shidden(=""|\s|>)/);
    expect(html).toContain("Pausar animações");
  });

  it("troca de técnica sem mostrar o nome dela", () => {
    // As etiquetas "pintura", "xilogravura", "barro" e "azulejo" saíram do controle (#278).
    expect(html).not.toContain("cortejo-tecnicas");
    const controle = html.slice(html.indexOf('class="cortejo-controle"'));
    for (const tecnica of ["pintura", "xilogravura", "barro", "azulejo"]) expect(controle).not.toContain(`>${tecnica}<`);
  });
});
