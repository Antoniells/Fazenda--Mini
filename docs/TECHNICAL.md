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

## Polimento visual (Pit Stop antes da Fase 9)

Pedido explícito, adiantando só uma parte da Fase 9 — sem sons e sem
ferramentas no inventário (ambos ficam para quando a fase for feita por
completo). Cinco pedaços: cursor de seleção nos canteiros, sombras de
chão, poeira ao arar, respingo ao regar, e pulo elástico ao colher/vender/
carregar os HUDs.

### Cursor de seleção (`systems/tileCursor.ts`)

Em vez de desenhar um quadrado por código (proibido pelas regras de pixel
art do projeto), reaproveita os 4 cantinhos em L de
`UI/Inventory/Slots.png` que já existiam no asset como "cursor de seleção"
(`data/ui.ts`, `SELECTION_CORNER_RECTS`) — a mesma peça que eu tinha
localizado antes, mas não usado, ao construir a `SeedBar`. `TileCursor`
escuta `pointermove` da cena inteira, calcula a célula do grid sob o
mouse e só mostra os 4 cantos (um em cada canto da célula) se ela estiver
em `farmMap.farmlandArea` — sobre grama, cerca ou objetos, nada aparece.
Não guarda nenhum estado de jogo, só reflete onde o mouse está.

### Sombras de chão (`systems/shadow.ts`)

`createGroundShadow` reaproveita uma única mancha oval de
`Tileset/Shadow.png` (`data/effects.ts`, `SHADOW_FRAME`) — o spritesheet
original é uma folha "9-slice" para sombras esticáveis, mas um dos tiles
já é uma mancha completa e autocontida, então nenhum recorte composto foi
necessário. A diferença entre "sombra de árvore" e "sombra de personagem"
é só escala (`scaleX`/`scaleY` passados por quem chama) — tingimento
escuro + opacidade reduzida, nunca uma forma nova.

- **Objetos estáticos** (árvores, Caixa de Remessas, Loja, em
  `systems/mapBuilder.ts`): sombra criada uma vez, com profundidade fixa
  (`STATIC_SHADOW_DEPTH = -0.4`, acima do solo, abaixo de qualquer coisa
  ordenada por Y) — mesmo raciocínio de "não precisa recalcular o que não
  se move" já usado nesses objetos.
- **Personagem** (`entities/Player.ts`): sombra própria, reposicionada e
  redepthada (`sprite.y - 0.1`, sempre logo atrás dele) a cada frame de
  movimento, junto com o Y-sorting do próprio sprite — são a mesma
  atualização, no mesmo lugar do código.

### Poeira ao arar e respingo ao regar (`systems/farmlandRenderer.ts`)

- `spawnHoeDust`: a mesma mancha de `createGroundShadow`, só que tingida
  de marrom-terra (`DUST_TINT`) em vez de escura, com um tween de "infla e
  some" (aumenta escala, sobe um pouco, perde opacidade) em vez de ficar
  parada. Zero sprites novos — só outra combinação de tingimento + tween
  sobre o mesmo asset.
- `spawnWaterSplash`: usa `Objects/Props/Sprash.png` (`data/effects.ts`),
  um respingo já azul de 4 frames — spritesheet em grade simples, ao
  contrário da Caixa de Remessas ou da Loja, então não precisou de recorte
  manual. Toca uma vez (`repeat: 0`) e se autodestrói ao terminar.
- Chamados de dentro de `PlotInteractable` (`systems/farmlandInteraction.ts`),
  no mesmo callback que já aplicava o efeito real (`Farmland.till`/
  `Farmland.water`) — a animação da ferramenta decide quando; o efeito
  visual e o efeito de jogo acontecem juntos, no mesmo instante.

### Pulo elástico ao colher e vender

