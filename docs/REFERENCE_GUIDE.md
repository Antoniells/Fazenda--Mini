# Biblioteca de referência — Mini Fazenda

Repositórios de terceiros pra **estudar como outros resolveram problemas específicos** e adaptar a IDEIA pro nosso Phaser 4 + TypeScript. Não são fonte de código nem de arte.

- Onde fica: `reference-projects/` na raiz do projeto — **fora do git** (`.gitignore`) e fora do observador de arquivos do Vite (`vite.config.ts`).
- Como montar/atualizar: `node tools/fetch-references.mjs` (`--update` atualiza). Clones rasos e filtrados: só o necessário pra LER código.

## Regras de uso

1. Antes de implementar algo, ver se alguma referência tem um sistema parecido (tabela "Por sistema", abaixo).
2. Entender **como** funciona e **por quê** — a arquitetura, não só o trecho.
3. Adaptar o conceito pro Phaser 4 + TypeScript e pra NOSSA arquitetura (`systems/`, `data/`, `scenes/`, `ui/` — ver [TECHNICAL.md](TECHNICAL.md)).
4. Não substituir um sistema que já funciona sem necessidade (regra 7 do CLAUDE.md). A referência serve pra melhorar o nosso, não pra trocar por outro.
5. **Licenças**:
   - GPL-3.0 (Serfdom, FarmSim) e **sem licença** (Harvest Haven, Armprod Valley, índice de recursos): só ideias. Nenhuma linha de código entra no projeto.
   - MIT (farming-rpg, elemental-farm): dá pra adaptar trechos, mantendo o aviso de copyright do autor junto.
   - Exemplos oficiais do Phaser: ler à vontade; são a forma "oficial" de usar a API.
6. **Arte**: nenhuma arte entra sem (a) licença conferida no `License.txt` do pacote e (b) combinar com o estilo do nosso pacote. Arte de outro estilo vira Frankenstein visual mesmo com licença livre. Áudio e utilitários (máscaras de luz, partículas) combinam com muito mais facilidade.
7. **Phaser 3 × 4**: farming-rpg, elemental-farm e boa parte dos exemplos são Phaser 3. Diferenças que já nos pegaram:
   - `setTintFill` não existe: é `setTint(cor).setTintMode(Phaser.TintModes.FILL)`.
   - Pós-processamento por pipeline (`setPostPipeline`, `postFX`/`preFX`) virou **Filters** (`camera.filters`, ex.: o desfoque de `systems/worldBlur.ts`).
   - Na dúvida, procurar primeiro em `phaser-examples/public/src/filters` e `.../game objects/lights`, que já são da API nova.

## Triagem (segunda filtragem)

Avaliado por tamanho real de código, estado, licença e se o README bate com o conteúdo.

