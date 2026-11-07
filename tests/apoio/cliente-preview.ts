import * as banco from "../../src/lib/db";
import { Prisma } from "../../src/generated/prisma/client";

const { db } = banco;
const [comando, identificador] = process.argv.slice(2);

async function main() {
  if (comando === "criar") {
    await db.usuario.create({
      data: { email: `${identificador}@exemplo.test`, nome: identificador, senhaHash: "fixture-sem-login" },
    });
  } else if (comando === "consultar") {
    const usuario = await db.usuario.findUnique({
      where: { email: `${identificador}@exemplo.test` },
      select: { nome: true, papel: true },
    });
    process.stdout.write(JSON.stringify(usuario));
  } else if (comando === "consultar-bruto") {
    const tabela = "esquemaSql" in banco ? Prisma.sql`${banco.esquemaSql()}."Usuario"` : Prisma.raw('"Usuario"');
    const usuarios = await db.$transaction((tx) =>
      tx.$queryRaw`SELECT "nome", "papel" FROM ${tabela} WHERE "email" = ${`${identificador}@exemplo.test`} FOR UPDATE`,
    );
    process.stdout.write(JSON.stringify(usuarios));
  } else if (comando === "tabela-ausente") {
    const tabela = "esquemaSql" in banco ? Prisma.sql`${banco.esquemaSql()}."Sessao"` : Prisma.raw('"Sessao"');
    try {
      await db.$queryRaw`SELECT "id" FROM ${tabela} FOR UPDATE`;
      process.stdout.write("encontrada");
    } catch (erro) {
      if (!(erro instanceof Error) || !erro.message.includes("does not exist")) throw erro;
      process.stdout.write("ausente");
    }
  } else if (comando === "esquema-sql") {
    const esquema = "esquemaSql" in banco ? (banco.esquemaSql() as Prisma.Sql) : Prisma.raw('"public"');
    process.stdout.write(JSON.stringify({ texto: esquema.text, valores: esquema.values }));
  } else if (comando === "migracoes") {
    const { migracoesAplicadas } = await import("../../src/lib/moderacao/sistema");
    const migracoes = await migracoesAplicadas();
    process.stdout.write(JSON.stringify(migracoes.map((m) => m.nome)));
  } else if (comando === "marcar-negocio") {
    await db.empresa.update({
      where: { instagramUsername: "padaria.florescer.exemplo" },
      data: { nome: identificador },
    });
  } else {
    throw new Error("Comando da fixture desconhecido.");
  }
}

main().finally(() => db.$disconnect());
