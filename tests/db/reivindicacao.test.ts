import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, type Prisma } from "@/lib/db";
import {
  aprovar,
  confirmarCodigo,
  ErroReivindicacao,
  iniciarPorCodigoDm,
  LIMITE_TENTATIVAS,
  pedirOutroEnvio,
  processarDm,
  processarLoginInstagram,
  recusar,
  registrarEnvio,
  solicitarPorDocumento,
} from "@/lib/reivindicacao";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuario(nome = "Pessoa") {
  contador++;
  return db.usuario.create({ data: { nome, email: `pessoa${contador}@exemplo.com`, senhaHash: "x" } });
}

async function criarEmpresa(username: string, extra: Partial<{ instagramUserId: string; instagramIgsid: string }> = {}) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      ...extra,
    },
  });
}

async function donos(empresaId: string) {
  const membros = await db.empresaMembro.findMany({ where: { empresaId } });
  return membros.map((m) => m.usuarioId).sort();
}

const responde = (username: string | null) => async () => username;

beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("código por DM", () => {
  it("gera um código e reaproveita enquanto ele vale", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");

    const primeira = await iniciarPorCodigoDm(empresa.id, dono.id);
    const segunda = await iniciarPorCodigoDm(empresa.id, dono.id);

    expect(primeira.codigo).toMatch(/^BEM-/);
    expect(segunda.id).toBe(primeira.id);
    expect(primeira.expiraEm.getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000);
  });

  it("gera um código novo quando o anterior expirou", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const velha = await iniciarPorCodigoDm(empresa.id, dono.id);
    await db.reivindicacao.update({ where: { id: velha.id }, data: { expiraEm: new Date(Date.now() - 1000) } });

    const nova = await iniciarPorCodigoDm(empresa.id, dono.id);

    expect(nova.id).not.toBe(velha.id);
    expect((await db.reivindicacao.findUnique({ where: { id: velha.id } }))?.status).toBe("expirada");
  });

  it("aprova sozinho quando a DM vem do @ do negócio", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { codigo } = await iniciarPorCodigoDm(empresa.id, dono.id);

    const resultado = await processarDm({
      remetenteId: "igsid-1",
      texto: `oi, segue o código ${codigo}`,
      buscarUsername: responde("padaria.flor"),
    });

    expect(resultado).toBe("aprovada");
    expect(await donos(empresa.id)).toEqual([dono.id]);
    const atualizada = await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } });
    expect(atualizada.status).toBe("verificada");
    expect(atualizada.instagramIgsid).toBe("igsid-1");
    expect(await db.registroAuditoria.count({ where: { alvoId: empresa.id, usuarioId: null } })).toBe(1);
  });

  it("não aprova quando a DM vem de outro @", async () => {
    const golpista = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { codigo, id } = await iniciarPorCodigoDm(empresa.id, golpista.id);

    const resultado = await processarDm({
      remetenteId: "igsid-2",
      texto: codigo!,
      buscarUsername: responde("outra.conta"),
    });

    expect(resultado).toBe("em_analise");
    expect(await donos(empresa.id)).toEqual([]);
    const reivindicacao = await db.reivindicacao.findUniqueOrThrow({ where: { id } });
    expect(reivindicacao.status).toBe("pendente");
    expect(reivindicacao.notas).toContain("@outra.conta");
  });

  it("deixa para a moderação quando não dá para descobrir o @", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { codigo, id } = await iniciarPorCodigoDm(empresa.id, dono.id);

    expect(await processarDm({ remetenteId: "x", texto: codigo!, buscarUsername: responde(null) })).toBe("em_analise");
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id } })).notas).toContain("Confira no Instagram");
  });

  it("ignora mensagens sem código ou com código desconhecido", async () => {
    expect(await processarDm({ remetenteId: "x", texto: "olá!", buscarUsername: responde("a") })).toBe("ignorada");
    expect(await processarDm({ remetenteId: "x", texto: "BEM-AAAAAA", buscarUsername: responde("a") })).toBe("ignorada");
  });

  it("não aceita código expirado", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { codigo, id } = await iniciarPorCodigoDm(empresa.id, dono.id);
    await db.reivindicacao.update({ where: { id }, data: { expiraEm: new Date(Date.now() - 1000) } });

    expect(await processarDm({ remetenteId: "x", texto: codigo!, buscarUsername: responde("padaria.flor") })).toBe(
      "em_analise",
    );
    expect(await donos(empresa.id)).toEqual([]);
  });

  it("quando já existe dono, a moderação decide e pode transferir", async () => {
    const antigo = await criarUsuario("Antigo");
    const novo = await criarUsuario("Novo");
    const empresa = await criarEmpresa("padaria.flor");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: antigo.id } });
    const moderador = await criarUsuario("Moderação");
    const { codigo, id } = await iniciarPorCodigoDm(empresa.id, novo.id);

    expect(
      await processarDm({ remetenteId: "igsid-novo", texto: codigo!, buscarUsername: responde("padaria.flor") }),
    ).toBe("em_analise");
    expect(await donos(empresa.id)).toEqual([antigo.id]);

    await aprovar({ reivindicacaoId: id, revisorId: moderador.id, modo: "transferir" });

    expect(await donos(empresa.id)).toEqual([novo.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).instagramIgsid).toBe("igsid-novo");
  });
});