| Referência | Motor / linguagem | Código | Licença | Estado | Veredito |
|---|---|---|---|---|---|
| **phaser-examples** (`phaser/`) | Phaser 3 e 4 / JS | 2.499 exemplos (só `public/src`; a arte deles não veio) | sem arquivo de licença (repositório oficial) | ativo | **A — consultar sempre**: é a API oficial. Tem as pastas da API nova (`filters`, `game objects/lights`, `noise`). |
| **Serfdom** (`farming/`) | Godot 4 / GDScript | 54 scripts, ~3,6 mil linhas | GPL-3.0 | parado desde 2023 | **A — organização de sistemas**. O próprio autor avisa: repositório educacional, sem a arte (não roda). Só o código serve. |
| **FarmSim** (`farming/`) | Godot 4 / GDScript | 57 scripts, ~2,4 mil linhas | GPL-3.0 | ativo (WIP) | **A — arquitetura por componentes** (dano, coleta, respawn, interação), save JSON completo, animais. |
| **elemental-farm** (`phaser/`) | Phaser 3 + Vite / TS | 20 arquivos, ~2,6 mil linhas | MIT | jam 2025 | **B — efeitos de tela por shader** (dia/noite, chuva, onda de calor, ar) e cena de UI separada. Shaders de Phaser 3 viram Filters no 4. |
| **Harvest Haven** (`farming/`) | Unity / C# | 54 scripts, ~6 mil linhas | sem licença | parado desde 2023 | **B — padrões**: propriedades por célula do grid, estado preservado entre cenas, pool de VFX, fade de objetos na frente do jogador. O save em arquivo está **comentado** (incompleto). Feito num curso de Unity. |
| **farming-rpg** (`phaser/`) | Phaser 3 dentro de Angular / TS | 34 arquivos, ~2 mil linhas | MIT | arquivado (2023) | **B — Tiled e personagem**: colisão/spawn/transição por camadas de objeto do Tiled, troca de paleta do personagem (LPC). Pequeno e preso ao Angular. |
| **Armprod Valley** (`farming/`) | Godot 4 / C# (não é Unity) | 15 scripts, ~1,5 mil linhas | sem licença | ativo | **C — pontual**: minigame de pesca com barra (`FishBar.cs`), save por célula (`TileSaveData`). |
| **jam-ready-assets** (`graphics/`) | catálogo de assets | 129 mil arquivos em 330 pacotes (só nomes e licenças: a arte fica no Git LFS e não foi baixada) | por pacote (`License.txt`) — maioria CC0 (Kenney) | ativo | **Catálogo**: bom pra ÁUDIO (CC0) e utilitários; arte quase toda de outro estilo. Baixar um pacote: `git lfs pull --include "<pacote>/**"` dentro da pasta. |
| **free-game-dev-resources** (`audio/`) | índice (README) | 155 links | sem licença | ativo | **C — índice**: ferramentas, bibliotecas de áudio, fontes, shaders. Lugar pra procurar, não pra estudar código. |
| **hitstop** (`gamefeel/`) | motor próprio em Canvas 2D / TS (não é Phaser) | ação 2D estilo Hollow Knight: motor + jogo + editores | sem licença | ativo | **B — sensação de impacto**: `docs/game-feel.md` e `src/engine/feel/feel.ts` (congelamento no golpe, tremor por trauma², empurrão de câmera, tudo de uma intensidade só), golpe guardado no `player.ts`, ímã de coleta no `pickup.ts`. Já aplicado em `systems/impact.ts`. As partículas de lá são retângulos desenhados por código (proibido aqui). |
| ~~GreenValley~~ | — | **nenhum** (só 5 arquivos .md) | — | — | **Descartado**: a descrição ("tudo em Canvas 2D") não tem código por trás. |

## Por sistema

"Nosso" = onde está o nosso sistema hoje (em `src/`). "Onde olhar" = arquivo da referência, com o caminho relativo à pasta dela — exceto **Harvest Haven**, relativo a `src/Assets/Scripts/`, e **Phaser**, relativo a `phaser-examples/public/src/`. Lacunas ficam marcadas.

### 🌱 Agricultura (plantio, crescimento, rega, colheita)
- Nosso: `systems/farmland.ts`, `farmlandRenderer.ts`, `farmlandInteraction.ts`, `sprinklers.ts`, `data/crops.ts`.
- **FarmSim** `scenes/objects/crops/growth_cycle_component.gd`: crescimento por dias até a colheita, sem rega não avança. `crop_class.gd`.
- **Serfdom** `Scripts/ground items/crop.gd`; `pipe.gd` (irrigação por canos ligados à água, com partícula).
- **Harvest Haven** `Crop/Crop.cs`, `CropDetails.cs` (cultura definida por dados), `Map/GridPropertiesManager.cs` (propriedades por célula: cavável, regada…).
- **Armprod Valley** `scripts/FarmingSystem.cs` (camadas de tilemap pra terra arada/regada).
- **elemental-farm** `src/objects/farm-tile.ts`, `crop.ts`, `element-system.ts` (o solo muda de cor com o estado).

### 🌳 Recursos (árvores, pedras, mato, respawn)
- Nosso: `systems/farmResources.ts`, `resourceNodeRegistry.ts`, `resourceInteraction.ts`, `breakEffect.ts`, `wildGrass.ts`.
- **FarmSim** `scenes/components/respawn_component.gd` (renasce após N dias), `hit_component.gd`/`hurt_component.gd`/`damage_component.gd` (vida de recurso por componentes), `objects/trees/`, `objects/rocks/`.
- **Serfdom** `Scripts/ground items/destroyable.gd`, `wood_tree.gd`.

### 🎒 Inventário, baús e crafting
- Nosso: `systems/inventory.ts`, `ui/inventoryScreen.ts`, `ui/hotbar.ts`, `systems/chestStorage.ts`, `ui/chestMenu.ts`.
- **Serfdom** `Scripts/ui & inventory/` (contêiner de itens genérico usado por inventário e baú: `item_container.gd` + `item_container_display.gd`; item no cursor; tooltip; aviso de item pego; crafting: `craftables_display.gd`, `recipe_ingredient.gd`, `machine.gd`).
- **FarmSim** `scripts/globals/inventory_manager.gd`, `item_database.gd` (catálogo de itens), `scenes/ui/inventory/` (hotbar, arrastar e soltar, pilhas).
- **Harvest Haven** `Inventory/InventoryManager.cs`, `UI/UIInventory/` (barra, slot, caixa de texto).