- **Colher** (`FarmlandRenderer.playHarvestPop` +
  `detachCropImage`): antes de `Farmland.harvest` mudar o estado da
  célula, a imagem da plantação é retirada do controle do renderer
  (`cropImages`) e ganha um tween próprio (cresce, sobe, some). Retirar
  antes é o que importa: sem isso, o próximo `renderPlot`/`renderAll`
  (que já vê a célula colhida) tentaria destruir a mesma imagem por cima
  da animação. Puramente visual — o resultado da colheita já foi decidido
  por `Farmland.harvest`, antes disso.
- **Vender** (`ShippingBinInteractable.popBin`): a própria caixa achata e
  estica rapidamente (`yoyo`) ao vender — igual a "recebeu uma entrega".
  Guarda a escala original uma vez no construtor para sempre voltar a ela,
  mesmo se o jogador vender de novo enquanto a animação anterior ainda
  está rodando (`killTweensOf` antes de reiniciar).

### Entrada animada dos HUDs (`ui/seedBar.ts`, `ui/coinBar.ts`)

- `SeedBar`: cada slot nasce com escala 0 e "estoura" (`Back.easeOut`) até
  o tamanho final, com um pequeno atraso escalonado por índice — a barra
  parece nascer em sequência, não tudo de uma vez. O ícone nem precisou de
  uma animação de entrada própria: como `MainScene` já chama
  `seedBar.refresh()` logo após construir a barra, e `refresh()` já anima
  o ícone selecionado até o tamanho certo, bastou o ícone também começar
  em escala 0 para essa mesma animação servir de entrada.
- `CoinBar`: fundo, moeda e texto começam em escala 0 e entram juntos com
  o mesmo `Back.easeOut`.
- `ShopMenu` não ganhou entrada animada — fica oculto até `open()`, e abrir
  já é a própria "entrada" (não faz sentido animar algo que começa
  invisível e só aparece sob demanda).

## Construções, Decoração e Expansão (Fase 6)

Primeiro passo da fase: um sistema **genérico** de posicionamento livre —
comprar na Loja, posicionar em qualquer grama livre com preview e checagem
de colisão, remover depois — usando o Poço (`WELL`) como primeiro objeto.
A arquitetura não é específica do Poço: qualquer construção ou decoração
futura reaproveita as mesmas peças, só precisando de uma nova
`DecorationDefinition`.

### Dados de decoração (`data/decorations.ts`)

`DecorationDefinition` é o equivalente de `CropDefinition` para objetos do
mundo: `textureKey`/`texturePath`, um `frameName` recortado à mão
(`frameRect`) para o ícone da Loja e o sprite no mundo, e `price`. O
`frameRect` do Poço (`Objects/Exterior/Well .png`) veio do mesmo processo
de escaneamento de pixels (PowerShell + `System.Drawing`) já usado para
outros assets — encontrar os limites reais do sprite, sem confundir com o
canto de um vizinho na mesma folha.

### Estoque de decorações (`systems/inventory.ts`)

Terceiro Map do `Inventory`, `decorations` (quantidade por `decorationId`),
com o mesmo padrão e a mesma justificativa do estoque de sementes: separado
de `items`/`seeds` para não colidir por id. `getDecorationCount`,
`addDecorations` (compra na Loja, devolução ao remover) e `useDecoration`
(consumido ao posicionar; recusa sem estoque).

### Loja genérica (`ui/shopMenu.ts`, `scenes/MainScene.ts`)

`ShopMenu` era acoplado a `CropDefinition`; virou genérico sobre `ShopItem`
(`id`, `textureKey`, `iconFrame`, `price`) — a forma mínima que sementes e
decorações têm em comum. `MainScene` monta uma lista única combinando
`CROPS` (via `seedPrice`) e `DECORATIONS` (via `price`) e passa para o
mesmo painel; o callback de compra (`buyShopItem`) despacha para
`buySeed`/`buyDecoration` conforme o id pertence a um ou outro catálogo.
Um único painel visual continua vendendo os dois tipos de item, sem duplicar
UI.

### Grid dinâmico (`systems/grid.ts`)

