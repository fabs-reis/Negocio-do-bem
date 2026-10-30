import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { NO_DIRETORIO, resumoDoDiretorio } from "@/lib/consultas";
import { db } from "@/lib/db";
import { INSTAGRAM_DO_PROJETO, REPOSITORIO } from "@/lib/dominio";
import { linkPerfil, normalizarUsername } from "@/lib/instagram";
import { boaCompanhia, decidirProcura } from "@/lib/participacao";
import { metadadosDaPagina } from "@/lib/seo";
import { FormParticipar } from "./FormParticipar";

// A página do link da bio do Instagram, para quem tem um negócio. A porta pede só o @
// e leva ao próximo passo (ver src/lib/participacao.ts). O resultado da procura volta para esta
// mesma página, em /participar?instagram=<@>.

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Faça parte",
  descricao:
    "Tem um negócio que cuida das pessoas, da comunidade ou do planeta? Coloque o @ do Instagram e faça parte do Negócio do Bem. É de graça.",
  caminho: "/participar",
});

const QUEM_JA_ESTA_AQUI = 6;

const PROMESSAS: { titulo: string; texto: ReactNode }[] = [
  { titulo: "É de graça.", texto: "Não tem plano pago." },
  { titulo: "Ninguém compra destaque.", texto: "Não tem anúncio nem ranking." },
  { titulo: "O perfil é seu.", texto: "Você edita quando quiser e tira o negócio do diretório com um clique." },
  { titulo: "Não pedimos a senha do seu Instagram.", texto: "Da sua conta, guardamos só o nome e o e-mail." },
  { titulo: "Tem gente cuidando.", texto: "A moderação tira perfil falso do ar, e as decisões ficam registradas." },
  {
    titulo: "O código é aberto.",
    texto: (
      <>
        Qualquer pessoa pode{" "}
        <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer" className="link">
          ver como o site funciona
        </a>
        .
      </>
    ),
  },
];

const DUVIDAS = [
  {
    pergunta: "Preciso de CNPJ?",
    resposta: "Não. Negócio pequeno, informal ou que está começando também é bem-vindo aqui.",
  },
  {
    pergunta: "Alguém já cadastrou meu negócio. E agora?",
    resposta: "Que bom, é sinal de carinho. Coloque o @ ali em cima e confirme que ele é seu.",
  },
  {
    pergunta: "E se eu não quiser aparecer?",
    resposta: "Você oculta o negócio no seu painel, e ele sai do diretório na hora.",
  },
  {
    pergunta: "O que é o selo de perfil oficial?",
    resposta:
      "É o selo de quem confirmou pelo Instagram do negócio. Ele mostra pra quem visita que foi você mesmo que assumiu o perfil.",
  },
];

