# Arquitetura Técnica — Mini Fazenda

> Este documento descreve a arquitetura técnica **planejada**. Detalhes de implementação podem ser ajustados durante o desenvolvimento, desde que os princípios abaixo sejam respeitados. Para regras de comportamento de desenvolvimento, ver [CLAUDE.md](../CLAUDE.md).

## Stack tecnológica

- **TypeScript** — linguagem principal do projeto, para segurança de tipos e manutenibilidade.
- **Phaser** — engine 2D usada para renderização, cenas, física e input.
- **Vite** — build tool e servidor de desenvolvimento; o jogo será desenvolvido inicialmente através dele.
- **Electron** *(futuro, Fase 10)* — empacotamento como aplicativo executável para desktop. Não instalado nem configurado nesta etapa.

## Plataforma e distribuição

O desenvolvimento acontece via Vite. Posteriormente, o jogo poderá ser empacotado como aplicativo desktop utilizando Electron. Para que essa transição não exija reescrever a lógica principal do jogo:

- A lógica do jogo (cenas, entidades, sistemas, dados) não deve depender de APIs específicas de navegador além do que o Phaser já abstrai.
- Qualquer necessidade futura de acesso a sistema de arquivos, janelas nativas ou processos deve ficar isolada em uma camada própria, implementada apenas quando o Electron for integrado.

## Organização de código

O código-fonte (`src/`) deve manter separação entre:

- **Cenas** — telas/estados do Phaser (ex.: boot, menu, cena principal do jogo).
- **Entidades** — objetos do mundo do jogo (personagem, elementos interativos, animais, etc.).
- **Sistemas** — lógica que opera sobre entidades e estado (movimento, pathfinding, interação, ações, economia).
- **Dados** — definições e configurações (tipos de terreno, cultivos, itens, parâmetros de jogo), preferencialmente desacopladas de código de execução.
- **Assets** — referências e carregamento de recursos visuais/sonoros externos.
- **Mapas** — definições de mapas/tilemaps usados pelas cenas.
- **UI** — elementos de interface (HUD, inventário, loja, menus), separados da lógica de simulação do mundo.

Cada responsabilidade deve viver em seu próprio módulo. Evitar concentrar lógica de múltiplos sistemas em um único arquivo ou em uma única cena.

## Gerenciamento de assets

- Todo elemento visual (personagem, terrenos, objetos, animais, UI) deve vir de **arquivos externos**: sprites, spritesheets, tilesets e imagens, armazenados em `assets/`.
- Nenhuma arte deve ser criada utilizando HTML, CSS, SVG, emojis ou formas programáticas.
- A lógica do jogo deve ser independente dos assets visuais — referenciar assets por identificadores/caminhos, sem depender da aparência específica de um asset, permitindo trocar a arte sem alterar sistemas.

## Mapas

- Mapas ficam em `maps/`, separados do código-fonte.
- O formato de mapa (ex.: tilemap compatível com Phaser) será definido quando a Fase 2 (Mundo e mapa) for desenvolvida.
- Dados de mapa (grid, terrenos, obstáculos, zonas interativas) devem ser lidos pelos sistemas do jogo, não codificados diretamente nas cenas.

## Dados

- Configurações e definições de jogo (tipos de ação, propriedades de cultivos, itens, parâmetros de economia, etc.) devem ser representadas como dados estruturados, separados da lógica que os interpreta.
- Isso permite ajustar conteúdo e balanceamento sem alterar sistemas de código.

## Integração futura com Electron

Quando a Fase 10 (Desktop) for desenvolvida:

- O build gerado pelo Vite será empacotado dentro de um shell Electron.
- Qualquer funcionalidade nativa de desktop (janelas, menus do sistema, instalador) será adicionada como camada externa à lógica do jogo, não misturada a ela.
- Até lá, nenhuma dependência do Electron deve ser instalada ou referenciada no código.

## Princípios técnicos

- Código modular, com responsabilidades bem definidas.
- Evitar arquivos monolíticos.
- Dados separados da lógica.
- Assets substituíveis sem reescrever sistemas.
- Evitar dependências desnecessárias — adicionar bibliotecas apenas quando houver necessidade real.
## Pixel Art e Renderização

O projeto utiliza pixel art como linguagem visual.

A renderização deve preservar a integridade dos pixels dos assets.

Regras:

