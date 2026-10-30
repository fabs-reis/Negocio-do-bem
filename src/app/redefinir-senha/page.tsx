import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { FormRedefinirSenha } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { lerTokenDeRedefinicao, tokenDeRedefinicaoValido } from "@/lib/auth/redefinicao";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Senha nova", robots: FORA_DA_BUSCA };

export default function RedefinirSenha(props: PageProps<"/redefinir-senha">) {
  return (
    <PaginaConta
      titulo="Escolha uma senha nova"
      subtitulo="Depois de trocar, você entra de novo com a senha nova em todos os aparelhos."
      searchParams={props.searchParams}
      formulario={() => <Formulario />}
    />
  );
}

async function Formulario() {
  const token = await lerTokenDeRedefinicao();
  if (token && (await tokenDeRedefinicaoValido(token))) return <FormRedefinirSenha />;
  return (
    <div className="space-y-4">
      <Aviso tipo="erro">Este link venceu, já foi usado ou não é válido.</Aviso>
      <Link href="/esqueci-a-senha" className="botao w-full">
        Pedir um link novo
      </Link>
    </div>
  );
}
