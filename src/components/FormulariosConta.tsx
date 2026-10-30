"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrar, entrar, pedirRedefinicaoDeSenha, redefinirSenhaComLink } from "@/acoes/conta";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";

function valorTexto(valores: Record<string, string | string[]> | undefined, campo: string): string {
  const v = valores?.[campo];
  return typeof v === "string" ? v : "";
}

export function FormEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <input type="hidden" name="voltar" value={voltar} />
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={valorTexto(estado?.valores, "email")} className="campo" />
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="campo" />
        <p className="mt-1 text-sm">
          <Link href="/esqueci-a-senha" className="link">
            Esqueci minha senha
          </Link>
        </p>
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} className="botao w-full" enviando="Entrando…">
        Entrar
      </BotaoEnviar>
      <p className="text-center text-sm text-suave">
        Ainda não tem conta?{" "}
        <Link href={`/cadastrar?voltar=${encodeURIComponent(voltar)}`} className="link">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export function FormCadastro({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  const erros = estado?.erros ?? {};
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <input type="hidden" name="voltar" value={voltar} />
      <div>
        <label htmlFor="nome" className="rotulo">
          Seu nome
        </label>
        <input id="nome" name="nome" autoComplete="name" required maxLength={80} defaultValue={valorTexto(estado?.valores, "nome")} className="campo" aria-invalid={!!erros.nome} />
        {erros.nome ? <p className="erro-campo">{erros.nome}</p> : <p className="ajuda">Aparece nos seus depoimentos.</p>}
      </div>
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={valorTexto(estado?.valores, "email")} className="campo" aria-invalid={!!erros.email} />
        {erros.email && <p className="erro-campo">{erros.email}</p>}
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} className="campo" aria-invalid={!!erros.senha} />
        {erros.senha ? <p className="erro-campo">{erros.senha}</p> : <p className="ajuda">Pelo menos 8 caracteres.</p>}
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} className="botao-coral w-full" enviando="Criando conta…">
        Criar conta
      </BotaoEnviar>
      <p className="text-center text-sm text-suave">
        Já tem conta?{" "}
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="link">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function FormEsqueciASenha() {
  const [estado, acao, pendente] = useActionState(pedirRedefinicaoDeSenha, undefined);
  const erros = estado?.erros ?? {};
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={valorTexto(estado?.valores, "email")} className="campo" aria-invalid={!!erros.email} />
        {erros.email && <p className="erro-campo">{erros.email}</p>}
      </div>
      <BotaoEnviar pendente={pendente} className="botao w-full" enviando="Enviando…">
        Enviar o link
      </BotaoEnviar>
      <p className="text-center text-sm text-suave">
        Lembrou?{" "}
        <Link href="/entrar" className="link">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function FormRedefinirSenha() {
  const [estado, acao, pendente] = useActionState(redefinirSenhaComLink, undefined);
  const erros = estado?.erros ?? {};
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha nova
        </label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} className="campo" aria-invalid={!!erros.senha} />
        {erros.senha ? <p className="erro-campo">{erros.senha}</p> : <p className="ajuda">Pelo menos 8 caracteres.</p>}
      </div>
      {estado?.erro && (
        <Aviso tipo="erro">
          {estado.erro}{" "}
          <Link href="/esqueci-a-senha" className="link">
            Pedir um link novo
          </Link>
        </Aviso>
      )}
      <BotaoEnviar pendente={pendente} className="botao w-full" enviando="Salvando…">
        Salvar senha nova
      </BotaoEnviar>
    </form>
  );
}