- Utilizar pixelArt quando apropriado no Phaser.
- Desabilitar antialiasing para elementos de pixel art.
- Evitar interpolação de texturas.
- Manter tiles alinhados ao grid.
- Evitar escalas fracionárias.
- Evitar posições fracionárias para elementos de pixel art.
- Preferir escalas inteiras.
- Investigar texture bleeding antes de modificar os assets.
- Não corrigir problemas visuais criando formas programáticas sobre os assets.
- Quando um problema estiver relacionado ao tileset, verificar primeiro o recorte e o tile utilizado.
- Quando necessário, utilizar técnicas de padding/extrusão de textura para evitar artefatos de borda.

## Agricultura (Fase 4)

Sistema de terrenos cultiváveis, arar, plantar, crescimento, rega e colheita,
construído sobre a arquitetura de mapa/movimentação/interação já existente
(sem alterar grid, A* ou colisões).

### Estados de uma célula cultivável (`systems/farmland.ts`)

```
untilled → tilled → growing → (ready, ainda "growing") → tilled (colhida)
                        ↓
                      dead → tilled (limpa)
```

`farmMap.farmlandArea` (em `data/maps/farmMap.ts`) define quais células são
cultiváveis — a mesma convenção de `treePositions`. Fora dessa lista, uma
célula não tem estado de agricultura (é "terreno comum").

### Crescimento e hidratação são responsabilidades separadas

Esta é a decisão mais importante do sistema, e o motivo de uma correção
nesta fase: a primeira versão fazia a rega ser necessária para o estágio
avançar (crescimento "pausava" sem água). Isso foi corrigido porque não
representava como a Mini Fazenda original funcionava.

- **Crescimento**: função só do tempo decorrido desde o plantio.
  `Plot.plantedAt` guarda o momento do plantio (no relógio interno do
  `Farmland`, incrementado a cada `update`); o estágio é
  `floor((agora - plantedAt) / (crop.totalGrowthMs / estágios))`. Regar não
  acelera nem é necessário para isso avançar.
- **Hidratação**: função só do tempo desde a última rega.
  `Plot.lastWateredAt` é atualizado quando o jogador rega. Se
  `agora - lastWateredAt` passar de `crop.maxTimeWithoutWaterMs`, a
  plantação morre (`state = 'dead'`) — independentemente do estágio em que
  estava. Uma plantação morta não pode ser colhida; interagir com ela limpa
  o terreno (volta a `tilled`, sem recompensa).

Ambos os tempos são configuráveis por cultura em `data/crops.ts`
(`totalGrowthMs`, `maxTimeWithoutWaterMs`), não espalhados pelo código.

Usar "momentos" (`plantedAt`/`lastWateredAt`) em vez de contadores que só
acumulam duração deixa a estrutura pronta para um futuro sistema de salvar
o jogo (bastaria persistir esses momentos e o relógio), mesmo que esse
sistema não exista ainda.

### Ações do personagem (`entities/Player.ts` + `data/player.ts`)

Arar, plantar, regar e colher têm animação própria, tocada uma vez
(`performAction`) antes do efeito ser aplicado — a animação nunca decide o
resultado, só o representa visualmente; quem decide é sempre `Farmland`.
Enquanto uma ação está em andamento (`Player.isBusy()`), o personagem não
aceita novo movimento por teclado nem novo clique (`PlayerController`
verifica isso antes de processar input).

As animações reaproveitam os assets já existentes do personagem
(`Pre-made/Alex`): `Hoe.png` (arar), `Watering.png` (regar), `Sickle.png`
(colher). Não existe uma animação dedicada de "plantar" no asset —
`Shovel.png` (cavar) é usada como aproximação temporária, documentada em
`data/player.ts`. Todas seguem a mesma convenção de 3 linhas
(baixo/cima/lado) e a mesma lógica de direção/flip já usada em
idle/caminhada — não há tratamento especial por animação, evitando repetir
o problema de orientação já visto na Fase 3.

**Limitação atual conhecida:** como o personagem caminha até a própria
célula cultivável (ela é caminhável, igual a qualquer outro terreno) e
executa a ação parado ali, a direção usada nas animações de ação é sempre
"baixo" (o personagem cuida do que está debaixo/na frente dele), em vez de
se posicionar numa célula adjacente e virar dinamicamente para o alvo.
Ajustar isso é um refinamento futuro que vale a pena revisitar quando o
polimento visual da fazenda for a prioridade.

