import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../..", import.meta.url));

/** Roda o build só com as variáveis dadas; os casos aqui param antes das migrações. */
function build(variaveis: Record<string, string>) {
  return spawnSync("sh", ["scripts/cloudflare-build.sh"], {
    cwd: raiz,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", ...variaveis },
    encoding: "utf8",
  });
}

describe("build da produção no Cloudflare (#361)", () => {
  it("falha na main sem APP_URL", () => {
    const resultado = build({ WORKERS_CI_BRANCH: "main" });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("Falta o APP_URL de produção");
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])("falha na main com o APP_URL local %s", (appUrl) => {
    const resultado = build({ WORKERS_CI_BRANCH: "main", APP_URL: appUrl });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("Falta o APP_URL de produção");
  });

  it("falha no deploy manual de produção sem APP_URL", () => {
    const resultado = build({ DEPLOY_ENV: "production" });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("Falta o APP_URL de produção");
  });
});
