# Arquitetura Técnica — Mini Fazenda

> Este documento descreve a arquitetura técnica **planejada**. Detalhes de implementação podem ser ajustados durante o desenvolvimento, desde que os princípios abaixo sejam respeitados. Para regras de comportamento de desenvolvimento, ver [CLAUDE.md](../CLAUDE.md).

## Stack tecnológica

- **TypeScript** — linguagem principal do projeto, para segurança de tipos e manutenibilidade.
- **Phaser** — engine 2D usada para renderização, cenas, física e input.
- **Vite** — build tool e servidor de desenvolvimento; o jogo será desenvolvido inicialmente através dele.
- **Electron** *(Fase 10)* — empacotamento como aplicativo executável para desktop (`electron/`, `electron-builder`).

## Plataforma e distribuição

O desenvolvimento acontece via Vite, e o mesmo build é empacotado como aplicativo desktop com Electron. Para que a lógica principal do jogo não dependa do empacotamento:

- A lógica do jogo (cenas, entidades, sistemas, dados) não deve depender de APIs específicas de navegador além do que o Phaser já abstrai.
- Acesso a sistema de arquivos, janelas nativas e processos fica isolado em uma camada própria (`electron/` + adaptadores em `src/systems`), nunca misturado à lógica do jogo.

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

## Integração com Electron (Fase 10)

**Scripts** (`package.json`):

- `npm run dev:electron` — Vite + janela do Electron apontando para `http://localhost:5173` (F12 abre o DevTools). A porta é fixa (`strictPort`): feche outro `npm run dev` antes.
- `npm run start:electron` — gera o build e abre no Electron como o executável faria (protocolo `app://`).
- `npm run build:electron` — build + instalador do Windows em `release/` (`electron-builder`, configuração no campo `build` do `package.json`).

**Estrutura** (`electron/*.cts`, compilado para `dist-electron/*.cjs` por `npm run electron:compile`; `.cts` porque o `package.json` é `"type": "module"`):

- `main.cts` — janela, protocolo `app://`, IPC de save e de tela cheia.
- `preload.cts` — expõe `window.electronAPI` (`contextIsolation` + `sandbox`; o jogo não tem `require`, `fs` nem `ipcRenderer`).

**Decisões:**

- **Servir o jogo:** os assets são carregados por caminho absoluto (`/UI/...`), que não funciona sob `file://`; empacotado, o processo principal serve `dist` pelo protocolo `app://game/` (com respostas `Range` para o áudio em streaming).
- **Janela:** 16:9 (o jogo é 1280x720, `gameConfig.ts` — `GAME_WIDTH/GAME_HEIGHT` em `electron/main.cts` precisam acompanhar), a maior escala que cabe na tela (até 1920x1080), sem menu, tamanho fixo (mínimo = máximo — `resizable: false` deixava o Chromium com uma área errada no Windows), instância única. O jogo **abre em tela cheia** por padrão; F11/Alt+Enter ou o botão das Configurações alternam, e a escolha do jogador fica em `display_prefs.json` (sem esse arquivo = tela cheia).
- **Save:** `ElectronStorageAdapter` (em `systems/storageAdapter.ts`) usa a ponte `window.electronAPI.storage`, síncrona (`sendSync`), porque a interface `StorageAdapter` é síncrona. Os arquivos ficam em `Documentos/Mini Fazenda/`: `savegame-slot1.json` a `savegame-slot3.json` e `settings.json`. O jogo só envia uma CHAVE; o processo principal escolhe o arquivo (formato `[a-z0-9-]`, sem caminhos), limita o tamanho e grava de forma atômica (temporário + renomear). No navegador o adaptador padrão continua sendo o `localStorage`.
- **Variável de teste:** `MINI_FAZENDA_SAVE_DIR` troca a pasta dos saves (para testes não sujarem seus Documentos).

## Cursor do jogo e balão de dica

- **Cursor** (`systems/gameCursor.ts`, `data/ui.ts` → `GAME_CURSOR_*`): o primeiro ícone de `UI/HUD.png` (seta marrom) é fatiado da textura já carregada, ampliado 2x sem suavização num canvas e vira o `cursor: url(...)` do CSS. A regra usa `!important` porque o Phaser aplica `cursor: pointer` inline sobre objetos com `useHandCursor` — assim o ponteiro do jogo vale em todos os elementos. Instalado uma vez pela `MainMenuScene` (primeira cena).
- **Tooltip** (`ui/tooltip.ts`): painel do jogo (NineSlice) + texto, invisíveis até `show(texto, ponteiro)`; `follow` acompanha o ponteiro (vira de lado/para cima quando não cabe) e `hide` esconde. A `UIScene` cria UM e o passa à `Hotbar` e ao `InventoryScreen`, que ligam `pointerover`/`pointermove`/`pointerout` dos slots. No Inventário o ícone cobre o centro da moldura, então moldura e ícone registram o hover separadamente; o balão some ao arrastar, ao fechar a tela e ao trocar de aba.

## Clima, aspersor, armadura, Loja, Caixa de Remessas e loot no chão

- **Chuva** (`systems/weather.ts`, `ui/weatherOverlay.ts`): na virada do dia (dormir, meia-noite, tecla T) `MainScene.rollWeather` sorteia `RAIN_CHANCE` (15%) e guarda em `gameState.weather.raining` (vai pro save). Chovendo, `Farmland.waterAll` rega toda a lavoura e a cena "varre" as plantações com respingos. O visual vive na `UIScene` (persistente): véu cinza-azulado + partículas de gotas (`Water props.png`) + respingos batendo em pontos aleatórios da tela (`Sprash.png`); não chove na Caverna.
- **Aspersor** (`data/decorations.ts` → `SPRINKLER`, `systems/sprinklers.ts`): decoração comprável (Loja, aba Construções) com `waterReach` (era `waterRadius`, um raio — hoje é um padrão de terras: ver a seção "Caixa de Correio e grid de alcance do aspersor"); toda manhã rega as terras que alcança. Lê `gameState.placedDecorations`. Arte: `Objects/Props/Sprinkler.webp` (ver a seção "Martelo, cercas destruídas, aspersor animado e ajustes").
- **Armadura** (`Inventory.toggleArmor`/`getDefense`, `ui/armorHud.ts`): clicar numa armadura da Mochila (ou no ícone dela na bonequinha) veste/tira. Cada ponto de defesa tira 5% do dano recebido (`reduceDamage` em `systems/playerHealth.ts`). A HUD (`UI/Armor.png`: cheio/meio/vazio) mostra 5 ícones de 2 pontos cada, embaixo dos corações, escondida sem armadura.
- **Loja** (`ui/shopMenu.ts`): mesmo esquema da aba Agricultura do Inventário — grid de itens à esquerda (clicar SELECIONA), detalhe à direita (ícone grande, nome, descrição, preço) e o botão "Comprar" (que pede a compra via `onBuy`). Cada `ShopItem` traz `name`/`description`; itens únicos (receitas) mostram "Já possui" via `isOwned`.
- **Caixa de Remessas** (`ui/shippingBinMenu.ts`, `systems/shippingBinInteraction.ts`): interagir abre um menu com dois grids (caixa / bolsa). Clicar numa colheita da bolsa transfere 1 unidade (Shift+clique ou botão direito: todas); nada sai do `Inventory` até o botão "Vender" (`Inventory.takeCrop` + `addCoins`). Fechar sem vender não perde nada.
- **Loot no chão** (`systems/lootDrops.ts`): árvores, pedras, Slimes e plantações chamam `spawnLoot` em vez de dar o item direto. O item pula até o chão (arte do próprio item) e, quando o jogador chega a ~48px, é sugado até ele e só então entra no `Inventory`. Monte grande vira até 6 itens. Sair do mapa (`SHUTDOWN`) manda o que sobrou no chão pra bolsa.

## Seleção de personagem, interior da casa e ajustes da versão 0.1.2

- **Seleção de personagem** (`data/player.ts`, `systems/playerSprites.ts`, `CharacterCreationScene`): Alex, Josh, Lyria, Manu e Tori compartilham o mesmo rig; `getPlayerAssets(characterId)` devolve as chaves/caminhos de cada um (nomes de arquivo que diferem entre as pastas ficam em `CHARACTER_FILES`). `profile.characterId` (`gameState`) vai pro save (`SaveData.characterId`, opcional — saves antigos caem em Alex). Toda cena que cria um `Player` chama `preloadPlayerSprites` no `preload` (a `CharacterCreationScene` só carrega o idle de cada um pro preview). Chaves de textura e de animação são POR personagem (`player-<nome>-...`), então trocar de personagem entre slots nunca reaproveita arte do anterior.
- **Interior da casa** (`data/maps/houseMap.ts`, `scenes/HouseScene.ts`): cômodo 8x8 (bordas de parede, porta na parede de baixo, cama 1x2), câmera parada e ampliada 2x. A porta da Fazenda (`systems/enterHouseInteraction.ts`) dá fade out e vai pra `HouseScene`; pisar na porta de dentro volta pra Fazenda em frente à porta. **Dormir** agora é na cama (`systems/sleepInteraction.ts`) → `systems/dayCycle.ts` `startNextDay`: relógio às 06:00, vida cheia, lavoura/clima/aspersores/mundo do dia novo, SALVA, fade in. Chão/paredes são placeholder (tábua do `Barn tileset.png`).
- **Correção — dormir depois da meia-noite:** o contador de dias já vira à meia-noite; antes, dormir entre 00:00 e 05:59 somava OUTRO dia e rodava a virada da lavoura de novo (plantação não regada morria). `GameClock.advanceToNextMorning` agora devolve `false` nesse caso e `startNextDay` só roda a virada quando o dia realmente virou.
- **Caixa de Remessas vende materiais** (`data/sellables.ts`, `ResourceDefinition.sellPrice`): madeira 1, pedra 2, gosma de Slime 4 (a gosma não tinha nenhum uso). A bolota não vende (é semente de árvore).
- **Câmera de mapas pequenos** (`systems/cameraSetup.ts`): mapa menor que a janela (Floresta/Pedreira/Caverna/Praia, ~830x640 em 1280x720) fica centralizado, e o vazio em volta usa a cor do bioma.
- **Juice:** números de dano e tremor de câmera ao acertar inimigos; tremor ao derrubar árvore/quebrar pedra; "+N Item" agrupado ao pegar loot (`systems/floatingText.ts`); dígitos de moedas "pulam" ao ganhar; faixa "DIA N" (com o clima) na virada do dia.
- **Áreas:** Caverna com tint azulado + cogumelos/pedras/flores-cristal; Praia, Pedreira e Floresta com props de decoração (`props` em `data/maps/*`).

## Pet companheiro