Até aqui o `WalkableGrid` era só leitura, montado uma vez a partir do mapa.
Ganhou `block`/`unblock`, operando no mesmo `Set` interno de células
bloqueadas — necessário porque decorações agora bloqueiam/liberam células
em tempo de execução, algo que nenhum obstáculo anterior (fixo desde a
criação do mapa) precisava fazer.

### Roubando o clique: `PointerInputInterceptor` (`systems/playerController.ts`)

Durante o modo de posicionamento, um clique no mundo não pode significar
"mover/interagir" (comportamento normal do `PlayerController`) **e**
"posicionar a decoração" ao mesmo tempo. Em vez de espalhar essa checagem
pelo `PlayerController`, ele ganhou um gancho genérico: um
`PointerInputInterceptor` opcional (`{ isActive(), handleClick(x,y) }`),
checado logo no início de `handlePointerDown` — se houver um interceptor
ativo, o clique é inteiramente entregue a ele e a lógica normal é pulada.
Sem interceptor (ou inativo), o comportamento é idêntico ao de antes dessa
mudança — o gancho não altera nenhum fluxo existente.

### Posicionamento e remoção (`systems/decorationPlacement.ts`)

`DecorationPlacementSystem` implementa `PointerInputInterceptor` e concentra
toda a lógica da Fase 6:

- **Modo de posicionamento** (`toggle`, tecla B em `MainScene`): sem
  estoque da decoração, não entra no modo (só avisa no console, mesmo
  espírito de "clique sem efeito" já usado noutros lugares). Com estoque,
  ativa um preview (`ghost`, uma única `Image` reaproveitada) que segue o
  mouse.
- **Preview**: verde (`0x9be89b`) sobre local válido, vermelho
  (`0xff8a8a`) sobre inválido — `canPlaceAt` recusa células não andáveis
  (já ocupadas) e células da área de plantio (`farmlandArea`), para não
  competir por espaço com a agricultura. Meio-transparente
  (`alpha 0.6`), profundidade 950 — acima do mundo, abaixo dos HUDs
  (3000+), mesma faixa do `TileCursor` (900).
- **Confirmar** (`handleClick`, chamado pelo `PlayerController` via o
  interceptor): valida a célula de novo, consome 1 do estoque
  (`useDecoration`) e cria o objeto — sprite com sombra de chão
  (`createGroundShadow`, mesma sombra reaproveitada de `mapBuilder.ts`,
  profundidade -0.4, abaixo de qualquer objeto ordenado por Y), bloqueia a
  célula no grid e registra um `Interactable` ali. Sem mais estoque depois
  de colocar, sai do modo sozinho.
- **Remover**: uma decoração posicionada é só mais um objeto sólido do
  mundo com um `Interactable` registrado — a interação adjacente que já
  existia para a Caixa de Remessas e a Loja (`PlayerController`,
  inalterado) funciona sem nenhum código novo. Ao interagir
  (`PlacedDecorationInteractable`), o objeto e sua sombra são destruídos,
  a célula é liberada no grid, o registro de interação é removido e 1
  unidade volta ao estoque.
- Tecla ESC (`MainScene`) cancela o modo sem posicionar nada. Entrar no
  modo também fecha a Loja se estiver aberta (`ShopMenu.close()` antes do
  `toggle`) — evitar os dois painéis/modos abertos ao mesmo tempo.

Testado de ponta a ponta: comprar o Poço na Loja (moedas e estoque
corretos) → tecla B → preview segue o mouse e reage a local válido/inválido
→ clique posiciona (estoque zera, grid bloqueia a célula) → interagir com o
Poço posicionado (ver abaixo — deixou de remover) — sem erros no console em
nenhum passo.

### Utilidade do Poço: cargas do regador (`systems/inventory.ts`, `systems/farmlandInteraction.ts`, `systems/decorationPlacement.ts`, `ui/waterBar.ts`)

