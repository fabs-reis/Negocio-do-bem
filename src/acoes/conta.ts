"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { apagarTokenDeRedefinicao, criarTokenDeRedefinicao, lerTokenDeRedefinicao, redefinirSenha } from "@/lib/auth/redefinicao";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { caminhoSeguro, criarSessao, encerrarSessao } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { avisarRedefinicaoDeSenha } from "@/lib/notificacoes";

const campoEmail = z.email("Digite um e-mail válido.").max(200, "E-mail muito longo.");
const campoSenha = z.string().min(8, "Use pelo menos 8 caracteres.").max(200, "Senha muito longa.");

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Conte como podemos te chamar.").max(80, "Nome muito longo."),
  email: campoEmail,
  senha: campoSenha,
});

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

  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    return { erros: { email: "Já existe uma conta com este e-mail. Que tal entrar?" }, valores: valoresDoFormulario(dados) };
  }

  const usuario = await db.usuario.create({ data: { nome, email, senhaHash: await gerarHashSenha(senha) } });
  await criarSessao(usuario.id);
  redirect(caminhoSeguro(texto(dados, "voltar")));
}

// Hash de uma senha qualquer: quando o e-mail não existe, conferimos contra ele
// para a resposta demorar o mesmo tempo e não revelar quais e-mails têm conta.
let hashFalso: Promise<string> | undefined;

export async function entrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const email = texto(dados, "email").trim().toLowerCase();
  const senha = texto(dados, "senha");
  const usuario = email ? await db.usuario.findUnique({ where: { email } }) : null;
  const senhaConfere = await verificarSenha(senha, usuario?.senhaHash ?? (await (hashFalso ??= gerarHashSenha("senha-que-nao-existe"))));

  if (!usuario || !senhaConfere) {
    return { erro: "E-mail ou senha incorretos.", valores: valoresDoFormulario(dados) };
  }
  await criarSessao(usuario.id);
  redirect(caminhoSeguro(texto(dados, "voltar")));
}

/**
 * Pede o link para criar uma senha nova. A resposta é a mesma exista a conta ou não,
 * para ninguém descobrir quais e-mails têm conta; o e-mail sai depois da resposta.
 */
export async function pedirRedefinicaoDeSenha(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoEmail.safeParse(texto(dados, "email").trim().toLowerCase());
  if (!resultado.success) {
    return { erros: { email: resultado.error.issues[0]!.message }, valores: valoresDoFormulario(dados) };
  }
  const usuario = await db.usuario.findUnique({ where: { email: resultado.data }, select: { id: true } });
  if (usuario) {
    const token = await criarTokenDeRedefinicao(usuario.id);
    if (token) after(() => avisarRedefinicaoDeSenha(usuario.id, token));
  }
  redirect("/entrar?aviso=redefinicao_pedida");
}

/** Troca a senha de quem abriu o link do e-mail (o token vem do cookie guardado por /api/redefinir-senha). */
export async function redefinirSenhaComLink(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoSenha.safeParse(texto(dados, "senha"));
  if (!resultado.success) return { erros: { senha: resultado.error.issues[0]!.message } };

  const token = await lerTokenDeRedefinicao();
  if (!token || !(await redefinirSenha(token, resultado.data))) {
    return { erro: "Este link venceu ou já foi usado. Peça um novo." };
  }
  await apagarTokenDeRedefinicao();
  redirect("/entrar?aviso=senha_redefinida");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/");
}