- **Escolha e save** (`data/pets.ts`, `CharacterCreationScene`, `gameState`/`saveManager`): na Criação de Personagem uma segunda linha `< >` (ou Shift + ← →) troca entre 3 gatos e 3 cachorros (`PETS`, um catálogo curado das folhas de `assets/Animals/Pets`). O escolhido vai pro perfil (`profile.petId`) e pro save (`SaveData.petId`, opcional — saves antigos ou com id inválido carregam com o pet padrão). Adicionar um pet = uma linha em `PETS`.
- **Folha do pet** (`data/pets.ts`): grade 4 colunas de 32x32; só as linhas 0-4 são usadas porque nelas gatos e cachorros têm o mesmo layout (0 = andar de lado, olhando à esquerda; 1 = de frente; 2 = de costas; 3/4 = em pé → sentado, de lado/de frente — a pose feliz é o quadro 3 da linha 4). Da linha 5 em diante o layout muda entre as espécies. Chaves de textura/animação são POR pet (`pet-<id>`), como no personagem.
- **Entidade** (`entities/Pet.ts`): posição livre em px (como os inimigos), mas sempre andando célula a célula por rotas A* (`systems/pathfinding.ts`) no MESMO grid do jogador — contorna árvores, cercas, casa e água. Só troca de rota nos limites de célula (nunca no meio de um passo) e "chegar" é estar na célula do destino planejado (`goal`), não "a rota acabou". Estados: descansando (sentado voltado pro jogador), passeando, seguindo, atendendo ao chamado, recebendo carinho, perseguindo e mordendo. Todos os números (velocidades, raios, dano, recargas) ficam em `PET_TUNING`/`PET_ROAM`.
- **Exploração**: o pet vagueia num raio em volta do JOGADOR (`wanderRadiusTiles`; pra cima o raio é metade, senão ele passeia atrás de casas/árvores e "some") e só vem atrás quando o jogador passa do `leashTiles`; se ficar longe demais ou sem caminho, reaparece ao lado dele. A Fazenda solta mais (`PET_ROAM.farm`) que as áreas e a Casa.
- **Carinho**: um clique no pet (`PlayerController.addWorldClickHandler` — tratadores de clique no mundo, checados DEPOIS dos interceptores de menu/posicionamento e ANTES de "andar até aqui") o chama; se estiver longe ele corre até o jogador, e então fica feliz (pose de língua pra fora, pulinhos e 3 corações do HUD — `UI/Bars.png` — subindo). O jogador não anda e vira de frente pro pet. Ocupado brigando, o pet só absorve o clique.
- **Navegação entre cenas** (`systems/petCompanion.ts`): o `Pet` é uma entidade da cena (os sprites morrem com ela), então TODA cena que tem jogador — Fazenda, as 4 áreas (`ExternalMapScene`) e a Casa — carrega a folha no `preload` (`preloadPet`) e cria um `PetCompanion` logo depois do jogador/grid/conteúdo prontos; o pet nasce na célula livre ao lado do jogador (fora do anel de parede nas áreas, fora da porta na Casa). A escolha em si vive só no `gameState`.
- **Combate**: quando um inimigo acerta (ou tenta acertar — a invencibilidade pós-dano não conta) o jogador, a cena emite `PLAYER_ATTACKED_EVENT` (`systems/combat.ts`, emitido por `SlimeSpawner.hurtPlayer` com o `Enemy` que atacou; o `Slime` passou a informar `this` no callback do golpe). O `PetCompanion` escuta e o pet corre até o agressor e o morde (`Enemy.takeDamage(..., 'pet')`: mostra o número de dano, mas não sacode a câmera) até ele morrer; só revida contra quem agrediu. Desiste se o jogador se afastar demais ou se ficar parado, sem rota, por `chaseStuckMs` (inimigo encostado na parede/do outro lado da água) — se o inimigo agredir de novo, o pet volta. O pet não leva dano.
- **Pausas**: as cenas só chamam `petCompanion.update` quando o jogo está andando — Menu de Pausa e fade de entrada na casa na Fazenda; Inventário/Bancada abertos nas áreas (igual aos Slimes) e na Casa.

## Água animada (autotile), colheita na chuva e ajustes

- **Autotile animado da água** (`systems/waterAutotile.ts`, tabela em `data/tiles.ts` — `WATER_AUTOTILE_*`): `buildAuthoredGroundChunk` (chão autorado no editor, Fazenda e áreas) chama `buildWaterAutotile`, que acha as células de água do `ground` (`isWaterGid`: o tile "Água" plano e qualquer tile de "Beach animations tiles" que não seja areia lisa — o lago da Floresta e o mar da Praia foram pintados com ele) e desenha por cima do chão o tile certo de `Beach animations tiles.png`, escolhido por **bitmask dos 4 vizinhos** (N=1, E=2, S=4, W=8; bit ligado = vizinho também é água; fora do mapa conta como água). São 16 máscaras = 16 tiles, o MESMO layout do solo arado (cápsulas verticais/horizontais, ilhota, 9-slice); o miolo usa o único tile 100% liso da folha (col 9, linha 2), porque o "centro" do 9-slice tem rosquinhas nos cantos. A folha tem 4 fases empilhadas (blocos de 4 linhas, `WATER_AUTOTILE_PHASE_STRIDE`); um único timer da cena troca as fases de todas as células de borda (240 ms) — o miolo liso é igual nas 4 e não é atualizado. Como no arado, só há 4 vizinhos (sem cantos internos). Colisão NÃO muda (continua vindo de `blockedArea`/`obstacleCells`), e o editor continua mostrando o tile pintado (estático).
- **Colheita na chuva** (`Farmland.harvest(col, row, raining)`): colher em dia de chuva mantém o solo molhado (`wateredToday` fica ligado no solo `tilled` e o renderer trata solo arado + regado como molhado); fora da chuva volta a seco. Na virada do dia o solo arado seca (`onNewDay`), e ao carregar um save o solo arado só vem molhado se estiver chovendo.
- **Props de chão** (`MapPropDef.flat`, `systems/mapProps.ts`): o tronco caído é desenhado no chão (`depth -0.4`, acima do chão/água/terra e abaixo de tudo ordenado por Y), em vez de ordenado por Y — a arte de 2+ tiles de altura cobria quem passava atrás dela.
- **Ícone da madeira**: `Icons/RPG icons/Extras/Wood.png` (primeiro ícone 16x16 da folha) — vale pro drop no chão, o slot do Inventário e a Caixa de Remessas.

## Água bloqueada, recursos da Fazenda, ciclo de brotos e aspersor 1x1

- **Água bloqueia sozinha** (`systems/waterCells.ts`): `isWaterGid` é a fonte ÚNICA do que é água (o autotile desenha por ela, a colisão bloqueia por ela); `waterCellsFromGround(ground)` lista as células. `ExternalMapScene` (Floresta/Praia) e `buildWalkableGrid` (Fazenda) bloqueiam essas células no grid — sem depender de `blockedArea`/`lakeArea` — e o respawn diário da Floresta não nasce nelas. Slimes, folhagem selvagem e o pet ficam de fora da água porque nascem/andam pelo grid.
- **Recursos da Fazenda** (`systems/farmResources.ts`): as árvores de `farmMap.treePositions` e as pedras de `farmMap.rockPositions` (editor) são nós do `resourceNodeRegistry` (chave `MainScene:resources`, semeada no construtor da `MainScene`). `FarmResources` desenha tudo a partir do registro; árvore adulta e pedra bloqueiam o grid e ganham `TreeInteractable` (Machado, 8 golpes, madeira + bolotas) / `RockInteractable` (Picareta, 4 golpes, pedra), os mesmos das áreas — o loot cai no chão. `buildWalkableGrid` não bloqueia mais `treePositions`: quem bloqueia (e desbloqueia ao cortar) é o `FarmResources`. O `TreePlantingSystem` ficou só com o modo de plantio (fantasma + clique) e delega a árvore plantada ao `FarmResources.plant`.
- **Ciclo de dias** (`advanceFarmResourcesDay`, chamado por `dayCycle.advanceWorldResourcesState` e pela `MainScene` à meia-noite): toda árvore avança um estágio (broto → muda → adulta, ~2 dias) e nascem 0–2 brotos novos em grama lisa livre (`isFarmCellFreeForResource`: dentro da propriedade, fora da lavoura/caminho/construções/blocos de colisão e a mais de 2 células da casa, loja, caixa, portão e pontes), até o teto de 12 árvores (`FARM_CAPS`; cortar libera vaga). Pedras da Fazenda não renascem. Broto e muda são andáveis e balançam ao pisar.
- **Recursos persistem** (`resourceNodeRegistry.serialize/restore/resetToInitial`, `SaveData.resourceNodes`): o que foi cortado/quebrado e o que nasceu/cresceu (Fazenda, Floresta, Pedreira) vai pro save. Partida nova e saves antigos (sem o campo) voltam ao mapa original — antes o registro nunca era zerado e o mundo da partida anterior vazava pra nova. `ResourceCaps.newTreesPerDay/newRocksPerDay` deixam cada cena ajustar a taxa de nascimento.
- **Aspersor 1x1** (`data/decorations.ts`, `systems/decorationPlacement.ts`): `footprint` 1x1 e `displayScaleMultiplier` 16/109 (o CORPO do aspersor, 109px no `Sprinkler.webp`, vira exatamente 1 tile; o jato passa pra fora, só visual); `placement: 'farmland'` — só pode ser posicionado em terreno de plantio AINDA NÃO ARADO (as demais decorações continuam só fora da lavoura). Sprinklers de saves antigos (2x2, fora da lavoura) voltam como 1x1 e continuam regando.
- **Trava da enxada** (`Farmland.setTillLocked/isTillLocked`): o aspersor (`locksTilling`) trava o bloco pra `till` — regra do grid da lavoura, não da ferramenta (transitória: recriada por `restorePlacements` ao abrir a Fazenda). Com a enxada na mão, o clique no aspersor não faz nada (não ara nem remove); só a PICARETA (qualquer tier) o tira do chão — ele cai como item no chão (`LootCategory 'decoration'`) e o jogador o recolhe; qualquer outra seleção só mostra a dica. Como o aspersor fica em cima de um canteiro, `DecorationPlacementSystem` guarda a interação anterior da célula (`PlotInteractable`) ao posicionar e a devolve ao remover — sem isso o canteiro ficaria sem interação pra sempre.
- **Pedreira**: as pedras não ficam mais em `obstacleCells` (lista congelada no boot) — bloqueiam pelo registro atual em `buildMapContent`; uma pedra já quebrada não deixa mais parede invisível ao voltar.

## Progressão de ferramentas, móveis da casa e Baú