`PlacedDecorationInteractable.interact()` por padrão remove a decoração
(devolve ao estoque) — mas o Poço é a exceção: interagir com ele (clique
adjacente, mesmo mecanismo de sempre) chama
`DecorationPlacementSystem.refillWateringCan` em vez de `removeAt`, então o
Poço colocado **deixou de ser removível por um clique simples** — essa era
a única "utilidade" que ele tinha antes, e passou a ter uma de verdade.

Ao contrário da primeira versão deste recurso (só feedback visual, sem
mecânica por trás), o regador agora tem cargas reais:

- `Inventory` ganhou `wateringCanCharges` (começa cheio,
  `WATERING_CAN_CAPACITY = 10`, exportada para quem precisar do máximo) com
  `getWateringCanCharges`/`useWaterCharge` (recusa e devolve `false` se
  vazio, mesmo padrão de `useSeed`/`useDecoration`)/`refillWateringCan`.
- `PlotInteractable` (`systems/farmlandInteraction.ts`) checa
  `getWateringCanCharges() <= 0` **antes** de tocar a animação de regar —
  sem carga, não rega, só um log ("Regador vazio — encha no Poço."), mesmo
  espírito de "clique sem efeito" já usado para sementes em falta. A carga
  em si só é consumida dentro do `performAction('water', ...)`, depois que
  a animação termina — mesmo timing de quando `useSeed` é chamado ao
  plantar.
- `DecorationPlacementSystem.refillWateringCan` enche de volta ao máximo e
  toca o mesmo respingo d'água já usado ao regar
  (`FarmlandRenderer.spawnWaterSplash`) — por isso `DecorationPlacementSystem`
  recebe `FarmlandRenderer` no construtor (`MainScene` já tinha a instância
  pronta antes de criar o sistema de decorações).
- `ui/waterBar.ts`: HUD no canto inferior esquerdo — mesma linguagem visual
  da `CoinBar`/`ClockBar` (fundo semitransparente, ícone fixo — aqui o
  `Watering can.png` do pacote de ícones RPG), mas com uma barra de
  preenchimento em vez de texto (dois retângulos sólidos, trilho +
  preenchimento, mesma técnica de cor+alpha já usada no fundo da `CoinBar`
  e no véu de dia/noite). Fica azul acima de 25% de carga e vermelha abaixo
  disso, como aviso de que uma viagem ao Poço está próxima.

### Animação dedicada de buscar água (`data/player.ts`, `Character/.../Pick Up itens/pick up.png`)

Interagir com o Poço tocava a mesma animação de regar a lavoura
(`PLAYER_ACTIONS.water`) — visualmente estranho, já que mostra o
personagem erguendo o regador já cheio, não "pegando" água nenhuma. Não
existe uma animação dedicada de "poço" no pacote de assets; `Pick Up
itens/pick up.png` (abaixar e levantar algo, 4 frames por direção) foi a
mais próxima disponível, sem precisar de arte nova — nova entrada
`PLAYER_ACTIONS.well`, disparada só na interação com o Poço
(`DecorationPlacementSystem`, via `performAction('well', ...)`).

Essa folha usa frames de **64x64**, o dobro das outras (`Hoe`/`Shovel`/
`Watering`/`Sickle`, todas 32x32) — confirmado exportando frames
individuais com fundo magenta e comparando 32 vs 64px (a 32px, cada "frame"
cortava o personagem ao meio; a 64px, cada um continha a pose inteira,
com margem transparente ao redor). Como o tamanho de frame já não era mais
o mesmo para todas as animações, `ActionAnimSpec` ganhou um campo
`frameSize` (as 4 animações antigas continuam declarando `PLAYER_FRAME_SIZE`
explicitamente) e o preload em `MainScene` passou a usar `spec.frameSize`
em vez do tamanho fixo global.

### Personagem não encobre a decoração ao se aproximar (`systems/decorationPlacement.ts`, `systems/treeOverlap.ts`)