describe("código mandado pela DM do projeto", () => {
  const HORA = 60 * 60 * 1000;

  /** A pessoa pede o código e a moderação registra que mandou a DM. */
  async function pedidoEnviado(empresaId: string, usuarioId: string) {
    const moderador = await criarUsuario("Moderação");
    const pedido = await iniciarPorCodigoDm(empresaId, usuarioId);
    await registrarEnvio({ reivindicacaoId: pedido.id, revisorId: moderador.id });
    return { pedido: await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } }), moderador };
  }

  const confirmar = (empresaId: string, usuarioId: string, texto: string) => confirmarCodigo({ empresaId, usuarioId, texto });

  it("o pedido espera a DM, e o envio dá 48 horas ao código", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");

    const pedido = await iniciarPorCodigoDm(empresa.id, pessoa.id);
    expect(pedido).toMatchObject({ envios: 0, enviadoEm: null });
    expect(pedido.expiraEm.getTime()).toBeGreaterThan(Date.now() + 7 * 24 * HORA);

    const { pedido: enviado, moderador } = await pedidoEnviado(empresa.id, pessoa.id);
    expect(enviado.id).toBe(pedido.id);
    expect(enviado.envios).toBe(1);
    expect(enviado.enviadoEm).not.toBeNull();
    expect(Math.abs(enviado.expiraEm.getTime() - (Date.now() + 48 * HORA))).toBeLessThan(60_000);
    expect(await db.registroAuditoria.findFirst({ where: { acao: "reivindicacao.codigo_enviado" } })).toMatchObject({
      usuarioId: moderador.id,
      alvoId: empresa.id,
    });
  });

  it("o código certo, colado por quem pediu, aprova com o selo de perfil oficial", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);

    // Do jeito que a pessoa copia da DM: minúsculas e sem o hífen também valem.
    expect(await confirmar(empresa.id, pessoa.id, pedido.codigo!.replace("-", " ").toLowerCase())).toBe("aprovada");

    expect(await donos(empresa.id)).toEqual([pessoa.id]);
    expect(await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).toMatchObject({ status: "verificada", oficial: true });
    expect(await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({ status: "aprovada", revisadoPorId: null });
  });

  it("o código vale mesmo se a moderação esquecer de registrar o envio", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const pedido = await iniciarPorCodigoDm(empresa.id, pessoa.id);

    expect(await confirmar(empresa.id, pessoa.id, pedido.codigo!)).toBe("aprovada");
  });

  it("o código de outra pessoa não vale", async () => {
    const [ana, bia] = await Promise.all(["Ana", "Bia"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido: daAna } = await pedidoEnviado(empresa.id, ana.id);
    await pedidoEnviado(empresa.id, bia.id);

    await expect(confirmar(empresa.id, bia.id, daAna.codigo!)).rejects.toThrow("não confere");

    expect(await donos(empresa.id)).toEqual([]);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: daAna.id } })).status).toBe("pendente");
  });

  it("sem pedido ou com um texto sem código, explica o que fazer", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");

    await expect(confirmar(empresa.id, pessoa.id, "BEM-AAAAAA")).rejects.toThrow("Não encontramos um pedido de código");
    await pedidoEnviado(empresa.id, pessoa.id);
    await expect(confirmar(empresa.id, pessoa.id, "oi")).rejects.toThrow("formato BEM-7K3F9Q");
  });

  it("conta as tentativas erradas e para no limite, até para o código certo", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);
    const errado = pedido.codigo === "BEM-AAAAAA" ? "BEM-BBBBBB" : "BEM-AAAAAA";

    await expect(confirmar(empresa.id, pessoa.id, errado)).rejects.toThrow(`Restam ${LIMITE_TENTATIVAS - 1} tentativas`);
    for (let i = 2; i < LIMITE_TENTATIVAS; i++) await expect(confirmar(empresa.id, pessoa.id, errado)).rejects.toThrow("não confere");
    await expect(confirmar(empresa.id, pessoa.id, errado)).rejects.toThrow("as tentativas acabaram");
    await expect(confirmar(empresa.id, pessoa.id, pedido.codigo!)).rejects.toThrow("errado muitas vezes");

    expect(await donos(empresa.id)).toEqual([]);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).tentativas).toBe(LIMITE_TENTATIVAS);
  });

  it("tentativas ao mesmo tempo não passam do limite", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);
    const errado = pedido.codigo === "BEM-AAAAAA" ? "BEM-BBBBBB" : "BEM-AAAAAA";

    const resultados = await Promise.allSettled(Array.from({ length: 20 }, () => confirmar(empresa.id, pessoa.id, errado)));

    expect(resultados.every((r) => r.status === "rejected")).toBe(true);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).tentativas).toBe(LIMITE_TENTATIVAS);
  });

  it("dois envios do código certo ao mesmo tempo aprovam uma vez só", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);

    const resultados = await Promise.all([confirmar(empresa.id, pessoa.id, pedido.codigo!), confirmar(empresa.id, pessoa.id, pedido.codigo!)]);

    expect(resultados).toEqual(["aprovada", "aprovada"]);
    expect(await donos(empresa.id)).toEqual([pessoa.id]);
    expect(await db.registroAuditoria.count({ where: { acao: "reivindicacao.aprovada" } })).toBe(1);
  });

  it("depois de 48 horas do envio, o código venceu", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);
    await db.reivindicacao.update({ where: { id: pedido.id }, data: { expiraEm: new Date(Date.now() - 1000) } });

    await expect(confirmar(empresa.id, pessoa.id, pedido.codigo!)).rejects.toThrow("venceu");
    expect(await donos(empresa.id)).toEqual([]);
  });

  it("outro envio: só depois do primeiro, uma vez por envio e até dois envios", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const pedido = await iniciarPorCodigoDm(empresa.id, pessoa.id);
    await expect(pedirOutroEnvio(empresa.id, pessoa.id)).rejects.toThrow("ainda não mandou o primeiro código");

    const { moderador } = await pedidoEnviado(empresa.id, pessoa.id);
    await db.reivindicacao.update({ where: { id: pedido.id }, data: { tentativas: LIMITE_TENTATIVAS } });
    await pedirOutroEnvio(empresa.id, pessoa.id);

    const depois = await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(depois.codigo).not.toBe(pedido.codigo);
    expect(depois).toMatchObject({ tentativas: 0, envios: 1, status: "pendente" });
    expect(depois.reenvioPedidoEm).not.toBeNull();
    await expect(pedirOutroEnvio(empresa.id, pessoa.id)).rejects.toThrow("já pediu outro envio");
    // O código antigo deixou de valer.
    await expect(confirmar(empresa.id, pessoa.id, pedido.codigo!)).rejects.toThrow("não confere");

    await registrarEnvio({ reivindicacaoId: pedido.id, revisorId: moderador.id });
    expect(await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({ envios: 2, reenvioPedidoEm: null });
    await expect(pedirOutroEnvio(empresa.id, pessoa.id)).rejects.toThrow("análise manual");

    expect(await confirmar(empresa.id, pessoa.id, depois.codigo!)).toBe("aprovada");
  });

  it("dois pedidos de outro envio ao mesmo tempo viram um só", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { pedido } = await pedidoEnviado(empresa.id, pessoa.id);

    const resultados = await Promise.allSettled([pedirOutroEnvio(empresa.id, pessoa.id), pedirOutroEnvio(empresa.id, pessoa.id)]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).codigo).not.toBe(pedido.codigo);
  });

  it("com outro dono, o código certo fica com a moderação, que aprova com o selo", async () => {
    const [antiga, nova, moderador] = await Promise.all(["Antiga", "Nova", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: antiga.id } });
    const { pedido } = await pedidoEnviado(empresa.id, nova.id);

    expect(await confirmar(empresa.id, nova.id, pedido.codigo!)).toBe("em_analise");
    const emAnalise = await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(emAnalise.status).toBe("pendente");
    expect(emAnalise.codigoConfirmadoEm).not.toBeNull();
    expect(emAnalise.notas).toContain("Código confirmado no site");
    expect(await donos(empresa.id)).toEqual([antiga.id]);
    // Colar de novo não gasta tentativa nem muda nada.
    expect(await confirmar(empresa.id, nova.id, pedido.codigo!)).toBe("em_analise");

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "transferir" });

    expect(await donos(empresa.id)).toEqual([nova.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).oficial).toBe(true);
  });

  it("um pedido de código aprovado sem o código não dá o selo", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    const pedido = await iniciarPorCodigoDm(empresa.id, pessoa.id);

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });

    expect(await donos(empresa.id)).toEqual([pessoa.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).oficial).toBe(false);
  });

  it("o envio só se registra num pedido de código pendente", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    const analise = await solicitarPorDocumento({
      empresaId: empresa.id,
      usuarioId: pessoa.id,
      cnpj: null,
      site: null,
      relacao: "Dona",
      contato: "(81) 99999-0000",
      mensagem: null,
    });

    await expect(registrarEnvio({ reivindicacaoId: analise.id, revisorId: moderador.id })).rejects.toThrow(ErroReivindicacao);
  });
});