- **Progressão linear** (`data/toolProgression.ts`): Machado e Picareta seguem Madeira > Pedra > Ferro > Ouro (`TOOL_PROGRESSION`, ids em `data/tools.ts`). O pacote de ícones não tem pasta "Pedra": o tier Pedra usa a arte de `2. Cooper`. Fabricar na Bancada o tier N exige TER o N-1 na Bolsa (`getToolUpgradeBlock`, `systems/toolUpgrade.ts`; a Bancada mostra "Já tem"/"Precisa: …") e `Inventory.upgradeTool` **substitui** o item anterior no MESMO slot — o antigo é destruído, nunca há item extra nem outro slot, e o slot selecionado da Hotbar não muda. Saves do fluxo antigo (dois tiers da mesma família) são consolidados em `Inventory.deserialize` (fica o maior, no slot do mais antigo). Receitas novas: `recipe-axe-stone`/`recipe-pickaxe-stone` (200 moedas).
- **Efeito dos tiers** (`resourceInteraction.ts`): cada golpe soma `TOOL_TIER_POWER` (1 / 1,5 / 2 / 4) ao progresso — Machado derruba a árvore em 8 / 6 / 4 / 2 golpes e a Picareta quebra a pedra em 4 / 3 / 2 / 1. Antes, Machado/Picareta de Ferro/Ouro não funcionavam em árvores/pedras (só o de madeira passava na checagem de id). Qualquer tier também remove a Bancada. Só Machado e Picareta têm progressão por ora (Enxada/Foice/Regador/espadas seguem como estão); outra família = uma linha em `TOOL_PROGRESSION` + 4 `ToolDefinition`s.
- **Móveis** (`data/decorations.ts` — `placement: 'house'`, `FURNITURE`): Baú, Cadeira, Mesa (2x1), Sofá (2x1) e Cômoda são decorações comuns (compradas na aba Construção da Loja, estoque em `Inventory.decorations`) que só se posicionam dentro da casa. `systems/furniturePlacement.ts` (`FurniturePlacementSystem`, na `HouseScene`): fantasma + clique via `PointerInputInterceptor` (Hotbar ou tecla B entram no modo; ESC sai); só células internas do cômodo (parede fora), nunca a porta/o ponto de entrada, e a posição é recusada se fechar TODO o acesso à cama (simula o bloqueio e roda o A* da entrada até uma célula ao lado da cama). Bloqueia o grid (objeto estático com colisão), registra a interação em cada célula do footprint e grava em `gameState.placedFurniture` (save). Clicar num móvel comum o recolhe (volta ao estoque). Na Fazenda os móveis nunca entram no modo de posicionamento (`canPlaceAt` recusa, `MainScene.resolveSelectedDecoration` ignora).
- **Baú** (`systems/chestStorage.ts`, `ui/chestMenu.ts`): o conteúdo vive em `gameState.chests` (por id de baú = célula-âncora do móvel; vai pro save, `SaveData.chests`) como até 24 pilhas `{category, id, amount}` (ferramentas/armaduras são pilhas de 1). Mover é imediato e passa por uma API genérica do `Inventory` (`getStackCount/removeStack/addStack/hasRoomFor/getBagStacks`), que trata todas as categorias igual e não conta como colheita nova (as Descobertas não mudam): `depositToChest` só move o que o baú comporta e `withdrawFromChest` só tira do baú o que a Bolsa aceitou (vaga de slot; uma ferramenta que conflita com a progressão — já tem outra da família — é recusada). A tela é do `UIScene` (câmera própria, sem o zoom da casa), aberta pelo evento `OPEN_CHEST_MENU_EVENT`: em cima o baú, embaixo a bolsa; clique move 1, Shift+clique/botão direito move a pilha; "Recolher" pega o móvel de volta só com o baú vazio. A casa trava movimento/clique e fecha com ESC enquanto a tela está aberta.

## Evento do pet (caixa e carta) e Hordas

- **Evento do pet** (`systems/petEvent.ts`, `petBox.ts`, `ui/letterPanel.ts`): `HouseScene.sleep` conta os sonos na cama (`gameState.sleepCount`, antes da virada que salva). No 3º, `petBoxPlaced` liga e uma caixa (`PetBox`, `Animals/Pets/Cats/Box.png`, sólida, na célula (20, 9) à frente da casa) aparece na Fazenda. Interagir dispara `OPEN_LETTER_EVENT`; a `UIScene` mostra o `LetterPanel` (modal, só fecha pelo botão "Cuidar dele" — Esc não vale) com a carta e o nome do jogador. O ❤️ do texto original NÃO é emoji/glifo (regra de não desenhar arte por código): é o sprite de coração do HUD (`UI/Bars.png`) ao fim da carta. Ao terminar a leitura: `unlockPet()` (`petUnlocked = true`), salva, a caixa some e o pet passa a existir. Sem `petUnlocked` nenhuma cena cria o `PetCompanion` (Fazenda, áreas e Casa). O pet continua sendo o escolhido na Criação de Personagem. Saves antigos (sem o campo) carregam como liberado — já tinham pet desde o começo; partida nova começa bloqueado.
- **Hordas** (`data/horde.ts`, `systems/horde.ts`, `hordeDirector.ts`, `entities/Raider.ts`): a cada 10 dias (10, 20, 30…) a Fazenda sofre uma noite de ataque, das 19:00 às 06:00. O estado (`gameState.horde`, no save) é global; os inimigos são da cena — o `HordeDirector` os faz nascer nas bordas da propriedade (rajada de 3 e lotes de 2 a cada 9 s, sempre em célula com rota até a casa), reaproveita o estado se a cena reabrir no meio (nasce o que falta) e mostra o contador. Tamanho/vida crescem com o número da horda (8 + 2 por horda, máx. 20; vida 25 + 5 por horda). Os drops (gosma) dos abatidos vão pro POOL da horda (`registerHordeKill`), não caem no chão.
- **IA dos Raiders — 3 alvos por prioridade**: (1) o JOGADOR, se estiver a menos de 7 células (e, sem plantação viva no mapa, caça o jogador onde estiver); (2) as CERCAS da lavoura — `FarmFences` dá vida (3 golpes) às mesmas imagens que `buildFarmlandFence` desenha e o grid já bloqueia; caem e liberam a célula; (3) as PLANTAÇÕES — o objetivo de fundo: a plantação viva mais próxima (`Farmland.destroyCrop`: a planta morre, a semente dormente some). A rota vem de um A* PONDERADO (`systems/hordePathfinding.ts`): cerca é passagem com custo (7 passos), então o inimigo só quebra a cerca quando dar a volta pelo portão sai mais caro — aí ela vira o alvo imediato até cair. Reavalia a cada ~0,7 s. O ataque é o do Slime (aviso → golpe → recuperação; levar dano no aviso interrompe) e avisa `PLAYER_ATTACKED_EVENT` (o pet revida).
- **Fim do evento**: vitória quando o último inimigo cai OU amanhece (06:00) com o jogador vivo → `finishHordeVictory`: drops do pool + BÔNUS (moedas 150n, madeira 40+15n, pedra 25+10n e Ferro 4+2n, n = número da horda; `hordeReward`), as cercas só machucadas se recuperam (`FarmFences.healDamaged`) e as DESTRUÍDAS continuam quebradas até o Martelo (o aviso de vitória diz quantas faltam), e salva. Se o jogador MORRE (`playerDeath`): `finishHordeDefeat` encerra sem bônus e entrega só o pool; a `MainScene.init` roda `startNextDay` (o dia avança) e o aviso ao acordar lista o que ele guardou. A penalidade de moedas do desmaio continua.
- **Dormir bloqueado**: durante a horda e, no dia dela, até ela acontecer (`getSleepBlockReason`) — senão bastava um cochilo pra passar o dia sem a noite de ataque. O relógio só corre na Fazenda, então sair pra casa/áreas congela a horda.
- **Ferro** (`data/resources.ts` `IRON`, ícone de `Bars and ores.png`): recurso novo (não havia ferro coletável); vende na Caixa de Remessas. A Fazenda passou a carregar o spritesheet do Slime (`MainScene.preload`) porque os Raiders usam a mesma arte.

## Efeitos visuais: poeira na grama e borboletas

- **Poeira nos pés** (`systems/grassDust.ts`, `attachGrassDust`): enquanto o jogador ANDA sobre uma célula de "Grama", a cada 130 ms sai uma nuvenzinha atrás dele — a mancha de `Tileset/Shadow.png` (a mesma da sombra e da poeira da enxada) em tingimento SÓLIDO (`TintModes.FILL`, a mancha-base é escura e multiplicar preto não muda a cor), que cresce, sobe, vai pra trás e some. Parado, na terra, na ponte ou na lavoura arada não sai nada. "Grama" = o GID autorado da célula é um dos dois tons da grama plana (`GRASS_TILE_IDS`, mesma regra dos detalhes de grama; `isGrassGround`); sem `ground` autorado o chão é gerado como grama. Cada cena acrescenta as próprias exceções: a Fazenda exclui a ponte e a lavoura já arada/plantada (`Farmland.getPlot`), as áreas externas excluem a ponte de volta. Ligado na Fazenda e em todas as `ExternalMapScene`; a Caverna e a Pedreira não têm `ground` autorado (o chão é a grama procedural com tingimento), então contam como grama, como já contam para o som de passos.
- **Borboletas** (`systems/butterflies.ts`, `ButterflyField`; sprites em `data/effects.ts` `BUTTERFLY_*`, 5 espécies de `Animals/Forest/Bugs/Butterfly/`, 7 frames de bater de asas): só na Fazenda e SÓ DE DIA (`GameClock.isDaytime()` = sem véu noturno, das 07:00 às 17:00). A cada 1,5–4,5 s, com no máximo 6 no ar, uma nasce numa posição aleatória de grama dentro da tela (ou logo além dela): UM Tween de opacidade (alpha 0 → 1, `hold`, `yoyo` de volta a 0) faz aparecer, ficar e sumir; enquanto isso ela deriva devagar com uma oscilação. Ao anoitecer ninguém novo nasce e as que estão no ar somem com um fade. Sem colisão nem interação. O campo é atualizado pelo `update` da `MainScene` (junto do relógio, então congela com a pausa); os sprites morrem com a cena.

## Martelo, cercas destruídas, aspersor animado e ajustes

