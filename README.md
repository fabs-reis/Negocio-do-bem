# Negócio do Bem

Um diretório de negócios com consciência social e conexão com a comunidade. As pessoas encontram negócios que compartilham dos seus valores, indicam quem admiram e deixam depoimentos. Os donos assumem o perfil do negócio, a moderação confere os dados e eles contam a própria história.

- **Diretório** com busca (sem diferenciar acentos) e filtros por causa e estado.
- **Perfis** com a história do negócio no estilo Substack (Markdown, tipografia serifada), badges de causas e depoimentos.
- **Causas** como Pet friendly, Antirracista, Escala 5x2, Escala 4x3 e outras (lista em `src/lib/causas.ts`).
- **Indicação** pela comunidade, com moderação antes de publicar.
- **Reivindicação de propriedade** pelo dono, explicada abaixo.
- **Painel do dono** para editar o perfil, responder depoimentos e ocultar o negócio.
- **Moderação** com filas de reivindicações, indicações e denúncias, e registro de auditoria.

## Telas

As imagens usam os dados de exemplo do seed.

![Página inicial com a busca e os filtros por causa](docs/prints/home.png)

| Diretório | Perfil do negócio |
| --- | --- |
| ![Cards do diretório com os selos de causas](docs/prints/diretorio.png) | ![Perfil da Padaria Florescer com a história no estilo Substack](docs/prints/perfil.png) |
| **Depoimentos** | **Painel do dono** |
| ![Depoimentos da comunidade com a resposta do dono](docs/prints/depoimentos.png) | ![Painel do dono editando o perfil](docs/prints/painel-do-dono.png) |

<p align="center">
  <img src="docs/prints/celular-home.png" alt="Página inicial no celular" width="280">
  <img src="docs/prints/celular-perfil.png" alt="Perfil do negócio no celular" width="280">
</p>

## Stack

Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, Prisma 7 + PostgreSQL, Zod e Vitest. A autenticação é por e-mail e senha (scrypt), com sessão em cookie `httpOnly`. O cookie guarda o token e o banco guarda só o hash dele.

## Rodando localmente

Requisitos: Node 22.12+ e Docker (ou um PostgreSQL seu).

```bash
docker compose up -d          # sobe o Postgres em localhost:5433
cp .env.example .env          # ajuste ADMIN_EMAILS com o seu e-mail
npm install                   # também gera o cliente do Prisma
npm run db:migrate            # cria as tabelas
npm run db:seed               # dados de exemplo (opcional)
npm run dev                   # http://localhost:3000
```

O seed cria negócios fictícios e estas contas, todas com a senha `senha-demo-123`:

| E-mail | Papel |
| --- | --- |
| `moderacao@exemplo.com` | moderação |
| `ana@exemplo.com`, `joao@exemplo.com`, `bia@exemplo.com` | donos de negócios de exemplo |
| `carla@exemplo.com` | enviou os dados do Café Arco-Íris e espera a moderação |

Quem estiver em `ADMIN_EMAILS` vira moderador ao entrar.

### Problemas comuns

- **"User was denied access on the database"**: o `DATABASE_URL` está apontando para outro Postgres, geralmente um instalado no computador (Homebrew ou Postgres.app) na porta 5432. O do Docker usa a **5433**: confira se o seu `.env` tem `localhost:5433`, como no `.env.example`, e rode `npm run db:migrate` de novo.
- **"Can't reach database server"**: o Docker não está rodando. Abra o Docker Desktop e rode `docker compose up -d`.
- **"The table `public.Empresa` does not exist"**: faltou criar as tabelas. Rode `npm run db:migrate`.
- Depois de mudar o `.env`, pare o `npm run dev` (Ctrl+C) e rode de novo.

## Como o dono reivindica o negócio

Tudo começa no botão "Sou o dono" do perfil (`/empresas/<@>/reivindicar`). Por enquanto, o caminho é um só: a pessoa envia os **dados do negócio** e a moderação confere antes de aprovar.

- **CNPJ ou MEI** (opcional): a moderação vê o CNPJ formatado e os dados da Receita ao lado.
- **Site** (opcional): aparece como link na ficha da moderação.
- **Instagram**: é o @ do próprio perfil, que a moderação abre para comparar com o CNPJ e o site.
- **Relação com o negócio** e **contato** (obrigatórios), para a moderação tirar dúvidas.

Duas formas automáticas de verificação já estão no código, mas ficam **desligadas** até você preencher as variáveis no `.env`:

| Caminho | Liga quando | Como é aprovado |
| --- | --- | --- |
| **Entrar com Instagram** | `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` preenchidos | Na hora, se o @ conectado for o do negócio (só contas comerciais ou de criador) |
| **Código por DM** | `INSTAGRAM_PERFIL_OFICIAL` preenchido | Pela moderação, ou sozinho se o webhook estiver configurado |

Com algum deles ligado, o envio de dados vira a opção "Não tenho acesso ao Instagram do negócio". Se ligar um deles, atualize também o texto de `src/app/sobre/page.tsx`, que hoje só descreve o envio de dados.

Regras que protegem os negócios (em `src/lib/reivindicacao.ts`):

