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
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: navegar }),
}));

class Formulario {
  constructor(
    readonly atributos: Record<string, string>,
    readonly campos: [string, string][] = [["q", "padaria"], ["onde", ""]],
  ) {}

  get action() { return this.atributos.action; }
  hasAttribute(nome: string) { return nome in this.atributos; }
}

let ouvintes: Record<string, (evento: Event) => void>;
let limpar: (() => void)[];
let movimentoReduzido: boolean;

beforeEach(() => {
  vi.useFakeTimers();
  efeitos.length = 0;
  ouvintes = {};
  movimentoReduzido = false;
  vi.clearAllMocks();
  vi.stubGlobal("HTMLFormElement", Formulario);
  vi.stubGlobal("FormData", class { constructor(readonly formulario: Formulario) {} [Symbol.iterator]() { return this.formulario.campos[Symbol.iterator](); } });
  vi.stubGlobal("location", { href: "https://exemplo.com/", pathname: "/", search: "" });
  vi.stubGlobal("window", { __abertura: "aberta", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("matchMedia", () => ({ get matches() { return movimentoReduzido; }, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("document", {
    addEventListener: vi.fn((tipo: string, listener: (evento: Event) => void, captura?: boolean) => {
      if (tipo === "submit") expect(captura).toBe(true);
      ouvintes[tipo] = listener;
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

function enviar(formulario: Formulario, prevenido = false) {
  const evento = { target: formulario, submitter: null, defaultPrevented: prevenido, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  ouvintes.submit(evento as unknown as Event);
  return evento;
}

const busca = (atributos: Record<string, string> = {}) =>
  new Formulario({ action: "https://exemplo.com/explorar", "data-cortina": "", ...atributos });

describe("cortina só na busca", () => {
  it("cobre a busca marcada e navega para o resultado ao fim da proteção", () => {
    const evento = enviar(busca());
    expect(evento.preventDefault).toHaveBeenCalledOnce();
    expect(atualizarFase).toHaveBeenCalledWith("fechando");
    expect(navegar).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(navegar).toHaveBeenCalledExactlyOnceWith("/explorar?q=padaria&onde=");
  });

  it("segura o envio para o Form do Next não navegar antes de a cortina cobrir", () => {
    // O <Form> do Next ignora preventDefault quando não tem onSubmit próprio.
    const evento = enviar(busca());
    expect(evento.stopPropagation).toHaveBeenCalledOnce();
  });

  it("não segura um envio que a cortina não cobre", () => {
    const evento = enviar(new Formulario({ action: "https://exemplo.com/explorar" }));
    expect(evento.stopPropagation).not.toHaveBeenCalled();
  });

  it("Escape durante o fechamento pula a cortina, mas preserva a busca enviada", () => {
    const evento = enviar(busca());
    expect(evento.preventDefault).toHaveBeenCalledOnce();
    expect(navegar).not.toHaveBeenCalled();

    ouvintes.keydown({ key: "Escape" } as unknown as Event);

    expect(atualizarFase).toHaveBeenCalledWith("oculta");
    expect(navegar).toHaveBeenCalledExactlyOnceWith("/explorar?q=padaria&onde=");
    vi.runAllTimers();
    expect(navegar).toHaveBeenCalledTimes(1);
  });

  it("Escape sem busca pendente não inicia navegação", () => {
    ouvintes.keydown({ key: "Escape" } as unknown as Event);
    expect(navegar).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não escuta cliques em links: a navegação comum segue sem cortina", () => {
    expect(ouvintes.click).toBeUndefined();
  });

  it("deixa nativo um formulário sem data-cortina", () => {
    const evento = enviar(new Formulario({ action: "https://exemplo.com/explorar" }));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não intercepta um envio já cancelado", () => {
    const evento = enviar(busca(), true);
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não cobre a busca com menos movimento", () => {
    movimentoReduzido = true;
    const evento = enviar(busca());
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(atualizarFase).not.toHaveBeenCalled();
  });

  it("não cobre a busca enquanto a abertura roda", () => {
    vi.stubGlobal("window", { __abertura: "desenhando", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const evento = enviar(busca());
    expect(evento.preventDefault).not.toHaveBeenCalled();
  });
});