- **Cerca destruída** (`systems/farmFences.ts`): a última pancada da horda troca o quadro da cerca pelo `FENCE_BROKEN_INDEX` (2º quadro de `White Fence.png`, dois cepos quebrados), libera a célula no grid (o inimigo e o jogador passam) e a registra em `gameState.destroyedFences` — vai pro save (`destroyedFences`, opcional: save antigo = nenhuma) e a cena nova as recria já quebradas. NÃO se conserta sozinha. O fim da horda só cura as cercas machucadas.
- **Martelo** (`data/tools.ts` `HAMMER`, `HAMMER_PRICE` = 80): ferramenta comprada DIRETO na aba Ferramentas da Loja (desconta moedas, compra única — depois vira "Já possui"; `MainScene.buyHammer`). Com ele na mão, clicar na cerca quebrada leva o jogador até uma célula VIZINHA e ele bate de lá (mesma animação de golpe da Picareta): `FarmFences.repair` devolve o quadro inteiro, a vida e bloqueia a célula de novo. O clique "de fora" em célula andável vem do flag `Interactable.interactFromAdjacent` (`PlayerController.handlePointerDown` reaproveita o caminho do clique em célula sólida). O ícone é PROVISÓRIO: o pacote não tem martelo, então usa a Pá de madeira (`Shovel.png`) — trocar é só o `texturePath`.
- **Sem muda em cima de cerca**: `TreePlantingSystem` (e o posicionamento de construções) recusam qualquer célula em que `FarmFences.hasFenceAt` seja verdadeiro — de pé OU destruída (destruída fica andável, então só `isWalkable` não bastaria).
- **Picareta desfaz o arado**: canteiro `tilled` vazio + Picareta (qualquer tier) → `Farmland.untill` (volta a `untilled`, seco), com a poeira/som da enxada; canteiro com semente/planta não muda.
- **Aspersor animado** (`Objects/Props/Sprinkler.webp`, 4x6 quadros de 236x218): parado no quadro 0 o dia todo; a animação (jorrando e "fechando") toca UMA vez por dia, na manhã (`MORNING_ANIMATION_HOURS` 06:00–12:00, `animatesEachMorning`), disparada pela `MainScene` (`playSprinklerMorning` → `DecorationPlacementSystem.playMorningAnimations`; o dia já tocado fica em `gameState.sprinklerAnimDay`, então trocar de cena não repete). O ícone (Loja/Bolsa) é um recorte justo do corpo (`frameName`); os quadros de animação têm todos o mesmo tamanho, com `animationOriginY` alinhando o pé do cano à base do tile. O `Sprinkler.png` antigo foi removido.
- **Pet que não voltava da casa**: a `MainScene` é reaproveitada pelo Phaser a cada `scene.start` e seus campos sobrevivem — o `petCompanion` da vez anterior (já destruído) barrava a criação de outro. `create` agora o zera antes de recriar.
- **Moedas iniciais**: 70 (`STARTING_COINS`); saves existentes mantêm as suas.

## Tutorial de novos jogadores

- **Gerenciador** (`systems/tutorial.ts`, dados em `data/tutorial.ts`, painel em `ui/tutorialPanel.ts`): lógica pura (sem Phaser). Os passos são só dados (`TUTORIAL_STEPS`: título, texto e um `goal`); adicionar/reordenar um passo é mexer só ali. Tipos de objetivo: `info` (texto + botão "Começar"/"Concluir"), `move` (N passos), `select` (pegar um item na Hotbar) e `act` (arar/plantar/regar com o item certo na mão). Passos atuais: boas-vindas → andar 6 passos → Enxada → arar → sementes → plantar → Regador → regar → fim.
- **Avanço**: o jogo AVISA o gerenciador (`tutorial.notify`) quando a ação de fato aconteceu — `player-stepped` na `MainScene` (andar), `UIScene.requestHotbarSelect` (selecionar) e o resultado de `till`/`plant`/`water` em `PlotInteractable`. Um passo de "selecionar" cujo item já está na mão vale por cumprido (nunca trava). O andamento (`gameState.tutorialStep/Progress`) só vive na sessão.
- **Bloqueio de comandos** (`tutorial.allows(cmd)`, perguntado por quem recebe o comando): nos passos `info` NADA funciona (o painel escurece a tela e o botão é a única saída); em `move`/`select`/`act` só o movimento fica livre; `select` e `act` aceitam na Hotbar só o item exigido; `act` libera clique só em canteiros; ataque (Espaço), comer (F), Inventário (E) e posicionar (B) ficam travados o tempo todo. `PlayerController` (teclado, clique, ataque, comer), `UIScene` (Hotbar: teclas 1-8, scroll e clique) e `MainScene` (E/B) consultam o gerenciador; Esc (Pausa) continua livre. O painel tem sempre o botão "Pular tutorial" (`tutorial.skip()`): encerra em qualquer passo e conta como concluído — grava no save igual ao fim normal. Sem tutorial rodando `allows` é sempre `true`, então o resto do jogo não muda.
- **Save**: ao terminar o último passo grava `gameState.tutorialCompleted = true` e salva na hora (`tutorialCompleted` em `SaveData`). Partida nova começa `false` (`startNewGame`, e o slot 7 vazio da Hotbar fica selecionado pra o passo da Enxada não nascer cumprido); save ANTIGO (sem o campo) carrega `true` — quem já jogava não vê o tutorial; o padrão de `gameState` também é `true` (fluxo de desenvolvimento que abre a Fazenda sem o menu). Concluído, nunca mais aparece. Sair no meio recomeça do primeiro passo.

## Câmera do jogador (zoom) e câmera de interface

- **Zoom** (`systems/cameraSetup.ts` → `WORLD_CAMERA_ZOOM` = 1,25): a câmera que segue o jogador (Fazenda e as 4 áreas; a Casa tem o próprio zoom fixo) enquadra 32x18 tiles em vez de 40x22,5 — personagem e lavoura maiores sem apertar o campo de visão. Ajustar é mudar essa constante. O zoom é aplicado ANTES dos limites da câmera (o tamanho visível do mundo depende dele).
- **Câmera de interface** (`systems/uiCamera.ts`, instalada por `setupWorldCamera`): Loja, Pausa, Caixa de Remessas, aviso "DIA n", contador da horda e títulos das áreas são desenhados na própria cena do mapa com `scrollFactor` 0 — a câmera principal os ampliaria (o aviso do topo saía da tela, todo texto ficava mole). Uma segunda câmera (zoom 1, mesmo tamanho da janela) desenha só esses objetos; a principal, só o mundo. A classificação é automática: a cada frame, todo objeto novo da cena vai pra uma das câmeras conforme o `scrollFactor` (máscara `cameraFilter`), então nenhum sistema precisa saber dela; o clique acerta porque cada câmera só considera o que desenha. Exceção: o véu da noite (`KEEP_ON_WORLD_CAMERA`) fica no mundo — o zoom o alarga e ele continua cobrindo a tela.

## Geografia do mundo (pontes entre cenas)

- **Mapa**: a Fazenda tem 4 pontes de transição (`farmMap.bridges`, dado puro): **Cavernas** ao norte (10,0), **Praia** ao sul (30,29) e, na parede **oeste**, a **Pedreira** em (0,10) com a **Floresta** logo ABAIXO dela, em (0,20) — a Floresta ficava na parede leste (39,20) e foi movida. A parede leste não tem mais ponte.
- **Continuidade espacial**: a ponte de volta de cada área fica no lado OPOSTO ao da Fazenda (`ExternalMapConfig.returnDirection`): Cavernas ↔ sul, Praia ↔ norte, Pedreira ↔ leste e agora Floresta ↔ **leste** (`FOREST_RETURN_DIRECTION`; a ponte de volta é a célula central da parede leste, (25,10)). Os pontos de nascimento saem sozinhos da geometria: ao voltar à Fazenda o jogador nasce logo dentro da parede, ao lado da ponte (`BridgeSystem.computeReturnSpawn` → (1,20)); ao chegar na Floresta, uma célula à frente da ponte de volta ((24,10), `computeSpawnInFrontOf`).
- **Zona de chegada livre** (`computeArrivalClearance`): a passarela da ponte de volta (entre os corrimões, sem saída lateral) mais um bloco de 3 de largura depois dela ficam SEMPRE sem árvore/pedra — uma só na frente fecharia a saída e prenderia o jogador. O pinheiro (22,10) foi tirado de `forestMap.ts`; e, como saves antigos guardam os nós do mapa anterior, `ForestScene.buildMapContent` limpa essa zona do registro a cada entrada, e o respawn diário (`advanceForestDay`) também a exclui.
- **Save**: o desbloqueio das pontes é guardado pela chave "col,row"; ao carregar, a chave antiga da Floresta ("39,20") é migrada pra "0,20" — quem já pagou a ponte não paga de novo.

## Vilarejo (trecho leste)

- **Mapa** (`data/maps/farmMap.ts`): o trecho de expansão LESTE (antes a "Madeireira", 12 colunas) virou o bioma `'village'` — colunas 40..69, linhas 0..29 (30 colunas). Nasce ABERTO (`ExpansionChunk.startsUnlocked`): sem parede do núcleo, sem placa de compra — `PropertyExpansionSystem` já libera a parede leste na criação (o mundo passa a ter a Fazenda 0..39 + o Vilarejo 40..69). Os outros três trechos (Mineração a oeste, Cavernas, Praia) seguem à venda como antes.
- **Limites da câmera**: `MainScene.create` calcula os limites pelo retângulo de TODOS os trechos (`farmMap.expansions`), então o Vilarejo entra sozinho: a câmera rola até a coluna 70 (px 2240) e para ali — sem faixa preta. O grid (`inBounds`) também cobre o trecho, com o perímetro externo bloqueado.
- **Layout e colisões** (`data/maps/villageMap.ts`, dados puros; desenho em `systems/villageBuilder.ts`): rua principal leste-oeste (linhas 14-15) ligada à abertura da parede, praça com chafariz animado (4 quadros), poço e banca; avenida norte-sul; 10 casas (`Objects/Exterior/Houses/2, 3, 7, 8`) em três fileiras, cada uma com a rua/viela da frente livre; 11 pinheiros decorativos e flores/cogumelos. As COLISÕES vêm da mesma fonte que o desenho: cada arte tem uma máscara (`solid`, `#` = célula sólida, medida pelo alfa: paredes bloqueiam, telhado não) e `villageBlockedCells()` soma paredes + troncos + poço ao grid estático (`systems/grid.ts`) — nunca há casa sem colisão. A profundidade de cada casa é a base das paredes (o jogador passa atrás do telhado, na frente da porta), e os pinheiros entram na transparência de sobreposição. As ruas de terra usam o mesmo blob de terra da Fazenda (`villageDirtZone`); rua/praça não soltam poeira nos pés.
- **Loja do Vilarejo** (`data/villageShop.ts`, `systems/villageShop.ts`): a casa de madeira com toldo (`VILLAGE_SHOP_HOUSE`, `house8`, na entrada da rua principal) virou loja. Fachada: o NPC Ferreiro (`Character/.../NPC'S/Blacksmith/Idle.png`, quadros 0-3 = de frente, em loop lento) na porta, atrás de um balcão e com uma vitrine na varanda (recortes de `Objects/Interior/Blacksmith.png`); profundidades logo acima da casa (NPC < vitrine < balcão; o jogador, na rua, fica na frente). **Gatilho**: as células do balcão/NPC (colunas 41-44, linhas 12-13 — todas sólidas, a parede da casa) têm um `ShopCounterInteractable`; como a vizinhança dessas células é toda sólida, `Interactable.approachCell` (novo, `systems/interaction.ts`; `PlayerController.handleBlockedClick` o usa antes de procurar a vizinha mais próxima) diz de onde atender: a rua em frente (linha 14). Clicar leva o jogador até lá, ele vira de frente e o painel abre (ou fecha, alternando). **Painel**: uma SEGUNDA instância do `ShopMenu` (o livro), com uma aba e o catálogo do Ferreiro; a Loja da Fazenda não muda. **Catálogo** (`VILLAGE_SHOP_GOODS`, `data/villageShop.ts`): armas e armaduras PRONTAS, compradas direto em moedas, sem Bancada nem receita, a ~1,5x o valor da receita/arma equivalente — Espada de Ferro 750, Espada de Ouro 1800, Armadura de Madeira 300, Armadura de Ferro 900 (a espada de madeira, inicial, não é vendida). **Compra** (`purchaseVillageShopItem`, `systems/villageShop.ts`): item único (`ownsVillageShopItem` — na Bolsa, inclusive se foi fabricado — vira "Já possui"), exige um slot livre na Bolsa (`Inventory.hasFreeSlot`, senão o item se perderia) e só então debita e entrega (`unlockTool`/`unlockArmor`); em qualquer recusa (sem moedas, Bolsa cheia, já possui) nada é cobrado. A Bancada e as receitas continuam como estão. `MainScene.closeShopMenus` fecha as duas nos mesmos pontos de antes (andar, E, B, Esc) e o saldo atualiza nas duas. Pra mudar o catálogo: editar `VILLAGE_SHOP_GOODS`.
- **Corrimões das pontes** (`PropertyExpansionSystem.unblockCoreWall`): abrir uma parede não devolve mais ao jogador as células dos corrimões das pontes daquela parede (ficavam andáveis ao comprar a expansão, dando pra contornar o túnel da ponte).

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