### Seleção de sementes, debug de tempo e balanceamento

Três ajustes de polimento sobre a base acima:

- **Seleção de sementes**: `Inventory` (`systems/inventory.ts`) guarda não só
  os itens colhidos, mas também a semente ativa (`selectedSeedId`, com
  `getSelectedSeedId`/`selectSeed`). `PlotInteractable.interact()` planta a
  semente selecionada em vez de um `DEFAULT_CROP_ID` fixo. `MainScene` liga
  as teclas 1/2/3 a `Inventory.selectSeed`, na ordem em que as culturas
  aparecem em `CROPS` (1 = cenoura, 2 = batata, 3 = cebola) — uma 4ª cultura
  em `data/crops.ts` já ficaria com dados prontos, mas precisaria de uma 4ª
  tecla neste código, que só cobre 1-3 por enquanto.
- **Avanço de tempo para debug**: a tecla T (`MainScene.setupDebugTimeSkip`)
  chama `Farmland.update()` — o mesmo método usado a cada frame — com um
  salto de tempo maior (`DEBUG_TIME_SKIP_MS`), e re-renderiza a agricultura
  na hora. Não é uma mecânica de jogo, é só para não precisar esperar em
  tempo real durante testes de crescimento/morte por sede.
- **Janela entre solo seco e morte**: `maxTimeWithoutWaterMs` da cenoura foi
  ajustado de 10s para 20s. Como o solo já fica visualmente seco na metade
  desse tempo (`farmlandRenderer.renderSoil`), isso amplia a janela de aviso
  de 5s para 10s antes da plantação morrer — tempo mais realista para o
  jogador perceber e regar de novo. A lógica em si não mudou, só o valor de
  dados em `data/crops.ts`. Batata e cebola seguem a mesma ideia, com seus
  próprios tempos (ver abaixo).

### Mais culturas: batata e cebola

Além da cenoura, `data/crops.ts` define `POTATO` (`Crops/Spring/Potato.png`)
e `ONION` (`Crops/Spring/Onion.png`). Antes de adicionar qualquer uma,
os spritesheets foram conferidos visualmente (recorte/zoom, mesma técnica
usada para a cenoura) para confirmar que seguem a mesma convenção de 8
frames (0 e 1 = semente, 2-5 = crescimento, 6 = vazio, 7 = ícone) — nem toda
cultura do pacote segue esse layout (ex.: Parsnip e Cabbage têm outra
contagem de frames), então isso precisa ser verificado a cada nova cultura,
não assumido.

Tempos diferentes por cultura (só para dar variedade ao alternar/testar):
batata cresce mais devagar (`totalGrowthMs: 20000`, `maxTimeWithoutWaterMs:
25000`) e cebola mais rápido (`totalGrowthMs: 12000`,
`maxTimeWithoutWaterMs: 16000`) que a cenoura. Como o resto do sistema
(crescimento, hidratação, renderização, colheita) já era genérico por
`cropId`, nenhum código fora de `data/crops.ts` precisou mudar.

### Visual (`systems/farmlandRenderer.ts`)

Solo (uma imagem por célula, oculta até ser arada) usa
`Tileset/Tilled Soil and wet soil.png` — seco por padrão, molhado enquanto
a plantação foi regada recentemente (metade do tempo até o limite sem
água). A plantação (uma imagem por célula plantada) usa os frames de
crescimento do spritesheet da cultura plantada (`crop.textureKey`/
`crop.growthFrames`, ver `data/crops.ts`); uma plantação morta reaproveita
o último frame alcançado com um tingimento acastanhado (`setTint`), em vez
de um sprite novo.

### Barra de sementes (`ui/seedBar.ts`)

HUD fixo (screen-space, `setScrollFactor(0)`), centralizado na base da
tela, um slot por cultura em `CROPS`. Só composição de assets existentes,
sem nenhuma forma desenhada por código:

- A moldura de cada slot é um recorte de `UI/Inventory/Slots.png`
  (`data/ui.ts` guarda o retângulo exato, localizado recortando/ampliando o
  spritesheet pixel a pixel — mesma técnica já usada para `PINE_TREE_FRAME`
  em `MainScene`).
