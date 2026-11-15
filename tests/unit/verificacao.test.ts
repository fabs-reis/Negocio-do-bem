import { describe, expect, it } from "vitest";
import { perfilVerificado } from "@/lib/verificacao";

describe("perfilVerificado", () => {
  it("é verificado quando um dono atual tem liberação no Clube", () => {
    expect(perfilVerificado({ membros: [{ usuarioId: "a" }], liberacoesClube: [{ usuarioId: "a" }] })).toBe(true);
  });

  it("não é verificado quando a pessoa liberada deixou de ser dona", () => {
    expect(perfilVerificado({ membros: [{ usuarioId: "b" }], liberacoesClube: [{ usuarioId: "a" }] })).toBe(false);
  });

  it("ignora liberações que não estão valendo", () => {
    expect(perfilVerificado({ membros: [{ usuarioId: "a" }], liberacoesClube: [{ usuarioId: "a", status: "suspensa" }] })).toBe(false);
  });

  it("sem os dados da consulta, não é verificado", () => {
    expect(perfilVerificado({})).toBe(false);
  });
});
