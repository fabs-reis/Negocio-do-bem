import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CortinaDePagina } from "@/components/cortina/CortinaDePagina";

const { efeitos, atualizarFase, navegar } = vi.hoisted(() => ({
  efeitos: [] as (() => void | (() => void))[],
  atualizarFase: vi.fn(),
  navegar: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (efeito: () => void | (() => void)) => { efeitos.push(efeito); },
  useRef: (valor: unknown) => ({ current: valor }),
  useState: (valor: unknown) => [valor, atualizarFase],
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/explorar",
  useRouter: () => ({ push: navegar }),
}));

class Elemento {
  constructor(
    readonly atributos: Record<string, string> = {},
    readonly pai: Elemento | null = null,
    readonly isContentEditable = false,
  ) {}

  get href() { return this.atributos.href; }
  getAttribute(nome: string) { return this.atributos[nome] ?? null; }
  hasAttribute(nome: string) { return nome in this.atributos; }
  closest(seletores: string): Elemento | null {
    const corresponde = seletores.split(",").some((seletor) => {
      const atual = seletor.trim();
      if (atual === "a[href]") return this.hasAttribute("href");
      const atributo = atual.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      return !!atributo && this.hasAttribute(atributo[1]) &&
        (atributo[2] === undefined || this.getAttribute(atributo[1]) === atributo[2]);
    });
    return corresponde ? this : this.pai?.closest(seletores) ?? null;
  }
}

let clicar: (evento: MouseEvent) => void;
let limpar: (() => void)[];

beforeEach(() => {
  vi.useFakeTimers();
  efeitos.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("Element", Elemento);
  vi.stubGlobal("location", { href: "https://exemplo.com/explorar", pathname: "/explorar" });
  vi.stubGlobal("window", { __abertura: "aberta", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("document", {
    addEventListener: vi.fn((tipo: string, listener: (evento: MouseEvent) => void, captura?: boolean) => {
      if (tipo === "click") {
        expect(captura).toBe(true);
        clicar = listener;
      }
    }),
    removeEventListener: vi.fn(),
  });
  CortinaDePagina();
  limpar = efeitos.map((efeito) => efeito()).filter((retorno): retorno is () => void => typeof retorno === "function");
});

afterEach(() => {
  limpar.forEach((funcao) => funcao());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function clique(alvo: Elemento, prevenido = false) {
  const evento = {
    target: alvo,
    button: 0,
    defaultPrevented: prevenido,
    preventDefault: vi.fn(),
  };
  clicar(evento as unknown as MouseEvent);
  return evento;
}

function link(pai: Elemento | null = null, editavel = false, atributos: Record<string, string> = {}) {
  return new Elemento({ href: "https://exemplo.com/sobre", ...atributos }, pai, editavel);
}

describe("interações no handler da cortina", () => {
  it.each(["data-sem-cortina", "inert", "aria-disabled"])("preserva a navegação nativa na região %s", (atributo) => {
    const regiao = new Elemento({ [atributo]: atributo === "aria-disabled" ? "true" : "" });
    const evento = clique(new Elemento({}, link(regiao)));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não intercepta um link editável", () => {
    const evento = clique(link(null, true));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não intercepta conteúdo editável dentro de um link", () => {
    const evento = clique(new Elemento({ contenteditable: "true" }, link(), true));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não intercepta um ícone dentro de conteúdo editável", () => {
    const texto = new Elemento({ contenteditable: "plaintext-only" }, link(), true);
    const evento = clique(new Elemento({}, texto));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("aceita a ilha não editável dentro de uma região editável", () => {
    const regiao = new Elemento({ contenteditable: "true" }, null, true);
    const evento = clique(link(regiao, false, { contenteditable: "false" }));
    expect(evento.preventDefault).toHaveBeenCalledOnce();
    expect(atualizarFase).toHaveBeenCalledWith("fechando");
  });

  it("continua interceptando links comuns e navega ao fim da proteção", () => {
    const evento = clique(new Elemento({}, link()));
    expect(evento.preventDefault).toHaveBeenCalledOnce();
    expect(atualizarFase).toHaveBeenCalledWith("fechando");
    expect(navegar).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(navegar).toHaveBeenCalledExactlyOnceWith("/sobre");
  });

  it("não intercepta evento previamente cancelado", () => {
    const evento = clique(link(), true);
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });
});
