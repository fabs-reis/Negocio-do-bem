import { describe, expect, it, vi } from "vitest";
import {
  criptografarSegredoMfa,
  descriptografarSegredoMfa,
  gerarCodigosRecuperacao,
  gerarSegredoMfa,
  hashCodigoRecuperacao,
  validarCodigoMfa,
} from "@/lib/auth/mfa";

describe("MFA RFC 6238 e segredos", () => {
  it("valida o vetor RFC 6238 de 6 dígitos", () => {
    const segredo = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(validarCodigoMfa(segredo, "287082", 59_000)).toBe(1);
    expect(validarCodigoMfa(segredo, "287082", 90_000)).toBeNull();
    expect(validarCodigoMfa(segredo, "287082", 30_000)).toBe(1);
    expect(validarCodigoMfa(segredo, "ABCDEF", 59_000)).toBeNull();
  });

  it("cifra segredos de forma autenticada e rejeita chave incorreta", () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    try {
      const segredo = gerarSegredoMfa();
      const cifrado = criptografarSegredoMfa(segredo);
      expect(cifrado).not.toContain(segredo);
      expect(descriptografarSegredoMfa(cifrado)).toBe(segredo);
      const partes = cifrado.split(".");
      partes[3] = Buffer.from("corrompido").toString("base64url");
      expect(() => descriptografarSegredoMfa(partes.join("."))).toThrow();
      vi.stubEnv("MFA_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
      expect(() => descriptografarSegredoMfa(cifrado)).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("gera códigos de recuperação únicos e só guarda hashes", () => {
    const codigos = gerarCodigosRecuperacao();
    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    expect(codigos.every((codigo) => /^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/.test(codigo))).toBe(true);
    for (const codigo of codigos) {
      const hash = hashCodigoRecuperacao(codigo);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hashCodigoRecuperacao(codigo.toLowerCase().replaceAll("-", "")));
    }
    expect(hashCodigoRecuperacao("123")).toBeNull();
  });
});
