"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmarConfiguracaoMfa, iniciarConfiguracaoMfa, validarSegundoFator } from "@/acoes/mfa";
import { BotaoEnviar } from "@/components/BotaoEnviar";

function AvisoErro({ mensagem }: { mensagem?: string }) {
  return mensagem ? <p role="alert" className="text-sm text-coral-700">{mensagem}</p> : null;
}

export function PainelMfa({
  configurado,
  verificado,
  revalidar,
  voltar,
}: {
  configurado: boolean;
  verificado: boolean;
  revalidar: boolean;
  voltar: string;
}) {
  const [inicio, iniciar, iniciando] = useActionState(iniciarConfiguracaoMfa, undefined);
  const [confirmacao, confirmar, confirmando] = useActionState(confirmarConfiguracaoMfa, undefined);
  const [validacao, validar, validando] = useActionState(validarSegundoFator, undefined);

  if (!configurado) {
    return (
      <section className="cartao space-y-6 p-6">
        <h2 className="font-semibold">Ativar verificação em duas etapas</h2>
        <p className="text-sm text-suave">
          Use uma aplicação autenticadora compatível com TOTP. A configuração exige a senha atual.
          Quem usa apenas o Google deve primeiro criar uma senha pelo link disponível no painel.
        </p>
        {!confirmacao?.codigos && (
          <>
            <form action={iniciar} className="space-y-3">
              <label htmlFor="mfa-senha" className="rotulo">Senha atual</label>
              <input id="mfa-senha" name="senha" type="password" autoComplete="current-password" required className="campo" />
              <AvisoErro mensagem={inicio?.erro} />
              <BotaoEnviar pendente={iniciando} className="botao" enviando="Preparando…">
                Gerar chave de autenticação
              </BotaoEnviar>
            </form>
            {inicio?.segredo && (
              <div className="space-y-2">
                <p className="text-sm">Adicione uma conta na aplicação autenticadora e introduza manualmente esta chave:</p>
                <code className="block break-all rounded-xl bg-papel p-3 text-sm font-semibold" aria-label="Chave MFA">{inicio.segredo}</code>
                <p className="text-xs text-suave">Tipo: baseado em tempo (TOTP), 6 dígitos, 30 segundos. Guarde a chave em privado.</p>
              </div>
            )}
            <form action={confirmar} className="space-y-3">
              <label htmlFor="mfa-confirmar" className="rotulo">Código de 6 dígitos da aplicação</label>
              <input id="mfa-confirmar" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="campo" />
              <AvisoErro mensagem={confirmacao?.erro} />
              <BotaoEnviar pendente={confirmando} className="botao" enviando="Ativando…">Ativar segundo fator</BotaoEnviar>
            </form>
          </>
        )}
        {confirmacao?.codigos && (
          <div className="space-y-4">
            <p className="font-semibold">MFA ativado. Guarde os códigos de recuperação num local seguro.</p>
            <p className="text-sm text-suave">
              Cada código só pode ser utilizado uma vez. Não serão mostrados novamente e não substituem a senha.
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {confirmacao.codigos.map((codigo) => <li key={codigo}><code className="text-sm">{codigo}</code></li>)}
            </ul>
            <Link href="/moderacao" className="link block">Ir para a moderação</Link>
          </div>
        )}
      </section>
    );
  }
  if (verificado && !revalidar) {
    return (
      <section className="cartao space-y-3 p-6">
        <p className="font-semibold">Segundo fator verificado nesta sessão.</p>
        <Link className="link block" href={voltar}>Continuar para a moderação</Link>
      </section>
    );
  }
  return (
    <section className="cartao space-y-4 p-6">
      <h2 className="font-semibold">{revalidar ? "Confirme novamente a sua identidade" : "Confirmar o segundo fator"}</h2>
      <p className="text-sm text-suave">
        Introduza o código da sua aplicação autenticadora ou um código de recuperação ainda não utilizado.
      </p>
      <form action={validar} className="space-y-3">
        <input type="hidden" name="voltar" value={voltar} />
        <label className="rotulo" htmlFor="mfa-codigo">Código de autenticação</label>
        <input id="mfa-codigo" name="codigo" type="text" autoComplete="one-time-code" autoCapitalize="characters" required maxLength={39} className="campo" />
        <AvisoErro mensagem={validacao?.erro} />
        <BotaoEnviar pendente={validando} className="botao" enviando="Verificando…">Verificar e continuar</BotaoEnviar>
      </form>
    </section>
  );
}