O Poço é visualmente mais alto que 1 tile (76px de altura de exibição contra
32px da célula que ocupa), mas a ordenação por Y só enxerga a base dele. Ao
se aproximar por baixo (mesma coluna, uma linha abaixo — a forma mais comum
de se aproximar para interagir/remover), o personagem tem Y maior e a
ordenação o coloca na frente, encobrindo quase todo o Poço — que parecia
"sumir" bem na hora em que o jogador mais precisa vê-lo.

É o mesmo problema que `updateTreeOverlap` já resolve para árvores, só que
invertido: lá, a árvore (na frente) fica semitransparente para não esconder
o personagem; aqui, é o personagem (na frente) que precisa ficar
semitransparente, porque quem não pode desaparecer é a decoração. A função
`coverageRatio` (proporção de sobreposição das duas caixas) foi exportada de
`treeOverlap.ts` para `decorationPlacement.ts` reaproveitar, em vez de
duplicá-la — o cálculo geométrico é o mesmo, só o papel de quem fica
transparente troca de lado.

`DecorationPlacementSystem.updateOcclusion()` (chamado a cada frame por
`MainScene.update`, junto com `updateTreeOverlap`): para cada decoração
posicionada que está atrás do personagem (`sprite.depth > image.depth`),
mede a cobertura da decoração pelo personagem e aplica a maior encontrada à
opacidade do personagem (`Phaser.Math.Linear(1, MIN_PLAYER_ALPHA, ...)`,
`MIN_PLAYER_ALPHA = 0.4`). Como a célula da decoração é sólida, o
personagem nunca chega perto o bastante para cobrir 100% dela de verdade —
por isso a cobertura medida passa por um fator de amplificação (`* 2`,
`Phaser.Math.Clamp`d em 1) antes de virar opacidade, para o efeito já ficar
visível assim que ele encosta, em vez de exigir uma sobreposição completa
que nunca acontece geometricamente. Testado: personagem encostado embaixo
do Poço colocado cai para ~0.49 de opacidade (medido via `sprite.alpha`) e
volta a 1 assim que se afasta.

### Expansão de propriedade (`data/maps/farmMap.ts`, `systems/propertyExpansion.ts`, `systems/mapBuilder.ts`, `systems/grid.ts`)

Estilo Forager, não um menu de loja: 4 trechos de terra ao redor do núcleo
original (`farmMap.cols` x `farmMap.rows`, 25x18 — não muda), um por
direção (norte/sul/leste/oeste), cada um com preço e posição de placa
próprios (`farmMap.expansions: ExpansionChunk[]`). Cada trecho é comprado
individualmente, andando até a placa física na parede daquele lado e
interagindo — sem painel abstrato envolvido.

- **O mundo já nasce com os 4 trechos** (`PropertyExpansionSystem`, no
  `create` da cena): grama (`buildGroundChunk`, uma camada de tilemap por
  trecho, reaproveitando a mesma função que desenha o núcleo) e o
  perímetro externo **definitivo** de cada um (`buildExpansionChunkFence`
  — os 3 lados que não fazem fronteira com o núcleo; esse lado fica aberto,
  unindo trecho e núcleo assim que a parede for removida). Isso já existia
  antes da compra — só fica inacessível, não invisível.
- **Coordenadas negativas**: trechos a norte/oeste ficam em colunas/linhas
  negativas (ex.: oeste em `col0: -8`). `WalkableGrid.inBounds` deixou de
  assumir `0..cols/rows` e passou a cobrir o retângulo total (núcleo + todos
  os trechos, calculado a partir de `farmMap.expansions`); a câmera
  (`MainScene.create`) também tem seus limites calculados assim, no lugar
  de só `farmMap.cols/rows`.
- **A cerca do núcleo virou 4 peças independentes**: os 4 cantos do núcleo
  (`buildFenceCorners`) são permanentes — nunca somem, mesmo depois dos 2
  lados que se encontram ali serem comprados; evita a complexidade de
  fundir cantos quando as 2 paredes adjacentes são compradas em momentos
  diferentes. Cada lado reto entre os cantos (`buildFenceSide`) é composto
  e removível independentemente — é a "cerca temporária" daquele trecho,
  some (visual + `grid.unblock`) quando comprado.
