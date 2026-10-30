# Rig do cortejo

Este documento diz como desenhar uma figura do cortejo.
Com ele, uma pessoa (ou um agente) troca o rascunho de uma figura sem mexer em mais nada.
A padeira (`personagens/padeira.tsx`) é a referência de estilo e de rig.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `personagens/<id>.tsx` | Uma figura. Exporta um componente que recebe `PropsDaFigura` (`{ placa?: string }`). |
| `personagens/index.ts` | O registro: cada id leva ao componente e ao rig. A ordem do palco é `ORDEM_DO_CORTEJO`. |
| `personagens/base.tsx` | As peças comuns: `Figura`, `Forma`, `Brilho`, `Placa`, `SombraNoChao`, `pivo`, `usePrefixo`. |
| `personagens/tipos.ts` | `Rig`, `PropsDaFigura` e `CLASSES_DO_RIG`, a lista de classes de cada rig. |
| `cortejo.css` | As cores de cada papel, as quatro técnicas, a ligação das classes com os ciclos e o palco. |
| `scripts/gerar-ciclos.mjs` (na raiz) | Gera `ciclos.css` com `npm run cortejo:ciclos`. Não edite o CSS à mão. |
| `Cortejo.tsx` | O palco. `movimento.ts` tem a pausa da página. `ControleMovimento.tsx` é o botão. |

Para trocar uma figura, substitua só o arquivo dela. Não mude o registro, a base, o CSS nem o gerador.

## Moldura

- Vista de lado, andando da esquerda para a direita (o rosto olha para a direita).
- `viewBox="0 0 <largura> 400"` em todas. A altura é sempre 400.
- O chão fica em `y = 384`. A sola, a roda e a pata encostam nesse y na pose de descanso.
- Larguras: bípede 220, cadeira 300, caramelo 230.
- A raiz é sempre `<Figura p={p} nome="<id>" rig="<rig>" largura={...} paleta={PALETA}>`.
  Ela põe `aria-hidden`, as classes `figura figura-<id> rig-<rig>` e os gradientes da sombra.
- A sombra no chão (`<SombraNoChao cx rx />`) fica fora de `r-corpo`: ela não anda.

## Ids e classes

1. Chame `const p = usePrefixo();` uma vez por figura. É o `useId` do React.
2. Todo id dentro da figura começa com `${p}-` (gradiente, padrão, filtro, recorte, máscara).
   Nunca use um id fixo: duas figuras iguais na mesma página não podem repetir id.
3. Toda referência `url(#...)` aponta para um id da própria figura.
4. O rig usa classes, nunca ids. Cada grupo do rig é um `<g>` com uma classe só, a do rig.
5. Cada grupo do rig tem o seu pivô: `style={pivo(x, y)}`, em unidades do viewBox.
6. Cada classe da lista do rig aparece uma vez só na figura.

O teste `tests/unit/palco-personagens.test.ts` confere os itens 2 a 6 em cada figura.

## Pose de descanso

Desenhe cada membro reto para baixo, a partir do pivô: rotação zero é "apontando para baixo".
O ciclo gira cada grupo a partir dessa pose. Uma rotação positiva gira no sentido horário da tela:
a perna vai para trás (para a esquerda), e uma negativa vai para a frente.
Uma rotação fixa de desenho (por exemplo, o braço que segura a placa já inclinado)
fica num `<g transform="rotate(...)">` dentro do grupo do rig, nunca no próprio grupo.

## Rig bípede (padeira, costureira, agricultor)

As medidas das pernas são fixas: o ciclo conta com elas para o pé de apoio ficar no chão.

| Classe | Pivô | Contém | Movimento |
|---|---|---|---|
| `r-corpo` | quadril (104, 232) | tudo, menos a sombra no chão | sobe e desce até 7 unidades (`passo-corpo`) |
| `r-perna-tras`, `r-perna-frente` | quadril (104, 232) | a coxa (76 de comprimento, até o joelho em y 308) e a canela | balança de -24° a +22° (`passo-coxa`) |
| `r-canela-tras`, `r-canela-frente` | joelho (104, 308) | a canela (66, até o tornozelo em y 374) e o pé | dobra até 58° (`passo-joelho`) |
| `r-pe-tras`, `r-pe-frente` | tornozelo (104, 374) | o pé, do calcanhar (x 92) à ponta (x 134), sola em y 384 | calcanhar no chão, pé chato, ponta (`passo-tornozelo`) |
| `r-braco-tras` | ombro (livre, perto de (98, 154)) | o braço de lá | balança de -19° a +15° (`passo-braco`) |
| `r-antebraco-tras` | cotovelo (livre, perto de (98, 206)) | o antebraço e a mão de lá | dobra para a frente (`passo-cotovelo`) |
| `r-braco-frente` | ombro (livre, perto de (114, 154)) | a manga que desce por trás da placa | quase parado (`passo-segura`) |
| `r-placa` | a mão que segura | a placa e a mão por cima dela | balança 1,8° a cada passo (`passo-placa`) |
| `r-cabeca` | base do pescoço | cabeça, cabelo, rosto | acena 1,4° (`passo-cabeca`) |