describe("Entrar com Instagram", () => {
  it("aprova na hora quando a conta é a do negócio", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("casa.do_bem");

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: dono.id,
      conta: { userId: "17841400000000001", username: "casa.do_bem" },
    });

    expect(resultado).toEqual({ tipo: "verificada" });
    expect(await donos(empresa.id)).toEqual([dono.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).instagramUserId).toBe("17841400000000001");
  });

  it("recusa quando a pessoa entra com outra conta", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("casa.do_bem");

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: pessoa.id,
      conta: { userId: "1", username: "minha.conta.pessoal" },
    });

    expect(resultado).toEqual({ tipo: "conta_diferente", conectada: "minha.conta.pessoal" });
    expect(await db.reivindicacao.count()).toBe(0);
  });

  it("manda para análise quando o @ passou para outra conta", async () => {
    // O negócio trocou de @ e alguém registrou o @ antigo: o ID não bate mais.
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("casa.do_bem", { instagramUserId: "id-original" });

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: pessoa.id,
      conta: { userId: "id-de-outra-pessoa", username: "casa.do_bem" },
    });

    expect(resultado).toEqual({ tipo: "em_analise" });
    expect(await donos(empresa.id)).toEqual([]);
    const pendente = await db.reivindicacao.findFirstOrThrow({ where: { empresaId: empresa.id } });
    expect(pendente.notas).toContain("pode ter mudado de dono");
  });

  it("detecta a mesma conta ligada a outro perfil e, ao aprovar, move a ligação", async () => {
    const dono = await criarUsuario();
    const moderador = await criarUsuario();
    const antigo = await criarEmpresa("nome.antigo", { instagramUserId: "id-123" });
    const novo = await criarEmpresa("nome.novo");

    const resultado = await processarLoginInstagram({
      empresaId: novo.id,
      usuarioId: dono.id,
      conta: { userId: "id-123", username: "nome.novo" },
    });
    expect(resultado).toEqual({ tipo: "em_analise" });

    const pendente = await db.reivindicacao.findFirstOrThrow({ where: { empresaId: novo.id, status: "pendente" } });
    expect(pendente.notas).toContain("@nome.antigo");

    await aprovar({ reivindicacaoId: pendente.id, revisorId: moderador.id });
    expect((await db.empresa.findUniqueOrThrow({ where: { id: novo.id } })).instagramUserId).toBe("id-123");
    expect((await db.empresa.findUniqueOrThrow({ where: { id: antigo.id } })).instagramUserId).toBeNull();
  });
});