- **Cantos diagonais**: como os trechos são só "em cruz" (um por lado, sem
  trecho nos 4 cantos diagonais entre um horizontal e um vertical), e os
  limites da câmera cobrem o retângulo total, a câmera conseguia rolar até
  esses cantos e revelar um buraco preto (sem tilemap nenhum ali). Corrigido
  preenchendo esses 4 cantos só com grama (`PropertyExpansionSystem.fillDiagonalGaps`)
  — sem cerca nem bloqueio extra no grid, porque esses cantos já são
  inalcançáveis a pé (cercados pelas paredes dos 2 trechos vizinhos).
  Limitação conhecida: onde a cerca permanente de um trecho vertical
  encontra a de um horizontal (ex.: canto noroeste com norte E oeste
  comprados), as duas peças não se fundem num canto único — ficam como 2
  segmentos retos que só quase se tocam, uma pequena imperfeição visual
  num canto que já não dá pra visitar.
- **Placa de obra** (`buildConstructionSign`, `Objects/Exterior/Construction area.png`
  — caixa de ferramentas + capacete, o objeto mais próximo de uma "placa"
  no pacote de assets): um `Interactable` por trecho
  (`ExpansionSignInteractable`), bloqueado no grid, com a mesma interação
  adjacente da Loja/Caixa de Remessas — sem menu, interagir já tenta
  comprar (`PropertyExpansionSystem.tryBuy`). Sem moedas suficientes, só um
  log (mesmo espírito de "clique sem efeito"). Comprado: paga
  `chunk.price`, destrói a placa e a parede daquele lado, libera as células
  correspondentes no grid — o trecho passa a fazer parte da propriedade.
- Testado (via chamada direta de `interact()` + inspeção do grid, os 4
  lados): leste e oeste (preço 120) e norte e sul (preço 100) — cada compra
  paga o preço certo, remove a placa e a parede, e libera exatamente as
  células daquele lado (os 4 cantos do núcleo continuam bloqueados).

### Próximos pontos (fora do escopo deste passo)

- Fundir os cantos diagonais da cerca quando os 2 trechos adjacentes são
  comprados (ver limitação conhecida acima).
- Mais tipos de decoração/construção além do Poço (a arquitetura já
  suporta, só falta cadastrar novas `DecorationDefinition`).
- Algum indicador visual de que a tecla B existe (hoje é descoberta só
  pelo log do console ao comprar).

## Ajustes soltos (pedidos junto com a Fase 6)

Dois ajustes sem relação direta com posicionamento/decoração, pedidos na
mesma leva de trabalho:

- **Arte do solo arado** (`data/tiles.ts`, `SOIL_DRY_INDEX`/`SOIL_WET_INDEX`):
  o tile antigo (linha 2/6, coluna 9 de `Tilled Soil and wet soil.png`) era
  uma cor sólida lisa, sem nenhuma textura — escolhido originalmente só por
  ser "100% uniforme" (nenhum pixel transparente, ladrilha sem emenda).
  Substituído por um par (linha 1/5, coluna 2) achado escaneando todos os
  192 tiles do spritesheet por script (PowerShell + `System.Drawing`):
  filtra só tiles totalmente opacos (mesmo requisito de "sem emenda" de
  antes) e ordena pela variância de cor dentro do tile (mais textura =
  mais interessante visualmente). O escolhido tem marcas de terra nos 4
  cantos que, ladrilhadas lado a lado, formam losangos espaçados
  igualmente — confirmado renderizando um bloco 4x3 fora do jogo antes de
  aplicar, sem nenhuma emenda visível.
- **Velocidade de movimento** (`data/player.ts`, `PLAYER_MOVE_DURATION_MS`):
  180ms → 260ms por célula (personagem andando mais devagar).

## Sistema de Tempo (Fase 7)

Primeiro item da fase: um relógio interno com ciclo dia/noite e contador de
dias — puramente aditivo, sem efeito em nenhuma mecânica existente.

