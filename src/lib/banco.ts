import { createHash } from "node:crypto";

/** Identificador SQL delimitado do esquema, com as aspas escapadas, para SQL bruto. */
export function identificadorSql(esquema: string | undefined) {
  return `"${(esquema ?? "public").replaceAll('"', '""')}"`;
}

/** CLI e clientes precisam selecionar o mesmo esquema, inclusive depois do build. */
export function configuracaoDoBanco(url: string | undefined, ambiente: string | undefined, identificador: string | undefined) {
  if (ambiente !== "preview") {
    const conexao = url && URL.canParse(url) ? new URL(url) : undefined;
    return { url, esquema: conexao?.searchParams.get("schema") ?? undefined };
  }
  if (!identificador || !/^dpl_[A-Za-z0-9]+$/.test(identificador)) {
    throw new Error("Falta um VERCEL_DEPLOYMENT_ID válido para isolar o banco do preview.");
  }

  let conexao: URL;
  try {
    conexao = new URL(url ?? "");
    if (conexao.protocol !== "postgresql:" && conexao.protocol !== "postgres:") throw new Error();
  } catch {
    throw new Error("Falta uma DATABASE_URL PostgreSQL válida para o preview.");
  }

  // O identificador completo precisa caber nos 63 bytes aceitos pelo PostgreSQL.
  const esquema = `preview_${createHash("sha256").update(identificador).digest("hex").slice(0, 55)}`;
  conexao.searchParams.set("schema", esquema);
  return { url: conexao.toString(), esquema };
}