- O conteúdo do slot é o próprio frame de ícone da cultura
  (`CropDefinition.iconFrame`, hoje sempre 7 — o frame do item já colhido).
- O destaque da semente selecionada é escala/opacidade/tingimento com
  tweens (`SeedBar.refresh`) sobre esses mesmos assets — a mesma técnica já
  usada para a plantação morta em `farmlandRenderer.ts` — nunca uma forma
  nova desenhada por cima (proibido pelas regras de pixel art do projeto).

`SeedBar` não decide nada sozinha: `MainScene.selectSeed()` é o único
lugar que chama `Inventory.selectSeed()` e depois `SeedBar.refresh()` — ela
é acionada tanto pelas teclas 1/2/3 quanto pelo clique num slot. Cada slot
é interativo (`frame.setInteractive()` + `onSelect` passado no construtor);
o handler de clique chama `event.stopPropagation()` para o clique não
"vazar" para o listener global do `PlayerController` (que trataria o
mesmo clique como mover o personagem/interagir com o terreno embaixo do
HUD).

### Interação (`systems/interaction.ts` + `systems/farmlandInteraction.ts`)

Camada de interação genérica (`InteractionRegistry`): qualquer célula pode
registrar um `Interactable`. `PlayerController` só pergunta "existe algo
aqui?" — sem saber o que é agricultura. Isso permite reaproveitar a mesma
camada para árvores, animais, construções etc. nas próximas fases. Uma
célula cultivável decide sua própria ação a partir do próprio estado
(`PlotInteractable.interact()`): ara se comum, planta se arada e vazia,
rega se crescendo, colhe se pronta, ou limpa se morta.

### Resultado da colheita