A perna de trás anda meia volta depois da da frente: o CSS cuida disso.
Ordem das camadas, de trás para a frente: braço de lá, perna de trás, perna da frente,
tronco (e avental), pescoço, cabeça, braço de cá, placa com a mão.
Ciclo: 1,2 s.

## Rig da cadeira de rodas (psicóloga)

O ciclo de empurrar usa a cinemática da mão no aro: as medidas do braço e da roda são fixas.

| Classe | Pivô | Contém | Movimento |
|---|---|---|---|
| `r-cadeira` | roda (126, 322) | encosto, manopla, assento, quadro, apoio dos pés | parada |
| `r-roda-tras` | roda (126, 322) | pneu (raio 56 a 63), raios a cada 30°, aro de impulsão (raio 51,5 a 55), cubo | gira 180° por ciclo (`empurra-roda`) |
| `r-roda-frente` | rodízio (200, 368) | pneu (raio 10 a 16) e uma cruz a cada 90° | gira 720° por ciclo (`empurra-rodizio`) |
| `r-corpo` | quadril (122, 262) | braço de lá, tronco, pescoço, cabeça | inclina até 5° para a frente no impulso (`empurra-corpo`) |
| `r-braco-tras`, `r-braco-frente` | ombro (118, 172) | o braço (56, reto até o cotovelo em (118, 228)) | segue a mão no aro (`empurra-braco-*`) |
| `r-antebraco-tras`, `r-antebraco-frente` | cotovelo (118, 228) | antebraço e mão (58 até a pega em (118, 286)) | idem (`empurra-antebraco`) |
| `r-placa` | apoio no colo | a placa | balança 0,8° (`empurra-placa`) |
| `r-cabeca` | base do pescoço | cabeça, cabelo, rosto | compensa a inclinação (`empurra-cabeca`) |

A roda e o rodízio só fecham o laço sem salto com essas simetrias (raios a cada 30°, cruz a cada 90°).
`r-braco-frente` fica fora de `r-corpo` e por último na ordem: ele passa na frente da roda.
O ciclo já move o ombro dele junto com a inclinação do corpo.
Ordem das camadas: fresta da roda de lá, cadeira, pernas no assento e pés no apoio (paradas),
corpo, placa, roda, rodízio, braço de cá.
Ciclo: 1,6 s.

## Rig quadrúpede (caramelo)

| Classe | Pivô | Contém | Movimento |
|---|---|---|---|
| `r-corpo` | (108, 312) | tudo, menos a sombra no chão | sobe e desce pouco (`trote-corpo`) |
| `r-pata-1` (frente, perto), `r-pata-2` (frente, longe) | ombro (152, 312) | a perna (34) | balança de -24° a +24° (`trote-frente`) |
| `r-pata-3` (trás, perto), `r-pata-4` (trás, longe) | quadril (64, 312) | a coxa (34) | balança (`trote-tras`) |
| `r-pata-N-baixo` | (152, 346) ou (64, 346) | a canela (34) e a pata (4, sola em 384) | dobra na volta da pata (`trote-*-baixo`) |
| `r-rabo` | base do rabo | o rabo | abana (`trote-rabo`) |
| `r-cabeca` | pescoço | pescoço, coleira, cabeça | balança 2° (`trote-cabeca`) |

Trote em diagonal: `r-pata-1` anda com `r-pata-4`, e `r-pata-2` com `r-pata-3`.
Ordem das camadas: patas de lá, rabo, corpo, patas de cá, cabeça. Ciclo: 0,6 s.

## A placa

- A palavra vem da prop `placa`. Desenhe a placa com `<Placa p x y largura altura palavra={placa} />` dentro de `r-placa`.
- `Placa` quebra uma frase longa em duas linhas ("DE QUEM"), escolhe o corpo e põe `textLength`:
  com qualquer fonte, a palavra cabe e não estica palavra curta.
- A fonte é `--font-display` (classe `cortejo-letra`). Não mude a fonte na figura.
- A mão que segura fica dentro de `r-placa`, depois da placa: ela anda com a placa.
- Deixe a área do texto livre: nenhum braço passa por cima das letras.
- O caramelo não tem placa.

## Cores e técnicas

Toda forma pintada tem um papel, pela classe `t-<papel>` (use `<Forma papel="...">`).
A técnica do palco decide a tinta de cada papel. Não ponha `fill` fixo numa forma.

