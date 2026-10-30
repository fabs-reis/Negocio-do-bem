# Área da conta

Refinamento de painel, formulários de acesso, edição da empresa e confirmação de saída, mantendo as fontes Bricolage Grotesque e Figtree do novo frontend. Relacionado à issue #167.

## Apresentação

O painel separa identidade, navegação, negócios, pedidos recentes e indicações. A ação inicial se adapta à quantidade de negócios da conta. A edição usa índice de seções e mais espaço entre títulos, ajuda e campos. Os campos, limites, ações e estados continuam os existentes. O editor de história e sua prévia permanecem os mesmos.

As telas de acesso têm formulário e contexto em duas colunas no computador, com foco no formulário no celular. Os ícones de provedores externos são uma prévia desabilitada, identificada como indisponível; nenhum OAuth foi implementado e nenhuma credencial foi adicionada.

Em `/sair`, uma confirmação explícita usa a Server Action original de saída. A visita por GET não encerra a sessão. A ação POST remove a sessão e redireciona para a home. O menu da conta passa a apontar para essa confirmação.

## Dependência

Este trabalho está empilhado sobre o PR #156 e a contribuição pública da AG. Não deve ser integrado antes deles. A branch foi criada a partir da stage e avançada para essa base de frontend sem merge adicional. Antes de sair do rascunho, deve ser atualizada sobre a stage já integrada para que o diff mostre somente a área da conta.

Não inclui Participar, selo oficial ou código por DM do #114. Não altera ações, autenticação, permissões, banco ou regras de moderação e reivindicação.

## Validação

Lint e tipos aprovados, com o aviso preexistente do Open Graph; build aprovado. 272 testes unitários em 18 arquivos passaram. Campos nativos, validações e callbacks dos formulários foram comparados com a base por AST e preservados. A suíte completa foi tentada, mas o Vite falhou na inicialização com `code.charCodeAt is not a function` neste ambiente Windows.

Telas de acesso, painel e edição foram verificadas por HTTP com dados fictícios. A saída foi exercitada por POST e confirmou 303 para a home, limpeza do cookie e remoção da sessão do banco. Não houve envio de edição ou alteração de dados de negócios.

Capturas e revisão visual de temas, teclado, zoom e responsividade continuam pendentes por indisponibilidade do host de navegador. Manter a contribuição em rascunho até a validação.