`systems/inventory.ts` guarda o resultado de colheitas por id de item, a
semente selecionada e as moedas do jogador — ver
[Economia (Fase 5)](#economia-fase-5--fundação) para o que foi adicionado
nessa fase. Ainda não é um inventário completo (sem slots/pesos/itens além
de sementes e colheita).

### Próximos pontos (fora do escopo desta fase)

- Culturas além das 3 atuais (cenoura, batata, cebola): a estrutura de
  dados já suporta, mas a seleção por teclado (`MainScene.setupSeedSelection`)
  só cobre as teclas 1-3 — uma 4ª cultura precisaria de mais uma tecla ali.
- Posicionamento adjacente + direção dinâmica nas ações agrícolas (ver
  limitação acima).
- Indicador visual de "precisa de água" antes da plantação morrer (hoje só
  o solo seco/molhado sinaliza isso).

## Economia (Fase 5)

Fase concluída: fundação (preços, saldo de moedas, HUD), venda (Caixa de
Remessas), a interação com objetos sólidos que isso exigiu no
`PlayerController`, estoque de sementes e compra (Loja). O ciclo completo
— plantar (com sementes do estoque) → colher → vender → comprar mais
sementes — funciona de ponta a ponta.

### Preços (`data/crops.ts`)

Cada `CropDefinition` ganhou `seedPrice` (custo da semente) e `sellPrice`
(venda da colheita, sempre maior que `seedPrice` — a diferença é o lucro).
Substituiu o campo antigo `sellValue`, que não era usado por nada ainda.
Valores coerentes com o ritmo de cada cultura (já documentado antes):
batata (mais lenta) é a mais cara dos dois lados; cebola (mais rápida) é a
mais barata.

### Moedas (`systems/inventory.ts`)

`Inventory` ganhou um saldo (`coins`, começa em 50) com `getCoins`,
`addCoins` e `spendCoins` — este último recusa (retorna `false`, sem alterar
o saldo) se não houver moedas suficientes. Continua sem depender do Phaser,
como o resto do `Inventory` — a UI é quem lê o saldo, não o contrário.

### Estoque de sementes (`systems/inventory.ts`)

`Inventory` ganhou um segundo Map, `seeds` (quantidade por `cropId`),
deliberadamente separado de `items` (colheita, usado para vender) — mesmo
indexados pelo mesmo `cropId`, misturar os dois um dia criaria um bug onde
vender esvaziaria também o estoque de plantio. `getSeedCount`, `addSeeds`
(compra na Loja) e `useSeed` (consumido ao plantar; recusa se não houver).

O jogador começa com 3 sementes da cultura padrão (cenoura) — o suficiente
para jogar sem precisar visitar a Loja antes de plantar pela primeira vez;
as outras culturas começam em 0 e precisam ser compradas.

`PlotInteractable` (`systems/farmlandInteraction.ts`) agora checa
`getSeedCount` antes de plantar: sem estoque da semente selecionada, o
clique não faz nada (só um log — mesmo espírito de "clique sem efeito" já
usado para obstáculos sem interação), sem tocar a animação de plantar à
toa. Com estoque, `useSeed` é chamado dentro do `performAction`, junto com
`Farmland.plant` — a mesma barreira "efeito só depois da animação, nunca
antes" que já vale para as outras ações agrícolas.

### HUD de moedas (`ui/coinBar.ts`)

HUD fixo (screen-space) no canto superior direito: um fundo semitransparente,
a moeda girando de `UI/Money.png` (6 frames, animação própria) como ícone, e
o saldo em texto. O número em si usa `scene.add.text` — não existe fonte em
pixel art no pacote de assets, e a quantidade de moedas é um valor livre que
não cabe num sprite fixo. O fundo se redimensiona conforme o texto cresce
(saldo com mais dígitos), e a moeda dá um pequeno "pulo" (tween de escala)
sempre que o saldo aumenta — feedback de "ganhou dinheiro" sem precisar de
sprite novo.

`CoinBar.refresh()` só faz algo quando o valor realmente muda (compara com o
último saldo visto). `MainScene` chama `refresh()` a cada frame em vez de só
nos pontos que mudam `coins` (hoje: a venda na Caixa de Remessas) — evita
depender de lembrar de sincronizar a UI em cada novo lugar que mexer em
moedas no futuro (ex.: a loja de compra). É diferente da `SeedBar`, que só
atualiza sob demanda porque seu `refresh()` dispara tweens que não podem
reiniciar 60x/segundo — para um texto simples que só redesenha quando muda
de fato, isso não é um problema.

### Caixa de Remessas e venda (`systems/shippingBinInteraction.ts`)

Ponto de venda do jogador: um objeto sólido e estático
(`Objects/Exterior/shipping box.png`) que vende toda a colheita do
inventário de uma vez. Antes disso era um NPC Banqueiro andável — trocado
por uma caixa de remessas sólida porque um NPC sem colisão, em cima do qual
o jogador precisava pisar para interagir, quebrava a imersão do estilo
Stardew Valley que o jogo busca.

- **Asset** (`data/tiles.ts`, `SHIPPING_BIN_FRAME`): `shipping box.png`
  (48x64) tem estados fechado/aberto em tiles de 16x16, conferidos por
  recorte/zoom antes de usar. Só o frame fechado (linha 2, coluna 1) é uma
  imagem completa dentro de um único tile — o estado aberto precisa de 2
  tiles empilhados (tampa + base) para caber, e como a caixa não anima
  nesta fase (sem efeito de abrir ao vender), só o frame fechado é usado,
  como imagem estática (não um spritesheet/animação).
- **Posição** (`data/maps/farmMap.ts`, `shippingBinPosition`): mesma fonte
  única de verdade das árvores e da lavoura. Encostada na cerca lateral
  direita, na mesma altura da lavoura — fácil de alcançar depois de
  colher, com a coluna da cerca como um dos 4 vizinhos já naturalmente
  bloqueado.
- **Desenho** (`systems/mapBuilder.ts`, `buildShippingBin`): mesmo padrão
  de `buildFarmDecorations` (árvores) — profundidade fixa pelo Y da base,
  calculada uma vez na criação, já que o objeto nunca muda de posição.
- **Colisão** (`systems/grid.ts`): a célula é bloqueada, igual às árvores e
  à borda do mapa — o jogador não pisa nela. É isso que torna necessária a
  interação adjacente abaixo.
- **Interação** (`ShippingBinInteractable`, mesmo padrão do
  `PlotInteractable`): percorre todas as culturas em `CROPS`, tira do
  inventário tudo que houver de cada uma (`Inventory.takeAll`), soma pelo
  `sellPrice` de cada uma e credita de uma vez com `addCoins`. Sem nada
  para vender, não faz nada (só um log). Mostra um texto flutuante
  temporário (`+N`, sobe e desaparece) como feedback imediato — visual
  isolado, não guarda estado nem decide nada. Do ponto de vista desta
  classe, a interação é idêntica não importa de que lado o jogador chegou.

### Loja e compra (`ui/shopMenu.ts`, `systems/shopInteraction.ts`)

Uma banca sólida (`Objects/Exterior/Newsstand.png`, já uma imagem completa
— sem frames para recortar) perto da lavoura, com o mesmo mecanismo de
objeto sólido + interação adjacente da Caixa de Remessas.

- **`ShopInteractable`** (mesmo padrão do `PlotInteractable`/
  `ShippingBinInteractable`): `interact()` só alterna (`toggle()`) o painel
  `ShopMenu` — não decide preços nem processa compra, isso é do `Inventory`
  e do próprio `ShopMenu`.
- **`ShopMenu`**: painel oculto por padrão, mesma linguagem visual da
  `SeedBar`/`CoinBar` (moldura de `UI/Inventory/Slots.png`, ícone = frame
  colhido da cultura, preço em texto — mesma justificativa da `CoinBar`
  para não haver fonte em pixel art). Fica centralizado na tela enquanto
  aberto; cada slot é clicável (mesma técnica de `event.stopPropagation()`
  da `SeedBar`, para o clique não vazar para o `PlayerController`) e chama
  o callback `onBuy(cropId)` passado por `MainScene`. `refresh(coins)`
  escurece os slots que o jogador não pode pagar no momento — só afeta a
  aparência, nunca decide se a compra é permitida (isso é sempre
  `Inventory.spendCoins`).
- **`MainScene.buySeed(cropId)`**: tenta `inventory.spendCoins(crop.seedPrice)`;
  se conseguir, `inventory.addSeeds(cropId, 1)`. Sem saldo, não faz nada
  (só um log) — o painel continua aberto, então o jogador pode tentar outra
  compra sem precisar reabrir a Loja.
- **Fechar**: interagir de novo com a banca alterna fechado (`toggle`), e
  qualquer passo do jogador (`'player-stepped'`) também fecha — evita
  deixar o painel "preso" na tela enquanto ele anda pela fazenda.
- **Preço no ícone da `SeedBar`**: a barra de sementes (base da tela) ganhou
  um número pequeno em cada slot (`SeedBar.refreshStock`) mostrando quantas
  sementes daquela cultura o jogador tem — sem isso, não haveria como saber
  por que plantar parou de funcionar ao esgotar o estoque. `MainScene`
  atualiza isso a cada frame, mesma lógica de "barato, só redesenha quando
  muda" da `CoinBar`.

### Interação com objetos sólidos (`systems/playerController.ts`)

Antes, `PlayerController.handlePointerDown` descartava qualquer clique numa
célula não-andável antes mesmo de consultar o `InteractionRegistry` — o que
tornava impossível interagir com algo sólido sem estar em cima dele. Agora:

- Clique numa célula bloqueada com uma interação registrada
  (`handleBlockedClick`): acha a célula andável mais próxima do jogador
  entre as 4 vizinhas da célula clicada (`findNearestWalkableNeighbor`,
  comparando o comprimento real da rota do A* — não só distância Manhattan
  — já que o mapa é pequeno o bastante para isso não pesar), e leva o
  personagem até lá. Sem nenhuma vizinha andável e alcançável, ou sem
  interação registrada ali (caso comum: árvore, cerca), o clique não tem
  efeito algum — igual a antes.
- Ao chegar, se a célula onde parou for diferente da célula-alvo (caso das
  células sólidas), `Player.faceDirection()` vira o personagem de frente
  para o alvo antes de `interact()` disparar — sem isso, a direção seria só
  "qual foi o último passo dado para chegar", que não necessariamente
  aponta para o alvo. Para uma célula andável e interativa (ex.: um
  canteiro), a célula onde o jogador para já É a célula-alvo, então esse
  passo é pulado — comportamento idêntico ao de antes desta mudança.
- `Player.faceDirection(dCol, dRow)` (novo, em `entities/Player.ts`)
  reaproveita a mesma lógica de direção/flip já usada pelo movimento — não
  há orientação especial só para "virar parado".

### Próximos pontos

- Inventário genérico (itens/slots além de colheita e sementes) — só se
  uma fase futura realmente precisar; o jogo não usa nada assim hoje.
- Persistência (saldo, estoque de sementes e progresso da lavoura resetam
  a cada reload — sem sistema de save ainda, previsto pra Fase 9).
