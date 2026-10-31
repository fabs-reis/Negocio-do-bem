import { createHash } from "node:crypto";

/** Identificador SQL delimitado do esquema, com as aspas escapadas, para SQL bruto. */
export function identificadorSql(esquema: string | undefined) {
  return `"${(esquema ?? "public").replaceAll('"', '""')}"`;
}

/** CLI e clientes precisam selecionar o mesmo esquema, inclusive depois do build. */
export function configuracaoDoBanco(url: string | undefined, ambiente: string | undefined, identificador: string | undefined, provedor?: string) {
  if (ambiente !== "preview") {
    const conexao = url && URL.canParse(url) ? new URL(url) : undefined;
    return { url, esquema: conexao?.searchParams.get("schema") ?? undefined };
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const vercel = /^dpl_[A-Za-z0-9]+$/;
  if (!identificador || !(provedor === "cloudflare" ? uuid.test(identificador) : provedor === "vercel" ? vercel.test(identificador) : uuid.test(identificador) || vercel.test(identificador))) {
    throw new Error("Falta uma identidade válida para isolar o banco do preview (BANCO_PREVIEW_ID ou VERCEL_DEPLOYMENT_ID).");
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