**Personagem "flutuando" durante a animação**: `Player` usa `origin(0.5, 1)`
— ancorado no canto inferior do *frame*, não nos pés de verdade do
personagem. Como a folha de 64x64 tem bem mais margem vazia abaixo do
personagem que `Idle.png` (referência), o personagem renderizava acima do
chão enquanto essa animação tocava. Medido pixel a pixel: pés a y=41 de um
frame de 64px (22px de margem) contra y=25 de um frame de 32px do
`Idle.png` (6px de margem) — 16px nativos de diferença, 32px já na escala
de exibição (`DISPLAY_SCALE = 2`). Corrigido com `ActionAnimSpec.yOffset`
(opcional, 0 por padrão): `Player.performAction` desloca o sprite pra baixo
nesse valor ao iniciar a animação e desfaz ao terminar
(`ANIMATION_COMPLETE`), então só essa ação "cai" um pouco mais fundo,
compensando a margem extra — as outras animações (`yOffset` ausente,
equivalente a 0) continuam com o comportamento de sempre.

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

## Efeito de quebra, SFX e revisão geral de estado

### Efeito de quebra (`systems/breakEffect.ts`)

`playBreakEffect(scene, image, shadow?)` é usado quando a picareta destrói um móvel (`furniturePlacement.ts`) ou o aspersor/bancada
(`decorationPlacement.ts`, via `removeAt(..., breakEffect = true)`). O sprite treme e pisca (tint FILL), depois é fatiado em 3×3
pedaços (`setCrop` sobre o mesmo frame) que voam com tweens, além de 3 nuvens de poeira. A remoção lógica (grid, estoque) acontece
antes; o efeito é só visual e destrói a imagem ao estourar.

### Efeitos sonoros (`data/audio.ts`, `assets/Sounds/Effects/`, `docs/sfx/`)

24 SFX novos gerados com o motor do sfxr.me (jsfxr) por `docs/sfx/generate.cjs`; os parâmetros ficam em
`docs/sfx/sfxr-definitions.json` — para ajustar um som, edite a definição e rode o script de novo. Cobrem golpes de machado/picareta,
quebra de madeira/pedra/metal, espada, plantar, colher, limpar planta morta, regar/encher regador, porta, dormir, baú, craft,
venda, desbloqueio (ponte/expansão), alerta/vitória da horda, martelo (cerca) e inimigo derrotado. Ficam em `ALL_SOUND_EFFECTS`
(carregados no preload) e são tocados por `playEffect`/`playRandomEffect`.

**Sons sem uso retirados do projeto:** os gerados `Machado madeira 1/2`, `Picareta pedra 1/2` e `Minerio quebrando` (substituídos pelos
sons novos `Bater em arvore N` / `Picareta`, ou nunca ligados a nada) e os pacotes de música que não tocam (`400 Sounds Pack`,
`Cozy Tunes`, `Polyshade's Chiptunes` e os `.zip`). Foram movidos para `../Mini Fazenda - sons removidos/`, fora do repositório.
`docs/sfx/generate.cjs` ainda tem as definições desses sons, caso queira gerá-los de novo.

### Ajustes visuais

- Título do menu principal subiu `TITLE_LIFT_PX = 28` (`MainMenuScene.ts`).
- Poeira de grama nasce `DUST_ORIGIN_LIFT_PX = 8` acima do pé (`grassDust.ts`).
- Sombra do Slime/inimigos sobe `SHADOW_OFFSET_Y = 26` (`Enemy.ts`).

### Correções da revisão geral

- **Vazamento de ouvintes** (`systems/sceneEvents.ts`): o Phaser reaproveita a instância da cena e não limpa `scene.events.on` do
  jogo; todo ouvinte de `player-stepped` passa por `onPlayerStepped`, que se remove no SHUTDOWN.
- **Decoração sobre muda/árvore**: `DecorationPlacementSystem.canPlaceAt` recusa células com nó em `resourceNodeRegistry`.
- **Semente/água só gastam se a ação ocorreu**: `farmlandInteraction.ts` planta/rega primeiro e só então consome.
- **Estoque órfão** (`Inventory.slotOrphanedStock`): item que chegou com bolsa cheia ganha slot quando um é liberado e ao carregar
  o save. Também: índice de hotbar não inteiro ignorado; `spendCoins` recusa valor negativo/NaN.
- **Dano de árvores/pedras persiste** (`ResourceNode.hits`, `getNode`/`setHits`): sobrevive à troca de cena, virada de dia e save.
- **Fail-safe de ação** (`Player.performAction`): `ACTION_FAILSAFE_MS = 4000` encerra a ação se a animação nunca completar, evitando
  jogador travado em `busy`.
- **Carregamento atômico** (`SaveManager.load`): o estado é reconstruído em variáveis locais e só então trocado em `gameState`; um
  save corrompido devolve `false` sem alterar nada.
- Sprites de árvore já destruídos saem da lista de transparência por sobreposição (`farmResources.getTreeSprites`).

## Vilarejo, moradores, tempo global e campanha

### Água da Floresta (`data/tiles.ts` `WATER_STYLES`, `systems/waterAutotile.ts`)

O autotile animado da água agora tem **estilos** (`WATER_STYLES`): cada um é uma folha 24x16 com o mesmo desenho de 16 tiles em 4 fases, mudando só a
coluna onde o bloco começa e o tile de água lisa. `beach` (padrão) = `Beach animations tiles.png`; `waterGround` = `Water Ground animations tiles.png`
(bloco azul com margem de terra nas colunas 12-15, miolo liso em (21, 2) — achados por varredura de pixels). `ExternalMapConfig.waterStyle` escolhe o
estilo da cena; a Floresta usa `'waterGround'`. A colisão não mudou (continua vindo de `waterCellsFromGround`). O editor de mapas ainda mostra o
tileset antigo no preview da Floresta (só a renderização em jogo troca).

### Tempo global (`systems/worldTime.ts`, `systems/dayCycle.ts`)

O relógio agora anda em **toda** cena: `advanceWorldTime(delta, onFarm)` é chamado no `update` da Fazenda, dos mapas externos (`ExternalMapScene`) e da
Casa. Na meia-noite roda `runDayTurn()` (lavoura cresce, clima, aspersores, árvores/pedras renascem — o mesmo que dormir), independente da cena aberta.
Cada cena tem o véu de noite (`DayNightOverlay`; dentro de casa com `INDOOR_NIGHT_INTENSITY`) e a faixa "DIA n". Regras da horda: ela só é conduzida pela
Fazenda; se amanhece com o jogador fora, termina **sem bônus** (senão bastava ficar longe), e os mapas externos avisam quando ela chega.

### Vilarejo como cena (`scenes/VillageScene.ts`, `data/maps/villageMap.ts`)

O Vilarejo deixou de ser um trecho colado à Fazenda: é uma cena 30x30 alcançada pela **ponte leste** (`farmMap.bridges`, sem requisito — ponte sem
moedas/itens já nasce aberta, `BridgeSystem.isFree`); a de volta fica na parede oeste. Layout/colisões vêm de `villageMap.ts` (coordenadas locais, cada casa
com `door`); a loja do Ferreiro é `systems/villageShop.ts` (`createVillageShop`). A Fazenda desenha a própria cerca leste (`buildFenceSide`).

### Moradores e rotina (`data/npcs.ts`, `entities/Npc.ts`, `systems/npcSystem.ts`)

Três moradores (Bruno/Ferreiro, Alberto/Banqueiro, Capitão Salgado), cada um com casa, porta e **rotina** por hora (`schedule`: casa → trabalho/praça →
casa). `resolvePlace` escolhe o lugar pelo relógio e pelo clima (na chuva ficam em casa, exceto o Ferreiro no balcão). `Npc` anda por A* célula a célula,
sai/entra pela porta com fade e para no lugar; ao abrir a cena cada um já nasce onde deveria estar. A loja só atende com o Ferreiro atrás do balcão
(`post`). Clicar num morador leva o jogador até ele e abre a conversa (`ui/dialoguePanel.ts`, na `UIScene`, via `OPEN_DIALOGUE_EVENT`).
As folhas dos NPCs têm um bloco de quadros por direção (`DIRECTION_INDEX` em `Npc.ts`).

### Campanha e FIM (`data/campaign.ts`, `systems/campaign.ts`, `scenes/EndingScene.ts`)

12 missões em 4 atos (Raízes, Fronteiras, Preparativos, A Noite Final), dadas pelos moradores (entregar colheita/recursos, pagar, ter arma/armadura, abrir
pontes, vencer hordas). Estado em `gameState.campaign` (vai pro save; saves antigos começam do zero contando as hordas já vencidas). O marcador de
objetivo fica no canto do HUD (`ui/questTracker.ts`). A missão final é a **Noite Final**: ao dizer "Estou pronto" ao Alberto o dia é marcado
(`campaign.finalNightDay`), `horde.ts` o trata como dia de horda (horda nº 4: 14 inimigos) e dormir fica bloqueado. Vencê-la chama `completeCampaign()`
e abre a `EndingScene` (epílogo + resumo; "Continuar jogando" volta à Fazenda no modo livre). Perder a noite (desmaio, ou dia virar com o jogador longe)
desmarca a data. As hordas comuns (a cada 10 dias) continuam e contam pra missão "Sobreviver à primeira noite".