| Papel | Para |
|---|---|
| `pele` | pele |
| `cabelo` | cabelo, bigode, sobrancelha grossa |
| `roupa`, `roupa-2` | peça de cima, peça de baixo |
| `acessorio`, `acessorio-2` | a pista do ofício (avental, fita métrica, boné, cesta) e o seu detalhe |
| `sapato` | sapato, pneu |
| `objeto` | quadro da cadeira, sola, peças grandes |
| `placa`, `letra` | o papelão e a palavra (a `Placa` já usa) |
| `traco` | olho, nariz do cachorro: forma cheia, pequena |

Linhas finas (pálpebra, boca, dedos, costura) usam `<path className="t-linha">`: traço na cor do `traco`.

A `PALETA` dá, para cada papel, a cor da pintura e o tom das técnicas de uma tinta só:
`escuro`, `medio` ou `claro`. Escolha o tom pelo valor da cor, não pela pessoa.
O tom do `traco` precisa contrastar com o tom da `pele`: pele escura pede traço `claro`.

| Tom | Xilogravura | Barro | Azulejo |
|---|---|---|---|
| `escuro` | preto com veio de madeira, contorno branco | terracota escura | cobalto |
| `medio` | hachura preta no papel | terracota | aguada de cobalto |
| `claro` | papel, contorno preto | terracota clara | branco esmaltado |

Na xilogravura a palavra sai em vermelho, a segunda tinta.

Camadas de volume, por cima da forma (a `Forma` desenha):

- `volume="h"`: tubo em pé, sombra do lado direito. Use em braço, perna, tronco, pescoço.
- `volume="v"`: sombra embaixo. Use em sapato, placa, assento.
- `volume="r"`: esfera, luz no alto à esquerda. Use em cabeça, mão, coque.
- `longe`: a peça do lado de lá do corpo fica um pouco mais escura. Use no braço de lá, na perna de trás,
  e no tronco quando o braço de cá passa na frente dele.
- `<Brilho p cx cy rx ry />`: um brilho suave (no cabelo, no sapato, no lombo).

Cor que só faz sentido na pintura (bochecha, boca, farinha, verdura na cesta) vai num elemento com
a classe `t-so-pintura` e `fill` fixo. Ele some nas outras técnicas.

O que já vem pronto, sem nada a mais na figura: a `Forma` desenha uma cópia de cada forma (`t-grao`)
que o palco pinta com o grão da tinta (pintura e barro) ou com as falhas de tinta (xilogravura).
O palco põe o painel de azulejos e o rejunte (azulejo).
Não use filtro SVG (`filter`, `<filter>`) na figura: sobre uma figura que anda, ele custa um quadro inteiro
por quadro. Use as camadas acima.

## O palco

```tsx
<Cortejo personagens={personagensDoCortejo(porCategoria)} tecnicas={["pintura", "xilogravura", "barro", "azulejo"]} />
```

- `personagens`: `{ id, placa, href, rotulo, total }` para cada pessoa e `{ id: "caramelo" }`.
  `personagensDoCortejo(resumoDoDiretorio().porCategoria)` monta os cinco na ordem do plano.
  O caramelo anda junto da última pessoa.
- `tecnicas`: a ordem da troca. Nomes desconhecidos são ignorados. Cada técnica fica de 3 a 4 segundos.
- Cada pessoa é um link com o nome "Ver negócios de <tipo>". Passar o mouse ou focar para a pessoa
  e mostra a etiqueta com o tipo e a contagem.
- O palco mostra o estado em `data-estado` (`rodando` ou `parado`) e o motivo em `data-motivo`
  (`carregando`, `movimento-reduzido`, `visitante`, `aba-oculta`, `fora-da-tela`).
- Sem JavaScript, com movimento reduzido, fora da tela ou com a aba escondida, as figuras ficam paradas
  numa pose de passo e a técnica não troca.

## A pausa da página

O botão do palco pausa todas as animações da página, não só o cortejo.

- Outro componente React lê com `useMovimentoPausado()` e muda com `pausarMovimento()` e `retomarMovimento()`
  (de `movimento.ts`).
- Uma animação feita só com CSS segue o atributo do documento:

```css
:root[data-movimento="pausado"] .letreiro { animation-play-state: paused; }
```

- `ControleMovimento` é o botão. A página pode pôr outro em outro lugar: os dois mostram o mesmo estado.
- A escolha fica guardada no navegador do visitante.

## Para conferir

1. `npx vitest run tests/unit/palco-` confere rig, pivôs, ids e a placa de cada figura.
2. Veja a figura nas quatro técnicas, parada e andando, em 1280 e em 375 px de largura.
3. Para mudar um ciclo, mude a curva em `scripts/gerar-ciclos.mjs` e rode
   `npm run cortejo:ciclos` na raiz do projeto.