describe("renovação durante aprovação com troca do ID do Instagram", () => {
  function sinal() {
    let liberar!: () => void;
    const promessa = new Promise<void>((resolve) => { liberar = resolve; });
    return { promessa, liberar };
  }

  it.each(["instagram_login", "codigo_dm"] as const)("renova %s sem deadlock na mesma empresa", async (metodo) => {
    const pessoa = await criarUsuario();
    const moderador = await criarUsuario("Moderação");
    const empresa = await criarEmpresa("renovacao", { instagramUserId: "id-anterior" });
    const antigo = await db.reivindicacao.create({
      data: {
        empresaId: empresa.id, usuarioId: pessoa.id, metodo,
        instagramUserId: metodo === "instagram_login" ? "id-aprovado" : null,
        expiraEm: new Date(Date.now() - 60_000),
      },
    });
    // Na DM, a aprovação de outro pedido cancela o código vencido da mesma pessoa.
    const paraAprovar = metodo === "instagram_login" ? antigo : await db.reivindicacao.create({
      data: {
        empresaId: empresa.id, usuarioId: pessoa.id, metodo: "instagram_login",
        instagramUserId: "id-aprovado", expiraEm: new Date(Date.now() + 60_000),
      },
    });
    const pedidoLido = sinal();
    const continuarAprovacao = sinal();
    const renovacaoPronta = sinal();
    const continuarRenovacao = sinal();
    const empresaAlterada = sinal();
    const concluirAprovacao = sinal();
    let numero = 0;
    let pidAprovacao = 0;
    let pidRenovacao = 0;
    let alterouPedido = false;

    // As operações SQL são reais. As pausas fixam a ordem sem depender de atrasos.
    const cliente = db.$extends({ query: {
      reivindicacao: {
        async findUnique({ args, query }) {
          const pedido = await query(args);
          pedidoLido.liberar();
          await continuarAprovacao.promessa;
          return pedido;
        },
        async updateMany({ args, query }) {
          const resultado = await query(args);
          if (args.where?.metodo === metodo) alterouPedido = resultado.count > 0;
          return resultado;
        },
      },
      empresa: {
        async update({ args, query }) {
          const atualizada = await query(args);
          empresaAlterada.liberar();
          await concluirAprovacao.promessa;
          return atualizada;
        },
      },
    } });
    const transacionar = cliente.$transaction.bind(cliente);
    vi.spyOn(db, "$transaction").mockImplementation(async (operacao, opcoes) => transacionar(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      if (++numero === 1) {
        pidAprovacao = pid;
      } else {
        pidRenovacao = pid;
        renovacaoPronta.liberar();
        await continuarRenovacao.promessa;
      }
      // A extensão só pausa consultas. Ela não muda modelos nem resultados.
      return operacao(tx as unknown as Prisma.TransactionClient);
    }, { ...opcoes, timeout: 12_000 }));

    const resultados: Promise<PromiseSettledResult<unknown>[]>[] = [];
    try {
      resultados.push(Promise.allSettled([aprovar({ reivindicacaoId: paraAprovar.id, revisorId: moderador.id })]));
      await pedidoLido.promessa;
      resultados.push(Promise.allSettled([metodo === "instagram_login"
        ? processarLoginInstagram({ empresaId: empresa.id, usuarioId: pessoa.id,
          conta: { userId: "id-renovado", username: empresa.instagramUsername } })
        : iniciarPorCodigoDm(empresa.id, pessoa.id)]));
      await renovacaoPronta.promessa;
      continuarAprovacao.liberar();
      await empresaAlterada.promessa;
      continuarRenovacao.liberar();

      // A aprovação segura Empresa. A renovação deve esperar nela, não segurar o pedido antigo.
      await expect.poll(async () => {
        const [{ bloqueadores }] = await db.$queryRaw<{ bloqueadores: number[] }[]>`
          SELECT pg_blocking_pids(${pidRenovacao}::int) AS bloqueadores`;
        return bloqueadores;
      }).toContain(pidAprovacao);
      console.info(`${metodo}: renovação bloqueada pela aprovação, pedido antigo alterado: ${alterouPedido}`);
      concluirAprovacao.liberar();
      const concluidos = (await Promise.all(resultados)).flat();
      expect(concluidos).toEqual([
        { status: "fulfilled", value: undefined },
        { status: "fulfilled", value: metodo === "instagram_login" ? { tipo: "em_analise" } : expect.objectContaining({ metodo: "codigo_dm" }) },
      ]);
      expect(alterouPedido).toBe(false);
      expect(await donos(empresa.id)).toEqual([pessoa.id]);
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).instagramUserId).toBe("id-aprovado");
      expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: antigo.id } })).status)
        .toBe(metodo === "instagram_login" ? "aprovada" : "cancelada");
      expect(await db.reivindicacao.count({ where: { empresaId: empresa.id, metodo, status: "pendente" } })).toBe(1);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(metodo === "instagram_login" ? 2 : 3);
      expect(await db.registroAuditoria.count({ where: { alvoId: empresa.id, acao: "reivindicacao.aprovada" } })).toBe(1);
    } finally {
      continuarAprovacao.liberar();
      continuarRenovacao.liberar();
      concluirAprovacao.liberar();
      await Promise.all(resultados);
      vi.restoreAllMocks();
    }
  }, 15_000);
});

