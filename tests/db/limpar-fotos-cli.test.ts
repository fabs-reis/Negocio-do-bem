import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const executar = promisify(execFile);

/** Roda o comando como o `npm run fotos:limpar`, só com o ambiente que o teste dá. */
async function rodar(argumentos: string[], ambiente: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await executar(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "scripts/limpar-fotos-historias.ts", ...argumentos],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", DATABASE_URL: URL_BANCO_TESTE, ...ambiente },
      },
    );
    return { codigo: 0, stdout, stderr };
  } catch (erro) {
    const falha = erro as { code: number; stdout: string; stderr: string };
    return { codigo: falha.code, stdout: falha.stdout, stderr: falha.stderr };
  }
}

describe("comando fotos:limpar", () => {
  it("diz qual armazenamento e qual banco leu", async () => {
    const r = await rodar(["listar"]);

    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("Armazenamento lido: pasta local");
    expect(r.stdout).toContain("Banco lido:");
  }, 60_000);

  it("mostra o motivo do erro, não só uma frase genérica", async () => {
    const r = await rodar(["listar", "https://abc.public.blob.vercel-storage.com/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg"]);

    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("A seleção contém foto fora do inventário de histórias.");
    expect(r.stdout).toContain("Armazenamento lido: pasta local");
  }, 60_000);

  it("mostra o motivo quando o banco não responde", async () => {
    const r = await rodar(["listar"], { DATABASE_URL: "postgresql://postgres@127.0.0.1:1/inexistente" });

    expect(r.codigo).toBe(1);
    expect(r.stderr).toMatch(/reach database server|ECONNREFUSED/i);
  }, 60_000);
});
