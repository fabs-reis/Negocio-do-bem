## Issue relacionada

<!-- Use "Closes #N" se esta PR resolve a Issue e "Refs #N" se apenas se relaciona. -->

Closes #

## O que muda e por quê

<!-- Explique a mudança e o motivo. Prefira PRs pequenas, com um assunto só. -->

## Como testar

<!-- Passos para quem for revisar ou testar. Se mexeu na interface, coloque prints. -->

1.
2.
3.

## Dependências e trabalhos relacionados

<!-- Esta PR depende de outra, ou trata do mesmo assunto que outra PR ou Issue? Se não souber, escreva "Nenhum conhecido". -->

## Antes de pedir revisão (autor)

- [ ] Atende aos critérios de aceite da Issue
- [ ] Rodei `npm run lint`, `npm run typecheck` e `npm test`
- [ ] Mudei uma regra de negócio? Atualizei o `docs/regras-de-negocio.md`
- [ ] Mudei o `prisma/schema.prisma`? Incluí a migração
- [ ] Mudei a reivindicação (`src/lib/reivindicacao.ts`)? Atualizei ou criei o teste em `tests/db/`
- [ ] Não incluí `.env` nem dados reais de pessoas ou negócios
- [ ] Verifiquei se existe outra PR para o mesmo assunto
- [ ] Se o trabalho ainda não terminou, deixei a PR como **Draft**

<details>
<summary><b>Para quem revisa</b></summary>

A revisão precisa ser de **outra pessoa**; a do próprio autor não conta.

- [ ] A PR resolve o que a Issue pede e atende aos critérios de aceite
- [ ] O escopo é pequeno, com um assunto só
- [ ] Os checks passaram no último commit e não há conflito com a stage
- [ ] Toda Server Action confere a permissão no servidor, não só na interface
- [ ] Regra de negócio, migração e testes da reivindicação foram atualizados quando necessário
- [ ] Não há `.env` nem dados reais de pessoas ou negócios
- [ ] Existe outra PR para o mesmo assunto, ou uma dependência não integrada?

Registre o resultado em um comentário:

```
Revisão
- Resultado: aprovado / precisa de alterações
- Commit revisado: (código do commit)
- Pontos a resolver: (liste, ou escreva "nenhum")
- O que não consegui verificar:
```

Se a PR mudar depois da revisão, a aprovação anterior não vale para o novo commit.

</details>

<details>
<summary><b>Para quem testa (QA-Test)</b></summary>

Use apenas dados fictícios, como os do seed.

- [ ] Testei cada critério de aceite da Issue
- [ ] Se é um bug, reproduzi o problema com as evidências da Issue e confirmei que ele não acontece mais
- [ ] Testei o fluxo principal, do começo ao fim
- [ ] Testei os casos de erro mencionados na Issue ou na PR
- [ ] Se a regra envolve permissão, testei os perfis afetados
- [ ] Se mexeu na interface, testei em tela pequena e grande

Registre o resultado em um comentário:

```
Validação
- Ambiente testado: preview da PR ou stage
- Critérios de aceite (Issue #N): atendidos / não atendidos (liste os que falharam)
- Resultado: aprovado / precisa de ajustes
- Evidência: prints, vídeo ou passos executados
- O que não consegui testar:
```

</details>

> A PM coordena o fluxo no GitHub Project.