describe("documento e moderação", () => {
  const dadosDoNegocio = { cnpj: null, site: null, relacao: "Dona", contato: "(81) 99999-0000", mensagem: null };

  it("fica com a moderação mesmo quando o negócio ainda não tem dono", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("sem.dono");

    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    expect(pedido.status).toBe("pendente");
    expect(await donos(empresa.id)).toEqual([]);
    expect(await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).toMatchObject({ status: "indicada" });
    expect(await db.registroAuditoria.count({ where: { acao: "reivindicacao.aprovada" } })).toBe(0);
  });

  it("a moderação aprova o pedido de um negócio sem dono", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("sem.dono");
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });

    expect(await donos(empresa.id)).toEqual([pessoa.id]);
    expect(await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).toMatchObject({ status: "verificada", oficial: false });
    expect(await db.registroAuditoria.findFirst({ where: { acao: "reivindicacao.aprovada" } })).toMatchObject({ usuarioId: moderador.id });
  });

  it("deixa para a moderação quando o negócio foi tirado do ar", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("fora.do.ar");
    await db.empresa.update({ where: { id: empresa.id }, data: { moderacao: "rejeitada" } });

    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    expect(pedido.status).toBe("pendente");
    expect(await donos(empresa.id)).toEqual([]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).moderacao).toBe("rejeitada");
  });

  it("guarda CNPJ e site e não deixa duplicar enquanto está em análise", async () => {
    const pessoa = await criarUsuario();
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("ateliê".normalize("NFD").replace(/[̀-ͯ]/g, ""));
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });
    const dados = {
      empresaId: empresa.id,
      usuarioId: pessoa.id,
      cnpj: "11222333000181",
      site: "https://atelie.example.com/",
      relacao: "Sócia",
      contato: "(81) 99999-0000",
      mensagem: null,
    };

    const pedido = await solicitarPorDocumento(dados);

    expect(pedido).toMatchObject({ metodo: "documento", status: "pendente", cnpj: "11222333000181", site: "https://atelie.example.com/" });
    expect(await donos(empresa.id)).toEqual([dono.id]);
    await expect(solicitarPorDocumento(dados)).rejects.toBeInstanceOf(ErroReivindicacao);
  });

  it("recusa com motivo e registra na auditoria", async () => {
    const pessoa = await criarUsuario();
    const moderador = await criarUsuario();
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("loja.x");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, cnpj: null, site: null, relacao: "Dono", contato: "x", mensagem: null });

    await recusar({ reivindicacaoId: pedido.id, revisorId: moderador.id, motivo: "Não conseguimos confirmar." });

    const recusada = await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(recusada.status).toBe("recusada");
    expect(recusada.motivoRecusa).toBe("Não conseguimos confirmar.");
    await expect(aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id })).rejects.toBeInstanceOf(ErroReivindicacao);
    expect(await db.registroAuditoria.count({ where: { acao: "reivindicacao.recusada" } })).toBe(1);
  });

  it("limita a quantidade de solicitações por dia", async () => {
    const pessoa = await criarUsuario();
    for (let i = 0; i < 10; i++) {
      const empresa = await criarEmpresa(`loja${i}`);
      await iniciarPorCodigoDm(empresa.id, pessoa.id);
    }
    const mais = await criarEmpresa("loja.extra");
    await expect(iniciarPorCodigoDm(mais.id, pessoa.id)).rejects.toThrow(/muitas solicitações/);
  });

  describe("limite diário com pedidos simultâneos", () => {
    const DADOS = { cnpj: null, site: null, relacao: "Funcionario", contato: "contato@exemplo.com", mensagem: null };

    /** Negócios com dono: o pedido por documento não é aprovado sozinho e fica pendente. */
    async function criarEmpresasComDono(quantidade: number, prefixo: string) {
      const dono = await criarUsuario("Dono");
      const empresas = [];
      for (let i = 0; i < quantidade; i++) {
        const empresa = await criarEmpresa(`${prefixo}${i}`);
        await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });
        empresas.push(empresa);
      }
      return empresas;
    }

    async function criarPedidosRecentes(usuarioId: string, quantidade: number, prefixo: string) {
      for (let i = 0; i < quantidade; i++) {
        const empresa = await criarEmpresa(`${prefixo}${i}`);
        await db.reivindicacao.create({
          data: {
            empresaId: empresa.id,
            usuarioId,
            metodo: "documento",
            status: "cancelada",
            expiraEm: new Date(Date.now() + 60_000),
          },
        });
      }
    }

    function conferir(resultados: PromiseSettledResult<unknown>[], aceitos: number) {
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(aceitos);
      for (const r of resultados) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(ErroReivindicacao);
          expect((r.reason as Error).message).toMatch(/muitas solicitações/);
        }
      }
    }

    it("por documento: 25 pedidos ao mesmo tempo criam só 10", async () => {
      const pessoa = await criarUsuario();
      const empresas = await criarEmpresasComDono(25, "doc");

      const resultados = await Promise.allSettled(
        empresas.map((e) => solicitarPorDocumento({ empresaId: e.id, usuarioId: pessoa.id, ...DADOS })),
      );

      conferir(resultados, 10);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("por documento: com nove pedidos recentes, quatro ao mesmo tempo criam só mais um", async () => {
      const pessoa = await criarUsuario();
      await criarPedidosRecentes(pessoa.id, 9, "antigo");
      const empresas = await criarEmpresasComDono(4, "par");

      const resultados = await Promise.allSettled(
        empresas.map((e) => solicitarPorDocumento({ empresaId: e.id, usuarioId: pessoa.id, ...DADOS })),
      );

      conferir(resultados, 1);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("por código de DM: 25 pedidos ao mesmo tempo criam só 10", async () => {
      const pessoa = await criarUsuario();
      const empresas = [];
      for (let i = 0; i < 25; i++) empresas.push(await criarEmpresa(`dm${i}`));

      const resultados = await Promise.allSettled(empresas.map((e) => iniciarPorCodigoDm(e.id, pessoa.id)));

      conferir(resultados, 10);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("por login do Instagram: 25 pedidos ao mesmo tempo criam só 10", async () => {
      const pessoa = await criarUsuario();
      const empresas = [];
      for (let i = 0; i < 25; i++) empresas.push(await criarEmpresa(`ig${i}`));

      const resultados = await Promise.allSettled(
        empresas.map((e, i) =>
          processarLoginInstagram({
            empresaId: e.id,
            usuarioId: pessoa.id,
            conta: { userId: `ig-conta-${i}`, username: e.instagramUsername },
          }),
        ),
      );

      conferir(resultados, 10);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("os três caminhos juntos dividem a mesma cota", async () => {
      const pessoa = await criarUsuario();
      await criarPedidosRecentes(pessoa.id, 7, "antigo");
      const comDono = await criarEmpresasComDono(3, "doc");
      const paraDm = [];
      const paraLogin = [];
      for (let i = 0; i < 3; i++) {
        paraDm.push(await criarEmpresa(`dm${i}`));
        paraLogin.push(await criarEmpresa(`ig${i}`));
      }

      const resultados = await Promise.allSettled([
        ...comDono.map((e) => solicitarPorDocumento({ empresaId: e.id, usuarioId: pessoa.id, ...DADOS })),
        ...paraDm.map((e) => iniciarPorCodigoDm(e.id, pessoa.id)),
        ...paraLogin.map((e, i) =>
          processarLoginInstagram({
            empresaId: e.id,
            usuarioId: pessoa.id,
            conta: { userId: `ig-conta-${i}`, username: e.instagramUsername },
          }),
        ),
      ]);

      conferir(resultados, 3);
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("aprovar enquanto a mesma conta faz novos pedidos não dá deadlock", async () => {
      const moderador = await criarUsuario("Moderador");
      const pessoa = await criarUsuario();
      const livres = [];
      for (let i = 0; i < 6; i++) livres.push(await criarEmpresa(`livre${i}`));
      const pendentes = [];
      for (let i = 0; i < 4; i++) {
        const empresa = await criarEmpresa(`pendente${i}`);
        const pedido = await db.reivindicacao.create({
          data: { empresaId: empresa.id, usuarioId: pessoa.id, metodo: "documento", expiraEm: new Date(Date.now() + 60_000) },
        });
        pendentes.push(pedido);
      }

      const resultados = await Promise.allSettled([
        ...pendentes.map((p) => aprovar({ reivindicacaoId: p.id, revisorId: moderador.id })),
        ...livres.map((e) => solicitarPorDocumento({ empresaId: e.id, usuarioId: pessoa.id, ...DADOS })),
      ]);

      for (const r of resultados) {
        if (r.status === "rejected") expect(r.reason).toBeInstanceOf(ErroReivindicacao);
      }
      expect(await db.reivindicacao.count({ where: { usuarioId: pessoa.id } })).toBe(10);
    });

    it("a cota de uma conta não trava os pedidos de outra", async () => {
      const [a, b] = [await criarUsuario(), await criarUsuario()];
      const empresas = await criarEmpresasComDono(12, "doc");

      const resultados = await Promise.allSettled(
        empresas.map((e, i) => solicitarPorDocumento({ empresaId: e.id, usuarioId: i % 2 ? a.id : b.id, ...DADOS })),
      );

      conferir(resultados, 12);
      expect(await db.reivindicacao.count({ where: { usuarioId: a.id } })).toBe(6);
      expect(await db.reivindicacao.count({ where: { usuarioId: b.id } })).toBe(6);
    });
  });

  it("não deixa quem já é dono pedir de novo", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("loja.y");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });
    await expect(solicitarPorDocumento({ empresaId: empresa.id, usuarioId: dono.id, cnpj: null, site: null, relacao: "Dona", contato: "x", mensagem: null })).rejects.toThrow(/já é dono/);
    // O código por DM fica aberto a quem já é dono só enquanto o perfil não é oficial.
    await db.empresa.update({ where: { id: empresa.id }, data: { oficial: true } });
    await expect(iniciarPorCodigoDm(empresa.id, dono.id)).rejects.toThrow(/já é dono/);
  });
});

describe("selo de perfil oficial", () => {
  const dadosDoNegocio = { cnpj: null, site: null, relacao: "Dona", contato: "(81) 99999-0000", mensagem: null };

  async function oficial(empresaId: string) {
    return (await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).oficial;
  }

  /** Antes da #133, quem enviava os dados de um negócio sem dono virava dono na hora. */
  async function assumirPelosDados(empresaId: string, usuarioId: string) {
    const moderador = await criarUsuario("Moderação");
    const pedido = await solicitarPorDocumento({ empresaId, usuarioId, ...dadosDoNegocio });
    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });
  }

  /** A pessoa gera o código e a DM chega do @ do negócio. */
  async function confirmarPorDm(empresa: { id: string; instagramUsername: string }, usuarioId: string) {
    const { codigo } = await iniciarPorCodigoDm(empresa.id, usuarioId);
    return processarDm({ remetenteId: `igsid-${usuarioId}`, texto: codigo!, buscarUsername: responde(empresa.instagramUsername) });
  }

  it("a aprovação pelo código por DM deixa o perfil oficial", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");

    expect(await confirmarPorDm(empresa, dono.id)).toBe("aprovada");

    expect(await oficial(empresa.id)).toBe(true);
  });

  it("a aprovação pelo Entrar com Instagram deixa o perfil oficial", async () => {
    const dono = await criarUsuario();
    const empresa = await criarEmpresa("casa.do_bem");

    await processarLoginInstagram({ empresaId: empresa.id, usuarioId: dono.id, conta: { userId: "id-1", username: "casa.do_bem" } });

    expect(await oficial(empresa.id)).toBe(true);
  });

  it("a aprovação pelos dados do negócio, num negócio sem dono, não deixa oficial", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("sem.dono");

    await assumirPelosDados(empresa.id, pessoa.id);

    expect(await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).toMatchObject({ status: "verificada", oficial: false });
  });

  it("a transferência pelos dados do negócio tira o selo, porque quem confirmou sai", async () => {
    const [confirmou, novo, moderador] = await Promise.all(["Confirmou", "Novo", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("loja.oficial");
    await confirmarPorDm(empresa, confirmou.id);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: novo.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "transferir" });

    expect(await donos(empresa.id)).toEqual([novo.id]);
    expect(await oficial(empresa.id)).toBe(false);
  });

  it("o co-dono pelos dados do negócio mantém o selo, porque quem confirmou continua", async () => {
    const [confirmou, socia, moderador] = await Promise.all(["Confirmou", "Sócia", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("loja.oficial");
    await confirmarPorDm(empresa, confirmou.id);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: socia.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "adicionar" });

    expect(await donos(empresa.id)).toEqual([confirmou.id, socia.id].sort());
    expect(await oficial(empresa.id)).toBe(true);
  });

  it("o co-dono pelos dados do negócio não dá o selo a um perfil que não era oficial", async () => {
    const [primeira, socia, moderador] = await Promise.all(["Primeira", "Sócia", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("loja.comum");
    await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: primeira.id, ...dadosDoNegocio });
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: socia.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "adicionar" });

    expect(await oficial(empresa.id)).toBe(false);
  });

  it("a transferência pelo código por DM deixa o perfil oficial", async () => {
    const [antiga, nova, moderador] = await Promise.all(["Antiga", "Nova", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await assumirPelosDados(empresa.id, antiga.id);
    // Já tem dono: a DM certa fica pendente para a moderação.
    expect(await confirmarPorDm(empresa, nova.id)).toBe("em_analise");
    const pedido = await db.reivindicacao.findFirstOrThrow({ where: { empresaId: empresa.id, status: "pendente" } });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "transferir" });

    expect(await donos(empresa.id)).toEqual([nova.id]);
    expect(await oficial(empresa.id)).toBe(true);
  });

  it("quem assumiu pelos dados do negócio confirma pelo código por DM e ganha o selo", async () => {
    const dona = await criarUsuario();
    const empresa = await criarEmpresa("atelie.raiz");
    await assumirPelosDados(empresa.id, dona.id);

    expect(await confirmarPorDm(empresa, dona.id)).toBe("aprovada");

    expect(await donos(empresa.id)).toEqual([dona.id]);
    expect(await oficial(empresa.id)).toBe(true);
  });

  it("quem assumiu pelos dados do negócio confirma pelo Entrar com Instagram e ganha o selo", async () => {
    const dona = await criarUsuario();
    const empresa = await criarEmpresa("atelie.raiz");
    await assumirPelosDados(empresa.id, dona.id);

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: dona.id,
      conta: { userId: "id-atelie", username: "atelie.raiz" },
    });

    expect(resultado).toEqual({ tipo: "verificada" });
    expect(await donos(empresa.id)).toEqual([dona.id]);
    expect(await oficial(empresa.id)).toBe(true);
  });

  it("um perfil oficial que ficou sem dono não passa o selo para quem envia os dados", async () => {
    // Apagar uma conta direto no banco leva junto o vínculo de dono dela.
    const [confirmou, pessoa] = await Promise.all(["Confirmou", "Pessoa"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("loja.orfa");
    await confirmarPorDm(empresa, confirmou.id);
    await db.usuario.delete({ where: { id: confirmou.id } });

    await assumirPelosDados(empresa.id, pessoa.id);

    expect(await donos(empresa.id)).toEqual([pessoa.id]);
    expect(await oficial(empresa.id)).toBe(false);
  });
});

