"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { CONFIRMACAO_DE_EMAIL_LIGADA, COOKIE_LINK, avisarSenhaRedefinida, criarLink, enviarLink, lerLink, redefinirSenhaComLink, usarLink } from "@/lib/auth/links";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { caminhoSeguro, criarSessao, encerrarSessao, exigirUsuario } from "@/lib/auth/sessao";
import { ipDoCabecalho, reservarTentativaDoEmail, tentativaDoIpLiberada, zerarTentativasDeTodasAsOrigens, zerarTentativasDoEmail } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";

const campoEmail = z.email("Digite um e-mail válido.").max(200, "E-mail muito longo.");
const campoSenha = z.string().min(8, "Use pelo menos 8 caracteres.").max(200, "Senha muito longa.");

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Conte como podemos te chamar.").max(80, "Nome muito longo."),
  email: campoEmail,
  senha: campoSenha,
});

/** IP de quem fez a requisição, ou null se não der para confiar em nenhum cabeçalho (veja `ipDoCabecalho`). */
async function ipDaRequisicao(): Promise<string | null> {
  return ipDoCabecalho(await headers());
}

export async function cadastrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaCadastro.safeParse({
    nome: texto(dados, "nome"),
    email: texto(dados, "email").trim().toLowerCase(),
    senha: texto(dados, "senha"),
  });
  if (!resultado.success) {
    return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };
  }
  const { nome, email, senha } = resultado.data;

  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.", valores: valoresDoFormulario(dados) };
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    return { erros: { email: "Já existe uma conta com este e-mail. Que tal entrar?" }, valores: valoresDoFormulario(dados) };
  }

  const usuario = await db.usuario.create({ data: { nome, email, senhaHash: await gerarHashSenha(senha) } });
  await criarSessao(usuario.id);
  const voltar = caminhoSeguro(texto(dados, "voltar"));
  if (CONFIRMACAO_DE_EMAIL_LIGADA) {
    after(async () => {
      const token = await criarLink(usuario, "confirmar", voltar);
      if (token) await enviarLink(usuario, "confirmar", token);
    });
  }
  redirect(voltar);
}

// Hash de uma senha qualquer: quando o e-mail não existe, conferimos contra ele
// para a resposta demorar o mesmo tempo e não revelar quais e-mails têm conta.
let hashFalso: Promise<string> | undefined;

export async function entrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const email = texto(dados, "email").trim().toLowerCase();
  const senha = texto(dados, "senha");
  const recusado = { erro: "E-mail ou senha incorretos.", valores: valoresDoFormulario(dados) };

  const ip = await ipDaRequisicao();
  if (!(await tentativaDoIpLiberada(ip)) || (email && !(await reservarTentativaDoEmail(email, ip)))) {
    return recusado;
  }

  const usuario = email ? await db.usuario.findUnique({ where: { email } }) : null;
  const senhaConfere = await verificarSenha(senha, usuario?.senhaHash ?? (await (hashFalso ??= gerarHashSenha("senha-que-nao-existe"))));

  if (!usuario || !senhaConfere) return recusado;
  await zerarTentativasDoEmail(email, ip);
  await criarSessao(usuario.id);
  redirect(caminhoSeguro(texto(dados, "voltar")));
}

/**
 * Pede o link para entrar sem senha. A resposta é a mesma com ou sem conta, e o
 * link é criado e mandado depois da resposta, para o tempo também não revelar nada.
 */
export async function pedirLinkDeAcesso(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoEmail.safeParse(texto(dados, "email").trim().toLowerCase());
  if (!resultado.success) {
    return { erros: { email: resultado.error.issues[0]?.message ?? "Digite um e-mail válido." }, valores: valoresDoFormulario(dados) };
  }
  const usuario = await db.usuario.findUnique({
    where: { email: resultado.data },
    select: { id: true, nome: true, email: true },
  });
  if (usuario) {
    const voltar = caminhoSeguro(texto(dados, "voltar"));
    after(async () => {
      const token = await criarLink(usuario, "entrar", voltar);
      if (token) await enviarLink(usuario, "entrar", token);
    });
  }
  redirect("/entrar/link/enviado");
}

export type EstadoReenvio = { enviado?: boolean; erro?: string } | undefined;

/** Manda de novo o link de confirmação para quem está logado e ainda não confirmou. */
export async function reenviarConfirmacao(_estado: EstadoReenvio, dados: FormData): Promise<EstadoReenvio> {
  const voltar = caminhoSeguro(texto(dados, "voltar"));
  const usuario = await exigirUsuario(voltar);
  if (usuario.emailConfirmado) redirect(voltar);
  const token = await criarLink(usuario, "confirmar", voltar);
  if (!token) return { erro: "Você pediu muitos e-mails na última hora. Espere um pouco e tente de novo." };
  after(() => enviarLink(usuario, "confirmar", token));
  return { enviado: true };
}

/** O clique em /link: usa o link guardado no cookie por /api/link. */
export async function usarLinkDoEmail(): Promise<void> {
  const loja = await cookies();
  const token = loja.get(COOKIE_LINK)?.value ?? "";
  // Um link de redefinir só se gasta trocando a senha (`criarSenhaComLink`).
  if ((await lerLink(token))?.finalidade === "redefinir") redirect("/link");
  loja.delete({ name: COOKIE_LINK, path: "/link" });
  const link = await usarLink(token);
  if (!link) redirect("/link");
  const destino = caminhoSeguro(link.destino);
  if (link.finalidade === "entrar") {
    await criarSessao(link.usuario.id);
    redirect(destino);
  }
  redirect(`/link?confirmado=1&voltar=${encodeURIComponent(destino)}`);
}

/**
 * Pede o link para criar uma senha nova. A resposta é a mesma exista a conta ou não, e o
 * link é criado e mandado depois da resposta, para o tempo também não revelar nada.
 * Cada pedido gasta uma tentativa do IP, como o login: sem isso dava para testar muitos
 * e-mails (a conta também tem o limite de links por hora, em `criarLink`).
 */
export async function pedirRedefinicaoDeSenha(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoEmail.safeParse(texto(dados, "email").trim().toLowerCase());
  if (!resultado.success) {
    return { erros: { email: resultado.error.issues[0]?.message ?? "Digite um e-mail válido." }, valores: valoresDoFormulario(dados) };
  }
  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.", valores: valoresDoFormulario(dados) };
  }
  const usuario = await db.usuario.findUnique({
    where: { email: resultado.data },
    select: { id: true, nome: true, email: true },
  });
  if (usuario) {
    after(async () => {
      const token = await criarLink(usuario, "redefinir");
      if (token) await enviarLink(usuario, "redefinir", token);
    });
  }
  redirect("/entrar?aviso=redefinicao_pedida");
}

/** Troca a senha de quem abriu o link do e-mail (o token vem do cookie guardado por /api/link). */
export async function criarSenhaComLink(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoSenha.safeParse(texto(dados, "senha"));
  if (!resultado.success) return { erros: { senha: resultado.error.issues[0]!.message } };

  // Cada troca calcula o scrypt, então também passa pelo limite por IP.
  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
  }
  const loja = await cookies();
  const token = loja.get(COOKIE_LINK)?.value ?? "";
  const conta = await redefinirSenhaComLink(token, resultado.data);
  if (!conta) return { erro: "Este link venceu ou já foi usado." };

  loja.delete({ name: COOKIE_LINK, path: "/link" });
  await zerarTentativasDeTodasAsOrigens(conta.email);
  after(() => avisarSenhaRedefinida(conta));
  redirect("/entrar?aviso=senha_redefinida");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/");
}
