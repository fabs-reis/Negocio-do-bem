import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inicio = readFileSync(new URL("../../src/app/inicio/inicio.css", import.meta.url), "utf8");
const pagina = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");

describe("faixas de causas da página inicial", () => {
  it("o clique do mouse não faz a faixa pular", () => {
    // O clique dá foco ao link. Com :focus-within, a animação saía entre apertar e
    // soltar o botão, o link mudava de lugar e o clique se perdia.
    expect(inicio).not.toMatch(/\.inicio-faixa:focus-within/);
    expect(inicio).toMatch(/\.inicio-faixa:has\(:focus-visible\) \.inicio-letreiroTrilho\s*\{\s*animation: none;/);
  });

  it("a faixa para com o mouse em cima", () => {
    const movendo = inicio.indexOf('.inicio-faixa[data-movendo="sim"] .inicio-letreiroTrilho');
    const parada = inicio.search(/\.inicio-faixa:hover \.inicio-letreiroTrilho\s*\{\s*animation-play-state: paused;/);
    expect(parada).toBeGreaterThan(-1);
    // Mesma especificidade: a pausa precisa vir depois da regra que põe a faixa para andar.
    expect(parada).toBeGreaterThan(movendo);
  });

  it("a cópia do laço também leva à causa, fora do Tab e do leitor de tela", () => {
    const copia = pagina.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/)?.[0];
    expect(copia).toBeDefined();
    expect(copia).not.toMatch(/\binert\b/);
    expect(copia).toMatch(/<Link href=\{causa\.href\} tabIndex=\{-1\}>/);
  });
});

describe("busca da página inicial", () => {
  it("os campos seguem o canto da caixa", () => {
    expect(inicio).toMatch(/\.inicio-busca form\[role="search"\] label\s*\{\s*border-radius: 999px;/);
    expect(inicio).toMatch(/@media \(max-width: 40rem\)[\s\S]*\.inicio-busca form\[role="search"\] label\s*\{\s*border-radius: 0\.8rem;/);
  });
});