### 🏪 Economia (loja, venda, preços)
- Nosso: `systems/vendorShops.ts`, `villageShop.ts`, `shippingBinInteraction.ts`, `data/sellables.ts`.
- Lacuna: nenhuma referência tem economia de verdade (Armprod só soma o que a colheita rende). Procurar outra quando for mexer nisto.

### 🧑 NPCs e diálogo
- Nosso: `systems/npcSystem.ts`, `entities/Npc.ts`, `npcDialogue.ts`, `npcLines.ts`, `requests.ts`, `campaign.ts`.
- **Serfdom** `Scripts/npc.gd`, `managers/npc_manager.gd`, `Scripts/dialogue/` e a pasta `Dialogue/` (falas em arquivos `.dialogue`, do addon Dialogue Manager: diálogo como DADOS, com condições).
- **farming-rpg** `src/app/objects/characters/npc.ts`, `abstractCharacter.ts` (base comum de jogador e NPC no Phaser).
- **elemental-farm** `src/objects/dialog.ts` (caixa de diálogo no Phaser).
- Lacuna: rotina diária e relacionamento (nenhuma referência tem).

### 🗺️ Mundo, mapas e transições
- Nosso: `scenes/*`, `systems/mapBuilder.ts`, `externalMapBuilder.ts`, `bridgeSystem.ts`, `propertyExpansion.ts`.
- **farming-rpg** `src/app/objects/tiled/` (colisão, ponto de spawn e transição como objetos do Tiled), `scenes/base.scene.ts`, `transitionData.ts`.
- **Harvest Haven** `Scene/SceneControllerManager.cs` (troca de cena com fade), `SceneTeleport.cs`, `SaveSystem/SceneSave.cs` (estado de cada cena guardado ao sair).
- **Serfdom** `Scripts/map_connector.gd`, `procedural_generator.gd` (caverna/floresta por ruído: umidade, temperatura, altitude).

### 🧭 Pathfinding
- Nosso: `systems/pathfinding.ts`, `hordePathfinding.ts`, `grid.ts`.
- **FarmSim** animais andando com desvio de colisão (`scenes/characters/chicken/`, `cow/`) — usa a navegação do Godot.
- Lacuna: nenhuma referência tem A* próprio pra comparar (os exemplos do Phaser em `paths/` são curvas, não busca de caminho).

### ⚔️ Combate e 👾 IA de inimigos
- Nosso: `systems/combat.ts`, `entities/Enemy.ts`, `Slime.ts`, `Raider.ts`, `hordeDirector.ts`, `caveEnemies.ts`, `playerHealth.ts`.
- **FarmSim** `scenes/components/hit_component.gd`, `hurt_component.gd`, `damage_component.gd` (quem bate × quem apanha separados).
- **Serfdom** / **FarmSim** máquinas de estado (`Scripts/states/`, `scripts/state_machine/`) — o mesmo padrão serve pra IA.
- **Phaser** `phaser-examples/public/src/physics/` (sobreposição, corpos).
- **hitstop** `docs/game-feel.md`, `src/engine/feel/feel.ts` (pacote de impacto: congelamento + tremor por trauma + empurrão de câmera — já aplicado em `systems/impact.ts`), `src/game/actors/player.ts` (golpe guardado, aparar golpes).
- Lacuna: nenhuma referência de inimigo com perseguição/ataque elaborados.

### 🌦️ Clima e 🌅 tempo
- Nosso: `systems/weather.ts`, `ui/weatherOverlay.ts`, `wind.ts`, `gameClock.ts`, `worldTime.ts`, `dayCycle.ts`, `ambientLight.ts`, `dayNightOverlay.ts`, `data/seasons.ts`.
- **Serfdom** `Scripts/managers/time_manager.gd` (sinais de novo dia e de cada minuto, estações), `ui & inventory/day_night_modulate.gd`.
- **FarmSim** `scripts/globals/day_night_cycle_manager.gd`, `scenes/components/day_night_cycle_component.gd`.
- **elemental-farm** `src/shaders/day-night-shader.ts`, `rain-shader.ts`, `heat-wave-shader.ts` (efeito na tela inteira por shader; no Phaser 4 seria um Filter).

