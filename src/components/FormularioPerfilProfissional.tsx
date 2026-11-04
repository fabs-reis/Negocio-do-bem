"use client";

import { useActionState } from "react";
import { salvarPerfilProfissional } from "@/acoes/servicos";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { CampoMunicipio } from "@/components/CampoMunicipio";
import { IconeRede } from "@/components/IconeRede";
import { SeletorModalidades } from "@/components/SeletorModalidades";
import { enviarSemLimpar } from "@/components/envio";
import { formatarMunicipio } from "@/lib/texto";

type Perfil = {
  nomePublico: string;
  apresentacao: string;
  cidade: string;
  uf: string;
  remoto: boolean;
  presencial: boolean;
  emailContato: string | null;
  site: string | null;
  publicado: boolean;
};

export function FormularioPerfilProfissional({ perfil }: { perfil: Perfil | null }) {
  const [estado, acao, pendente] = useActionState(salvarPerfilProfissional, undefined);
  const valores = estado?.valores ?? {};
  const valor = (chave: string, inicial = "") => typeof valores[chave] === "string" ? valores[chave] as string : inicial;
  const marcado = (chave: string, inicial = false) => Object.keys(valores).length ? valores[chave] === "sim" : inicial;
  const municipio = valor("municipio", perfil ? formatarMunicipio(perfil.cidade, perfil.uf) : "");

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="cartao overflow-hidden shadow-sm shadow-tinta/5">
      <div className="border-b border-linha bg-coral-50/40 p-5 sm:p-7">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-coral-100 text-coral-700">
          <IconeRede nome="pessoa" className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Perfil profissional</h2>
        <p className="mt-2 text-sm leading-relaxed text-suave">Conte quem você é e como atende. Para publicar, informe um e-mail profissional ou um site.</p>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-widest text-coral-700 uppercase">Sobre você</h3>
          <Campo id="nomePublico" rotulo="Nome profissional" erro={estado?.erros?.nomePublico}>
            <input id="nomePublico" name="nomePublico" required minLength={2} maxLength={80} autoComplete="name" defaultValue={valor("nomePublico", perfil?.nomePublico)} aria-invalid={!!estado?.erros?.nomePublico} placeholder="Como deseja ser conhecido?" className="campo min-h-12" />
          </Campo>
          <Campo id="apresentacao" rotulo="Apresentação" erro={estado?.erros?.apresentacao} ajuda="Conte sua experiência, especialidades e o que pode oferecer.">
            <textarea id="apresentacao" name="apresentacao" required minLength={20} maxLength={1200} rows={4} defaultValue={valor("apresentacao", perfil?.apresentacao)} aria-invalid={!!estado?.erros?.apresentacao} placeholder="Trabalho com…" className="campo min-h-32 resize-y" />
          </Campo>
        </div>

        <div className="space-y-4 border-t border-linha pt-6">
          <h3 className="text-xs font-semibold tracking-widest text-coral-700 uppercase">Onde e como atende</h3>
          <CampoMunicipio key={municipio} valorInicial={municipio} erro={estado?.erros?.municipio} />
          <SeletorModalidades remoto={marcado("remoto", perfil?.remoto)} presencial={marcado("presencial", perfil?.presencial)} erro={estado?.erros?.modalidade} />
        </div>

        <div className="space-y-4 border-t border-linha pt-6">
          <h3 className="text-xs font-semibold tracking-widest text-coral-700 uppercase">Contatos profissionais</h3>
          <p className="text-sm leading-relaxed text-suave">Só os contatos que você informar ficarão visíveis, e apenas enquanto o perfil estiver publicado.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="emailContato" rotulo="E-mail profissional (opcional)" erro={estado?.erros?.emailContato}>
              <input id="emailContato" name="emailContato" type="email" maxLength={200} autoComplete="email" defaultValue={valor("emailContato", perfil?.emailContato ?? "")} placeholder="contato@exemplo.com" className="campo min-h-12" />
            </Campo>
            <Campo id="site" rotulo="Site ou portfólio (opcional)" erro={estado?.erros?.site}>
              <input id="site" name="site" type="text" maxLength={200} defaultValue={valor("site", perfil?.site ?? "")} placeholder="meuportfolio.com.br" className="campo min-h-12" />
            </Campo>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-folha/20 bg-folha-50 px-4 py-4 transition hover:border-folha/40 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-coral">
          <input type="checkbox" name="publicado" value="sim" defaultChecked={marcado("publicado", perfil?.publicado)} className="mt-1 h-4 w-4 shrink-0 accent-folha" />
          <span>
            <span className="block text-sm font-semibold">Publicar meu perfil profissional</span>
            <span className="mt-1 block text-xs leading-relaxed text-suave">Você poderá ocultar o perfil a qualquer momento. Alterações nos dados públicos enviarão seus anúncios novamente para análise.</span>
          </span>
        </label>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        <BotaoEnviar pendente={pendente} enviando="Salvando…" className="botao-coral min-h-12 w-full px-6 sm:w-auto">
          <IconeRede nome="verificar" className="h-4 w-4" /> Salvar perfil
        </BotaoEnviar>
      </div>
    </form>
  );
}
