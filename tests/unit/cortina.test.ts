import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { destinoDaBusca, proximaFaseCortina, type BuscaDaCortina } from "@/lib/cortina";

const busca = (mudanca: Partial<BuscaDaCortina> = {}): BuscaDaCortina => ({
  atual: "https://exemplo.com/",
  acao: "https://exemplo.com/explorar",
  campos: [["q", "padaria"], ["onde", "recife-pe"]],
  ...mudanca,
});

describe("destinoDaBusca", () => {
  it("leva a busca da inicial ao Explorar com os mesmos campos do formulário", () => {
    expect(destinoDaBusca(busca())).toEqual({ href: "/explorar?q=padaria&onde=recife-pe" });
  });

  it("mantém campos vazios, como o navegador faria", () => {
    expect(destinoDaBusca(busca({ campos: [["q", "brechó"], ["onde", ""]] }))).toEqual({ href: "/explorar?q=brech%C3%B3&onde=" });
  });

  it("cobre uma nova busca dentro do próprio Explorar", () => {
    const destino = destinoDaBusca(busca({ atual: "https://exemplo.com/explorar?q=pao", campos: [["q", "bolo"]] }));
    expect(destino).toEqual({ href: "/explorar?q=bolo" });
  });

  it("reconhece a mesma busca mesmo com outra codificação na barra de endereço", () => {
    expect(destinoDaBusca(busca({ atual: "https://exemplo.com/explorar?q=a%20b", campos: [["q", "a b"]] }))).toBeNull();
  });

  it.each([
    { atual: "https://exemplo.com/explorar?q=padaria&onde=recife-pe" },
    { acao: "https://outro.com/explorar" },
    { acao: "javascript:alert(1)" },
    { acao: "nao é url", atual: "também não" },
  ])("mantém o envio nativo para %j", (mudanca) => {
    expect(destinoDaBusca(busca(mudanca))).toBeNull();
  });
});

describe("abertura pulada", () => {
  it("reinicia a saída do contêiner sem aproveitar o tempo da abertura normal", () => {
    const css = readFileSync(new URL("../../src/components/cortina/cortina.css", import.meta.url), "utf8");
    const pulada = css.match(/html\[data-abertura="pulada"\] \.cortina-abertura \{([^}]+)\}/)![1];
    expect(pulada).toContain("animation: cortina-abertura-pula-finaliza 1ms linear 550ms both");
    expect(css).toContain("@keyframes cortina-abertura-pula-finaliza");
  });
});

describe("proximaFaseCortina", () => {
  it("só troca de página depois de cobrir e só termina depois de revelar", () => {
    expect(proximaFaseCortina("oculta", "iniciar")).toBe("fechando");
    expect(proximaFaseCortina("fechando", "cobrir")).toBe("coberta");
    expect(proximaFaseCortina("coberta", "revelar")).toBe("abrindo");
    expect(proximaFaseCortina("abrindo", "terminar")).toBe("oculta");
  });

  it("não pula etapas nem reinicia uma transição ocupada", () => {
    expect(proximaFaseCortina("fechando", "revelar")).toBe("fechando");
    expect(proximaFaseCortina("coberta", "iniciar")).toBe("coberta");
    expect(proximaFaseCortina("oculta", "terminar")).toBe("oculta");
  });

  it.each(["oculta", "fechando", "coberta", "abrindo"] as const)("cancelar libera a fase %s", (fase) => {
    expect(proximaFaseCortina(fase, "cancelar")).toBe("oculta");
  });
});
