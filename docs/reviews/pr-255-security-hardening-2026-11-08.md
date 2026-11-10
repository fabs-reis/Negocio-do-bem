# PR #255 — Revisão de segurança e integração com stage (2026-11-08)

- PR original: https://github.com/fabs-reis/Negocio-do-bem/pull/255
- Requisito: https://github.com/fabs-reis/Negocio-do-bem/issues/103
- Branch original preservada em `backup/pr-255-pre-stage-sync-20261108`

## Problemas encontrados e ações realizadas

1. **Branch divergente:** a PR estava 34 commits atrás de `stage`. Uma substituição direta de `src/acoes/moderacao.ts` apagaria a remoção de proprietários, a suspensão de ofertas rejeitadas e a auditoria transacional. Foram mantidos os arquivos atuais da `stage`, aplicando os pontos de integração do MFA de modo seletivo.
2. **Compatibilidade Next.js:** foi preservado `exigirModerador("acao")` para evitar o comportamento problemático de `notFound()` em Server Actions enviadas sem JavaScript, mantendo `notFound()` nas páginas.
3. **Step-up de alto impacto:** verificação MFA recente para aprovações em lote, transferências de reivindicações, remoção de donos, rejeição de negócio, liberação/suspensão no Clube do Bem e exclusão de embaixador.
4. **Alteração e recuperação de senha:** limpa pendências de inscrição MFA, revoga sessões remotas e invalida o segundo fator da sessão atual quando necessário. O MFA já ativado permanece ativo, inclusive após redefinição por e-mail.
5. **Validação de segredos:** a chave `MFA_ENCRYPTION_KEY` precisa conter exatamente 32 bytes em base64 canônico; nunca versionar a chave real.
6. **Condição de corrida:** o UPDATE transacional de validação do segundo fator exige sessão não expirada, dentro da duração absoluta e ainda dentro do prazo de inatividade.
7. **Regressão:** fixtures e mocks atualizados para o modelo MFA em testes de moderação; testes de chaves inválidas e de acesso sem MFA adicionados.

## Pontos que ainda exigem validação

- Validar `npm ci`, `npm run lint`, `npm run typecheck` e `npm test` com PostgreSQL em CI.
- Revisar os fluxos de perda do autenticador e códigos de recuperação com a equipe CyberSec. Nunca implementar reset de MFA automático por e-mail.
- Testar autenticação por senha, Google e link; acesso por Server Action sem JavaScript, gestão de sessão, expiração e concorrência no PostgreSQL.
- Homologar em Cloudflare Workers com `nodejs_compat` e `MFA_ENCRYPTION_KEY` definido como secret no ambiente de homologação.
- TOTP **não é resistente a phishing**. A issue prefere passkeys/WebAuthn; equipe de segurança deverá aprovar TOTP como alternativa antes de marcar a PR como pronta.
- Não realizar merge em `stage` até que todos os checks e o review CyberSec sejam concluídos.

## Estratégia de integração

Foi preparado um merge com dois pais (head original da PR + `stage`), usando uma árvore derivada da `stage` para preservar as alterações recentes e recuperando apenas as mudanças funcionais da PR. A PR permanece em rascunho. Nenhum segredo de produção foi escrito no repositório.