describe("negócio tirado do ar", () => {
  /** Negócio que a moderação tirou do ar, com ou sem um dono que assumiu sem confirmar pelo Instagram. */
  async function tiradoDoAr(username: string, dono?: { id: string }) {
    const empresa = await criarEmpresa(username);
    if (dono) {
      await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });
      await db.empresa.update({ where: { id: empresa.id }, data: { status: "verificada" } });
    }
    await db.empresa.update({ where: { id: empresa.id }, data: { moderacao: "rejeitada" } });
    return empresa;
  }

  /** Continua fora do ar, sem selo, com o pedido pendente e a anotação para a moderação. */
  async function esperaAModeracao(empresaId: string, usuarioId: string, donosEsperados: string[]) {
    expect(await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).toMatchObject({ moderacao: "rejeitada", oficial: false });
    expect(await donos(empresaId)).toEqual(donosEsperados);
    const pedido = await db.reivindicacao.findFirstOrThrow({ where: { empresaId, usuarioId, metodo: { not: "documento" } } });
    expect(pedido.status).toBe("pendente");
    expect(pedido.notas).toContain("fora do ar");
    expect(await db.registroAuditoria.count({ where: { alvoId: empresaId, acao: { startsWith: "reivindicacao.aprovada" } } })).toBe(0);
  }

  it("a DM certa de quem não é dono fica com a moderação", async () => {
    const pessoa = await criarUsuario();
    const empresa = await tiradoDoAr("fora.do.ar.dm");
    const { codigo } = await iniciarPorCodigoDm(empresa.id, pessoa.id);

    const resultado = await processarDm({ remetenteId: "igsid-pessoa", texto: codigo!, buscarUsername: responde("fora.do.ar.dm") });

    expect(resultado).toBe("em_analise");
    await esperaAModeracao(empresa.id, pessoa.id, []);
  });

  it("a DM certa de quem já é dono fica com a moderação", async () => {
    const dona = await criarUsuario();
    const empresa = await tiradoDoAr("fora.do.ar.dm.dono", dona);
    const { codigo } = await iniciarPorCodigoDm(empresa.id, dona.id);

    const resultado = await processarDm({ remetenteId: "igsid-dona", texto: codigo!, buscarUsername: responde("fora.do.ar.dm.dono") });

    expect(resultado).toBe("em_analise");
    await esperaAModeracao(empresa.id, dona.id, [dona.id]);
  });

  it("o login certo de quem não é dono fica com a moderação", async () => {
    const pessoa = await criarUsuario();
    const empresa = await tiradoDoAr("fora.do.ar.login");

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: pessoa.id,
      conta: { userId: "id-pessoa", username: "fora.do.ar.login" },
    });

    expect(resultado).toEqual({ tipo: "em_analise" });
    await esperaAModeracao(empresa.id, pessoa.id, []);
  });

  it("o login certo de quem já é dono fica com a moderação", async () => {
    const dona = await criarUsuario();
    const empresa = await tiradoDoAr("fora.do.ar.login.dono", dona);

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: dona.id,
      conta: { userId: "id-dona", username: "fora.do.ar.login.dono" },
    });

    expect(resultado).toEqual({ tipo: "em_analise" });
    await esperaAModeracao(empresa.id, dona.id, [dona.id]);
  });

  it("a aprovação sem moderação não publica de novo; a da moderação publica", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await tiradoDoAr("fora.do.ar.aprovar");
    const { id } = await iniciarPorCodigoDm(empresa.id, pessoa.id);

    await aprovar({ reivindicacaoId: id, revisorId: null });
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).moderacao).toBe("rejeitada");

    const outra = await criarEmpresa("fora.do.ar.moderacao");
    await db.empresa.update({ where: { id: outra.id }, data: { moderacao: "rejeitada" } });
    const pedido = await iniciarPorCodigoDm(outra.id, pessoa.id);
    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });
    expect((await db.empresa.findUniqueOrThrow({ where: { id: outra.id } })).moderacao).toBe("aprovada");
  });
});

