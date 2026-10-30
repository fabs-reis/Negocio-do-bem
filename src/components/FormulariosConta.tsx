"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { cadastrar, entrar, pedirLinkDeAcesso } from "@/acoes/conta";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { LoginsExternos } from "@/components/LoginsExternos";

function valorTexto(valores: Record<string, string | string[]> | undefined, campo: string): string {
  const v = valores?.[campo];
  return typeof v === "string" ? v : "";
}

function useFocoErro(estado: unknown) {
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado) formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-erro-formulario]')?.focus();
  }, [estado]);
  return formulario;
}

export function FormEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  const formulario = useFocoErro(estado);
  return (
    <form ref={formulario} action={acao} onSubmit={enviarSemLimpar(acao)} aria-busy={pendente} className="form-conta">
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
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="campo" aria-describedby="senha-ajuda" />
        <p id="senha-ajuda" className="ajuda">
          Esqueceu a senha?{" "}
          <Link href={`/entrar/link?voltar=${encodeURIComponent(voltar)}`} className="link">
            Entre com um link por e-mail
          </Link>
        </p>
      </div>
      {estado?.erro && <div tabIndex={-1} data-erro-formulario><Aviso tipo="erro">{estado.erro}{estado.erro === "E-mail ou senha incorretos." && <p className="mt-2">Confira os dados ou use o link por e-mail para entrar.</p>}</Aviso></div>}
      <BotaoEnviar pendente={pendente} className="botao w-full" enviando="Entrando…">
        Entrar
      </BotaoEnviar>
      <p className="conta-alternativa">
        Ainda não tem conta?{" "}
        <Link href={`/cadastrar?voltar=${encodeURIComponent(voltar)}`} className="link">
          Criar conta
        </Link>
      </p>
      <LoginsExternos />
    </form>
  );
}

export function FormPedirLink({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(pedirLinkDeAcesso, undefined);
  const erros = estado?.erros ?? {};
  const formulario = useFocoErro(estado);
  return (
    <form ref={formulario} action={acao} onSubmit={enviarSemLimpar(acao)} aria-busy={pendente} className="form-conta">
      <input type="hidden" name="voltar" value={voltar} />
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail da sua conta
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={valorTexto(estado?.valores, "email")} className="campo" aria-invalid={!!erros.email} aria-describedby="email-info" />
        {erros.email ? <p id="email-info" className="erro-campo">{erros.email}</p> : <p id="email-info" className="ajuda">O link vale por 15 minutos e uma vez só.</p>}
      </div>
      <BotaoEnviar pendente={pendente} className="botao w-full" enviando="Enviando…">
        Enviar link de acesso
      </BotaoEnviar>
      <p className="conta-alternativa">
        Lembrou a senha?{" "}
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="link">
          Entrar com senha
        </Link>
      </p>
    </form>
  );
}

export function FormCadastro({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  const erros = estado?.erros ?? {};
  const formulario = useFocoErro(estado);
  return (
    <form ref={formulario} action={acao} onSubmit={enviarSemLimpar(acao)} aria-busy={pendente} className="form-conta">
      <input type="hidden" name="voltar" value={voltar} />
      <div>
        <label htmlFor="nome" className="rotulo">
          Seu nome
        </label>
        <input id="nome" name="nome" autoComplete="name" required maxLength={80} defaultValue={valorTexto(estado?.valores, "nome")} className="campo" aria-invalid={!!erros.nome} aria-describedby="nome-info" />
        {erros.nome ? <p id="nome-info" className="erro-campo">{erros.nome}</p> : <p id="nome-info" className="ajuda">Aparece nos seus depoimentos.</p>}
      </div>
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={valorTexto(estado?.valores, "email")} className="campo" aria-invalid={!!erros.email} aria-describedby={erros.email ? "email-erro" : undefined} />
        {erros.email && <p id="email-erro" className="erro-campo">{erros.email}</p>}
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} className="campo" aria-invalid={!!erros.senha} aria-describedby="senha-info" />
        {erros.senha ? <p id="senha-info" className="erro-campo">{erros.senha}</p> : <p id="senha-info" className="ajuda">Pelo menos 8 caracteres.</p>}
      </div>
      {estado?.erro && <div tabIndex={-1} data-erro-formulario><Aviso tipo="erro">{estado.erro}</Aviso></div>}
      <BotaoEnviar pendente={pendente} className="botao-coral w-full" enviando="Criando conta…">
        Criar conta
      </BotaoEnviar>
      <p className="conta-alternativa">
        Já tem conta?{" "}
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="link">
          Entrar
        </Link>
      </p>
    </form>
  );
}
