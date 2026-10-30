# Ordem das travas de reivindicação

## Escopo e prova inicial

Correção privada de GHSA-5w68-qw8r-48xf no candidato `d512943e03c4981bd8701728ac60c25e4b1e6b67`.
A regra continua a permitir dez pedidos por pessoa em 24 horas, com contagem e criação atômicas.
Não há mudança de regra de negócio nem arquivo de changelog neste escopo.

A revisão está em `/var/tmp/nott-native-write/negocio-revisoes-nativas-20261030/review-reivindicacoes.json`.
Os dois testes novos reproduziram `P2034`, com causa PostgreSQL `40P01: deadlock detected`, antes da alteração da implementação.
O arquivo `.nott/gate-native-cure/red-final.log` contém as duas falhas com a versão final dos testes.
O arquivo `.nott/gate-native-cure/red-final.sha256.json` identifica os arquivos executados.
O SHA-256 original de `src/lib/reivindicacao.ts` é `61fcec91ce420e1d09f1df9647fc9c9f3cd17c6140d6d64be69260e85376b0a2`.

## Grafo inspecionado antes da alteração

- `iniciarPorCodigoDm`: consulta de dono fora da transação. Dentro dela, trava `Usuario` com `FOR NO KEY UPDATE`, procura código vigente e confere a cota. Depois altera pedidos vencidos e insere o novo pedido. A inserção pede `KEY SHARE` em `Empresa` e `Usuario` pelas chaves estrangeiras.
- `processarLoginInstagram`: consulta empresa, membros e conflitos fora da transação. Dentro dela, trava a pessoa, confere a cota, cancela pedidos antigos e insere o novo pedido. A aprovação automática ocorre depois do término dessa transação.
- `solicitarPorDocumento`: consulta de dono fora da transação. Dentro dela, trava a pessoa, procura duplicação, conta e cria. Não altera pedidos anteriores. A aprovação ocorre depois do término dessa transação.
- `aprovar`: lê o pedido sem trava de linha. Remove membros no modo de transferência e cria ou mantém o membro. As chaves estrangeiras pedem `KEY SHARE` em empresa e pessoa. Desliga IDs do Instagram em outras empresas, quando necessário. Altera a empresa de destino, altera o pedido aprovado, cancela os outros pedidos pendentes da mesma pessoa e grava auditoria. Alterar um ID único do Instagram pode exigir `FOR UPDATE` em empresa. A auditoria pode pedir `KEY SHARE` na pessoa revisora.
- `recusar`: lê e altera um pedido, depois grava auditoria. A revisão e a auditoria podem pedir `KEY SHARE` na pessoa revisora. Não altera empresa.
- `cancelar`, `anotar` e o registro de conflito de `processarDm`: alteram somente pedidos em operações separadas. Não mantêm uma trava de pedido enquanto alteram empresa.
- `aprovarPendentesSemDono`, as ações de moderação, o retorno do login e o webhook chamam os caminhos acima. Não envolvem essas chamadas em outra transação.
- As edições de empresa e de fotos não alteram pedidos. A publicação em lote altera empresa e grava auditoria. O script de moderação altera o papel da pessoa e grava auditoria sem revisor. Não criam uma aresta inversa entre empresa e pedido.

Fontes: `src/lib/reivindicacao.ts`, `src/lib/auditoria.ts`, `prisma/schema.prisma`, `src/acoes/reivindicacoes.ts`, `src/acoes/moderacao.ts`, `src/acoes/empresas.ts`, `src/app/api/instagram/retorno/route.ts` e `scripts/moderacao.ts`.

O ciclo introduzido era: renovação segura pedido, aprovação segura empresa, renovação espera empresa pela chave estrangeira, aprovação espera pedido.
Na DM, a aprovação de outro pedido da mesma pessoa alcança o código vencido ao cancelar os pedidos restantes.

## Ordem escolhida

Os dois caminhos de renovação devem adquirir `FOR KEY SHARE` na empresa depois da trava da pessoa e antes de alterar qualquer pedido.
A ordem passa a ser `Usuario (NO KEY UPDATE)`, `Empresa (KEY SHARE)`, `Reivindicacao`.
A trava da empresa dura até o término da transação de renovação.
Ela antecipa a trava que a chave estrangeira já exigiria na criação.
Não precisa impedir alterações de campos não únicos da empresa nem serializar todas as pessoas que pedem o mesmo negócio.
O caminho por documento não precisa de outra trava, pois não altera pedidos antes de inserir.

A aprovação usa `KEY SHARE` em pessoa, compatível com `NO KEY UPDATE` da cota.
Assim, a aprovação não espera a trava da cota enquanto segura empresa.
Se a aprovação já segura a empresa, a renovação espera sem segurar pedidos antigos.
Se a renovação já segura a empresa, a aprovação espera sua alteração de chave antes de alcançar pedidos.
A renovação consegue inserir e terminar sem esperar pela empresa nesse caso.
As contagens e criações continuam na mesma transação, sob a mesma trava por pessoa.
A repetição de código continua restrita ao erro de unicidade `P2002`.
Não há repetição de deadlock.

Esta correção não muda a ordem preexistente entre duas aprovações que movem IDs entre várias empresas.
Ela não promete eliminar todos os deadlocks possíveis do sistema.

## Testes determinísticos

Cada teste usa os métodos reais do Prisma e o PostgreSQL real.
As pausas controlam somente o início da transação de renovação e a aprovação após a leitura do pedido e a alteração da empresa.
A consulta `pg_blocking_pids` confirma que a renovação espera pela transação de aprovação.
Antes da correção, ambos os caminhos já alteraram o pedido antigo nessa espera e recebem `40P01` após liberar a aprovação.
Depois da correção, nenhum altera o pedido antigo antes dessa espera.
As duas operações devem terminar sem erro.
Os testes conferem o dono, o ID do Instagram, o estado do pedido antigo, o novo pedido e a auditoria.

As pausas não usam esperas por duração fixa para determinar a ordem.
Os limites de duração dos testes apenas detectam falhas do teste.
Eles não modificam a produção nem substituem a prova do banco.
As saídas, comandos, códigos de saída e hashes ficam em `.nott/gate-native-cure/`.