- Nos caminhos pelo Instagram, o perfil fica ligado ao **ID da conta**, não só ao @. Se um @ mudar de dono, a verificação nova vai para análise em vez de ser aprovada sozinha.
- **Não existe aprovação automática quando há conflito**: o negócio já tem dono, o ID da conta é diferente do registrado ou a conta já está ligada a outro perfil. Nesses casos a moderação decide se adiciona a pessoa como co-dona ou transfere o perfil.
- Quando ligado, o código da DM vale 48 horas, fica preso à conta de quem o gerou e só é aceito se vier do @ do negócio. A tela avisa para nunca enviar um código passado por outra pessoa.
- Cada pessoa pode fazer no máximo 10 solicitações e 10 indicações por dia.
- Toda aprovação, recusa, edição e decisão de moderação fica registrada na auditoria (`/moderacao?aba=auditoria`).
- Donos respondem depoimentos, mas não apagam. Uma denúncia não esconde o depoimento: só a moderação remove.
- O dono pode **ocultar** o negócio do diretório a qualquer momento, por exemplo se foi indicado e não quer aparecer.

### Ativando o código por DM (opcional)

Preencha `INSTAGRAM_PERFIL_OFICIAL` com o @ do perfil oficial do Negócio do Bem, que recebe as DMs. A moderação confere cada DM e localiza o pedido pelo código na aba de reivindicações. Para a confirmação ser automática, veja a seção do webhook abaixo.

### Ativando o "Entrar com Instagram" (opcional)

> Os nomes de telas e permissões da Meta mudam com frequência. Confira a [documentação oficial](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) antes de configurar.

1. Em [developers.facebook.com](https://developers.facebook.com/), crie um app do tipo **Negócios** e adicione o produto **Instagram**, na opção de API com **login do Instagram**.
2. Nas configurações de login, cadastre a URL de redirecionamento `https://SEU-DOMINIO/api/instagram/retorno`, com o mesmo valor de `APP_URL`.
3. Copie o ID e a chave secreta **do app do Instagram** para `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
4. Enquanto o app estiver em desenvolvimento, só as contas cadastradas como testadoras conseguem entrar. Para liberar para todo mundo, peça a revisão do app (acesso avançado à permissão `instagram_business_basic`) e faça a verificação do negócio na Meta.

O site pede só `instagram_business_basic`, lê apenas o `user_id` e o `username` e **não guarda o token**.

### Ativando a confirmação automática da DM (opcional)

1. Conecte o perfil oficial (`INSTAGRAM_PERFIL_OFICIAL`) ao app e gere um token dele com `instagram_business_basic` e `instagram_business_manage_messages`. Coloque o token em `INSTAGRAM_ACCESS_TOKEN`.
2. Cadastre o webhook com a URL `https://SEU-DOMINIO/api/webhooks/instagram` e o mesmo texto de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`. Depois assine o campo `messages`.
3. Tokens de longa duração do Instagram vencem e precisam ser renovados periodicamente. Se o token vencer, nada quebra: as DMs passam a cair na fila da moderação com uma anotação.

O webhook confere a assinatura `X-Hub-Signature-256` de cada chamada, descobre o @ de quem mandou a DM e só aprova sozinho quando o @ bate e não há conflito.

## Testes e verificações

```bash
npm test          # testes unitários e de banco (precisa do Postgres rodando)
npm run lint
npm run typecheck
```

Os testes usam um banco separado (`negocio_do_bem_teste`, ou o de `TEST_DATABASE_URL`). Ele é criado na primeira execução e as tabelas são limpas entre os testes. Por segurança, a suíte só roda se o nome do banco tiver "test".

## Publicando

Funciona em qualquer hospedagem de Next.js com um PostgreSQL gerenciado.

**No Vercel**

1. Em **Storage**, crie um banco **Neon** e conecte ao projeto sem prefixo, para as variáveis se chamarem `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
2. Em **Environment Variables**, configure `ADMIN_EMAILS` e `APP_URL` (o domínio público, como `https://seu-projeto.vercel.app`). As do Instagram são opcionais.
3. Pronto. A cada deploy de produção, o `scripts/vercel-build.sh` aplica as migrações pendentes antes do build.

**Em outra hospedagem**

1. Configure as variáveis de `.env.example` no painel da hospedagem. `APP_URL` precisa ser o domínio público.
2. Aplique as migrações no banco de produção com `npm run db:deploy`. Faça isso a cada mudança no `prisma/schema.prisma`.
3. O `npm install` gera o cliente do Prisma, e o `npm run build` faz o resto.

Nunca rode o seed em produção: ele cria contas com senha conhecida e se recusa a rodar quando `NODE_ENV=production`.

## Estrutura

```
prisma/              esquema, migrações e dados de exemplo
src/acoes/           Server Actions (formulários), sempre conferindo permissão no servidor
src/app/             páginas e rotas (api/instagram e api/webhooks/instagram)
src/components/      componentes de interface
src/lib/             regras de negócio: reivindicacao.ts, instagram.ts, auth/, causas.ts, cnpj.ts…
tests/               testes (unit/ sem banco, db/ com banco)
```

## Próximos passos sugeridos

- Uma verificação mais automática para o dono: hoje a moderação confere CNPJ, site e Instagram à mão.
- Recuperação de senha e confirmação de e-mail (precisa de um serviço de envio de e-mail).
- Limite de tentativas de login por IP.
- Avisar o dono por e-mail quando a reivindicação for decidida ou quando chegar um depoimento.
- Upload de fotos do negócio.
- Renovação automática do token do Instagram usado pelo webhook.

## Como contribuir

Contribuições são bem-vindas. O [CONTRIBUTING.md](CONTRIBUTING.md) explica como rodar o projeto, as regras do código e como abrir um pull request. Achou uma falha de segurança? Avise em particular, como explica o [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE): você pode usar, copiar e modificar o código, inclusive em outros projetos, desde que mantenha o aviso de licença.
