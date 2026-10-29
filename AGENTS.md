<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Fluxo de trabalho: issues e pull requests

Vale para qualquer pessoa ou agente de IA que trabalhar neste repositório.

1. **Issue antes de codar.** Toda tarefa (bug, melhoria ou funcionalidade) começa por uma issue no GitHub com um destes labels:
   - `bug`: algo não funciona como deveria;
   - `enhancement`: melhoria em algo que já existe;
   - `feature`: funcionalidade nova.

   Sem issue, crie uma (`gh issue create --label ...`) antes de mexer no código.
2. **Branch dedicada, nunca direto na `main`**, no formato `tipo/numero-da-issue-descricao-curta`, em que o tipo é o label da issue. Exemplos: `bug/12-erro-no-login`, `feature/15-foto-do-negocio`.
3. **Entrega por pull request para a `main`.** Na descrição, use `Closes #N` quando o PR resolve a issue, ou `Refs #N` quando só se relaciona a ela.
4. **Deploy só pelo merge.** O merge na `main` publica em produção no Vercel. Cada PR ganha um preview do Vercel, que serve de homologação. Nada de deploy manual fora desse fluxo (`vercel deploy`, "Redeploy" no painel).
5. **A `main` é protegida:** exige PR e 1 aprovação. A checagem "Lint, tipos e testes" roda em todo PR.