### Por que um relógio novo, e não o que já existe em `Farmland`

`Farmland` já tem seu próprio `clockMs` (avança em tempo real, sem limite,
usado só para crescimento/hidratação das culturas). Esse relógio e o do
dia/noite são conceitos deliberadamente separados — um é "hora do dia", o
outro é "temporizador de crescimento" — ligar um ao outro mudaria como a
agricultura já funciona, o que não foi pedido. `GameClock`
(`systems/gameClock.ts`) roda em paralelo, sem nenhuma referência a
`Farmland` nem o contrário.

### Ritmo do dia (`systems/gameClock.ts`)

Um dia inteiro (24h) dura `DAY_LENGTH_MS` = 90 segundos reais — bem mais
curto que o ritmo "realista" de outros jogos do gênero (Stardew Valley:
~13min reais por dia). As culturas daqui crescem em 12-20s (`data/crops.ts`),
então um dia longo deixaria o relógio desconectado do resto do ritmo já
estabelecido; 90s dá uns 5-7 ciclos de plantio por dia. Ajustável mudando
uma única constante.

`GameClock.update(deltaMs)` acumula o tempo e devolve `true` só no frame em
que um novo dia começa (pra quem quiser reagir, hoje só um log em
`MainScene`). `getHours()` devolve a hora atual (0-24, fracionária).

### Véu de dia/noite (`systems/dayNightOverlay.ts`)

Um retângulo semitransparente cobrindo a tela inteira (mesma técnica já
usada no fundo da `CoinBar`/`ClockBar` — cor sólida com alpha, não um
asset; aqui a cor É o efeito, não uma peça de UI). Fica em
`scrollFactor(0)` (acompanha a câmera, que desde a Fase 6 pode rolar) e
depth 999 — abaixo da HUD (1000+), acima do mundo.

Pegadinha do Phaser encontrada testando: `scene.add.rectangle(x,y,w,h,cor,alpha)`
define o **alpha do preenchimento** (canal alpha da cor), uma propriedade
diferente do `alpha` do game object (`setAlpha`). Criar o retângulo com
`fillAlpha: 0` e depois só chamar `setAlpha(dinâmico)` deixava o alpha
final sempre 0 (fillAlpha × alpha do objeto) — o véu nunca aparecia, sem
erro nenhum no console. Corrigido criando com `fillAlpha: 1` (opaco) e
controlando a visibilidade só via `setAlpha`.

`GameClock.getNightAlpha()` calcula a opacidade (0 a 0.55 — nunca total,
pra não esconder o jogo) a partir da hora: dia cheio das 7h às 17h,
noite cheia das 19h às 5h, com transição linear suave nas janelas
5h-7h (amanhecer) e 17h-19h (anoitecer) — sem cortes abruptos.

### HUD do relógio (`ui/clockBar.ts`, `data/ui.ts`)

Espelha a `CoinBar` (moedas, canto superior direito) no canto superior
esquerdo: mesmo fundo semitransparente, mesma entrada animada
(`Back.easeOut`), mesmo motivo para texto (`scene.add.text` — não há fonte
em pixel art no pacote para "Dia N" / hora livre). O ícone
(`UI/Clock/Clock.png`, um mostrador sol/lua) é uma imagem única, sem frames
— ao contrário da moeda, não tem animação de giro.

### Debug

Tecla T (já usada para adiantar o relógio da agricultura) agora também
adianta `GameClock`, pelo mesmo `DEBUG_TIME_SKIP_MS` — um só atalho avança
os dois relógios paralelos ao testar.

### Próximos pontos (fora do escopo deste passo)

- Nenhuma mecânica ainda depende da hora/do dia (ex.: lojas fechando à
  noite, plantação parar de crescer, personagem mais lento no escuro) —
  intencional, escopo deste passo era só o relógio em si.
- Árvores, Pedras/Minérios, Animais e Produção Animal (demais itens da
  Fase 7).