### 💾 Save
- Nosso: `systems/saveManager.ts`, `storageAdapter.ts`.
- **FarmSim** `scripts/globals/save_manager.gd` (JSON com posição, inventário, estágio das plantas, vida dos recursos, terra arada, animais).
- **Harvest Haven** `SaveSystem/ISaveable.cs` + `SaveLoadManager.cs` (cada objeto salvável se registra e guarda o próprio estado por cena; o save em arquivo está comentado).
- **Armprod Valley** `scripts/SaveMechanism/` (`TileSaveData.cs`: estado por célula).

### 🎨 Pixel art, iluminação e sombras
- Nosso: `systems/lightSources.ts`, `caveLighting.ts`, `shadow.ts`, `paletteSwap.ts`, `layeredArt.ts`, `characterComposer.ts`.
- **Phaser** `game objects/lights/` (luz pontual, luz em cone, `graveyard.js`, `light culling.js`) e `filters/` (`glow`, `shadow`, `bloom`, `vignette`, `image light`, `normal tools`) — a iluminação nativa do Phaser 4, alternativa ao nosso véu + brilho em ADD.
- **Serfdom** `ground items/shadowed_animated_sprite.gd`, `ui & inventory/shadowed_sprite.gd` (sombra como sprite filho).
- **farming-rpg** `src/app/utils/colorPaletteUtil.ts` (paletas de pele/cabelo do personagem LPC).
- **Catálogo**: `kenney-light-masks` (CC0) — máscaras de luz prontas, no lugar de esticar a mancha de `Shadow.png`.

### ✨ VFX (partículas, poeira, água, golpes)
- Nosso: `breakEffect.ts`, `grassDust.ts`, `fallingLeaves.ts`, `oreSparkle.ts`, `sprinklerWater.ts`, `floatingText.ts`.
- **Phaser** `game objects/particle emitter/` (zona de emissão, morte, interpolação, emissão por passos).
- **Harvest Haven** `VFX/PoolManager.cs`, `VFXManager.cs` (pool de efeitos); `Item/ItemNudge.cs` (mato que balança ao passar).
- **Serfdom** `Scripts/tweens/` (`tween_bounce.gd`, `tween_shake.gd` — animações de feedback reutilizáveis).
- **Catálogo**: `kenney-particle-pack`, `kenney-smoke-particles` (CC0).

### 🔊 Áudio e 🎵 música
- Nosso: `systems/soundEffects.ts`, `data/audio.ts`, `systems/dayMusic.ts`, `audioSettings.ts`.
- **Serfdom** `Scripts/managers/sound_manager.gd`.
- **FarmSim** sons ambientes aleatórios dos animais (`scenes/characters/cow/moo_timer.gd`, `chicken/cluck.gd`).
- **Phaser** `phaser-examples/public/src/audio/`.
- **Catálogo (CC0)**: `kenney-impact-sounds` (passos em grama, madeira, neve, carpete…), `kenney-foley-sounds`, `kenney-interface-sounds`, `kenney-ui-audio`, `kenney-rpg-audio`, `kenney-music-jingles`, `kenney-music-loops`. Não há som de folhas farfalhando.
- **Índice**: `free-game-dev-resources` → "Audio — Music & SFX".
- Lacuna: música dinâmica (troca por situação) — nenhuma referência.

### 🖥️ UI, 🎥 câmera e cenas
- Nosso: `ui/*`, `scenes/UIScene.ts`, `systems/cameraSetup.ts`, `uiCamera.ts`, `worldBlur.ts`.
- **elemental-farm** `src/scenes/ui-scene.ts` (HUD numa cena à parte, como a nossa), `objects/element-pie-gauge.ts`.
- **Serfdom** `Scripts/states/state_menu_open.gd`, `state_chest_open.gd` (menu aberto como ESTADO do jogador: trava o resto sem `if` espalhado).
- **Phaser** `camera/`, `scenes/`, `input/`.

### ⚙️ Arquitetura
- Nosso: `systems/gameState.ts` (estado único), módulos em `systems/`, dados em `data/`, `sceneEvents.ts`, registro de interações (`interaction.ts`).
- **FarmSim**: componentes pequenos e plugáveis (`scenes/components/`) + gerentes globais (`scripts/globals/`).
- **Serfdom**: máquina de estados do jogador (`Scripts/states/`) e gerentes (`Scripts/managers/`).
- **Harvest Haven**: eventos estáticos (`Events/EventsHandler.cs`) e interface `ISaveable`.

## Lacunas (procurar referências quando o assunto chegar)
Economia/loja com preços dinâmicos · rotina e relacionamento de NPCs · A* com obstáculos dinâmicos · IA de combate (perseguir, atacar, recuar) · música dinâmica · um jogo de fazenda em **Phaser 4** (todos os de Phaser aqui são 3).
