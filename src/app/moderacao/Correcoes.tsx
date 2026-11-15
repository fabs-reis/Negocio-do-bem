import Link from "next/link";
import { decidirCorrecao } from "@/acoes/correcoes";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { db } from "@/lib/db";
import { formatarDataHora } from "@/lib/texto";

export async function Correcoes() {
  const avisos = await db.correcaoPerfil.findMany({
    where: { status: "pendente" }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], take: 50,
    include: { empresa: { select: { nome: true, instagramUsername: true } }, autor: { select: { nome: true } } },
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">Confira o aviso e use “Editar perfil” para corrigir os dados antes de marcar como corrigido. Os 50 avisos mais antigos aparecem primeiro.</p>
      {!avisos.length && <p className="cartao p-8 text-center text-suave">Nenhuma correção pendente.</p>}
      {avisos.map((aviso) => (
        <article key={aviso.id} className="cartao space-y-4 p-6">
          <h3 className="font-serif text-2xl font-semibold"><Link className="link" href={`/empresas/${aviso.empresa.instagramUsername}`}>{aviso.empresa.nome}</Link></h3>
          <p className="text-sm text-suave">{aviso.autor?.nome ?? "Conta excluída"} · {formatarDataHora(aviso.criadoEm)}</p>
          <dl className="space-y-2 text-sm">
            <dt className="font-semibold">O que está errado</dt><dd className="whitespace-pre-wrap break-words">{aviso.problema}</dd>
            <dt className="font-semibold">Correção sugerida</dt><dd className="whitespace-pre-wrap break-words">{aviso.correcao}</dd>
            {aviso.fonte && <><dt className="font-semibold">Fonte informada</dt><dd className="break-all"><a href={aviso.fonte} target="_blank" rel="noopener noreferrer nofollow" className="link">{aviso.fonte}</a></dd></>}
          </dl>
          <Link href={`/moderacao/negocios/${aviso.empresa.instagramUsername}`} className="link">Editar perfil →</Link>
          <form action={decidirCorrecao} className="flex flex-wrap gap-3">
            <input type="hidden" name="correcaoId" value={aviso.id} />
            <BotaoEnviar name="decisao" value="corrigido" className="botao botao-pequeno">Marcar como corrigido</BotaoEnviar>
            <BotaoEnviar name="decisao" value="sem_mudanca" className="botao-claro botao-pequeno">Encerrar sem mudança</BotaoEnviar>
          </form>
        </article>
      ))}
    </div>
  );
}
