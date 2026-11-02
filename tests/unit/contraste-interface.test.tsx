import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Placa } from "@/components/cortejo/personagens/base";

const global = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const palco = readFileSync(new URL("../../src/components/cortejo/cortejo.css", import.meta.url), "utf8");
const inicio = readFileSync(new URL("../../src/app/inicio/inicio.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../../src/components/EditorHistoria.tsx", import.meta.url), "utf8");

function cores(texto: string) {
  return Object.fromEntries([...texto.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]));
}
function luminancia(cor: string) {
  const canais = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return canais[0] * 0.2126 + canais[1] * 0.7152 + canais[2] * 0.0722;
}
function contraste(a: string, b: string) {
  const valores = [luminancia(a), luminancia(b)].sort((x, y) => x - y);
  return (valores[1] + 0.05) / (valores[0] + 0.05);
}

const claro = cores(global.match(/@theme static \{([\s\S]*?)\n\}/)![1]);
const escuro = { ...claro, ...cores(global.match(/\[data-tema="escuro"\] \{([\s\S]*?)\n\}/)![1]) };

describe("contraste dos controles", () => {
  for (const [tema, paleta] of [["claro", claro], ["escuro", escuro]] as const) {
    for (const fundo of ["papel", "superficie"]) {
      it(`a borda do campo contrasta com ${fundo} no tema ${tema}`, () => {
        const campo = global.match(/\.campo\s*\{([\s\S]*?)\}/)![1];
        const borda = campo.includes("border-borda-controle") ? paleta["borda-controle"] : paleta.linha;
        expect(contraste(borda, paleta[fundo])).toBeGreaterThanOrEqual(3);
      });
    }
  }
  it("o foco dos botões preenchidos não herda a cor do texto", () => {
    expect(inicio).toMatch(/\.inicio-busca button:focus-visible,[\s\S]*?\.inicio-cortejo \.inicio-botaoConvite:focus-visible\s*\{\s*outline-color: var\(--color-azul-texto\)/);
    for (const paleta of [claro, escuro]) for (const fundo of ["papel", "superficie"]) expect(contraste(paleta["azul-texto"], paleta[fundo])).toBeGreaterThanOrEqual(3);
  });
  it("o seletor de estilo do editor usa a borda funcional", () => {
    expect(editor.match(/<select[\s\S]*?<\/select>/)![0]).toContain("border-borda-controle");
  });
  it("separa a borda funcional das linhas decorativas", () => {
    expect(global.match(/\.campo\s*\{([\s\S]*?)\}/)![1]).toContain("border-borda-controle");
    expect(claro["borda-controle"]).not.toBe(claro.linha);
  });
});

describe("leitura das placas nas técnicas texturizadas", () => {
  it("mantém uma superfície de leitura entre as fibras e as letras", () => {
    const html = renderToStaticMarkup(<svg><Placa p="teste-placa" x={20} y={20} largura={160} altura={90} palavra="DE QUEM" /></svg>);
    expect(html).toContain('class="t-placa-leitura"');
    expect(html.indexOf('class="t-placa-leitura"')).toBeGreaterThan(html.indexOf('class="t-placa-fibra"'));
    expect(html.indexOf('class="t-placa-leitura"')).toBeLessThan(html.indexOf('class="t-letra cortejo-letra"'));
  });
  for (const tecnica of ["xilogravura", "barro"]) {
    it(`as letras de ${tecnica} contrastam com a área de leitura`, () => {
      const regra = palco.match(new RegExp(`\\.cortejo\\.${tecnica} \\.figura \\{([\\s\\S]*?)\\n\\}`))![1];
      const letra = regra.match(/--letra-da-tecnica:\s*(#[\da-f]{6})/i)?.[1];
      const fundo = regra.match(/--placa-leitura-fundo:\s*(#[\da-f]{6})/i)?.[1];
      expect(letra).toBeDefined();
      expect(fundo).toBeDefined();
      expect(contraste(letra!, fundo!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
