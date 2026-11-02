import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { personagensDoCortejo, PESSOAS_DO_CORTEJO } from "@/components/cortejo/dados";
import { CLASSES_DO_RIG, ORDEM_DO_CORTEJO, PERSONAGENS } from "@/components/cortejo/personagens";
import { hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";

/** As tags de abertura que têm a classe pedida. */
function tagsComClasse(html: string, classe: string): string[] {
  return [...html.matchAll(/<[a-z]+\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => new RegExp(`class="(?:[^"]* )?${classe}(?: [^"]*)?"`).test(tag));
}

function ids(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
}

function desenhar(id: keyof typeof PERSONAGENS, placa = "COMPRE"): string {
  const { Figura } = PERSONAGENS[id];
  return renderToStaticMarkup(createElement(Figura, { placa }));
}

describe("registro dos personagens", () => {
  it("tem os cinco personagens, na ordem do cortejo", () => {
    expect(ORDEM_DO_CORTEJO).toEqual(["padeira", "costureira", "psicologa", "agricultor", "caramelo"]);
    expect(Object.keys(PERSONAGENS).sort()).toEqual([...ORDEM_DO_CORTEJO].sort());
  });

  it("cada personagem usa o rig do seu corpo", () => {
    expect(PERSONAGENS.padeira.rig).toBe("bipede");
    expect(PERSONAGENS.costureira.rig).toBe("bipede");
    expect(PERSONAGENS.agricultor.rig).toBe("bipede");
    expect(PERSONAGENS.psicologa.rig).toBe("cadeira");
    expect(PERSONAGENS.caramelo.rig).toBe("quadrupede");
  });

  it("os rigs têm as classes do plano", () => {
    expect(CLASSES_DO_RIG.bipede).toEqual(
      expect.arrayContaining(["r-corpo", "r-cabeca", "r-braco-tras", "r-braco-frente", "r-perna-tras", "r-perna-frente", "r-placa"]),
    );
    expect(CLASSES_DO_RIG.cadeira).toEqual(
      expect.arrayContaining(["r-corpo", "r-cabeca", "r-braco-tras", "r-braco-frente", "r-cadeira", "r-roda-tras", "r-roda-frente", "r-placa"]),
    );
    expect(CLASSES_DO_RIG.quadrupede).toEqual(
      expect.arrayContaining(["r-corpo", "r-cabeca", "r-pata-1", "r-pata-2", "r-pata-3", "r-pata-4", "r-rabo"]),
    );
  });
});

describe.each(ORDEM_DO_CORTEJO)("figura %s", (id) => {
  const html = desenhar(id);

  it("desenha cada peça do rig uma vez, como classe, com o seu pivô", () => {
    for (const classe of CLASSES_DO_RIG[PERSONAGENS[id].rig]) {
      const tags = tagsComClasse(html, classe);
      expect(tags, classe).toHaveLength(1);
      expect(tags[0], classe).toMatch(/transform-origin:\s*-?[\d.]+px -?[\d.]+px/);
    }
    expect(html).not.toMatch(/\sid="r-/);
  });

  it("usa a altura comum do palco e fica fora da árvore de acessibilidade", () => {
    const [svg] = html.match(/<svg\b[^>]*>/) ?? [""];
    expect(svg).toMatch(/viewBox="0 0 \d+ 400"/);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain(`class="figura figura-${id} rig-${PERSONAGENS[id].rig}"`);
  });

  it("todo id tem o prefixo da instância e toda referência aponta para um id da própria figura", () => {
    const lista = ids(html);
    expect(lista.length).toBeGreaterThan(0);
    const prefixo = lista[0].split("-")[0];
    for (const i of lista) expect(i.startsWith(`${prefixo}-`)).toBe(true);
    for (const [, alvo] of html.matchAll(/url\(#([^)]+)\)/g)) expect(lista).toContain(alvo);
  });

  it("duas instâncias na mesma página não repetem ids", () => {
    const { Figura } = PERSONAGENS[id];
    const duas = renderToStaticMarkup(
      createElement(Fragment, null, createElement(Figura, { placa: "FAZ" }), createElement(Figura, { placa: "FAZ" })),
    );
    const lista = ids(duas);
    expect(new Set(lista).size).toBe(lista.length);
  });
});

describe.each(ORDEM_DO_CORTEJO.filter((id) => PERSONAGENS[id].rig !== "quadrupede"))("placa de %s", (id) => {
  it("escreve a palavra da prop como texto dentro de r-placa", () => {
    const html = desenhar(id, "DE QUEM");
    const inicio = html.indexOf(tagsComClasse(html, "r-placa")[0]);
    const placa = html.slice(inicio);
    expect(placa).toMatch(/<text\b[^>]*class="[^"]*t-letra/);
    expect(placa).toMatch(/>DE</);
    expect(placa).toMatch(/>QUEM</);
  });
});

describe("caramelo", () => {
  it("não carrega placa", () => {
    expect(desenhar("caramelo")).not.toContain("<text");
  });
});

describe("personagensDoCortejo", () => {
  const lista = personagensDoCortejo({ "Café e padaria": 12, Saúde: 3 });

  it("põe os cinco na ordem do cortejo", () => {
    expect(lista.map((p) => p.id)).toEqual(ORDEM_DO_CORTEJO);
  });

  it("as placas formam a frase", () => {
    const placas = lista.flatMap((p) => ("placa" in p ? [p.placa] : []));
    expect(placas.join(" ")).toBe("COMPRE DE QUEM FAZ O BEM");
  });

  it("cada pessoa leva à página do seu tipo de negócio", () => {
    expect(PESSOAS_DO_CORTEJO.map((p) => p.rotulo)).toEqual(["Café e padaria", "Moda e acessórios", "Saúde", "Mercado e empório"]);
    for (const pessoa of lista) {
      if (!("href" in pessoa)) continue;
      expect(CATEGORIAS).toContain(pessoa.rotulo);
      expect(temPaginaDeTipo(pessoa.rotulo)).toBe(true);
      expect(pessoa.href).toBe(hrefTipo(pessoa.rotulo));
    }
  });

  it("usa a contagem da categoria e zero quando ela falta", () => {
    const totais = Object.fromEntries(lista.flatMap((p) => ("total" in p ? [[p.id, p.total]] : [])));
    expect(totais).toEqual({ padeira: 12, costureira: 0, psicologa: 3, agricultor: 0 });
  });

  it("o caramelo não é link", () => {
    expect(lista.at(-1)).toEqual({ id: "caramelo" });
  });
});