## Fazenda maior, mapas maiores, Praia com vida e Pedidos

### Fazenda 56x42 e câmera só no liberado (`data/maps/farmMap.ts`, `scenes/MainScene.ts`, `systems/cameraSetup.ts`)

O núcleo da Fazenda cresceu de 40x30 para 56x42 (terreno novo à direita e embaixo; as coordenadas de casa, lavoura e cercas não mudaram). Os trechos de
expansão acompanham a nova largura/altura, e as pontes leste (Vilarejo) e sul (Praia) foram para as novas paredes. A câmera passou a mostrar só o núcleo
mais os trechos **já comprados** (`MainScene.computeFarmCameraBounds`): o que está atrás de uma parede trancada fica fora dela, como no lado leste;
comprar um trecho amplia os limites na hora (`applyWorldCameraBounds`). As compras de expansão agora vão pro save (`gameState.unlockedExpansions`) — antes
o trecho voltava trancado ao trocar de cena. Saves antigos: a ponte da Praia migra de `30,29` para `30,41`.

### Floresta, Pedreira e Praia maiores; sem tint na Praia/Caverna

Floresta e Pedreira: 26x20 → 40x30, crescendo à direita/embaixo (as árvores/pedras já salvas continuam nos mesmos lugares; o terreno novo tem mais árvores,
pedras e enfeites, e os tetos de recursos subiram). A Praia: 26x20 → 40x32 (mais areia ao redor, mais mar). O filtro (`BIOME_TINTS`) que escurecia o chão da
Praia e da Caverna foi removido — só a Mineração ainda usa tint.

### Praia (`data/maps/beachDecor.ts`, `systems/beachBuilder.ts`, `scenes/BeachScene.ts`)

Casinha do pescador (só a fachada, com porta), feirinha (barracas de peixe e frutas), coqueiros com rede, moai, canoa, guarda-sóis com mesinha, cadeiras,
toalhas e tapetes. As peças e as colisões vêm da MESMA lista (`BEACH_PLACEMENTS` → `beachBlockedCells`). A sereia **Marina** (`data/npcs.ts`, morador
`stationary`: não anda, só aparece de dia e some à noite) fica no mar junto da areia; clicar nela leva o jogador até lá e abre a conversa.

### Pedidos: missões secundárias (`data/requests.ts`, `systems/requests.ts`)

Cada morador (Bruno, Alberto, Capitão Salgado e Marina) tem 4 pedidos que apresenta em ciclo, **um por dia**: entregar colheita/recursos ou pagar moedas, com
recompensa em moedas e materiais. A escolha "Pedido do dia" aparece em toda conversa; cumprido, o próximo só vem no dia seguinte. Estado em
`gameState.requests` (vai pro save); a tela final mostra quantos foram atendidos. Usa as mesmas regras de entrega da campanha (`evaluateRequirement`,
`consumeRequirements`, `grantReward` em `systems/campaign.ts`).

### Colheita de 1 a 4 (`data/crops.ts` `rollHarvestAmount`)

Cada plantação pronta rende de 1 a 4 unidades (pesos 50/30/15/5 %, média ≈ 1,75), respeitando o mínimo da cultura. A descrição da semente na Loja foi atualizada.

### Sons de porta

`DOOR_SOUND` agora é `door_open.wav` (a pasta "400 Sounds Pack"): toda vez que se passa por uma porta — entrar/sair da casa e os moradores do Vilarejo quando
entram/saem de casa perto do jogador (até 10 células). `DOOR_KNOCK_SOUND` (`door_knock.wav`) toca quando batem na porta: na manhã em que a caixa do pet chega.

## Ajustes: arado, poeira, sons, horda × casa, caminha do pet

- **Terra arada sem "furos"** (`data/tiles.ts` `SOIL_TILESET_PATH`): o 9-slice original de `Tilled Soil and wet soil.png` traz um quarto de pontinho escuro em cada canto
  de tile; numa área arada isso virava uma grade de furos. Usa-se uma cópia (`... (sem pontos).png`) com esses pixels trocados pela cor do miolo; o original continua na pasta.
- **Poeira nos pés só na TERRA** (`systems/grassDust.ts`, `attachFootDust`/`isDirtGround`): sai no caminho de terra (GID autorado que não é grama/água/areia), nos canteiros
  arados e nas ruas do Vilarejo; nunca na grama nem na ponte. As borboletas continuam nascendo só na grama.
- **Sons novos** (`data/audio.ts`): 3 batidas de árvore (`AXE_HIT_SOUNDS`, também na cerca), picareta (`ROCK_HIT_SOUNDS`), miados (3) e latidos (2) em volume baixo
  (`PET_CAT_SOUNDS`/`PET_DOG_SOUNDS`: no carinho, ao morder e de vez em quando sozinhos, `Pet.maybeSpeakOnItsOwn`) e a ponte destravada usa o som das compras (`SPEND_MONEY_SOUND`).
- **Horda × casa**: com a horda em andamento (ou prestes a começar) a porta não abre ("A horda chegou!") e quem está em casa é posto pra fora (`HouseScene.update`).
- **Hotbar**: item novo num slot que já tinha ícone (ex.: aspersor no lugar de uma ferramenta de 16px) herdava a escala do anterior — agora a escala é refeita (`HotbarSlotView.visualKey`).
- **Criação de personagem**: sem o nome do personagem; "Cachorro Caramelo" virou "Cachorro Cinza".
- **Caminha do bichinho** (`PET_BED` em `data/decorations.ts`, `grantPetBed` em `systems/petEvent.ts`): móvel de 2 blocos (almofada de `Interior/cats furniture.png`), dado UMA vez ao
  liberar o pet (quem já tinha o pet recebe ao abrir a Fazenda; `petBedGiven` vai pro save), fora da Loja (`notForSale`). Vai pra Bolsa; posiciona-se dentro de casa como os outros móveis.

## Limpeza de sons sem uso e véu da noite "furado"

- **Sons sem uso retirados do projeto**: os antigos `Machado madeira 1/2`, `Picareta pedra 1/2`, `Minerio quebrando`, `Picareta.mp3` (pickaxe genérico), e os sons de
  impacto gerados por sfxr que os novos arquivos reais substituíram (`Arvore caindo.wav`, `Pedra quebrando.wav`) foram movidos pra `../Mini Fazenda - sons removidos/`
  (fora do repositório, não apagados). Os pacotes de música que não tocam (`400 Sounds Pack`, `Cozy Tunes`, `Polyshade's Chiptunes` e os `.zip`) também saíram de lá.
- **Sons de impacto trocados por gravações reais** (`data/audio.ts`): `AXE_HIT_SOUNDS`/`TREE_FALL_SOUND` (`Impacto madeira 1/2`, `Arvore caindo.mp3`) e
  `ROCK_HIT_SOUNDS`/`ROCK_BREAK_SOUND` (`Impacto da pedra 1/2`, `Pedra quebrada.mp3`), no lugar dos sons gerados por sfxr.
- **Canto do galo** (`ROOSTER_SOUND`/`ROOSTER_HOURS` em `data/audio.ts`, `MainScene.playRoosterMorning`): toca uma vez por dia, bem baixinho, entre 06:00 e 06:30 —
  mesmo esquema do `playSprinklerMorning` (`gameState.roosterSoundDay`, não vai pro save).
- **Logo do Menu Principal mais alto** (`MainMenuScene.ts` `TITLE_LIFT_PX`, 28 → 90, pedido explícito do usuário).
- **Véu da noite (`systems/dayNightOverlay.ts`) "furado" na metade de baixo do mapa**: a profundidade fixa do retângulo (999) ficava ABAIXO de qualquer objeto do
  mundo com Y > 999px — árvore, jogador, decoração etc. usam a própria posição Y como profundidade (`setDepth(sprite.y)`), e a própria Fazenda já passa de 999px
  de altura (núcleo ~1344px). Agora fica um a mais que `POP_TEXT_DEPTH` (`systems/floatingText.ts`, exportada pra isso — já era "acima de qualquer objeto do
  mundo" pros textos flutuantes), então nada do mundo consegue ficar por cima dele. Também ganhou uma recriação defensiva (destrói e refaz o retângulo se a
  câmera rolou mais de 400px desde a última vez): um teste isolado mostrou que o MESMO retângulo, com posição/tamanho/profundidade corretos, podia parar de
  ser desenhado depois de um salto grande e instantâneo da câmera (não acontece com o jogo real, que só rola aos poucos) — a recriação é uma rede de segurança
  barata pra esse caso, sem custo perceptível.

## Pedra "rock-boulder-2" dividida em duas

O retângulo de `ROCK_FRAME_2` (`data/tiles.ts`, folha `deep forest stones.png`) na verdade continha DUAS pedras desenhadas uma
embaixo da outra — uma lisa, outra com musgo — pedido explícito do usuário, que mandou um print apontando isso. Separadas
varrendo linha a linha (y=16-17 é o único par 100% transparente no meio do retângulo original de 29px de altura): `ROCK_FRAME_2`
agora é só a metade de cima (lisa, 22x13) e a nova `ROCK_FRAME_3` é a metade de baixo (com musgo, 22x14). `buildRock`
(`systems/externalMapBuilder.ts`) passou a sortear entre 3 variações (`0 | 1 | 2`) em vez de 2 — os 4 lugares que chamam (Fazenda,
Floresta, Pedreira, Praia) foram ajustados. O ícone de "Pedra" (`data/resources.ts` `STONE`) passou a usar `ROCK_FRAME_2` (a
lisa, pedido explícito) — antes usava `ROCK_FRAME_1` (a pedra marrom, outra variação, sem relação com o print).

## Tecla F, desfoque de UI, regador vazio, ícone da armadura, caminha do pet

- **Tecla F interage com Loja/Caixa de Remessas/Porta** (`systems/interaction.ts` `Interactable.keyInteractable`,
  `PlayerController.handleInteractKey`): F já era "comer a colheita" (`handleEatKey`, renomeado) — agora primeiro testa a célula
  que o personagem está ENCARANDO (`Player.getFacingVector`) por uma interação marcada `keyInteractable` (só
  `ShopInteractable`/`ShippingBinInteractable`/`EnterHouseInteractable`, pedido explícito); sem nada lá, cai no comportamento
  antigo (comer). O clique continua funcionando igual, sem mudança nenhuma nele.
- **Desfoque leve do mundo com qualquer janela de UI aberta** (`systems/worldBlur.ts` `WorldBlur`, pedido explícito): usa o
  filtro `Blur` nativo do Phaser 4 (`camera.filters.internal`), só na câmera do MUNDO — a HUD/painéis ficam numa câmera à parte
  (`systems/uiCamera.ts`) que o filtro nunca toca. Ligado em `MainScene`/`ExternalMapScene`/`HouseScene`, sempre que Loja,
  Inventário, Bancada, Caixa de Remessas, Baú ou Pausa/Configurações estiverem abertos — a Loja não tinha nem trava de clique
  antes (bug corrigido junto: dava pra andar/interagir com o cenário por trás dela).
