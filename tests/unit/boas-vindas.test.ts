import { describe, expect, it } from "vitest";
import { checklistDoPerfil } from "@/lib/boas-vindas";

const RECEM_ASSUMIDO = { fotoUrl: null, historia: "", causas: [], oficial: false };
const COMPLETO = {
  fotoUrl: "/enviados/perfis/foto.jpg",
  historia: "Começou na garagem de casa.",
  causas: [{ causa: "antirracista" }],
  oficial: true,
};

describe("checklistDoPerfil", () => {
  it("perfil recém-assumido: as três coisas faltam, cada uma com o link da sua seção", () => {
    expect(checklistDoPerfil(RECEM_ASSUMIDO, true)).toEqual({
      itens: [
        { rotulo: "Uma foto", feito: false, href: "#foto" },
        { rotulo: "As causas que vocês vivem", feito: false, href: "#causas" },
        { rotulo: "A história de vocês", feito: false, href: "#historia" },
      ],
      pedirSelo: true,
      mostrar: true,
    });
  });

  it("cada item fica feito com o dado preenchido", () => {
    const { itens } = checklistDoPerfil({ ...RECEM_ASSUMIDO, causas: [{ causa: "antirracista" }] }, true);
    expect(itens.map((item) => item.feito)).toEqual([false, true, false]);
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, true).itens.every((item) => item.feito)).toBe(true);
  });

  it("história só com espaços e causa que saiu da lista não contam", () => {
    const { itens } = checklistDoPerfil({ ...RECEM_ASSUMIDO, historia: "  \n ", causas: [{ causa: "causa-que-saiu" }] }, true);
    expect(itens.map((item) => item.feito)).toEqual([false, false, false]);
  });

  it("some quando as três coisas estão feitas e o perfil é oficial", () => {
    expect(checklistDoPerfil(COMPLETO, true)).toMatchObject({ pedirSelo: false, mostrar: false });
  });

  it("perfil oficial com algo faltando: mostra, sem pedir o selo", () => {
    expect(checklistDoPerfil({ ...COMPLETO, historia: "" }, true)).toMatchObject({ pedirSelo: false, mostrar: true });
  });

  it("perfil completo que não é oficial: continua, para pedir o selo", () => {
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, true)).toMatchObject({ pedirSelo: true, mostrar: true });
  });

  it("sem o código por DM e sem o Entrar com Instagram, não pede o selo", () => {
    expect(checklistDoPerfil(RECEM_ASSUMIDO, false)).toMatchObject({ pedirSelo: false, mostrar: true });
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, false)).toMatchObject({ pedirSelo: false, mostrar: false });
  });
});
