import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { sair } from "@/acoes/conta";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { usuarioAtual } from "@/lib/auth/sessao";
import { FORA_DA_BUSCA } from "@/lib/seo";
import "../area-interna.css";

export const metadata: Metadata = { title: "Sair da conta", robots: FORA_DA_BUSCA };

export default function PaginaSair() {
  return <div className="acesso-conta conta-status container-editorial pagina-operacional"><Suspense fallback={<div className="cartao h-64" role="status" aria-label="Carregando sua conta" />}><Confirmacao /></Suspense></div>;
}

async function Confirmacao() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/");
  return <section className="saida-conta cartao" aria-labelledby="titulo-saida">
    <p className="usuario-contexto">Sua conta</p>
    <h1 id="titulo-saida">Sair por agora?</h1>
    <p>Você vai encerrar o acesso neste navegador e voltar à página inicial. Seus negócios e suas informações continuam salvos.</p>
    <p className="saida-identidade">{usuario.email}</p>
    <form action={sair}><BotaoEnviar className="botao-coral" enviando="Saindo…">Sair e voltar ao início</BotaoEnviar><Link href="/painel" className="botao-claro">Continuar na conta</Link></form>
  </section>;
}
