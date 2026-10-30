import { describe, expect, it } from "vitest";
import { lerPreenchimento } from "@/app/indicar/preenchimento";

describe("lerPreenchimento", () => {
  it("abre com o @ e com \"Este negócio é meu\" marcado", () => {
    expect(lerPreenchimento({ instagram: "padaria.flor", dono: "sim" })).toEqual({ instagram: "padaria.flor", souDono: true });
  });

  it("normaliza o @ como o resto do site", () => {
    expect(lerPreenchimento({ instagram: "@Padaria.Flor" }).instagram).toBe("padaria.flor");
    expect(lerPreenchimento({ instagram: "https://www.instagram.com/padaria.flor/" }).instagram).toBe("padaria.flor");
  });

  it("deixa vazio o @ que não é válido e só marca com dono=sim", () => {
    expect(lerPreenchimento({ instagram: "não é um @", dono: "talvez" })).toEqual({ instagram: "", souDono: false });
  });

  it("sem nada na URL, o formulário abre como antes", () => {
    expect(lerPreenchimento({})).toEqual({ instagram: "", souDono: false });
  });

  it("com o parâmetro repetido, vale o primeiro", () => {
    expect(lerPreenchimento({ instagram: ["um.negocio", "outro"], dono: ["sim", "nao"] })).toEqual({
      instagram: "um.negocio",
      souDono: true,
    });
  });
});
