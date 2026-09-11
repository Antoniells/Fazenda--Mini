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

HUD fixo (screen-space, `setScrollFactor(0)`) no canto inferior esquerdo,
um slot por cultura em `CROPS`. Só composição de assets existentes, sem
nenhuma forma desenhada por código:

- A moldura de cada slot é um recorte de `UI/Inventory/Slots.png`
  (`data/ui.ts` guarda o retângulo exato, localizado recortando/ampliando o
  spritesheet pixel a pixel — mesma técnica já usada para `PINE_TREE_FRAME`
  em `MainScene`).
- O conteúdo do slot é o próprio frame de ícone da cultura
  (`CropDefinition.iconFrame`, hoje sempre 7 — o frame do item já colhido).
- O destaque da semente selecionada é só escala/opacidade/tingimento
  (`SeedBar.refresh`) sobre esses mesmos assets — a mesma técnica já usada
  para a plantação morta em `farmlandRenderer.ts` — nunca uma forma nova
  desenhada por cima (proibido pelas regras de pixel art do projeto).

`SeedBar` é puramente visual: não decide nada, só reflete
`Inventory.getSelectedSeedId()`. `MainScene` chama `refresh()` sempre que
uma tecla 1/2/3 muda a seleção.

### Interação (`systems/interaction.ts` + `systems/farmlandInteraction.ts`)

Camada de interação genérica (`InteractionRegistry`): qualquer célula pode
registrar um `Interactable`. `PlayerController` só pergunta "existe algo
aqui?" — sem saber o que é agricultura. Isso permite reaproveitar a mesma
camada para árvores, animais, construções etc. nas próximas fases. Uma
célula cultivável decide sua própria ação a partir do próprio estado
(`PlotInteractable.interact()`): ara se comum, planta se arada e vazia,
rega se crescendo, colhe se pronta, ou limpa se morta.

### Resultado da colheita

`systems/inventory.ts` é uma estrutura mínima (soma por id de item) só para
a agricultura ter um destino testável — não é o inventário completo, que
pertence à Fase 5 (Economia).

### Próximos pontos (fora do escopo desta fase)

- Culturas além das 3 atuais (cenoura, batata, cebola): a estrutura de
  dados já suporta, mas a seleção por teclado (`MainScene.setupSeedSelection`)
  só cobre as teclas 1-3 — uma 4ª cultura precisaria de mais uma tecla ali.
- Posicionamento adjacente + direção dinâmica nas ações agrícolas (ver
  limitação acima).
- Indicador visual de "precisa de água" antes da plantação morrer (hoje só
  o solo seco/molhado sinaliza isso).
- Inventário/economia reais (Fase 5).
