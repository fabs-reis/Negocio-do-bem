@AGENTS.md

## Projeto

- Código, rotas e textos em português (pt-BR). Siga os nomes já usados (`empresa`, `reivindicacao`, `depoimento`, `causas`).
- Prefira explicar o porquê na docstring da função, em `docs/regras-de-negocio.md`, em `docs/como-foi-feito.md` ou na descrição do PR. Evite comentários explicativos no meio do corpo da função. É uma preferência de estilo, não uma proibição de comentários necessários.
- Cache Components está ligado: leitura de cookies, `params`, `searchParams` ou banco fica dentro de `<Suspense>`. Os dados do banco não usam `use cache`, para estarem sempre atualizados.
- Formulários com `useActionState` usam `enviarSemLimpar` (`src/components/envio.ts`) para o React não limpar os campos quando há erro de validação.
- Regras da reivindicação ficam em `src/lib/reivindicacao.ts` e têm testes em `tests/db/`.
- Antes de concluir uma mudança: `npm run lint`, `npm run typecheck` e `npm test` (precisa do Postgres; os testes usam o banco `negocio_do_bem_teste`).