- **"Regador Vazio" flutuante em cima da Hotbar** (`systems/farmlandInteraction.ts` `handleWater`, `ui/hotbar.ts`
  `hotbarTopCenter`, `systems/floatingText.ts` `PopTextOptions.screenFixed`): antes só um `console.log`. Reaproveita o mesmo
  `popText` dos "+1 Madeira" etc., com uma opção nova (`screenFixed`, `scrollFactor(0)`) pra ancorar na tela em vez de seguir o
  mundo — `hotbarTopCenter` expõe a mesma conta de posição que a própria `Hotbar` usa, sem duplicar os números.
- **Ícone da armadura equipada menor** (`ui/inventoryScreen.ts` `EQUIPPED_ARMOR_ICON_TARGET_PX`, 75% do tamanho normal de ícone
  — pedido explícito).
- **Caminha do pet não recolhe mais com um clique comum** (`data/decorations.ts`, flag `noClickPickup` — depois generalizada a todos os móveis, ver a seção "Móveis: clique não recolhe…",
  `systems/furniturePlacement.ts` `PlacedFurnitureInteractable.interact`): bug corrigido — qualquer móvel voltava pro estoque
  num clique só, incluindo a caminha, que devia ficar. Continua saindo com a Picareta selecionada, como os demais móveis.
- **Pet dorme na caminha** (`entities/Pet.ts` estados `toBed`/`sleeping`, `data/pets.ts` `PET_TUNING.sleepChance/sleepMinMs/
  sleepMaxMs`, `scenes/HouseScene.ts` cálculo de `petBedCell`, `systems/petCompanion.ts`): a cada decisão de "calmo" (mesma hora
  do sorteio de vagar), se existe uma caminha nesta cena (só a `HouseScene` passa uma célula — as outras cenas nunca têm),
  chance de ir até a célula andável ao lado dela e dormir lá por um tempo sorteado, com a pose de descanso já existente
  (`sit-front`, sem arte nova) — de propósito não vira pro jogador enquanto dorme, pra não parecer só "sentado olhando".

## 3 tiers de Aspersor e respingo d'água novo

- **Aspersor de Madeira/Ferro/Ouro** (`data/decorations.ts` `SPRINKLER_WOOD`/`SPRINKLER_IRON`/`SPRINKLER_GOLD`, pedido
  explícito — arte nova do usuário): troca o único `SPRINKLER` (arte antiga `Sprinkler.webp`, animada, ainda no repo mas sem
  uso) por 3 decorações com `waterReach`: madeira = 4 terras em cruz, ferro = 8 (quadrado 3x3), ouro = 24 (quadrado 5x5) — `sprinklerReachCells` em `systems/sprinklers.ts`. Ícones
  estáticos recortados pixel a pixel de `Objects/Props/Sprinkler Tiers.png` (3 quadros lado a lado, sem grade uniforme — mesmo
  processo do Poço); `displayScaleMultiplier` = 16/25 (os 3 têm o mesmo recorte, 25x23) encolhe pro tamanho de 1 célula. Sem
  `animationFrames`: a arte nova não trouxe quadros de água jorrando — quem mostra a rega acontecendo agora é só o respingo
  sobre a terra. O de madeira manteve o id `'sprinkler'` (o único que já existia) pra não quebrar saves com um já posicionado.
  Preço do ferro (900) e ouro (4.000) são ponto de partida, fácil de ajustar ali mesmo.
- **Água do aspersor: sprite sobre cada terreno regado** (`systems/sprinklerWater.ts` `playSprinklerWater`, `data/effects.ts`
  `SPRINKLER_WATER_*`, `Objects/Props/Sprinkler Water.png`): 8 quadros de 32x32 vindos do usuário, 2 por lado (a ponta fina aponta
  sempre pro aspersor). Toda manhã (`DecorationPlacementSystem.playMorningAnimations`, o mesmo gancho do `playSprinklerMorning`)
  cada terreno arado com `wateredToday` dentro do alcance do aspersor (`sprinklerReachCells`) ganha o sprite por cima, alternando os 2 quadros por
  ~2,6s e sumindo; o par de quadros vem do lado em que o terreno fica (eixo dominante da distância, empate = horizontal) e
  começa um pouco depois quanto mais longe (efeito de onda). Só visual — quem rega é `systems/sprinklers.ts`. Os quadros
  vêm em cinza-chapado: `setTint` + `TintModes.FILL` com `SPRINKLER_WATER_TINT` (recolorir, não desenhar). As poças sobre a terra
  regada pelo aspersor saíram de `MainScene.playDayTurnSplashes` (só a chuva ainda "varre" respingos); o respingo azul original
  (`Sprash.png`) continua valendo pra regador na mão, chuva e Poço — uma troca global anterior foi desfeita.

## Gerenciador de eventos: o Visitante do Dia 8 e os gatos da Amanda

- **`systems/eventManager.ts`** (pedido explícito): cada evento (`WorldEventDefinition`) diz por `isActive()` se deve rodar AGORA (dia/hora de
  `gameState.gameClock` + estado salvo em `gameState.events.completed`, `data/events.ts`); o `EventManager` (um por `MainScene`, `update` todo
  frame fora da Pausa) liga o evento (`start` → `WorldEventRuntime`) quando passa a valer e o desliga quando deixa de valer, esperando o
  `isBusy()` dele. Lista em `systems/events/index.ts` (`WORLD_EVENTS`) — evento novo = uma definição a mais; `preload` de cada um só carrega a
  arte enquanto ainda há chance de rodar. Não há gancho na virada do dia: a condição é reavaliada, então serve a qualquer forma de o dia mudar.
- **Evento 1 — o Visitante do Dia 8** (`systems/events/visitorEvent.ts`): a partir das 06h do dia 8, o Capitão Salgado (arte de `data/npcs.ts`) nasce
  na ponte leste, anda por A* (`Npc.stepToward`, novo — a rotina do Vilarejo não é usada) até `VISITOR_STAND_CELL` (à direita da saída da porta,
  pra chegar sem cruzar a célula onde o jogador nasce) e para: célula bloqueada, `Interactable` com `keyInteractable` (clique ou F) e um balão
  "!" (`UI/speech bubble, emojis, reaction.png`, quadro 16x16) balançando em cima. Interagir abre a fala em 3 páginas; ao fechar na última
  (`onFinish`) o evento é marcado como concluído, salva, e ele volta andando pela ponte e some (`Npc.leave`). ESC no meio só fecha (não
  conclui, dá pra falar de novo); o dia 8 passando sem falar com ele, ele some sem registrar.
- **Paginação no `DialoguePanel`** (`DialoguePayload.pages`/`onFinish`): setas `<` `>` (mesmo estilo dos botões da Criação de Personagem), contador
  "1/3", teclas ← → e Enter; botões (`actions`, "Fechar") e `details` só na última página. Falas de uma página só não mudam. A `MainScene` agora
  também trava movimento/clique e não abre a Pausa com o ESC enquanto há conversa (`isDialogueOpen`, `DIALOGUE_ESC_GRACE_MS`).
- **Evento 2 — Easter egg da Amanda** (`systems/events/amandaCatsEvent.ts`): `isAmandaWithCat` (nome "Amanda" — sem diferenciar maiúsculas/espaços — e pet
  gato). Ativo do momento em que o pet é liberado (`petUnlocked`) até o dia 10 (`AMANDA_RESOLVE_DAY`): além do companheiro de sempre (`PetCompanion`),
  6 gatos visitantes (mesma classe `Pet`, peles sorteadas dos gatos de `data/pets.ts`, `Pet` ganhou `spawnCell`; clicar neles também faz carinho).
  No dia 10 eles somem (`Pet.fadeOutAndDestroy`) e a carta `AMANDA_LETTER` (agendada com `scheduleMail` assim que o evento começa) chega na Caixa
  de Correio, explicando com humor que já tinham dono. Sem mudança para quem não é a Amanda; se o pet só chegar depois do dia 10 o evento nem começa.
  Os gatos extras só existem na Fazenda (nas outras cenas continua só o companheiro).

## Chuva molha a terra arada; pet dormindo na caminha (correções)

- **Chuva × arar/plantar** (`Farmland.till`/`plant` ganharam `raining`, `farmlandInteraction.ts` passa `gameState.weather.raining`; `waterAll`): em dia de
  chuva a terra recém-arada (e a semente recém-plantada) já nasce molhada — mesma regra do solo colhido (`harvest`). Na virada de um dia chuvoso a
  chuva também molha a terra arada VAZIA (antes só molhava `growing`), então arada e plantada ficam iguais.
- **Pet dormindo de verdade** (`entities/Pet.ts`, `data/pets.ts`, `scenes/HouseScene.ts`): três causas de ele quase nunca dormir. (1) A coleira do pet
  (seguir o jogador além de `leashTiles`) valia em qualquer estado e o tirava da caminha assim que o jogador andava pela casa — `toBed`/`sleeping`
  agora ficam de fora (só `teleportDistance` os traz). (2) O lado livre da caminha era calculado uma vez, ANTES dos outros móveis: um móvel ao lado dela
  deixava o pet sem destino pra sempre — agora `Pet` recebe um provedor das células da caminha (`petBedCells`, lido de `gameState.placedFurniture`) e
  escolhe o lado livre mais perto na hora de decidir (`beginGoingToBed`). (3) Poucas chances e sonos curtos: `PET_TUNING.sleepChance` 0,35 → 0,7,
  sono de 15-35 s. Além disso ele agora SOBE na caminha (pulinho até a célula dela, `onBed`, desenhado à frente) e desce ao lado ao acordar (fim do
  sono, carinho ou briga).
- **Animação de dormir do pet** (`getPetSleepAnim`, `PetAnimName` `'sleep'`): usa a linha de dormir da própria folha (pedido do usuário) em vez da pose
  sentada — gatos: linha 9 (enroladinho); cachorros: linha 8 (deitado com a cabeça nas patas; a folha deles é deslocada uma linha nesse ponto). 4
  quadros a 2 fps.

- **Pet centralizado na caminha e "Zzz"** (`Pet.sleepSpot`, `emitSleepZ`, pedido explícito): o pet se deita no CENTRO da caminha inteira (média das células
  dela, a caminha tem 2), `SLEEP_LIFT_PX` acima da base, com a profundidade logo à frente dela. Enquanto dorme, "z" de tamanhos crescentes sobem da
  cabeça a cada ~0,9 s. Não existe arte de Zzz nos assets (só rostos de emoji, corações, etc.), então é o mesmo texto flutuante do jogo (`popText`,
  como o "Regador Vazio"); se vier uma arte de "Zzz", é só trocar o `popText` por um sprite em `emitSleepZ`.

