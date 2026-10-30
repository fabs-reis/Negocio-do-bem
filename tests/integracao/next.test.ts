import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const raiz = resolve(import.meta.dirname, "../..");

describe("Next em produção", () => {
  let servidor: ChildProcess | undefined;
  let log: WriteStream | undefined;
  let errosServidor = "";
  let saidaServidor = "";
  const caminhoLog = resolve(raiz, `.nott/next-integracao-${process.pid}-${Date.now()}.log`);
  let origem: string;
  let empresaId: string | undefined;
  let cookieModerador: string;
  let cookieMembro: string;
  let acao: string;
  const usuarios: string[] = [];

  async function criarPessoa(papel: string) {
    const pessoa = await db.usuario.create({
      data: { nome: `Pessoa ${papel}`, email: `${randomBytes(8).toString("hex")}@exemplo.test`, senhaHash: "nao-usada", papel },
    });
    usuarios.push(pessoa.id);
    const sessao = randomBytes(32).toString("base64url");
    await db.sessao.create({
      data: {
        id: createHash("sha256").update(sessao).digest("hex"),
        usuarioId: pessoa.id,
        expiraEm: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return `ndb_sessao=${sessao}`;
  }

  async function enviar(cookie: string) {
    const dados = new FormData();
    dados.set(acao, "");
    dados.set("empresaId", empresaId!);
    dados.set("decisao", "rejeitar");
    dados.set("aba", "negocios");
    return fetch(`${origem}/moderacao?aba=negocios`, {
      method: "POST", body: dados, headers: { cookie, origin: origem }, redirect: "manual",
    });
  }

  beforeAll(async () => {
    cookieModerador = await criarPessoa("moderador");
    cookieMembro = await criarPessoa("membro");
    const empresa = await db.empresa.create({
      data: {
        instagramUsername: `runtime.${randomBytes(6).toString("hex")}`,
        nome: "Negócio da prova de runtime",
        resumo: "Negócio fictício para o teste local",
        categoria: "Serviços", cidade: "Recife", uf: "PE", moderacao: "aprovada",
      },
    });
    empresaId = empresa.id;

    const reserva = createServer();
    reserva.listen(0, "127.0.0.1");
    await once(reserva, "listening");
    const endereco = reserva.address();
    if (!endereco || typeof endereco === "string") throw new Error("Não foi possível reservar a porta local.");
    const porta = endereco.port;
    await new Promise<void>((concluir, falhar) => reserva.close((erro) => erro ? falhar(erro) : concluir()));
    origem = `http://127.0.0.1:${porta}`;

    mkdirSync(resolve(raiz, ".nott"), { recursive: true });
    log = createWriteStream(caminhoLog);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(porta)], {
      cwd: raiz,
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: URL_BANCO_TESTE, APP_URL: origem, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout!.pipe(log, { end: false });
    servidor.stderr!.pipe(log, { end: false });
    servidor.stdout!.on("data", (dados: Buffer) => { saidaServidor += dados.toString(); });
    servidor.stderr!.on("data", (dados: Buffer) => { errosServidor += dados.toString(); });
    servidor.once("close", () => log!.end());
    await new Promise<void>((concluir, falhar) => {
      const espera = setTimeout(() => falhar(new Error(`O Next não iniciou. Consulte ${caminhoLog}.`)), 30_000);
      servidor!.stdout!.on("data", (dados: Buffer) => {
        if (dados.toString().includes("Ready")) { clearTimeout(espera); concluir(); }
      });
      servidor!.once("error", (erro) => { clearTimeout(espera); falhar(erro); });
      servidor!.once("exit", () => {
        clearTimeout(espera);
        falhar(new Error(`O Next encerrou antes de iniciar. Consulte ${caminhoLog}.`));
      });
    });

    log.write("\nPROVA: GET fila como moderador\n");
    const pagina = await fetch(`${origem}/moderacao?aba=negocios`, { headers: { cookie: cookieModerador } });
    expect(pagina.status).toBe(200);
    const html = await pagina.text();
    const formulario = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
      .map((trecho) => trecho[1]).find((trecho) => trecho.includes(`value="${empresaId}"`));
    const identificador = formulario?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    expect(identificador, "A página deve expor o formulário real da ação compilada.").toBeTruthy();
    acao = identificador!;
  }, 40_000);

  beforeEach(async () => {
    await db.registroAuditoria.deleteMany({ where: { alvoId: empresaId } });
    await db.empresa.update({ where: { id: empresaId }, data: { moderacao: "aprovada" } });
  });

  afterAll(async () => {
    if (servidor?.pid && servidor.exitCode === null && servidor.signalCode === null) {
      const encerrado = once(servidor, "close");
      const espera = setTimeout(() => servidor!.kill("SIGKILL"), 5_000);
      servidor.kill("SIGTERM");
      await encerrado;
      clearTimeout(espera);
    }
    if (log && !log.writableFinished) await once(log, "finish");
    try {
      if (empresaId) {
        await db.registroAuditoria.deleteMany({ where: { alvoId: empresaId } });
        await db.empresa.deleteMany({ where: { id: empresaId } });
      }
      await db.usuario.deleteMany({ where: { id: { in: usuarios } } });
    } finally {
      await db.$disconnect();
    }
    expect(errosServidor, `O Next escreveu erros. Log completo: ${caminhoLog}`).toBe("");
    expect(saidaServidor, `O Next registrou falha. Log completo: ${caminhoLog}`).not.toMatch(/⨯|(?:Error|TypeError|ReferenceError):/);
  });

  it("não revela a fila para visitante ou membro", async () => {
    for (const [papel, cookie] of [["visitante", ""], ["membro", cookieMembro]]) {
      log!.write(`\nPROVA: GET fila como ${papel}\n`);
      const resposta = await fetch(`${origem}/moderacao?aba=negocios`, { headers: { cookie } });
      expect([200, 404]).toContain(resposta.status);
      const html = await resposta.text();
      expect(html).toContain("Não encontramos esta página");
      expect(html).not.toContain("Negócio da prova de runtime");
      expect(html).not.toContain('name="empresaId"');
    }
  });

  it.each(["visitante", "membro"])("recusa a ação para %s sem gravar", async (papel) => {
    const cookie = papel === "membro" ? cookieMembro : "";
    log!.write(`\nPROVA: POST ação como ${papel}\n`);
    const resposta = await enviar(cookie);
    await resposta.text();
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe("aprovada");
    expect(await db.registroAuditoria.count({ where: { alvoId: empresaId } })).toBe(0);
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toBe("/404");
    const destino = await fetch(`${origem}/404`, { headers: { cookie } });
    expect(destino.status).toBe(404);
    const html = await destino.text();
    expect(html).toContain("Não encontramos esta página");
    expect(html).not.toContain("Negócio da prova de runtime");
  });

  it("executa a ação compilada para a moderação", async () => {
    log!.write("\nPROVA: POST ação como moderador\n");
    const resposta = await enviar(cookieModerador);
    await resposta.text();
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("aviso=feito");
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe("rejeitada");
    expect(await db.registroAuditoria.count({ where: { alvoId: empresaId, acao: "empresa.rejeitada" } })).toBe(1);
  });
});