export default function Participar(props: PageProps<"/participar">) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
      <section className="flex flex-wrap items-stretch gap-7">
        <div className="flex min-w-0 flex-[999_1_28rem] flex-col justify-center">
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-coral/20 bg-superficie/70 px-4 py-1.5 text-sm font-medium text-coral-700">
            <span aria-hidden="true">🌱</span>
            <span>Para quem tem um negócio do bem</span>
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Que bom que você chegou.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-suave text-pretty sm:text-xl">
            Se o seu negócio cuida das pessoas, da comunidade ou do planeta, ele já é do bem. Só falta a gente se conhecer.
          </p>
        </div>
        <Suspense fallback={<div className="min-h-40 flex-[1_1_18rem] animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
          <BoaCompanhia />
        </Suspense>
      </section>

      <section className="cartao mt-10 p-6 sm:p-8">
        <p className="font-serif text-2xl leading-snug text-balance sm:text-3xl">
          Pra começar, só precisamos do @ do seu negócio no Instagram.
        </p>
        <div className="mt-6">
          <FormParticipar />
        </div>
      </section>

      <Suspense>
        <Resultado searchParams={props.searchParams} />
      </Suspense>

      <Suspense>
        <QuemJaEstaAqui />
      </Suspense>

      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">O que a gente promete</h2>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROMESSAS.map((promessa) => (
            <li key={promessa.titulo} className="cartao p-5 leading-relaxed">
              <strong className="font-semibold">{promessa.titulo}</strong>{" "}
              <span className="text-suave">{promessa.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Dúvidas de quem está chegando</h2>
        <dl className="mt-6 space-y-3">
          {DUVIDAS.map((duvida) => (
            <div key={duvida.pergunta} className="cartao p-5">
              <dt className="font-semibold">{duvida.pergunta}</dt>
              <dd className="mt-1 leading-relaxed text-suave">{duvida.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-3xl bg-tinta px-6 py-10 text-papel sm:px-10">
        <p className="max-w-2xl font-serif text-2xl leading-snug text-balance sm:text-3xl">
          Comprar de quem faz o bem muda o bairro, a cidade e o país. Com você aqui, isso fica mais forte.
        </p>
        {/* Link comum, e não o Link do Next: o navegador leva o foco ao campo do @. */}
        <a href="#instagram" className="botao-coral mt-6 px-6 py-3 text-base">
          Colocar meu negócio
        </a>
        <div className="mt-8 space-y-1 text-papel/75">
          <p>
            Ficou com dúvida? Chama a gente no{" "}
            <a
              href={linkPerfil(INSTAGRAM_DO_PROJETO)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-papel underline decoration-coral underline-offset-4"
            >
              @{INSTAGRAM_DO_PROJETO}
            </a>
            .
          </p>
          <p>
            Não é o dono?{" "}
            <Link href="/indicar" className="font-semibold text-papel underline decoration-coral underline-offset-4">
              Indique um negócio que você ama.
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/** Os números ao vivo do diretório, ao lado das boas-vindas (embaixo, no celular). */
async function BoaCompanhia() {
  const { total, cidades } = await resumoDoDiretorio();
  if (total === 0) return null;
  return (
    <div className="flex flex-[1_1_18rem] items-center rounded-3xl border border-coral/20 bg-coral-50 p-7">
      <p className="font-serif text-2xl leading-snug text-tinta text-balance">{boaCompanhia(total, cidades)}</p>
    </div>
  );
}

/** O que a procura achou, quando a porta trouxe a pessoa de volta com ?instagram=<@>. */
async function Resultado({ searchParams }: Pick<PageProps<"/participar">, "searchParams">) {
  const { instagram: valor } = await searchParams;
  const instagram = normalizarUsername(Array.isArray(valor) ? valor[0] : valor);
  if (!instagram) return null;
  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: instagram },
    select: {
      nome: true,
      instagramUsername: true,
      fotoUrl: true,
      moderacao: true,
      oculta: true,
      motivoIndicacao: true,
      indicadaPor: { select: { nome: true } },
      _count: { select: { membros: true } },
    },
  });
  const negocio = empresa && { moderacao: empresa.moderacao, oculta: empresa.oculta, donos: empresa._count.membros };
  // O caso não depende do login: só o destino da indicação depende.
  const { caso } = decidirProcura(instagram, negocio, false);
  if (caso === "indicar" || !empresa) return null;

  if (caso === "indisponivel") {
    // Sem nome, foto ou motivo: o @ pode estar tirado do ar ou oculto pelo dono.
    return (
      <Cartao>
        <p className="leading-relaxed">
          Não conseguimos seguir com esse @ por aqui. Fala com a gente no{" "}
          <a href={linkPerfil(INSTAGRAM_DO_PROJETO)} target="_blank" rel="noopener noreferrer" className="link">
            @{INSTAGRAM_DO_PROJETO}
          </a>{" "}
          que a gente resolve.
        </p>
      </Cartao>
    );
  }

  const perfil = `/empresas/${empresa.instagramUsername}`;
  const negocioEncontrado = (
    <div className="flex items-center gap-3">
      <FotoEmpresa empresa={empresa} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{empresa.nome}</p>
        <p className="truncate text-sm text-suave">@{empresa.instagramUsername}</p>
      </div>
    </div>
  );

  if (caso === "revisao") {
    return (
      <Cartao>
        {negocioEncontrado}
        <h2 className="mt-5 font-serif text-2xl font-semibold">Esse negócio já tem alguém cuidando do perfil.</h2>
        <p className="mt-2 leading-relaxed text-suave">
          Se ele é seu e você não reconhece quem assumiu, peça uma revisão. A gente olha com cuidado.
        </p>
        <Link href={`${perfil}/reivindicar`} className="botao mt-5">
          Pedir revisão
        </Link>
      </Cartao>
    );
  }

  return (
    <Cartao destaque>
      {negocioEncontrado}
      <h2 className="mt-5 font-serif text-3xl font-semibold">Seu negócio já está aqui!</h2>
      {empresa.motivoIndicacao ? (
        <figure className="mt-3">
          <figcaption className="text-suave">
            {empresa.indicadaPor?.nome ?? "Alguém da comunidade"} indicou ele com carinho:
          </figcaption>
          <blockquote className="mt-2 font-serif text-xl leading-relaxed text-tinta/85">“{empresa.motivoIndicacao}”</blockquote>
        </figure>
      ) : (
        <p className="mt-3 text-suave">Alguém da comunidade indicou ele com carinho.</p>
      )}
      <p className="mt-4 font-medium">Agora é só confirmar que ele é seu.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href={`${perfil}/reivindicar`} className="botao-coral px-6 py-3 text-base">
          É meu negócio
        </Link>
        <Link href={perfil} className="botao-claro">
          Ver o perfil
        </Link>
      </div>
    </Cartao>
  );
}

function Cartao({ destaque = false, children }: { destaque?: boolean; children: ReactNode }) {
  return (
    <section
      id="resultado"
      aria-live="polite"
      className={`cartao mt-4 scroll-mt-24 p-6 sm:p-8 ${destaque ? "border-coral/30 bg-coral-50/40" : ""}`}
    >
      {children}
    </section>
  );
}

/** Negócios do diretório com dono e foto, os mais recentes primeiro. Some quando não há nenhum. */
async function QuemJaEstaAqui() {
  const negocios = await db.empresa.findMany({
    where: { ...NO_DIRETORIO, fotoUrl: { not: null }, membros: { some: {} } },
    orderBy: { criadoEm: "desc" },
    take: QUEM_JA_ESTA_AQUI,
    select: { instagramUsername: true, nome: true, fotoUrl: true, categoria: true, cidade: true, uf: true },
  });
  if (negocios.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Quem já está aqui</h2>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {negocios.map((negocio) => (
          <li key={negocio.instagramUsername}>
            <Link
              href={`/empresas/${negocio.instagramUsername}`}
              className="group cartao flex items-center gap-3 p-4 transition hover:border-coral/30"
            >
              <FotoEmpresa empresa={negocio} />
              <span className="min-w-0">
                <span className="block truncate font-semibold group-hover:text-coral-700">{negocio.nome}</span>
                <span className="block truncate text-sm text-suave">
                  {negocio.categoria} · {negocio.cidade}, {negocio.uf}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