- **Descrição da Loja não vaza mais da caixinha** (`ui/shopMenu.ts` `fitDescription`, pedido explícito): as descrições dos 3 aspersores foram resumidas
  (~100 caracteres) e, como rede de segurança pra qualquer texto longo, a descrição parte da fonte normal (10px) e reduz 1px por vez até caber na altura
  livre entre o nome e o preço (`DETAIL_DESCRIPTION_MAX_HEIGHT`), com mínimo de 7px. Conferidos todos os itens: cabem, os mais longos (sementes/receitas) em 9px.

## Móveis: clique não recolhe, cadeira com as pernas inteiras e sentar

- **Clique comum não recolhe NENHUM móvel** (`systems/furniturePlacement.ts` `PlacedFurnitureInteractable.interact`, pedido explícito): o bug da caminha do pet
  (`noClickPickup`, flag removida) valia pra todos — agora só a Picareta (despedaça e devolve à Bolsa) tira um móvel; o Baú continua pelo "Recolher".
- **Cadeira com as pernas inteiras** (`CHAIR.frameRect`): o recorte tinha 15px de altura, mas a arte vai de y=13 a y=30 (18px) — as pernas ficavam cortadas.
  Conferidos os outros móveis (mesa, sofá, cômoda, caminha, baú): sem corte.
- **Sentar na Cadeira e no Sofá** (`DecorationDefinition.seat`, `Player.sitAt/standUp/isSitting`, pedido explícito): interagir (clique com o jogador ao
  lado, ou tecla F) senta o jogador na célula do móvel mais perto dele, virado pra frente, na pose da folha `Sitting` (a mesma da ação de comer). A célula
  lógica não muda (volta pra ela ao levantar); o clique (interceptador na `HouseScene`, que só levanta) ou uma tecla de andar (`tryStep`) o levantam.
  **Bug corrigido:** a 1ª versão fazia `isBusy()` responder "ocupado" quando sentado, e o `PlayerController` ignora clique/teclas de quem está ocupado — então
  ninguém levantava. `isSitting()` é separado de `isBusy()` (ações e passos checam `sitting` por conta própria). Posição: `DecorationDefinition.seat {x, y}` (px a
  partir do meio da base da célula do assento; cadeira `{0, -1}`, sofá `{-8, -1}`), com o ponto limitado às bordas do móvel (`SEAT_EDGE_MARGIN_PX`).

- **Baú também na Fazenda e Picareta quebra qualquer móvel** (pedido explícito): (1) `DecorationDefinition.outdoor` (só o Baú): o móvel `placement: 'house'` que também
  pode ser posicionado fora da casa — `DecorationPlacementSystem.canPlaceAt` e `MainScene.resolveSelectedDecoration` o aceitam (fora da lavoura, como Poço/Bancada).
  Lá o `PlacedDecorationInteractable` abre o `ChestMenu` (mesmo evento `OPEN_CHEST_MENU_EVENT`, que a `MainScene` agora respeita: trava movimento/clique, E e ESC).
  O estoque do baú da Fazenda tem id próprio (`farmChestId` = `"farm:col,row"`), pra não colidir com um baú da casa na mesma célula; o dos baús da casa segue
  `"col,row"` (saves antigos). Vai pro save junto de `placedDecorations`/`chests`. (2) Em ambos os lugares a Picareta agora vem ANTES da abertura do baú (antes o baú
  abria o menu e nunca quebrava) e quebra o baú — mas só VAZIO: cheio, mostra "Esvazie o baú antes" (os itens sumiriam); o "Recolher" do menu continua.

## Água do mar da Praia e Modo Editor da Vila

- **Mar da Praia sem faixas** (`systems/waterCells.ts` `groundWithWaterRect`, `scenes/BeachScene.ts`, pedido explícito): o mar tinha duas camadas — a água animada do chão
  autorado (autotile, ciano claro) e, POR CIMA, o retângulo antigo `oceanArea` desenhado como textura de água plana (`buildWaterArea`, azul escuro, só 4 linhas) —, daí as faixas.
  Agora o retângulo entra no próprio chão (`ground` com GID de água plana nas células dele) e o autotile desenha tudo; o `buildWaterArea` saiu da Praia. A colisão
  segue igual (`obstacleCells` + `waterCellsFromGround`). O lago da Floresta ainda usa `buildWaterArea`.
- **Editor da Vila** (`MapEditorScene` `mapType: 'village'`, F2 dentro da Vila, mesmo esquema dos outros: `MAP_TYPE_CONFIGS`, `seedVillage`, `exportVillage`, tecla P):
  - **Dados** em `data/maps/villageLayout.ts` (formato dos outros mapas: `cols/rows`, `ground`, `backgroundColor`, `blockedArea`, `props`, mais `structures`/`well`/`trees`);
    `data/maps/villageMap.ts` deixou de ter as posições e passou a derivar tudo de lá (`VILLAGE_STRUCTURES`, `VILLAGE_WELL`, `VILLAGE_TREES`, `VILLAGE_PROPS`, colisão
    com `blockedArea`); as artes e as máscaras de colisão (`VILLAGE_ASSETS`) continuam no `villageMap.ts` — o editor NÃO as reescreve.
  - **Paleta**: Casa Abandonada/Azul/de Pedra/de Madeira (Loja), Banca, Chafariz, Poço da Praça (único), Pinheiro + Mover, Bloco de Colisão e Borracha; abas Ground
    (tiles: Grama/Solo/Água/Praia), Entities e Decoração (props) como nas outras cenas. Estruturas desenhadas como no jogo (canto superior-esquerdo da arte na célula).
  - **`role` das casas de moradores** (`shop`/`banker`/`pirate`, `VillageStructureRole`): o Ferreiro, o Banqueiro e o Pirata moram nas casas com o `role` deles
    (`VILLAGE_SHOP_HOUSE`/`BANKER`/`PIRATE` agora procuram por `role`); mover a casa no editor leva o `role` junto (a loja, a porta e a rotina do morador seguem).
    Apagar uma delas avisa no console e o jogo usa a posição padrão (nunca fica sem casa).
  - **Chão**: o editor semeia com grama procedural + as ruas de terra (`villageDirtZone`); o que for pintado vira `ground` autorado e a `VillageScene` passa a usá-lo
    (sem `ground`, continua procedural + ruas). Cor de fundo: o editor agora parte da que o mapa já tem (`mapData.backgroundColor`), em todos os mapas — antes sempre
    exportava o cinza-padrão do editor por cima.
  - **Salvar**: tecla P baixa o `villageLayout.ts` completo; é só substituí-lo em `src/data/maps/`. Testado: a exportação sem mexer reproduz exatamente o layout
    atual, e um layout com chão autorado e a casa da loja movida carregou na cena (fachada, casa do Ferreiro e colisão seguiram).

## Card automático de compra das pontes

`systems/bridgeSystem.ts` (`offerPurchase`/`buy`/`handlePlayerStep`, pedido explícito — a placa da Praia fica na borda de baixo do mapa, por baixo da Hotbar, e era
difícil de clicar; antes clicar na placa já pagava na hora, sem confirmação): ao chegar a até `OFFER_RANGE_CELLS` (3) células de uma ponte ainda bloqueada, abre sozinho um card
(o mesmo `DialoguePanel`, por `OPEN_DIALOGUE_EVENT`) com o preço, quanto o jogador tem e os botões "Comprar (preço)" — apagado se faltar moeda ("Faltam N moedas") — e "Fechar".
Comprar paga (`tryPayRequirement`), libera a ponte e mostra "Ponte liberada". Oferece UMA vez por aproximação (`offered`): fechar o card não o reabre a cada passo — só depois de
se afastar (mais de 4 células) e voltar. Clicar na placa continua funcionando e abre o mesmo card. A Fazenda trava movimento/clique/ESC durante a conversa (já feito pro visitante do dia 8).

## Caixa de Correio e grid de alcance do aspersor

- **Caixa de Correio** (`data/mail.ts`, `systems/mail.ts`, `systems/mailbox.ts`, pedido explícito): objeto sólido fixo na Fazenda
  (`MAILBOX_CELL`, à esquerda da casa), com a arte que já existia (uma das 4 caixas de correio em poste de `Objects/Exterior/Exterior.png`,
  recorte pixel a pixel — nenhuma arte nova). Segue o molde da caixa do pet (`petBox.ts`): bloqueia a célula, o jogador interage ao lado
  (clique ou tecla F — `keyInteractable`).
  - **Cartas agendadas** (`MailMessage.deliverOnDay`): uma carta está "na caixa" quando o dia do jogo (`GameClock.getDay`) chegou nela e ela
    ainda não foi lida — derivado, sem gancho na virada do dia. Duas fontes: `MAIL_SCHEDULE` (fixas, em `data/mail.ts`; uma carta nova é só
    mais uma entrada) e `scheduleMail(message)` (qualquer sistema agenda por código; um `id` repetido é ignorado). `{nome}` no texto vira o
    nome do jogador (`renderMail`).
  - **Leitura**: interagir abre a mais antiga não lida no `LetterPanel` já existente (evento `OPEN_LETTER_EVENT`, mesmo da caixa do pet); o
    botão termina a leitura → `markMailRead` + `saveGame()`. Várias cartas = uma por interação; sem nenhuma, o aviso flutuante "Sem cartas
    novas". Enquanto há carta não lida, o papel do `Exterior.png` flutua em cima da caixa (`Mailbox.update`).
  - **Save** (`gameState.mail`, `MailState`): só `readIds` e `custom` (as agendadas por código); as fixas não são duplicadas no save. Save
    antigo (sem o campo) carrega sem nenhuma lida — cartas fixas de dias já passados chegam de uma vez. Só existe na `MainScene` (a Fazenda).
  - Carta de exemplo: `welcome`, no dia 2 (texto provisório — troque em `MAIL_SCHEDULE`).
- **Grid verde de alcance do aspersor** (`DecorationPlacementSystem.drawCoverage`): no modo de posicionamento de qualquer decoração com
  `waterReach`, um `Graphics` (fill verde translúcido + contorno, mesmo visual do grid de colisão de `debugGridOverlay.ts`) marca os
  terrenos que ele regaria a partir da célula sob o cursor — as células vêm de `sprinklerReachCells` (`systems/sprinklers.ts`, a ÚNICA fonte
  da regra, usada também pela rega e pela água animada; só onde `Farmland.getPlot` existe), então mostra exatamente o que será regado.
  Alcance por tier (pedido explícito, corrigido — a 1ª versão tratava 4/8/24 como RAIO, e cobria dezenas de terras): madeira 4 terras em
  cruz (`cross`/1), ferro 8 (`square`/1 = 3x3), ouro 24 (`square`/2 = 5x5). Redesenha só quando a célula muda; some ao cancelar.