describe("migração do perfil oficial", () => {
  /** O UPDATE da migração que liga o selo nos negócios que já existiam. */
  function sqlDoPreenchimento(): string {
    const pasta = join("prisma", "migrations");
    const migracao = readdirSync(pasta).find((nome) => nome.endsWith("_perfil_oficial"));
    if (!migracao) throw new Error("A migração do perfil oficial não existe.");
    const sql = readFileSync(join(pasta, migracao, "migration.sql"), "utf8");
    const inicio = sql.indexOf('UPDATE "Empresa"');
    if (inicio < 0) throw new Error("A migração do perfil oficial não preenche os negócios que já existem.");
    return sql.slice(inicio, sql.indexOf(";", inicio) + 1);
  }

  it("liga o selo só onde quem confirmou pelo Instagram continua dono", async () => {
    const [dm, login, documento, saiu, ficou] = await Promise.all(
      ["Dm", "Login", "Documento", "Saiu", "Ficou"].map((nome) => criarUsuario(nome)),
    );
    const porDm = await criarEmpresa("migra.dm");
    const porLogin = await criarEmpresa("migra.login");
    const porDocumento = await criarEmpresa("migra.documento");
    const transferida = await criarEmpresa("migra.transferida");
    const aprovada = (empresaId: string, usuarioId: string, metodo: string) =>
      db.reivindicacao.create({ data: { empresaId, usuarioId, metodo, status: "aprovada", expiraEm: new Date() } });
    const dono = (empresaId: string, usuarioId: string) => db.empresaMembro.create({ data: { empresaId, usuarioId } });
    await aprovada(porDm.id, dm.id, "codigo_dm");
    await dono(porDm.id, dm.id);
    await aprovada(porLogin.id, login.id, "instagram_login");
    await dono(porLogin.id, login.id);
    await aprovada(porDocumento.id, documento.id, "documento");
    await dono(porDocumento.id, documento.id);
    // Quem confirmou pelo Instagram saiu numa transferência para quem enviou os dados.
    await aprovada(transferida.id, saiu.id, "codigo_dm");
    await aprovada(transferida.id, ficou.id, "documento");
    await dono(transferida.id, ficou.id);

    await db.$executeRawUnsafe(sqlDoPreenchimento());

    const oficiais = await db.empresa.findMany({ where: { oficial: true }, select: { instagramUsername: true } });
    expect(oficiais.map((e) => e.instagramUsername).sort()).toEqual(["migra.dm", "migra.login"]);
  });
});
