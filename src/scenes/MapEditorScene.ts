import Phaser from 'phaser';
import { farmMap, FarmMapData, FarmlandFenceLayout, getFarmlandFenceLayout, RectArea } from '../data/maps/farmMap';
import { forestMap, ForestMapData } from '../data/maps/forestMap';
import { caveMap, CaveMapData } from '../data/maps/caveMap';
import { beachMap, BeachMapData } from '../data/maps/beachMap';
import { quarryMap, QuarryMapData } from '../data/maps/quarryMap';
import { villageLayout, VillageLayoutData, VillageStructureRole } from '../data/maps/villageLayout';
import { VILLAGE_ASSETS, VillageAssetId, VILLAGE_FOUNTAIN_FRAMES, villageDirtZone } from '../data/maps/villageMap';
import { MAP_PROPS } from '../data/mapProps';
import { WELL } from '../data/decorations';
import {
  TILE_SIZE,
  GRASS_FLAT_TILE_INDEX,
  FENCE_TILESET_KEY,
  FENCE_TILESET_PATH,
  FENCE_EDGE_H_INDEX,
  FENCE_EDGE_V_INDEX,
  FENCE_CORNER_INDEX,
  FENCE_CORNER_BOTTOM_LEFT_INDEX,
  FENCE_CORNER_BOTTOM_RIGHT_INDEX,
  PINE_TREE_KEY,
  PINE_TREE_PATH,
  PINE_TREE_FRAME_NAME,
  PINE_TREE_FRAME,
  BIRCH_TREE_KEY,
  BIRCH_TREE_PATH,
  BIRCH_TREE_FRAME_NAME,
  BIRCH_TREE_FRAME,
  ROCK_KEY,
  ROCK_PATH,
  ROCK_FRAME_1,
  ROCK_BIG_SCALE_MULT,
  ORE_KEY,
  ORE_PATH,
  ORE_IRON_FRAME,
  ORE_COAL_FRAME,
  CAVE_ENTRANCE_KEY,
  CAVE_ENTRANCE_PATH,
  CAVE_ENTRANCE_FRAME,
  SHIPPING_BIN_KEY,
  SHIPPING_BIN_PATH,
  SHIPPING_BIN_FRAME_NAME,
  SHIPPING_BIN_FRAME,
  SHOP_STAND_KEY,
  SHOP_STAND_PATH,
  SOIL_TILESET_KEY,
  SOIL_DRY_AUTOTILE,
  WATER_KEY,
  PLAYER_HOUSE_KEY,
  PLAYER_HOUSE_PATH,
  PROPS_TILESET_KEY,
  PROPS_TILESET_PATH,
} from '../data/tiles';
import { CLOSE_BUTTON_SHEET_KEY, CLOSE_BUTTON_SHEET_PATH, CLOSE_X_ICON_FRAME, INVENTORY_UI_KEY, INVENTORY_UI_PATH, SELECTION_CORNER_NAMES, SELECTION_CORNER_RECTS } from '../data/ui';
import { DISPLAY_SCALE, BIOME_TINTS } from '../systems/mapBuilder';
import { pickGroundTileVariant } from '../systems/groundVariation';
import { buildDirtZone, pickDirtBlobTile } from '../systems/dirtPaths';
import { GROUND_TILESETS, GroundTilesetConfig, preloadGroundTilesets } from '../systems/groundTilesets';
import {
  exportFarmMapData,
  exportForestMapData,
  exportCaveMapData,
  exportBeachMapData,
  exportQuarryMapData,
  exportVillageMapData,
  VillageExportStructure,
  FenceExportEntry,
} from '../systems/mapEditorExport';
import { TilePickerPanel } from '../ui/tilePickerPanel';
import { computeFitScale } from '../ui/slotIcon';
import { UI_SCENE_KEY } from './UIScene';

const MAIN_SCENE_KEY = 'MainScene';

/** Escala de exibição — igual ao jogo (`mapBuilder.DISPLAY_SCALE`), pra que as coordenadas exportadas batam 1:1 com os arquivos de `data/maps/`. */
const TILE_PX = TILE_SIZE * DISPLAY_SCALE;

/** Velocidade do pan da câmera livre (px de mundo por segundo, no zoom 1:1). */
const CAMERA_PAN_SPEED = 500;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
/** Quanto o zoom muda por "unidade" de `deltaY` do scroll — valores de `deltaY` costumam vir em torno de ±100 por passo de roda. */
const ZOOM_STEP = 0.001;

/** Janela flutuante e arrastável (voltou a pedido explícito — nunca mais um layout docked escondendo parte do mapa): nasce no canto superior direito, mas pode ser movida pra qualquer lugar da tela pela barra de título. Altura um pouco menor que os 600px do canvas (não os 600px cheios do "ex: 300x600" do pedido) de propósito — sobra margem vertical real pra arrastar, senão a janela ficaria travada num canvas de 800x600. */
const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 560;
const TITLE_BAR_HEIGHT = 24;
const MODE_TABS_HEIGHT = 28;
const BRUSH_LABEL_HEIGHT = 18;
/** Onde o conteúdo (paleta de tiles OU lista de entidades) começa, local ao container da janela. */
const CONTENT_TOP = TITLE_BAR_HEIGHT + MODE_TABS_HEIGHT + BRUSH_LABEL_HEIGHT;
const CONTENT_PADDING = 8;
/** Faixa fixa no rodapé do painel (label + swatches) — pedido explícito, item 4 ("Cor de Fundo"). */
const BG_COLOR_SECTION_HEIGHT = 46;
/** Tamanho de cada tile dentro do `TilePickerPanel` — não precisa bater com `TILE_PX` do mundo, é só o zoom do seletor. */
const PICKER_TILE_DISPLAY_SIZE = 12;

/** GID do tile de grama plana — usado como "apagar" no Modo Ground (right-click), não importa qual tileset estava selecionado no momento. */
const GROUND_ERASE_GID = GRASS_FLAT_TILE_INDEX; // firstGid do tileset de grama é 0, então o GID é o próprio índice.

/**
 * Suporte universal (pedido explícito, item 5): o editor não é mais
 * exclusivo da Fazenda. `mapType` seleciona qual das 5 fontes de dados reais
 * do jogo (`data/maps/*.ts`) editar — "external" não existe como um tipo de
 * mapa próprio no código-fonte (é só a cena-base compartilhada das 4 cenas
 * de destino, ver `scenes/ExternalMapScene.ts`); os tipos de verdade são
 * estes 5, cada um com sua própria interface `XMapData` e seu próprio
 * exportador em `systems/mapEditorExport.ts`.
 */
export type MapType = 'farm' | 'forest' | 'cave' | 'beach' | 'quarry' | 'village';

export interface MapEditorInitData {
  mapType?: MapType;
  /** Mapa a carregar — se omitido, usa a constante real do módulo (`farmMap`/`forestMap`/...) pra aquele `mapType`. */
  mapData?: unknown;
  /** Chave da cena que abriu o editor (F2 universal, ver `systems/mapEditorLauncher.ts`) — pra `closeEditor` saber pra qual cena voltar/despausar. Sem ela (abrir o editor direto, ex.: como cena de boot do gameConfig), assume a Fazenda. */
  returnSceneKey?: string;
}

type AnyMapData = FarmMapData | ForestMapData | CaveMapData | BeachMapData | QuarryMapData | VillageLayoutData;

const DEFAULT_MAP_DATA: Record<MapType, AnyMapData> = {
  farm: farmMap,
  forest: forestMap,
  cave: caveMap,
  beach: beachMap,
  quarry: quarryMap,
  village: villageLayout,
};

/** Nome do arquivo baixado (tecla P, ver `MapEditorScene.exportMap`) — bate exatamente com o arquivo real que ele substitui em `data/maps/`. */
const MAP_TYPE_FILE_NAMES: Record<MapType, string> = {
  farm: 'farmMap.ts',
  forest: 'forestMap.ts',
  cave: 'caveMap.ts',
  beach: 'beachMap.ts',
  quarry: 'quarryMap.ts',
  village: 'villageLayout.ts',
};

/**
 * Todo objeto posicionável em QUALQUER tipo de mapa — cada `mapType` só usa
 * um subconjunto (ver `MAP_TYPE_CONFIGS`), mas o mapa `objects`/`Map` da
 * cena é genérico, então um único tipo cobre todos.
 */
type ObjectType =
  | 'fence'
  | 'tree'
  | 'shop'
  | 'shippingBin'
  | 'birchTree'
  | 'rock'
  | 'bigRock'
  | 'ironOre'
  | 'coalOre'
  | 'caveEntrance'
  | 'villageHouse2'
  | 'villageHouse3'
  | 'villageHouse7'
  | 'villageHouse8'
  | 'villageNewsstand'
  | 'villageFountain'
  | 'villageWell';

/** Uma cerca colocada guarda também QUAL variante do spritesheet foi escolhida (pedido explícito — orientação exata, não um botão único). */
interface PlacedObject {
  type: ObjectType;
  fenceVariantId?: string;
  /** Só as casas de moradores do Vilarejo: qual morador mora nela — acompanha a casa quando movida e vai pro `villageLayout.ts` (`role`). */
  villageRole?: VillageStructureRole;
}

/** Estrutura do Vilarejo (`VILLAGE_ASSETS`) ↔ tipo de objeto do editor. */
const VILLAGE_OBJECT_TYPES: Record<VillageAssetId, ObjectType> = {
  house2: 'villageHouse2',
  house3: 'villageHouse3',
  house7: 'villageHouse7',
  house8: 'villageHouse8',
  newsstand: 'villageNewsstand',
  fountain: 'villageFountain',
};
const VILLAGE_ASSET_BY_OBJECT_TYPE = new Map<ObjectType, VillageAssetId>((Object.entries(VILLAGE_OBJECT_TYPES) as Array<[VillageAssetId, ObjectType]>).map(([asset, type]) => [type, asset]));

interface FenceVariant {
  id: string;
  label: string;
  frame: number;
  flipX: boolean;
}

/** As 6 variantes reais do spritesheet de cerca (`data/tiles.ts`, já validadas pixel a pixel) — mesmas usadas pelo jogo de verdade em `systems/mapBuilder.buildFarmlandFence`, então a cerca semeada aqui já nasce com a orientação certa em vez de um tile genérico repetido. Só a Fazenda usa cerca (`MAP_TYPE_CONFIGS.farm.hasFences`). */
const FENCE_VARIANTS: FenceVariant[] = [
  { id: 'horizontal', label: 'Cerca Horizontal', frame: FENCE_EDGE_H_INDEX, flipX: false },
  { id: 'vertical', label: 'Cerca Vertical', frame: FENCE_EDGE_V_INDEX, flipX: false },
  { id: 'topLeft', label: 'Canto Sup. Esquerdo', frame: FENCE_CORNER_INDEX, flipX: false },
  { id: 'topRight', label: 'Canto Sup. Direito', frame: FENCE_CORNER_INDEX, flipX: true },
  { id: 'bottomLeft', label: 'Canto Inf. Esquerdo', frame: FENCE_CORNER_BOTTOM_LEFT_INDEX, flipX: false },
  { id: 'bottomRight', label: 'Canto Inf. Direito', frame: FENCE_CORNER_BOTTOM_RIGHT_INDEX, flipX: false },
];

interface StaticAssetDef {
  textureKey: string;
  /** Ausente = a imagem inteira (as casas do Vilarejo são imagens únicas, sem frame nomeado). */
  frame?: string | number;
  /** Só `bigRock` usa isto — mesmo asset de `rock`, escala maior (`ROCK_BIG_SCALE_MULT`, igual ao jogo de verdade). */
  scaleMultiplier?: number;
  /**
   * Deslocamento em pixels de mundo (já na escala do jogo, `DISPLAY_SCALE`
   * aplicado) a partir do canto superior-esquerdo da célula
   * (`col*TILE_PX`, `row*TILE_PX`) + o `origin` — MESMA fórmula que o jogo
   * de verdade usa pra desenhar cada asset (`systems/mapBuilder.ts`/
   * `systems/externalMapBuilder.ts`), pra o preview do editor "caber no
   * quadradinho" exatamente como no mapa real, em vez de um centro
   * genérico que não reflete o tamanho/proporção real de cada sprite.
   */
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
}

/**
 * Formato "padrão" que árvore/pedra/minério/entrada de caverna/caixa de
 * remessas usam de verdade no jogo (`buildFarmDecorations`,
 * `externalMapBuilder.buildExternalTree/buildGrowingTree/buildRock/
 * buildOreDeposit/buildCaveEntrance`, `mapBuilder.buildShippingBin`):
 * ancorado embaixo-centro da célula (`origin 0.5,1`), base encostada na
 * linha de baixo do tile (`(row+1)*TILE_PX` = `row*TILE_PX + TILE_PX`).
 * Só a Loja foge desse padrão (ver `STATIC_OBJECT_ASSET.shop`).
 */
const GROUND_ANCHORED_OFFSET = { offsetX: TILE_PX / 2, offsetY: TILE_PX, originX: 0.5, originY: 1 };

/** Asset real de cada objeto ESTÁTICO (sem variantes) — cerca é tratada à parte (ver `FENCE_VARIANTS`). Cobre os objetos dos 5 tipos de mapa; cada `mapType` só expõe um subconjunto na paleta (`MAP_TYPE_CONFIGS`). */
const STATIC_OBJECT_ASSET: Record<Exclude<ObjectType, 'fence'>, StaticAssetDef> = {
  tree: { textureKey: PINE_TREE_KEY, frame: PINE_TREE_FRAME_NAME, ...GROUND_ANCHORED_OFFSET },
  // Único fora do padrão — mesmos ajustes pixel a pixel de `mapBuilder.buildShopStand`
  // (`ajusteX=0`, `ajusteY=-54`, ou seja `y = row*TILE_PX - (-54)`).
  shop: { textureKey: SHOP_STAND_KEY, frame: 0, offsetX: 0, offsetY: 54, originX: 0.5, originY: 1 },
  shippingBin: { textureKey: SHIPPING_BIN_KEY, frame: SHIPPING_BIN_FRAME_NAME, ...GROUND_ANCHORED_OFFSET },
  birchTree: { textureKey: BIRCH_TREE_KEY, frame: BIRCH_TREE_FRAME_NAME, ...GROUND_ANCHORED_OFFSET },
  rock: { textureKey: ROCK_KEY, frame: ROCK_FRAME_1.name, ...GROUND_ANCHORED_OFFSET },
  bigRock: { textureKey: ROCK_KEY, frame: ROCK_FRAME_1.name, scaleMultiplier: ROCK_BIG_SCALE_MULT, ...GROUND_ANCHORED_OFFSET },
  ironOre: { textureKey: ORE_KEY, frame: ORE_IRON_FRAME.name, ...GROUND_ANCHORED_OFFSET },
  coalOre: { textureKey: ORE_KEY, frame: ORE_COAL_FRAME.name, ...GROUND_ANCHORED_OFFSET },
  caveEntrance: { textureKey: CAVE_ENTRANCE_KEY, frame: CAVE_ENTRANCE_FRAME.name, ...GROUND_ANCHORED_OFFSET },
  // Estruturas do Vilarejo: mesmo desenho de `systems/villageBuilder.buildVillage` — canto superior-esquerdo da arte na célula (origem 0,0).
  villageHouse2: { textureKey: VILLAGE_ASSETS.house2.key, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  villageHouse3: { textureKey: VILLAGE_ASSETS.house3.key, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  villageHouse7: { textureKey: VILLAGE_ASSETS.house7.key, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  villageHouse8: { textureKey: VILLAGE_ASSETS.house8.key, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  villageNewsstand: { textureKey: VILLAGE_ASSETS.newsstand.key, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  villageFountain: { textureKey: VILLAGE_ASSETS.fountain.key, frame: VILLAGE_FOUNTAIN_FRAMES[0].name, offsetX: 0, offsetY: 0, originX: 0, originY: 0 },
  // O poço da praça (2x1 células, `villageBuilder`): base-centro da faixa das DUAS células, ou seja, x = col+1 tiles.
  villageWell: { textureKey: WELL.textureKey, frame: WELL.frameName, offsetX: TILE_PX, offsetY: TILE_PX, originX: 0.5, originY: 1 },
};

/** O "pincel" ativo do Modo Entities/Decoração. `object`/`fence`/`prop` carregam qual tipo/variante/id exato; os demais são genéricos (o que fazem depende do `mapType`/estado atual, não de um payload próprio). `collision` existe em TODO tipo de mapa (pedido explícito — bloqueio estático independe de bioma); `prop` também (decoração ambiente independe de bioma, pedido explícito). */
type EntityTool =
  | { kind: 'object'; objectType: ObjectType }
  | { kind: 'fence'; variantId: string }
  | { kind: 'area' }
  | { kind: 'move' }
  | { kind: 'collision' }
  | { kind: 'prop'; propId: string }
  | { kind: 'eraser' };

interface EntityPaletteEntry {
  id: string;
  label: string;
  /** Ausente quando `swatchColor` está presente (Bloco de Colisão) — nesse caso o ícone é um retângulo colorido, não uma textura real. */
  textureKey?: string;
  frame?: string | number;
  flipX?: boolean;
  /** Ícone da paleta como retângulo colorido em vez de textura — mesma linguagem visual dos swatches de Cor de Fundo (item 4), não é "arte" nova (CLAUDE.md regra 12): só o Bloco de Colisão usa isto. */
  swatchColor?: number;
  tool: EntityTool;
}

type EditorMode = 'ground' | 'entities' | 'decoration';

interface MapEntityDef {
  /** Nunca `'fence'` — cerca é uma lista de variantes própria, ligada por `MapTypeConfig.hasFences` (ver `FENCE_VARIANTS`), não uma entrada solta aqui. */
  objectType: Exclude<ObjectType, 'fence'>;
  label: string;
  /** `shop`/`shippingBin`/`caveEntrance`: só uma célula por vez (a interface do mapa guarda posição única, não lista). */
  singleton?: boolean;
}

interface MapAreaDef {
  label: string;
  textureKey: string;
  frame?: string | number;
  /** Terra Arável da Fazenda é uma lista LIVRE de células (`FarmMapData.farmlandArea`); Lago/Oceano são um RETÂNGULO (`lakeArea`/`oceanArea`) — exportado como o bounding box das células pintadas. */
  exportAsRect: boolean;
}

interface MapTypeConfig {
  label: string;
  /** Tint do chão pra pré-visualizar o bioma (`systems/mapBuilder.BIOME_TINTS`) — puramente visual, nunca gravado no `ground` exportado (o jogo aplica o tint sozinho, por cena). */
  groundTint?: number;
  entities: MapEntityDef[];
  hasFences: boolean;
  area?: MapAreaDef;
}

/**
 * Configuração central do suporte universal (pedido explícito, item 5): cada
 * entrada descreve exatamente o que `data/maps/*.ts` já modela pra aquele
 * tipo de mapa (ver levantamento nos próprios arquivos) — a paleta de
 * entidades, a semeadura inicial (`seedFromRealMap`) e a exportação (`P`)
 * são todas geradas A PARTIR desta tabela, em vez de código duplicado por
 * tipo de mapa.
 */
const MAP_TYPE_CONFIGS: Record<MapType, MapTypeConfig> = {
  farm: {
    label: 'Fazenda',
    entities: [
      { objectType: 'tree', label: 'Árvore' },
      { objectType: 'shop', label: 'Loja', singleton: true },
      { objectType: 'shippingBin', label: 'Caixa de Remessas', singleton: true },
    ],
    hasFences: true,
    area: { label: 'Terra Arável', textureKey: SOIL_TILESET_KEY, frame: SOIL_DRY_AUTOTILE.center, exportAsRect: false },
  },
  forest: {
    label: 'Floresta',
    entities: [
      { objectType: 'tree', label: 'Pinheiro' },
      { objectType: 'birchTree', label: 'Bétula' },
      { objectType: 'rock', label: 'Pedra' },
    ],
    hasFences: false,
    area: { label: 'Lago', textureKey: WATER_KEY, exportAsRect: true },
  },
  cave: {
    label: 'Caverna',
    entities: [{ objectType: 'caveEntrance', label: 'Entrada da Caverna', singleton: true }],
    hasFences: false,
  },
  beach: {
    label: 'Praia',
    entities: [
      { objectType: 'rock', label: 'Pedra' },
      { objectType: 'bigRock', label: 'Pedra Grande' },
    ],
    hasFences: false,
    area: { label: 'Oceano', textureKey: WATER_KEY, exportAsRect: true },
  },
  quarry: {
    label: 'Pedreira',
    groundTint: BIOME_TINTS.mining,
    entities: [
      { objectType: 'rock', label: 'Pedra Pequena' },
      { objectType: 'bigRock', label: 'Pedra Grande' },
      { objectType: 'ironOre', label: 'Minério de Ferro' },
      { objectType: 'coalOre', label: 'Minério de Carvão' },
    ],
    hasFences: false,
  },
  village: {
    label: 'Vila',
    entities: [
      { objectType: 'villageHouse2', label: 'Casa Abandonada' },
      { objectType: 'villageHouse3', label: 'Casa Azul' },
      { objectType: 'villageHouse7', label: 'Casa de Pedra' },
      { objectType: 'villageHouse8', label: 'Casa de Madeira (Loja)' },
      { objectType: 'villageNewsstand', label: 'Banca de Jornal' },
      { objectType: 'villageFountain', label: 'Chafariz' },
      { objectType: 'villageWell', label: 'Poço da Praça', singleton: true },
      { objectType: 'tree', label: 'Pinheiro' },
    ],
    hasFences: false,
  },
};

/** Pré-definidas (pedido explícito, item 4 — "botões de cores pré-definidas" foi a opção escolhida, em vez do `<input type=color>` via DOM: mais simples e consistente com o resto da UI, que já é toda desenhada com `Rectangle`/`Graphics` do próprio Phaser). */
const BACKGROUND_COLOR_PRESETS: Array<{ label: string; hex: string }> = [
  { label: 'Padrão', hex: '#1e1e1e' },
  { label: 'Preto', hex: '#000000' },
  { label: 'Cinza', hex: '#3a3a3a' },
  // Cor real do tile de grama plana (`GRASS_FLAT_TILE_INDEX`) do
  // `Tileset Grass Summer.png`, amostrada pixel a pixel (média RGB da
  // célula de 16x16) — pedido explícito, item 3 desta rodada.
  { label: 'Verde Grama', hex: '#7ec433' },
  { label: 'Céu', hex: '#87ceeb' },
  { label: 'Caverna', hex: '#241a12' },
  { label: 'Água', hex: '#123a4a' },
];

/**
 * `MapEditorScene` — ferramenta de desenvolvimento (Level Design) de nível
 * profissional, no espírito de um editor tipo Tiled/RPG Maker: sem física,
 * colisão, HUD de jogo ou personagem. Aberta com F2 a partir da `MainScene`
 * (sempre editando a Fazenda — ver `init`), ela mesma garante seu próprio
 * isolamento (`isolateFromGame`).
 *
 * Arquitetura:
 * - Janela flutuante ARRASTÁVEL (voltou a pedido explícito — o layout docked
 *   de uma versão anterior escondia parte do mapa e limitava a navegação da
 *   câmera): `windowContainer` é um painel de `PANEL_WIDTH`x`PANEL_HEIGHT`
 *   px, nascendo no canto superior direito, com fundo sólido próprio (pra
 *   tiles transparentes não parecerem pretos). O arraste só é ativado pela
 *   BARRA DE TÍTULO (`setupTitleBar` — rastreamento manual de ponteiro,
 *   nunca `scene.input.setDraggable`, ver doc do método): os botões do
 *   corpo (abas, paleta, swatches) têm suas próprias hitzones e recebem
 *   clique normalmente, sem interferência do arraste. `getWindowBounds()`
 *   lê a posição ATUAL do container (nunca uma coordenada fixa) — usado pra
 *   bloquear zoom/pintura sempre que o ponteiro estiver dentro desse
 *   retângulo, onde quer que a janela tenha sido arrastada.
 * - Duas câmeras (corrigindo um bug real de projeção — WebGL zoom afetava a
 *   UI, ver commits anteriores): `cameras.main` cobre a tela INTEIRA (sem
 *   restrição de viewport) e sofre todo o pan/zoom, desenhando só o mundo
 *   (`groundLayer`, `gridOverlay`, casa, objetos, área) — `uiCamera` é uma
 *   segunda câmera fixa (zoom 1, nunca rola, também cobre a tela inteira)
 *   que desenha só a `windowContainer`, imune a zoom/pan. Cada câmera
 *   ignora o que é da outra (`ignore`) — main ignora a janela uma única vez
 *   em `setupWindow` (ignorar o Container já esconde todos os filhos,
 *   presentes e futuros); `uiCamera` ignora cada objeto de MUNDO assim que
 *   ele nasce (`addWorldObject`). Todo cálculo de clique-no-mapa usa
 *   `cameras.main.getWorldPoint(pointer.x, pointer.y)` explicitamente —
 *   nunca `pointer.worldX/worldY`, que fica ambíguo assim que existe mais
 *   de uma câmera na cena.
 * - Suporte universal (pedido explícito, item 5): `mapType` + `mapData`
 *   chegam por `init(data)` — sem eles, abre editando a Fazenda (mesmo
 *   comportamento de sempre, F2 continua funcionando sem mudança nenhuma).
 *   `MAP_TYPE_CONFIGS` descreve, por tipo de mapa, quais entidades existem,
 *   se tem cerca e se tem uma "área" pintável (lago/oceano/terra arável) — a
 *   paleta (`buildEntityPalette`), a semeadura inicial (`seedFromRealMap`) e
 *   a exportação (`exportMap`) são todas dirigidas por essa tabela, nunca
 *   hardcoded pra Fazenda. "external" não é um tipo de mapa de verdade no
 *   código (é só a cena-base compartilhada de Floresta/Caverna/Praia/
 *   Pedreira, ver `scenes/ExternalMapScene.ts`) — os 5 tipos reais são os 5
 *   arquivos de `data/maps/`.
 * - Conta-gotas (pedido explícito, item 2): clique do meio OU Alt+clique
 *   esquerdo em qualquer lugar do mapa lê `tile.index` (o GID, já correto
 *   pro tileset ativo) da célula e chama `tilePicker.setSelected(...)`,
 *   trocando de aba automaticamente se o GID pertencer a outro tileset (a
 *   própria `TilePickerPanel` já faz essa resolução) — nunca pinta nada
 *   nesse mesmo clique (`tryEyedrop` sempre retorna `true` se o gesto for
 *   reconhecido, mesmo sem tile embaixo).
 * - Ferramenta "Mover" (pedido explícito, item 3): clicar numa entidade
 *   existente com a ferramenta "Mover (Seleção)" ativa REMOVE ela da
 *   posição original (`heldObject`) e mostra um "fantasma" semi-transparente
 *   (`moveGhost`) grudado no cursor (sempre no grid, célula a célula); o
 *   PRÓXIMO clique reposiciona ali. Botão direito enquanto segurando cancela
 *   (devolve à posição original) — troca de aba/modo/ferramenta enquanto
 *   segurando também cancela automaticamente, pra nunca perder o objeto.
 * - Cor de fundo (pedido explícito, item 4): swatches pré-definidos no
 *   rodapé do painel chamam `cameras.main.setBackgroundColor` direto — sem
 *   `<input type=color>` via DOM (a alternativa que o próprio pedido
 *   ofereceu): mais simples e consistente com o resto da UI, que já é toda
 *   `Rectangle`/`Graphics` puro do Phaser (nunca HTML/CSS, CLAUDE.md regra
 *   12). Inclui "Verde Grama" (`#7EC433`, cor média real do tile de grama
 *   plana do tileset, `GRASS_FLAT_TILE_INDEX`, amostrada pixel a pixel).
 *   Incluído na exportação como `backgroundColor` (campo novo e opcional em
 *   todas as 5 interfaces de `data/maps/`, mesmo tratamento já dado a
 *   `ground`: autorado pelo editor, ainda não consumido pela cena).
 * - Bloco de Colisão (pedido explícito): ferramenta universal (existe em
 *   TODO tipo de mapa, não só quando há uma "área") que marca uma célula
 *   como bloqueada mesmo sem nenhum objeto visível ali — retângulo vermelho
 *   semi-transparente só de feedback do editor. Vira `blockedArea` (campo
 *   novo em todas as 5 interfaces), e ESTE campo já é lido de verdade:
 *   `systems/grid.ts` (Fazenda) e os 4 `obstacleCells` de
 *   `scenes/ForestScene.ts`/`CaveScene.ts`/`BeachScene.ts`/`QuarryScene.ts`
 *   já bloqueiam essas células no jogo de verdade — diferente de `ground`/
 *   `backgroundColor`, que ainda são só reservados.
 *
 * Nasce mostrando o mapa ATUAL (`this.mapData`), não um grid vazio: todo o
 * chão e as entidades reais são semeados a partir dos dados de verdade
 * (`seedFromRealMap`) — editar é sempre "por cima do que já existe".
 */
export class MapEditorScene extends Phaser.Scene {
  private mapType: MapType = 'farm';
  /** Ver doc de `MapEditorInitData.returnSceneKey`. */
  private returnSceneKey: string = MAIN_SCENE_KEY;
  private mapData!: AnyMapData;
  private gridCols = 0;
  private gridRows = 0;
  private singletonTypes = new Set<ObjectType>();

  private groundData: number[][] = [];
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private groundTilemap?: Phaser.Tilemaps.Tilemap;
  /** Cópia mutável de `GROUND_TILESETS` (`systems/groundTilesets.ts`) — o botão "Importar" (pedido explícito) só adiciona tilesets NESTA sessão, nunca no array compartilhado importado. Resetada em `init()`. */
  private groundTilesets: GroundTilesetConfig[] = [];
  private selectedGroundGid = GROUND_ERASE_GID;

  private objects = new Map<string, PlacedObject>();
  private objectViews = new Map<string, Phaser.GameObjects.Image>();
  /** "Área" pintável genérica — Terra Arável (Fazenda) OU Lago (Floresta) OU Oceano (Praia); Caverna/Pedreira não têm `MAP_TYPE_CONFIGS[...].area`, então isto nunca é usado nelas. */
  private areaCells = new Set<string>();
  private areaViews = new Map<string, Phaser.GameObjects.Image>();
  /** "Bloco de Colisão" (pedido explícito) — existe em TODO tipo de mapa; vira `XMapData.blockedArea`, lido de verdade por `systems/grid.ts`/`ExternalMapScene` (via `obstacleCells`). */
  private collisionCells = new Set<string>();
  private collisionViews = new Map<string, Phaser.GameObjects.Rectangle>();
  /** Props de decoração ambiente (aba "Decoração", pedido explícito) — existem em TODO tipo de mapa, sem colisão nenhuma; vira `XMapData.props`. Um por célula (repintar substitui, mesmo critério de `objects`). */
  private decorationCells = new Map<string, string>();
  private decorationViews = new Map<string, Phaser.GameObjects.Image>();

  private mode: EditorMode = 'ground';
  private entityPalette: EntityPaletteEntry[] = [];
  private decorationPalette: EntityPaletteEntry[] = [];
  private selectedEntityTool: EntityTool = { kind: 'move' };
  private entityPaletteIcons = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>();
  private entityPaletteObjects: Phaser.GameObjects.GameObject[] = [];
  /** Ícones da paleta de Decoração — separados de `entityPaletteIcons` porque tem rolagem própria (ver `setupDecorationPalette`). */
  private decorationPaletteIcons = new Map<string, Phaser.GameObjects.Image>();
  private decorationPaletteObjects: Phaser.GameObjects.GameObject[] = [];
  /** Deslocamento de rolagem (px de tela) da lista de Decoração — a lista (26 props) não cabe inteira no painel, mesmo problema que o `TilePickerPanel` já resolve pro Modo Ground, mas aqui como uma lista vertical simples (linhas escondidas fora da faixa visível), não um recorte de imagem única. */
  private decorationScrollY = 0;
  private decorationRows: Array<{ icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; hitZone: Phaser.GameObjects.Zone; baseY: number }> = [];
  private tilePicker!: TilePickerPanel;
  private brushLabel!: Phaser.GameObjects.Text;
  /** Botão "Importar" (Modo Ground, pedido explícito) — só visível nesse modo. */
  private importButtonBg!: Phaser.GameObjects.Rectangle;
  private importButtonText!: Phaser.GameObjects.Text;
  private modeButtons!: Record<EditorMode, { background: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>;

  /** Ferramenta "Mover" (item 3) — objeto "na mão" enquanto o usuário reposiciona algo já existente. */
  private heldObject: { object: PlacedObject; originalCol: number; originalRow: number } | null = null;
  private moveGhost: Phaser.GameObjects.Image | null = null;

  private windowContainer!: Phaser.GameObjects.Container;
  private isDraggingWindow = false;
  private dragPointerStart = { x: 0, y: 0 };
  private dragWindowStart = { x: 0, y: 0 };

  private backgroundColorHex = BACKGROUND_COLOR_PRESETS[0].hex;
  private backgroundSwatches: Array<{ hex: string; shape: Phaser.GameObjects.Rectangle }> = [];
  private backgroundSwatchHighlight!: Phaser.GameObjects.Graphics;

  /** Câmera fixa (zoom 1, nunca rola) exclusiva da UI — ver doc da classe. */
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  private gridOverlay!: Phaser.GameObjects.Grid;

  private isPaintingLeft = false;
  private isPaintingRight = false;
  private lastPaintedKey: string | null = null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() {
    super('MapEditorScene');
  }

  /**
   * Suporte universal (item 5) — sem `data`, abre editando a Fazenda (F2 a
   * partir da `MainScene` continua funcionando sem nenhuma mudança). O
   * Phaser reaproveita a mesma instância da cena entre `scene.start()`
   * (não recria a classe, ver `scenes/ExternalMapScene.init`), então todo
   * estado mutável da sessão anterior é limpo aqui — sem isso, reabrir o
   * editor com um `mapType` diferente misturaria entidades de mapas
   * diferentes.
   */
  init(data?: MapEditorInitData): void {
    this.mapType = data?.mapType ?? 'farm';
    this.returnSceneKey = data?.returnSceneKey ?? MAIN_SCENE_KEY;
    this.mapData = (data?.mapData as AnyMapData | undefined) ?? DEFAULT_MAP_DATA[this.mapType];
    this.gridCols = this.mapData.cols;
    this.gridRows = this.mapData.rows;
    this.singletonTypes = new Set(MAP_TYPE_CONFIGS[this.mapType].entities.filter((entity) => entity.singleton).map((entity) => entity.objectType));
    // Cópia nova a cada abertura — um tileset importado (botão "Importar") não deve sobreviver a um reabrir do editor.
    this.groundTilesets = [...GROUND_TILESETS];

    this.groundData = [];
    this.objects.clear();
    this.objectViews.clear();
    this.areaCells.clear();
    this.areaViews.clear();
    this.collisionCells.clear();
    this.collisionViews.clear();
    this.decorationCells.clear();
    this.decorationViews.clear();
    this.entityPalette = [];
    this.entityPaletteIcons.clear();
    this.entityPaletteObjects = [];
    this.decorationPalette = [];
    this.decorationPaletteIcons.clear();
    this.decorationPaletteObjects = [];
    this.decorationScrollY = 0;
    this.decorationRows = [];
    this.heldObject = null;
    this.moveGhost = null;
    this.mode = 'ground';
    this.selectedEntityTool = { kind: 'move' };
    this.selectedGroundGid = GROUND_ERASE_GID;
    // Parte da cor de fundo que o mapa JÁ tem (senão exportar sem mexer nela trocaria, por ex., o verde-grama do Vilarejo pelo cinza do editor).
    this.backgroundColorHex = this.mapData.backgroundColor ?? BACKGROUND_COLOR_PRESETS[0].hex;
  }

  preload(): void {
    // Todos os tilesets de chão (Grama/Solo/Água + qualquer um já importado
    // e colado de volta em `GROUND_TILESETS`) — um `load.image` por
    // tileset, gerado sozinho a partir do array (pedido explícito: "deixa
    // essa etapa mais automática").
    preloadGroundTilesets(this);
    this.load.image(PROPS_TILESET_KEY, encodeURI(`/${PROPS_TILESET_PATH}`));
    this.load.spritesheet(FENCE_TILESET_KEY, encodeURI(`/${FENCE_TILESET_PATH}`), {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.image(PINE_TREE_KEY, encodeURI(`/${PINE_TREE_PATH}`));
    this.load.image(SHIPPING_BIN_KEY, encodeURI(`/${SHIPPING_BIN_PATH}`));
    this.load.image(SHOP_STAND_KEY, encodeURI(`/${SHOP_STAND_PATH}`));
    this.load.image(PLAYER_HOUSE_KEY, encodeURI(`/${PLAYER_HOUSE_PATH}`));
    this.load.image(CLOSE_BUTTON_SHEET_KEY, encodeURI(`/${CLOSE_BUTTON_SHEET_PATH}`));
    // Carregados sempre, não só quando `mapType` precisa deles — são
    // arquivos pequenos e o Phaser ignora uma chave já em cache (mesma
    // lógica de `ExternalMapScene.preload`), evitando ter que orquestrar
    // preload condicional por tipo de mapa.
      this.load.image('imported-tileset-1789696244851', encodeURI('/Tileset/Beach animations tiles.png'));
    this.load.image(BIRCH_TREE_KEY, encodeURI(`/${BIRCH_TREE_PATH}`));
    this.load.image(ROCK_KEY, encodeURI(`/${ROCK_PATH}`));
    this.load.image(ORE_KEY, encodeURI(`/${ORE_PATH}`));
    this.load.image(CAVE_ENTRANCE_KEY, encodeURI(`/${CAVE_ENTRANCE_PATH}`));
    this.load.image(INVENTORY_UI_KEY, encodeURI(`/${INVENTORY_UI_PATH}`));
    // Estruturas do Vilarejo (casas, banca, chafariz) e a arte do poço — mesmas artes que `systems/villageBuilder.preloadVillage` carrega no jogo.
    for (const asset of Object.values(VILLAGE_ASSETS)) this.load.image(asset.key, encodeURI(`/${asset.path}`));
    this.load.image(WELL.textureKey, encodeURI(`/${WELL.texturePath}`));
  }

  create(): void {
    this.isolateFromGame();
    // Bug real (F2 universal): a ordem de renderização das cenas segue a
    // ordem de REGISTRO em `gameConfig.scene`, não a ordem de abertura —
    // `MapEditorScene` vem logo depois da `MainScene` nessa lista, então
    // abrir o editor a partir de QUALQUER cena registrada depois dela
    // (Floresta/Pedreira/Caverna/Praia) a deixava renderizando por BAIXO da
    // cena pausada (que continua desenhando, só não mais atualizando — ver
    // doc de `Phaser.Scenes.ScenePlugin.pause`), escondendo o editor
    // inteiro atrás dela. `bringToTop` (mesma técnica de `ensureUIScene`
    // pra `UIScene`) garante o editor sempre por cima, não importa de onde
    // veio.
    this.scene.bringToTop();
    // Câmeras primeiro: `addWorldObject` (chamado por tudo abaixo que
    // desenha o mundo) já precisa de `uiCamera` pra existir.
    this.setupCameras();

    this.registerFrames();
    this.buildEntityPalette();
    this.buildDecorationPalette();

    this.buildGroundLayer();
    this.buildGridOverlay();
    if (this.mapType === 'farm') this.renderHouseReference(this.mapData as FarmMapData);
    this.seedFromRealMap();

    this.setupWindow();
    this.setupPaintInput();
    this.setupShortcuts();
  }

  update(_time: number, delta: number): void {
    this.panCamera(delta);
  }

  // --- Isolamento da UI do jogo -------------------------------------------

  /**
   * Garante que a cena abra "limpa" não importa quem a chamou: a cena de
   * origem (`returnSceneKey`) fica pausada (nunca `stop` — destruiria o
   * jogador/câmera/estado dela, ver `systems/mapEditorLauncher.ts`), e a
   * `UIScene` (relógio, hotbar, moedas) é posta pra DORMIR — `sleep`, não
   * `stop`, porque ela é uma cena persistente (nunca reiniciada, ver
   * `scenes/UIScene.ts`); `stop` a destruiria de verdade.
   *
   * O `registerMapEditorShortcut` já pausa a cena de origem ANTES de abrir
   * o editor — o `pause` aqui é só uma rede de segurança pro caso do editor
   * ser aberto sem passar por ele (ex.: como cena de boot direta do
   * `gameConfig`, sem nenhuma cena de origem rodando).
   */
  private isolateFromGame(): void {
    const manager = this.scene.manager;
    if (manager.isActive(this.returnSceneKey)) this.scene.pause(this.returnSceneKey);
    if (manager.isActive(UI_SCENE_KEY)) this.scene.sleep(UI_SCENE_KEY);
  }

  // --- Setup ---------------------------------------------------------------

  /** Recorta os frames únicos usados aqui, exatamente como `MainScene.create` faz para o jogo de verdade — guardado por `!texture.has(name)` porque texturas são globais (`TextureManager`) e sobrevivem entre reaberturas desta cena (ver `init`), então tentar adicionar o mesmo frame duas vezes lançaria erro. */
  private registerFrames(): void {
    const addFrame = (textureKey: string, name: string, rect: { x: number; y: number; width: number; height: number }): void => {
      const texture = this.textures.get(textureKey);
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    };

    addFrame(PINE_TREE_KEY, PINE_TREE_FRAME_NAME, PINE_TREE_FRAME);
    addFrame(SHIPPING_BIN_KEY, SHIPPING_BIN_FRAME_NAME, SHIPPING_BIN_FRAME);
    addFrame(CLOSE_BUTTON_SHEET_KEY, CLOSE_X_ICON_FRAME.name, CLOSE_X_ICON_FRAME.rect);
    addFrame(BIRCH_TREE_KEY, BIRCH_TREE_FRAME_NAME, BIRCH_TREE_FRAME);
    addFrame(ROCK_KEY, ROCK_FRAME_1.name, ROCK_FRAME_1.rect);
    addFrame(ORE_KEY, ORE_IRON_FRAME.name, ORE_IRON_FRAME.rect);
    addFrame(ORE_KEY, ORE_COAL_FRAME.name, ORE_COAL_FRAME.rect);
    addFrame(CAVE_ENTRANCE_KEY, CAVE_ENTRANCE_FRAME.name, CAVE_ENTRANCE_FRAME.rect);
    // Vilarejo: o 1º quadro do chafariz (folha de 4x2) e o recorte do poço.
    addFrame(VILLAGE_ASSETS.fountain.key, VILLAGE_FOUNTAIN_FRAMES[0].name, VILLAGE_FOUNTAIN_FRAMES[0].rect);
    addFrame(WELL.textureKey, WELL.frameName, WELL.frameRect);
    // Ícone real da ferramenta "Mover" (item 3) — um dos 4 cantinhos em L do
    // cursor de seleção que o próprio jogo já usa (`TileCursor`), nunca
    // desenhado via código (CLAUDE.md regra 12).
    addFrame(INVENTORY_UI_KEY, SELECTION_CORNER_NAMES.topLeft, SELECTION_CORNER_RECTS.topLeft);
    // Props de decoração (aba "Decoração") — um frame por `MAP_PROPS`, mesma fonte usada pelo jogo de verdade (`systems/mapProps.ts`), nunca duplicada aqui.
    for (const prop of MAP_PROPS) addFrame(PROPS_TILESET_KEY, prop.id, prop.frame);
  }

  /** Paleta de Decoração (pedido explícito — "aba para colocar os asset props de decoração"): igual em TODO tipo de mapa, direto de `MAP_PROPS` — decoração ambiente não depende de bioma. */
  private buildDecorationPalette(): void {
    this.decorationPalette = MAP_PROPS.map((prop) => ({
      id: prop.id,
      label: prop.label,
      textureKey: PROPS_TILESET_KEY,
      frame: prop.id,
      tool: { kind: 'prop' as const, propId: prop.id },
    }));
  }

  /** Monta `this.entityPalette` a partir de `MAP_TYPE_CONFIGS[this.mapType]` — nunca hardcoded pra Fazenda (suporte universal, item 5). "Mover" e "Borracha" existem em todo tipo de mapa; cerca e "área" só aparecem quando o `mapType` os tem. */
  private buildEntityPalette(): void {
    const config = MAP_TYPE_CONFIGS[this.mapType];
    const palette: EntityPaletteEntry[] = [];

    palette.push({ id: 'move', label: 'Mover (Seleção)', textureKey: INVENTORY_UI_KEY, frame: SELECTION_CORNER_NAMES.topLeft, tool: { kind: 'move' } });

    for (const entity of config.entities) {
      const asset = STATIC_OBJECT_ASSET[entity.objectType];
      palette.push({ id: entity.objectType, label: entity.label, textureKey: asset.textureKey, frame: asset.frame, tool: { kind: 'object', objectType: entity.objectType } });
    }

    if (config.hasFences) {
      for (const variant of FENCE_VARIANTS) {
        palette.push({
          id: `fence:${variant.id}`,
          label: variant.label,
          textureKey: FENCE_TILESET_KEY,
          frame: variant.frame,
          flipX: variant.flipX,
          tool: { kind: 'fence', variantId: variant.id },
        });
      }
    }

    if (config.area) {
      palette.push({ id: 'area', label: config.area.label, textureKey: config.area.textureKey, frame: config.area.frame, tool: { kind: 'area' } });
    }

    // Bloco de Colisão (pedido explícito) — existe em TODO tipo de mapa,
    // não só quando o `mapType` tem uma "área": bloqueio estático não
    // depende de bioma. Ícone: retângulo vermelho (`swatchColor`), mesma
    // linguagem visual dos swatches de Cor de Fundo — não uma textura real,
    // porque não existe (nem faria sentido existir) um "asset" pra
    // representar "aqui não se pode andar".
    palette.push({ id: 'collision', label: 'Bloco de Colisão', swatchColor: 0xff0000, tool: { kind: 'collision' } });

    // Ícone real (o "X" vermelho já usado nos botões de fechar da UI do
    // jogo, ver `data/ui.ts`) — nunca desenhado via código (CLAUDE.md).
    palette.push({ id: 'eraser', label: 'Borracha', textureKey: CLOSE_BUTTON_SHEET_KEY, frame: CLOSE_X_ICON_FRAME.name, tool: { kind: 'eraser' } });

    this.entityPalette = palette;
  }

  /**
   * Monta a camada de chão a partir de `groundData` — semeada tile a tile
   * com o MESMO algoritmo que o jogo de verdade usa
   * (`systems/mapBuilder.buildGroundChunk`): se `this.mapData.ground` já
   * existe (rodada anterior do editor, colada de volta), usa esse valor
   * autorado; senão, gera proceduralmente. O zoneamento de "manchas de
   * terra" (`buildDirtZone`) só faz sentido pra Fazenda (usa
   * `farmlandArea`); nos outros tipos de mapa o chão procedural é só
   * variação de grama. Um `Tileset` por entrada de `GROUND_TILESETS` é
   * registrado na MESMA camada (múltiplos tilesets simultâneos), pra o
   * usuário poder pintar com qualquer um deles — e um `setTint` opcional
   * (`MAP_TYPE_CONFIGS[...].groundTint`) pré-visualiza o bioma.
   */
  private buildGroundLayer(): void {
    // Fazenda: manchas de terra pelos canteiros; Vilarejo: as ruas/praça de terra (`villageDirtZone`) — as duas só semeiam o chão INICIAL, o que o usuário pintar vira `ground` autorado.
    const dirtZone = this.mapType === 'farm' ? buildDirtZone(this.mapData as FarmMapData) : this.mapType === 'village' ? villageDirtZone : null;

    for (let row = 0; row < this.gridRows; row++) {
      const dataRow: number[] = [];
      for (let col = 0; col < this.gridCols; col++) {
        const authored = this.mapData.ground?.[row]?.[col];
        const gid = authored ?? (dirtZone?.has(col, row) ? pickDirtBlobTile(dirtZone, col, row) : pickGroundTileVariant(col, row));
        dataRow.push(gid);
      }
      this.groundData.push(dataRow);
    }

    this.rebuildGroundLayer();
  }

  /**
   * (Re)monta o `Tilemap`/`TilemapLayer` a partir de `this.groundData` (já
   * semeado por `buildGroundLayer`) e `this.groundTilesets` — separado de
   * `buildGroundLayer` pra poder ser chamado de novo depois de importar um
   * tileset novo em tempo real (`importTileset`, botão "Importar", pedido
   * explícito), sem re-semear `groundData` (o que duplicaria linhas). O
   * `Tilemap`/`TilemapLayer` antigos são destruídos primeiro — o Phaser não
   * permite adicionar um tileset a uma camada já criada.
   */
  private rebuildGroundLayer(): void {
    this.groundLayer?.destroy();
    this.groundTilemap?.destroy();

    const tilemap = this.make.tilemap({ data: this.groundData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tilesets = this.groundTilesets
      .map((ts) => tilemap.addTilesetImage(ts.textureKey, ts.textureKey, TILE_SIZE, TILE_SIZE, 0, 0, ts.firstGid))
      .filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);
    if (tilesets.length === 0) throw new Error('Não foi possível carregar nenhum tileset de chão.');

    this.groundTilemap = tilemap;
    this.groundLayer = this.addWorldObject(tilemap.createLayer(0, tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer);
    this.groundLayer.setScale(DISPLAY_SCALE);
    this.groundLayer.setDepth(-2);

    const tint = MAP_TYPE_CONFIGS[this.mapType].groundTint;
    if (tint !== undefined) this.groundLayer.setTint(tint);
  }

  /** Overlay de linhas de grid (pedido explícito — tecla G alterna) — puramente uma grade utilitária de alinhamento, não arte do mundo do jogo. Visível por padrão: é uma ferramenta de alinhamento, mais útil ligada do que desligada. */
  private buildGridOverlay(): void {
    this.gridOverlay = this.addWorldObject(this.add.grid(0, 0, this.gridCols * TILE_PX, this.gridRows * TILE_PX, TILE_PX, TILE_PX, 0x000000, 0, 0xffffff, 0.25));
    this.gridOverlay.setOrigin(0, 0);
    this.gridOverlay.setDepth(500);
  }

  /** Só visual, sem interação — a Casa não tem ferramenta própria neste editor, e só existe no mapa da Fazenda. */
  private renderHouseReference(map: FarmMapData): void {
    const { col0, row0 } = map.housePosition;
    // Mesmos ajustes pixel a pixel do jogo de verdade
    // (`systems/mapBuilder.buildPlayerHouse`: `ajusteX=-18, ajusteY=6`) —
    // sem eles, a Casa ficava alguns pixels fora do grid no preview do
    // editor (pedido explícito: "a casa... tem que caber dentro dos
    // quadradinhos corretamente, igual no mapa real do jogo").
    const house = this.addWorldObject(this.add.image(col0 * TILE_PX - 18, row0 * TILE_PX - 6, PLAYER_HOUSE_KEY));
    house.setOrigin(0, 0);
    house.setScale(DISPLAY_SCALE);
    house.setDepth(-1);
    house.setAlpha(0.85);
  }

  /** Popula as entidades reais do `mapType` atual — o editor nasce mostrando o mapa atual, nunca em branco. Um método `seedX` por tipo de mapa (cada `XMapData` tem campos próprios, sem um formato comum além de `cols/rows`). */
  private seedFromRealMap(): void {
    switch (this.mapType) {
      case 'farm':
        this.seedFarm(this.mapData as FarmMapData);
        break;
      case 'forest':
        this.seedForest(this.mapData as ForestMapData);
        break;
      case 'cave':
        this.seedCave(this.mapData as CaveMapData);
        break;
      case 'beach':
        this.seedBeach(this.mapData as BeachMapData);
        break;
      case 'quarry':
        this.seedQuarry(this.mapData as QuarryMapData);
        break;
      case 'village':
        this.seedVillage(this.mapData as VillageLayoutData);
        break;
    }

    // Blocos de Colisão (pedido explícito) — existem em TODO tipo de mapa
    // (`blockedArea` é um campo comum às 5 interfaces), semeados por último,
    // depois de todo o resto, já que independem de qual `mapType` é.
    for (const [col, row] of this.mapData.blockedArea ?? []) this.setCollisionAt(col, row, true);

    // Props de decoração ambiente (pedido explícito) — existem em TODO tipo
    // de mapa (`props` é um campo comum às 5 interfaces), semeados por
    // último pela mesma razão do `blockedArea` acima.
    for (const [col, row, propId] of this.mapData.props ?? []) this.setPropAt(col, row, propId);
  }

  /** A cerca usa EXATAMENTE a mesma regra de canto/borda/pulos (portão + célula ao lado + Caixa de Remessas) de `systems/mapBuilder.buildFarmlandFence`, pra nascer idêntica ao que o jogo já desenha. */
  private seedFarm(map: FarmMapData): void {
    for (const [col, row] of map.treePositions) this.setObjectAt(col, row, { type: 'tree' });
    for (const [col, row] of map.farmlandArea) this.setAreaAt(col, row, true);

    const layout = getFarmlandFenceLayout(map);
    this.seedFence(layout, map.shippingBinPosition);

    this.setObjectAt(map.shopPosition[0], map.shopPosition[1], { type: 'shop' });
    this.setObjectAt(map.shippingBinPosition[0], map.shippingBinPosition[1], { type: 'shippingBin' });
  }

  private seedFence(layout: FarmlandFenceLayout, shippingBinPosition: [number, number]): void {
    const skip = new Set<string>([`${layout.gate[0]},${layout.gate[1]}`, `${layout.gate[0] - 1},${layout.gate[1]}`, `${shippingBinPosition[0]},${shippingBinPosition[1]}`]);
    const place = (col: number, row: number, variantId: string): void => {
      if (skip.has(`${col},${row}`)) return;
      this.setObjectAt(col, row, { type: 'fence', fenceVariantId: variantId });
    };

    place(layout.col0, layout.row0, 'topLeft');
    place(layout.colEnd, layout.row0, 'topRight');
    place(layout.col0, layout.rowEnd, 'bottomLeft');
    place(layout.colEnd, layout.rowEnd, 'bottomRight');
    for (let col = layout.col0 + 1; col < layout.colEnd; col++) {
      place(col, layout.row0, 'horizontal');
      place(col, layout.rowEnd, 'horizontal');
    }
    for (let row = layout.row0 + 1; row < layout.rowEnd; row++) {
      place(layout.col0, row, 'vertical');
      place(layout.colEnd, row, 'vertical');
    }
  }

  private seedForest(map: ForestMapData): void {
    for (const [col, row] of map.pineTreePositions) this.setObjectAt(col, row, { type: 'tree' });
    for (const [col, row] of map.birchTreePositions) this.setObjectAt(col, row, { type: 'birchTree' });
    for (const [col, row] of map.rockPositions) this.setObjectAt(col, row, { type: 'rock' });
    this.seedAreaRect(map.lakeArea);
  }

  private seedCave(map: CaveMapData): void {
    this.setObjectAt(map.caveEntrancePosition[0], map.caveEntrancePosition[1], { type: 'caveEntrance' });
  }

  private seedBeach(map: BeachMapData): void {
    this.seedAreaRect(map.oceanArea);
    for (const [col, row] of map.rockPositions ?? []) this.setObjectAt(col, row, { type: 'rock' });
    for (const [col, row] of map.bigRockPositions ?? []) this.setObjectAt(col, row, { type: 'bigRock' });
  }

  private seedQuarry(map: QuarryMapData): void {
    for (const [col, row] of map.rockPositions) this.setObjectAt(col, row, { type: 'rock' });
    for (const [col, row] of map.bigRockPositions) this.setObjectAt(col, row, { type: 'bigRock' });
    for (const [col, row] of map.ironOrePositions) this.setObjectAt(col, row, { type: 'ironOre' });
    for (const [col, row] of map.coalOrePositions) this.setObjectAt(col, row, { type: 'coalOre' });
  }

  /** Casas, banca e chafariz (com o `role` das casas de moradores), o poço da praça e os pinheiros — tudo do `villageLayout`. */
  private seedVillage(map: VillageLayoutData): void {
    for (const structure of map.structures) {
      const type = VILLAGE_OBJECT_TYPES[structure.asset as VillageAssetId];
      if (!type) continue; // Id desconhecido (arquivo editado à mão): ignora.
      this.setObjectAt(structure.col, structure.row, { type, villageRole: structure.role });
    }
    this.setObjectAt(map.well.col, map.well.row, { type: 'villageWell' });
    for (const [col, row] of map.trees) this.setObjectAt(col, row, { type: 'tree' });
  }

  private seedAreaRect(area: RectArea): void {
    for (let row = area.row0; row < area.row0 + area.rows; row++) {
      for (let col = area.col0; col < area.col0 + area.cols; col++) {
        this.setAreaAt(col, row, true);
      }
    }
  }

  // --- Câmera ----------------------------------------------------------------

  /**
   * Duas câmeras (pedido explícito — ver doc da classe): `cameras.main`
   * cobre a tela INTEIRA (sem restrição de viewport — voltou a pedido
   * explícito, o layout docked de uma versão anterior limitava a navegação
   * da câmera) e sofre todo o pan/zoom, desenhando só o mundo; `uiCamera` é
   * uma segunda câmera também cobrindo a tela inteira, zoom sempre 1,
   * scroll sempre (0,0), que desenha só a `windowContainer`.
   */
  private setupCameras(): void {
    const cam = this.cameras.main;
    cam.setViewport(0, 0, this.scale.width, this.scale.height);
    cam.setBackgroundColor(this.backgroundColorHex);
    // Limita o pan aos limites físicos do grid (pedido explícito) — o
    // Phaser já recorta scrollX/scrollY sozinho pra dentro destes limites,
    // inclusive levando o zoom atual em conta, sem cálculo manual extra.
    cam.setBounds(0, 0, this.gridCols * TILE_PX, this.gridRows * TILE_PX);
    cam.centerOn((this.gridCols * TILE_PX) / 2, (this.gridRows * TILE_PX) / 2);
    cam.setZoom(1);

    // Sem `setBounds`/pan/zoom — fixa cobrindo a tela inteira, sempre no
    // mesmo lugar independente do que `cam` (mundo) estiver fazendo.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setName('ui');
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;

    // Zoom no scroll do mouse — ignorado se o ponteiro estiver sobre a
    // janela flutuante (que cuida do próprio scroll interno, ver
    // `ui/tilePickerPanel.ts`), onde quer que ela esteja agora
    // (`getWindowBounds` sempre lê a posição ATUAL do container).
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, deltaY: number) => {
      if (this.getWindowBounds().contains(pointer.x, pointer.y)) return;
      cam.zoom = Phaser.Math.Clamp(cam.zoom - deltaY * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
    });
  }

  /**
   * Todo objeto que representa o MUNDO (chão, grid, casa, objetos, área)
   * passa por aqui pra ser escondido da `uiCamera` — o inverso (main
   * ignorando a UI) é feito uma única vez em `setupWindow`, porque ignorar
   * um `Container` já esconde todos os filhos dele (presentes E futuros) da
   * câmera, sem precisar registrar cada um.
   */
  private addWorldObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.uiCamera.ignore(object);
    return object;
  }

  /** `this.add.image(...)` com frame OPCIONAL — algumas texturas (ex.: `WATER_KEY`, uma imagem única sem frame nomeado) precisam da variante de 3 argumentos; passar `frame: undefined` pra elas quebraria. */
  private addImage(x: number, y: number, textureKey: string, frame?: string | number): Phaser.GameObjects.Image {
    return frame !== undefined ? this.add.image(x, y, textureKey, frame) : this.add.image(x, y, textureKey);
  }

  private panCamera(delta: number): void {
    const distance = (CAMERA_PAN_SPEED * delta) / 1000;
    const cam = this.cameras.main;

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    if (left) cam.scrollX -= distance;
    if (right) cam.scrollX += distance;
    if (up) cam.scrollY -= distance;
    if (down) cam.scrollY += distance;
  }

  // --- Janela flutuante (abas Ground/Entities) --------------------------------

  /**
   * Retângulo ocupado pela janela AGORA, em coordenadas de tela —
   * recalculado a partir da posição atual de `windowContainer` (nunca uma
   * coordenada fixa), pra continuar certo depois de arrastada. Usado tanto
   * pra travar o zoom da câmera quanto pra saber se um clique/pintura foi
   * na janela ou no mapa (BLOQUEIO INTELIGENTE, pedido explícito).
   */
  private getWindowBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.windowContainer.x, this.windowContainer.y, PANEL_WIDTH, PANEL_HEIGHT);
  }

  private setupWindow(): void {
    this.windowContainer = this.add.container(this.scale.width - PANEL_WIDTH - 16, 16);
    this.windowContainer.setDepth(4000);
    // A `cameras.main` (mundo, com pan/zoom) nunca deve desenhar a janela —
    // ignorar o Container inteiro já esconde todos os filhos dele (mesmo os
    // que ainda serão adicionados depois, como o TilePickerPanel e a
    // paleta de entidades) dessa câmera, então basta esta chamada.
    this.cameras.main.ignore(this.windowContainer);

    this.setupPanelBackground();
    this.setupTitleBar();
    this.setupModeTabs();
    this.setupTilePicker();
    this.setupEntityPalette();
    this.setupDecorationPalette();
    this.setupBackgroundColorControl();
    this.applyModeVisibility();
  }

  /** Fundo sólido cobrindo o painel inteiro — pedido explícito de uma rodada anterior: sem isso, tiles/áreas transparentes da paleta pareceriam pretas/invisíveis. */
  private setupPanelBackground(): void {
    const background = this.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x161616, 1);
    background.setOrigin(0, 0);
    background.setStrokeStyle(1, 0x444444, 1);
    this.windowContainer.add(background);
  }

  /**
   * Barra de título arrastável (pedido explícito — o drag só pode ser
   * ativado por ELA, nunca pelo corpo do painel). Implementado com
   * rastreamento manual do ponteiro (não `scene.input.setDraggable`): a
   * barra é filha do `windowContainer` que queremos mover — se o Phaser
   * arrastasse a barra "de verdade", ele moveria só a posição LOCAL dela
   * dentro do container, não o container inteiro. Em vez disso, guardamos a
   * posição do ponteiro e do container no início do arraste e aplicamos o
   * mesmo delta ao container a cada `pointermove`, sempre travado dentro da
   * tela. Os botões do corpo (abas/paleta/swatches) têm suas PRÓPRIAS
   * hitzones com `event.stopPropagation()` e não escutam `pointermove`
   * global nenhum, então continuam recebendo clique normalmente — não há
   * como o arraste "vazar" pra eles.
   */
  private setupTitleBar(): void {
    const titleBar = this.add.rectangle(0, 0, PANEL_WIDTH, TITLE_BAR_HEIGHT, 0x111111, 1);
    titleBar.setOrigin(0, 0);
    titleBar.setStrokeStyle(1, 0x555555, 1);
    titleBar.setInteractive({ useHandCursor: true });
    this.windowContainer.add(titleBar);

    const titleText = this.add.text(CONTENT_PADDING, TITLE_BAR_HEIGHT / 2, `${MAP_TYPE_CONFIGS[this.mapType].label.toUpperCase()} (arraste)`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#cccccc',
    });
    titleText.setOrigin(0, 0.5);
    this.windowContainer.add(titleText);

    titleBar.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.isDraggingWindow = true;
      this.dragPointerStart = { x: pointer.x, y: pointer.y };
      this.dragWindowStart = { x: this.windowContainer.x, y: this.windowContainer.y };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingWindow) return;
      const dx = pointer.x - this.dragPointerStart.x;
      const dy = pointer.y - this.dragPointerStart.y;
      const x = Phaser.Math.Clamp(this.dragWindowStart.x + dx, 0, this.scale.width - PANEL_WIDTH);
      const y = Phaser.Math.Clamp(this.dragWindowStart.y + dy, 0, this.scale.height - PANEL_HEIGHT);
      this.windowContainer.setPosition(x, y);
    });

    this.input.on('pointerup', () => {
      this.isDraggingWindow = false;
    });
  }

  private setupModeTabs(): void {
    const tabWidth = PANEL_WIDTH / 3 - 2;
    const makeButton = (label: string, x: number, mode: EditorMode): { background: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } => {
      const width = tabWidth;
      const y = TITLE_BAR_HEIGHT;
      const background = this.add.rectangle(x, y, width, MODE_TABS_HEIGHT, 0x2c2c2c, 1);
      background.setOrigin(0, 0);
      background.setStrokeStyle(2, 0x555555, 1);
      background.setInteractive({ useHandCursor: true });
      background.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.setMode(mode);
      });
      this.windowContainer.add(background);

      const text = this.add.text(x + width / 2, y + MODE_TABS_HEIGHT / 2, label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      text.setOrigin(0.5, 0.5);
      this.windowContainer.add(text);

      return { background, text };
    };

    this.modeButtons = {
      ground: makeButton('GROUND', 0, 'ground'),
      entities: makeButton('ENTITIES', tabWidth + 2, 'entities'),
      decoration: makeButton('DECOR.', (tabWidth + 2) * 2, 'decoration'),
    };

    this.brushLabel = this.add.text(CONTENT_PADDING, TITLE_BAR_HEIGHT + MODE_TABS_HEIGHT + 2, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffd23f',
    });
    this.windowContainer.add(this.brushLabel);

    this.setupImportTilesetButton();

    this.updateModeButtonStyles();
  }

  /**
   * Botão "Importar" (Modo Ground, pedido explícito — "botão para importar
   * os novos tileset"): só visível em `applyModeVisibility` quando
   * `mode === 'ground'`. A lógica de arquivo/textura fica em
   * `importTileset`, não aqui — este método só desenha o botão.
   */
  private setupImportTilesetButton(): void {
    const width = 62;
    const height = 16;
    const x = PANEL_WIDTH - CONTENT_PADDING - width;
    const y = TITLE_BAR_HEIGHT + MODE_TABS_HEIGHT + 1;

    this.importButtonBg = this.add.rectangle(x, y, width, height, 0x3a5a3a, 1);
    this.importButtonBg.setOrigin(0, 0);
    this.importButtonBg.setStrokeStyle(1, 0x6fae6f, 1);
    this.importButtonBg.setInteractive({ useHandCursor: true });
    this.importButtonBg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.importTileset();
    });
    this.windowContainer.add(this.importButtonBg);

    this.importButtonText = this.add.text(x + width / 2, y + height / 2, '+ Importar', {
      fontFamily: 'monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#d8ffd8',
    });
    this.importButtonText.setOrigin(0.5, 0.5);
    this.windowContainer.add(this.importButtonText);
  }

  /**
   * Importa um tileset novo (pedido explícito — extensibilidade sem mexer
   * em código): abre o seletor de arquivo nativo do navegador, carrega a
   * imagem escolhida na hora (`textures.addBase64`, ver
   * https://docs.phaser.io — "seja pra escutar os eventos antes de usar a
   * textura") e adiciona uma aba nova no `TilePickerPanel`, já pintável.
   *
   * ESCOPO (decisão explícita do usuário): só nesta SESSÃO do editor — não
   * grava nada em disco (um app cliente-only não consegue, sem um backend
   * dedicado só pra isso). Pra virar permanente no jogo de verdade, baixa
   * também um arquivo de texto com o snippet EXATO pra colar em
   * `systems/groundTilesets.ts` + o `load.image` correspondente, o usuário
   * salvando a imagem original em `assets/` por conta própria — mesmo
   * espírito do exportador de mapas (tecla P), sem inventar persistência
   * que este projeto (Vite + client puro) não tem como oferecer de verdade.
   */
  private importTileset(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const probe = new Image();
        probe.onload = () => this.onTilesetImageReady(file.name, dataUrl, probe.naturalWidth, probe.naturalHeight);
        probe.onerror = () => console.warn(`MapEditorScene: não foi possível ler "${file.name}" como imagem.`);
        probe.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    input.click();
  }

  private onTilesetImageReady(fileName: string, dataUrl: string, width: number, height: number): void {
    const columns = Math.floor(width / TILE_SIZE);
    const rows = Math.floor(height / TILE_SIZE);
    if (columns < 1 || rows < 1) {
      console.warn(`MapEditorScene: "${fileName}" (${width}x${height}px) é menor que um tile (${TILE_SIZE}px) — importação cancelada.`);
      return;
    }

    const label = fileName.replace(/\.[^./]+$/, '').trim() || 'Importado';
    // Id legível (slug do nome do arquivo) em vez de um timestamp opaco —
    // pedido explícito ("deixa essa etapa mais automática"): é o mesmo id
    // que vai pro snippet colado em `groundTilesets.ts`, então vale a pena
    // já nascer memorável. `-2`/`-3`... só se colidir com um id já usado
    // nesta sessão (ex.: importar o mesmo arquivo duas vezes).
    const baseSlug = `imported-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tileset'}`;
    let textureKey = baseSlug;
    let suffix = 2;
    while (this.groundTilesets.some((ts) => ts.id === textureKey)) {
      textureKey = `${baseSlug}-${suffix}`;
      suffix++;
    }
    // Caminho ONDE o usuário vai salvar o arquivo (pedido explícito no passo
    // 1 do snippet) — mesma convenção de `data/tiles.ts` (relativo a
    // `assets/`, sem barra inicial). Já vai dentro do `GroundTilesetConfig`
    // gerado: uma vez colado em `groundTilesets.ts`, `preloadGroundTilesets`
    // carrega sozinho, sem NENHUM `load.image` escrito à mão.
    const path = `Tileset/${fileName}`;
    // Mesmo critério dos tilesets fixos (ver `systems/groundTilesets.ts`): um `firstGid` acima do maior já usado, arredondado pra uma faixa redonda de segurança.
    const lastGidEnd = this.groundTilesets.reduce((max, ts) => Math.max(max, ts.firstGid + ts.columns * ts.rows), 0);
    const firstGid = Math.ceil((lastGidEnd + 1) / 1000) * 1000;

    this.textures.once(Phaser.Textures.Events.LOAD, (loadedKey: string) => {
      if (loadedKey !== textureKey) return; // Outra textura base64 carregando ao mesmo tempo — não é a nossa.

      const config: GroundTilesetConfig = { id: textureKey, label, textureKey, path, tileSize: TILE_SIZE, columns, rows, firstGid };
      this.tilePicker.addTileset(config); // Já cresce `this.groundTilesets` (mesma referência, ver doc do campo).
      this.rebuildGroundLayer();
      this.tilePicker.setSelected(firstGid);

      const snippet = [
        `// Tileset importado: "${fileName}" (${columns}x${rows} tiles de ${TILE_SIZE}px) — só nesta sessão do editor.`,
        '// Pra virar permanente no jogo de verdade, só 2 passos:',
        `// 1) Salve a imagem original em assets/${path}`,
        '// 2) Adicione esta entrada dentro do array GROUND_TILESETS, em systems/groundTilesets.ts',
        '//    (preloadGroundTilesets carrega sozinho a partir daqui — nenhum load.image extra em nenhuma cena):',
        `{ id: '${textureKey}', label: '${label}', textureKey: '${textureKey}', path: '${path}', tileSize: TILE_SIZE, columns: ${columns}, rows: ${rows}, firstGid: ${firstGid} },`,
      ].join('\n');
      this.downloadTextFile(`${textureKey}-snippet.txt`, snippet);
    });
    this.textures.addBase64(textureKey, dataUrl);
  }

  private setMode(mode: EditorMode): void {
    if (this.mode === mode) return;
    // Trocar de aba enquanto "segurando" algo com a ferramenta Mover
    // devolveria o objeto pro limbo (nem na posição antiga, nem numa nova)
    // — cancela automaticamente, devolvendo à posição original.
    if (this.heldObject) this.cancelMove();
    this.mode = mode;
    this.updateModeButtonStyles();
    this.applyModeVisibility();
  }

  private updateModeButtonStyles(): void {
    for (const key of Object.keys(this.modeButtons) as EditorMode[]) {
      const isActive = key === this.mode;
      this.modeButtons[key].background.setFillStyle(isActive ? 0x4a7a4a : 0x2c2c2c, 1);
    }
  }

  private applyModeVisibility(): void {
    const groundActive = this.mode === 'ground';
    const entitiesActive = this.mode === 'entities';
    const decorationActive = this.mode === 'decoration';
    this.tilePicker.setVisible(groundActive);
    this.importButtonBg.setVisible(groundActive);
    this.importButtonText.setVisible(groundActive);
    for (const obj of this.entityPaletteObjects) (obj as Phaser.GameObjects.Image).setVisible(entitiesActive);
    for (const obj of this.decorationPaletteObjects) (obj as Phaser.GameObjects.Image).setVisible(decorationActive);
    if (decorationActive) this.applyDecorationScroll();

    this.brushLabel.setText(groundActive ? `Pincel: GID #${this.selectedGroundGid}` : `Pincel: ${this.describeEntityTool(this.selectedEntityTool)}`);
  }

  private describeEntityTool(tool: EntityTool): string {
    if (tool.kind === 'fence') return this.entityPalette.find((e) => e.id === `fence:${tool.variantId}`)?.label ?? 'Cerca';
    if (tool.kind === 'object') return this.entityPalette.find((e) => e.id === tool.objectType)?.label ?? tool.objectType;
    if (tool.kind === 'area') return this.entityPalette.find((e) => e.id === 'area')?.label ?? 'Área';
    if (tool.kind === 'move') return 'Mover (Seleção)';
    if (tool.kind === 'collision') return 'Bloco de Colisão';
    if (tool.kind === 'prop') return this.decorationPalette.find((e) => e.id === tool.propId)?.label ?? 'Decoração';
    return 'Borracha';
  }

  private setupTilePicker(): void {
    const contentHeight = PANEL_HEIGHT - CONTENT_TOP - CONTENT_PADDING - BG_COLOR_SECTION_HEIGHT;
    this.tilePicker = new TilePickerPanel(this, {
      container: this.windowContainer,
      x: CONTENT_PADDING,
      y: CONTENT_TOP,
      width: PANEL_WIDTH - CONTENT_PADDING * 2,
      height: contentHeight,
      displayTileSize: PICKER_TILE_DISPLAY_SIZE,
      tilesets: this.groundTilesets,
      onSelect: (gid) => {
        this.selectedGroundGid = gid;
        this.applyModeVisibility();
      },
    });
    this.tilePicker.setSelected(GROUND_ERASE_GID);
  }

  private setupEntityPalette(): void {
    const rowHeight = 32;
    const iconX = CONTENT_PADDING + 16;
    const targetIconPx = 22;
    const contentHeight = PANEL_HEIGHT - CONTENT_TOP - CONTENT_PADDING - BG_COLOR_SECTION_HEIGHT;

    // Fundo do painel (Modo Entities) — mesma linguagem visual do
    // `TilePickerPanel`, atrás dos ícones/labels/hitzones.
    const background = this.add.rectangle(0, CONTENT_TOP, PANEL_WIDTH, contentHeight, 0x1b1b1b, 0.96);
    background.setOrigin(0, 0);
    background.setStrokeStyle(2, 0x555555, 1);
    this.windowContainer.add(background);
    this.entityPaletteObjects.push(background as unknown as Phaser.GameObjects.Image);

    this.entityPalette.forEach((entry, index) => {
      const y = CONTENT_TOP + 14 + index * rowHeight;

      let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (entry.swatchColor !== undefined) {
        // Bloco de Colisão: retângulo colorido em vez de textura (ver doc de `EntityPaletteEntry.swatchColor`).
        icon = this.add.rectangle(iconX, y, targetIconPx, targetIconPx, entry.swatchColor, 0.6);
        icon.setStrokeStyle(1, entry.swatchColor, 1);
      } else {
        icon = this.addImage(iconX, y, entry.textureKey!, entry.frame);
        icon.setScale(computeFitScale(icon, targetIconPx));
        if (entry.flipX) icon.setFlipX(true);
      }
      this.windowContainer.add(icon);
      this.entityPaletteIcons.set(entry.id, icon);
      this.entityPaletteObjects.push(icon as unknown as Phaser.GameObjects.Image);

      const label = this.add.text(iconX + 20, y, entry.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      label.setOrigin(0, 0.5);
      this.windowContainer.add(label);
      this.entityPaletteObjects.push(label as unknown as Phaser.GameObjects.Image);

      const hitZone = this.add.zone(0, y, PANEL_WIDTH, rowHeight);
      hitZone.setOrigin(0, 0.5);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectEntityTool(entry.tool, entry.id);
      });
      this.windowContainer.add(hitZone);
      this.entityPaletteObjects.push(hitZone as unknown as Phaser.GameObjects.Image);
    });

    // "Mover" é sempre a primeira entrada da paleta (ver `buildEntityPalette`) — ferramenta inicial mais segura (não pinta nada por engano).
    const initialEntry = this.entityPalette[0];
    this.selectEntityTool(initialEntry.tool, initialEntry.id);
  }

  /**
   * Paleta de Decoração (pedido explícito) — mesmo layout de linha (ícone +
   * label + hitzone) de `setupEntityPalette`, mas com ROLAGEM: 26 props não
   * cabem nos ~13 slots visíveis do painel, e diferente do `TilePickerPanel`
   * (uma imagem única recortável via `setCrop`), aqui cada linha é um grupo
   * de 3 objetos (ícone/label/hitzone) — a técnica de recorte por `Container`
   * não é opção no Phaser 4/WebGL (ver doc de `TilePickerPanel`), então a
   * rolagem aqui simplesmente ESCONDE (`setVisible(false)`) as linhas fora
   * da faixa visível a cada passo de scroll (`applyDecorationScroll`), em vez
   * de recortar/mascarar de verdade.
   */
  private setupDecorationPalette(): void {
    const rowHeight = 32;
    const iconX = CONTENT_PADDING + 16;
    const targetIconPx = 22;
    const contentHeight = PANEL_HEIGHT - CONTENT_TOP - CONTENT_PADDING - BG_COLOR_SECTION_HEIGHT;

    const background = this.add.rectangle(0, CONTENT_TOP, PANEL_WIDTH, contentHeight, 0x1b1b1b, 0.96);
    background.setOrigin(0, 0);
    background.setStrokeStyle(2, 0x555555, 1);
    this.windowContainer.add(background);
    this.decorationPaletteObjects.push(background as unknown as Phaser.GameObjects.Image);

    this.decorationPalette.forEach((entry, index) => {
      const baseY = 14 + index * rowHeight;

      const icon = this.addImage(iconX, CONTENT_TOP + baseY, entry.textureKey!, entry.frame);
      icon.setScale(computeFitScale(icon, targetIconPx));
      this.windowContainer.add(icon);
      this.decorationPaletteIcons.set(entry.id, icon);
      this.decorationPaletteObjects.push(icon as unknown as Phaser.GameObjects.Image);

      const label = this.add.text(iconX + 20, CONTENT_TOP + baseY, entry.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      label.setOrigin(0, 0.5);
      this.windowContainer.add(label);
      this.decorationPaletteObjects.push(label as unknown as Phaser.GameObjects.Image);

      const hitZone = this.add.zone(0, CONTENT_TOP + baseY, PANEL_WIDTH, rowHeight);
      hitZone.setOrigin(0, 0.5);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectEntityTool(entry.tool, entry.id);
      });
      this.windowContainer.add(hitZone);
      this.decorationPaletteObjects.push(hitZone as unknown as Phaser.GameObjects.Image);

      this.decorationRows.push({ icon, label, hitZone, baseY });
    });

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, deltaY: number) => {
      if (this.mode !== 'decoration') return;
      if (!this.getWindowBounds().contains(pointer.x, pointer.y)) return;
      const contentHeightNow = PANEL_HEIGHT - CONTENT_TOP - CONTENT_PADDING - BG_COLOR_SECTION_HEIGHT;
      const listHeight = 14 + this.decorationPalette.length * rowHeight;
      const maxScroll = Math.max(0, listHeight - contentHeightNow);
      this.decorationScrollY = Phaser.Math.Clamp(this.decorationScrollY + deltaY, 0, maxScroll);
      this.applyDecorationScroll();
    });
  }

  /** Reposiciona cada linha da paleta de Decoração a partir de `decorationScrollY` e esconde as que ficarem fora da faixa visível do painel (ver doc de `setupDecorationPalette`). */
  private applyDecorationScroll(): void {
    const contentHeight = PANEL_HEIGHT - CONTENT_TOP - CONTENT_PADDING - BG_COLOR_SECTION_HEIGHT;
    for (const row of this.decorationRows) {
      const y = CONTENT_TOP + row.baseY - this.decorationScrollY;
      const visible = y >= CONTENT_TOP && y <= CONTENT_TOP + contentHeight;
      row.icon.setPosition(row.icon.x, y);
      row.label.setPosition(row.label.x, y);
      row.hitZone.setPosition(row.hitZone.x, y);
      row.icon.setVisible(visible);
      row.label.setVisible(visible);
      row.hitZone.setVisible(visible);
      if (visible) row.hitZone.setInteractive({ useHandCursor: true });
      else row.hitZone.disableInteractive();
    }
  }

  private selectEntityTool(tool: EntityTool, paletteId: string): void {
    if (this.heldObject && tool.kind !== 'move') this.cancelMove();
    this.selectedEntityTool = tool;
    for (const [entryId, icon] of this.entityPaletteIcons) {
      const isSelected = entryId === paletteId;
      icon.setAlpha(isSelected ? 1 : 0.55);
      // `Rectangle` (ícone do Bloco de Colisão) não tem `setTint` — só as texturas reais têm.
      if ('setTint' in icon) icon.setTint(isSelected ? 0xffffff : 0xaaaaaa);
    }
    for (const [entryId, icon] of this.decorationPaletteIcons) {
      const isSelected = entryId === paletteId;
      icon.setAlpha(isSelected ? 1 : 0.55);
      icon.setTint(isSelected ? 0xffffff : 0xaaaaaa);
    }
    this.applyModeVisibility();
  }

  /** Controle de Cor de Fundo (pedido explícito, item 4) — swatches pré-definidos fixos no rodapé do painel, sempre visíveis (não some ao trocar de aba Ground/Entities). */
  private setupBackgroundColorControl(): void {
    const sectionY = PANEL_HEIGHT - BG_COLOR_SECTION_HEIGHT;

    const sectionBg = this.add.rectangle(0, sectionY, PANEL_WIDTH, BG_COLOR_SECTION_HEIGHT, 0x151515, 1);
    sectionBg.setOrigin(0, 0);
    sectionBg.setStrokeStyle(1, 0x444444, 1);
    this.windowContainer.add(sectionBg);

    const label = this.add.text(CONTENT_PADDING, sectionY + 4, 'Cor de Fundo:', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#aaaaaa',
    });
    this.windowContainer.add(label);

    this.backgroundSwatchHighlight = this.add.graphics();
    this.windowContainer.add(this.backgroundSwatchHighlight);

    const swatchSize = 20;
    const gap = 6;
    const swatchY = sectionY + 20;

    this.backgroundSwatches = BACKGROUND_COLOR_PRESETS.map((preset, index) => {
      const x = CONTENT_PADDING + index * (swatchSize + gap);
      const colorNum = Phaser.Display.Color.HexStringToColor(preset.hex).color;
      const swatch = this.add.rectangle(x, swatchY, swatchSize, swatchSize, colorNum, 1);
      swatch.setOrigin(0, 0);
      swatch.setStrokeStyle(1, 0x888888, 1);
      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.setBackgroundColor(preset.hex);
      });
      this.windowContainer.add(swatch);
      return { hex: preset.hex, shape: swatch };
    });

    this.updateBackgroundSwatchHighlight();
  }

  private setBackgroundColor(hex: string): void {
    this.backgroundColorHex = hex;
    this.cameras.main.setBackgroundColor(hex);
    this.updateBackgroundSwatchHighlight();
  }

  private updateBackgroundSwatchHighlight(): void {
    this.backgroundSwatchHighlight.clear();
    const entry = this.backgroundSwatches.find((s) => s.hex === this.backgroundColorHex);
    if (!entry) return;
    const { shape } = entry;
    this.backgroundSwatchHighlight.lineStyle(2, 0xffd23f, 1);
    this.backgroundSwatchHighlight.strokeRect(shape.x - 2, shape.y - 2, shape.width + 4, shape.height + 4);
  }

  // --- Pintura ---------------------------------------------------------------

  private setupPaintInput(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // BLOQUEIO INTELIGENTE (pedido explícito): aborta qualquer interação
      // no mapa se o ponteiro estiver dentro do retângulo ATUAL da janela
      // flutuante — não uma faixa fixa, já que ela pode ter sido arrastada.
      if (this.getWindowBounds().contains(pointer.x, pointer.y)) return;

      // Conta-gotas (item 2) — tem prioridade sobre pintura/Mover: nunca
      // pinta nem pega/solta nada no mesmo clique que usou o gesto.
      if (this.tryEyedrop(pointer)) return;

      if (this.mode === 'entities' && this.selectedEntityTool.kind === 'move') {
        this.handleMoveClick(pointer);
        return; // Mover é um clique discreto — nunca entra no fluxo de pintura contínua abaixo.
      }

      if (pointer.leftButtonDown()) this.isPaintingLeft = true;
      if (pointer.rightButtonDown()) this.isPaintingRight = true;
      this.lastPaintedKey = null;
      this.applyPointerAction(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.heldObject) this.updateMoveGhost(pointer);
      if (this.isPaintingLeft || this.isPaintingRight) this.applyPointerAction(pointer);
    });

    this.input.on('pointerup', () => {
      this.isPaintingLeft = false;
      this.isPaintingRight = false;
      this.lastPaintedKey = null;
    });
  }

  /**
   * Conta-gotas (pedido explícito, item 2): clique do meio OU Alt+clique
   * esquerdo. Retorna `true` sempre que o GESTO for reconhecido (mesmo sem
   * tile embaixo do cursor, ou fora dos limites do mapa) — quem chama usa
   * isso pra nunca deixar o mesmo clique também pintar/mover algo.
   */
  private tryEyedrop(pointer: Phaser.Input.Pointer): boolean {
    const nativeEvent = pointer.event as MouseEvent;
    const isMiddleClick = pointer.button === 1;
    const isAltClick = pointer.leftButtonDown() && nativeEvent?.altKey === true;
    if (!isMiddleClick && !isAltClick) return false;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(worldPoint.x / TILE_PX);
    const row = Math.floor(worldPoint.y / TILE_PX);
    if (this.inBounds(col, row)) {
      const tile = this.groundLayer.getTileAt(col, row);
      if (tile) {
        this.setMode('ground');
        this.tilePicker.setSelected(tile.index);
      }
    }
    return true;
  }

  private applyPointerAction(pointer: Phaser.Input.Pointer): void {
    if (this.getWindowBounds().contains(pointer.x, pointer.y)) return; // clique na janela flutuante, não no mapa.
    // NUNCA `pointer.worldX/worldY`: com duas câmeras na cena, esse valor
    // fica ambíguo. A conversão pra coordenadas de mundo do MAPA tem que
    // ser feita explicitamente contra `cameras.main` (a única com pan/zoom).
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(worldPoint.x / TILE_PX);
    const row = Math.floor(worldPoint.y / TILE_PX);
    if (!this.inBounds(col, row)) return;

    const key = `${col},${row}`;
    if (key === this.lastPaintedKey) return;
    this.lastPaintedKey = key;

    if (this.mode === 'ground') {
      if (this.isPaintingLeft) this.paintGroundAt(col, row, this.selectedGroundGid);
      else if (this.isPaintingRight) this.paintGroundAt(col, row, GROUND_ERASE_GID);
    } else {
      // Botão direito SEMPRE apaga (pedido explícito), além da "Borracha"
      // dedicada selecionável com o botão esquerdo (mesmo pedido, "ou").
      if (this.isPaintingRight) this.eraseEntityAt(col, row);
      else if (this.isPaintingLeft) this.paintEntityAt(col, row);
    }
  }

  private paintGroundAt(col: number, row: number, gid: number): void {
    this.groundData[row][col] = gid;
    this.groundLayer.putTileAt(gid, col, row);
  }

  private paintEntityAt(col: number, row: number): void {
    const tool = this.selectedEntityTool;
    if (tool.kind === 'eraser') this.eraseEntityAt(col, row);
    else if (tool.kind === 'area') this.setAreaAt(col, row, true);
    else if (tool.kind === 'collision') this.setCollisionAt(col, row, true);
    else if (tool.kind === 'fence') this.setObjectAt(col, row, { type: 'fence', fenceVariantId: tool.variantId });
    else if (tool.kind === 'object') this.setObjectAt(col, row, { type: tool.objectType });
    else if (tool.kind === 'prop') this.setPropAt(col, row, tool.propId);
    // 'move' nunca chega aqui — tratado à parte em `handleMoveClick`.
  }

  private eraseEntityAt(col: number, row: number): void {
    this.clearObjectAt(col, row);
    this.setAreaAt(col, row, false);
    this.setCollisionAt(col, row, false);
    this.clearPropAt(col, row);
  }

  /** Visual de um `PlacedObject` numa célula — usado tanto pra colocar de verdade (`setObjectAt`) quanto pro "fantasma" da ferramenta Mover (`spawnMoveGhost`), pra nunca duplicar a lógica de qual frame/flip cada tipo usa. */
  private createObjectView(object: PlacedObject, col: number, row: number): Phaser.GameObjects.Image {
    if (object.type === 'fence') {
      const x = col * TILE_PX + TILE_PX / 2;
      const y = row * TILE_PX + TILE_PX / 2;
      const variant = FENCE_VARIANTS.find((v) => v.id === object.fenceVariantId) ?? FENCE_VARIANTS[0];
      const view = this.addWorldObject(this.add.image(x, y, FENCE_TILESET_KEY, variant.frame));
      view.setFlipX(variant.flipX);
      return view;
    }

    // Mesmo deslocamento/origem que o jogo de verdade usa pra cada asset
    // (ver doc de `StaticAssetDef`) — não mais um centro genérico, pra
    // caber no quadradinho exatamente como no mapa real.
    const asset = STATIC_OBJECT_ASSET[object.type];
    const x = col * TILE_PX + asset.offsetX;
    const y = row * TILE_PX + asset.offsetY;
    const view = this.addWorldObject(this.addImage(x, y, asset.textureKey, asset.frame));
    view.setOrigin(asset.originX, asset.originY);
    return view;
  }

  private setObjectAt(col: number, row: number, object: PlacedObject): void {
    const key = `${col},${row}`;

    // Objetos "singleton" pro `mapType` atual (loja/caixa de remessas na
    // Fazenda, entrada da caverna na Caverna): só uma célula por vez, já
    // que a interface do mapa guarda posição única, não lista.
    if (this.singletonTypes.has(object.type)) {
      for (const [existingKey, existing] of this.objects) {
        if (existing.type === object.type && existingKey !== key) {
          this.objects.delete(existingKey);
          this.objectViews.get(existingKey)?.destroy();
          this.objectViews.delete(existingKey);
        }
      }
    }

    this.objectViews.get(key)?.destroy();
    this.objects.set(key, object);

    const view = this.createObjectView(object, col, row);
    const asset = object.type === 'fence' ? undefined : STATIC_OBJECT_ASSET[object.type];
    // Objetos maiores que 1 tile (Loja) são só um preview centralizado na
    // célula — o editor não simula footprint/colisão (pedido explícito do
    // usuário), então não há necessidade de recortar ou reescalar por tipo,
    // fora do `scaleMultiplier` de `bigRock` (mesmo asset de `rock`, maior).
    view.setScale(DISPLAY_SCALE * (asset?.scaleMultiplier ?? 1));
    view.setDepth(1);
    this.objectViews.set(key, view);
  }

  private clearObjectAt(col: number, row: number): void {
    const key = `${col},${row}`;
    if (!this.objects.has(key)) return;
    this.objects.delete(key);
    this.objectViews.get(key)?.destroy();
    this.objectViews.delete(key);
  }

  private setAreaAt(col: number, row: number, on: boolean): void {
    const areaConfig = MAP_TYPE_CONFIGS[this.mapType].area;
    if (!areaConfig) return; // Caverna/Pedreira não têm área pintável.

    const key = `${col},${row}`;

    if (on) {
      if (this.areaCells.has(key)) return;
      this.areaCells.add(key);
      const x = col * TILE_PX + TILE_PX / 2;
      const y = row * TILE_PX + TILE_PX / 2;
      const view = this.addWorldObject(this.addImage(x, y, areaConfig.textureKey, areaConfig.frame));
      view.setScale(DISPLAY_SCALE);
      view.setDepth(0);
      this.areaViews.set(key, view);
    } else {
      if (!this.areaCells.has(key)) return;
      this.areaCells.delete(key);
      this.areaViews.get(key)?.destroy();
      this.areaViews.delete(key);
    }
  }

  /**
   * "Bloco de Colisão" (pedido explícito) — célula bloqueada mesmo sem
   * nenhum objeto visível ali (ex.: reservar espaço pra uma construção
   * futura). O retângulo vermelho semi-transparente é só FEEDBACK do
   * editor, não um asset novo — mesmo critério já usado pro grid de
   * alinhamento (`buildGridOverlay`, `Phaser.GameObjects.Grid`), uma
   * ferramenta de nível/dev-tool, não "arte" do mundo do jogo (CLAUDE.md
   * regra 12). Independente de `objects`/`areaCells`: um bloco de colisão
   * pode coexistir com uma entidade ou terra arável na mesma célula.
   */
  private setCollisionAt(col: number, row: number, on: boolean): void {
    const key = `${col},${row}`;

    if (on) {
      if (this.collisionCells.has(key)) return;
      this.collisionCells.add(key);
      const view = this.addWorldObject(this.add.rectangle(col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX, 0xff0000, 0.4));
      view.setOrigin(0, 0);
      view.setStrokeStyle(2, 0xff0000, 0.9);
      view.setDepth(3);
      this.collisionViews.set(key, view);
    } else {
      if (!this.collisionCells.has(key)) return;
      this.collisionCells.delete(key);
      this.collisionViews.get(key)?.destroy();
      this.collisionViews.delete(key);
    }
  }

  /**
   * Prop de decoração ambiente (aba "Decoração", pedido explícito) — igual
   * ao `GROUND_ANCHORED_OFFSET` usado pelas entidades reais (embaixo-centro
   * da célula), mas SEM colisão nenhuma (decisão explícita do usuário) e sem
   * `singletonTypes`/footprint: um prop por célula, repintar substitui.
   */
  private setPropAt(col: number, row: number, propId: string): void {
    const key = `${col},${row}`;
    this.decorationViews.get(key)?.destroy();
    this.decorationCells.set(key, propId);

    const x = col * TILE_PX + TILE_PX / 2;
    const y = row * TILE_PX + TILE_PX;
    const view = this.addWorldObject(this.add.image(x, y, PROPS_TILESET_KEY, propId));
    view.setOrigin(0.5, 1);
    view.setScale(DISPLAY_SCALE);
    view.setDepth(1);
    this.decorationViews.set(key, view);
  }

  private clearPropAt(col: number, row: number): void {
    const key = `${col},${row}`;
    if (!this.decorationCells.has(key)) return;
    this.decorationCells.delete(key);
    this.decorationViews.get(key)?.destroy();
    this.decorationViews.delete(key);
  }

  // --- Ferramenta "Mover" (pedido explícito, item 3) --------------------------

  private handleMoveClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(worldPoint.x / TILE_PX);
    const row = Math.floor(worldPoint.y / TILE_PX);

    // Botão direito enquanto segurando algo cancela (devolve à posição
    // original) em vez de tentar reposicionar ali.
    if (pointer.rightButtonDown() && this.heldObject) {
      this.cancelMove();
      return;
    }
    if (!this.inBounds(col, row)) return;

    if (!this.heldObject) {
      const key = `${col},${row}`;
      const existing = this.objects.get(key);
      if (!existing) return; // nada pra pegar nesta célula.
      this.clearObjectAt(col, row);
      this.heldObject = { object: existing, originalCol: col, originalRow: row };
      this.spawnMoveGhost(existing, col, row);
    } else {
      this.setObjectAt(col, row, this.heldObject.object);
      this.destroyMoveGhost();
      this.heldObject = null;
    }
  }

  /** Fantasma grudado no cursor (pedido explícito — "grudando no cursor como ghost") — sempre encaixado na célula que o cursor está sobrevoando, não pixel a pixel: mostra exatamente onde o objeto vai cair no próximo clique. */
  private updateMoveGhost(pointer: Phaser.Input.Pointer): void {
    if (!this.moveGhost) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Phaser.Math.Clamp(Math.floor(worldPoint.x / TILE_PX), 0, this.gridCols - 1);
    const row = Phaser.Math.Clamp(Math.floor(worldPoint.y / TILE_PX), 0, this.gridRows - 1);
    this.moveGhost.setPosition(col * TILE_PX + TILE_PX / 2, row * TILE_PX + TILE_PX / 2);
  }

  private spawnMoveGhost(object: PlacedObject, col: number, row: number): void {
    const ghost = this.createObjectView(object, col, row);
    const asset = object.type === 'fence' ? undefined : STATIC_OBJECT_ASSET[object.type];
    ghost.setScale(DISPLAY_SCALE * (asset?.scaleMultiplier ?? 1));
    ghost.setAlpha(0.6);
    ghost.setDepth(2000); // acima de tudo, pra sempre ficar visível seguindo o cursor.
    this.moveGhost = ghost;
  }

  private destroyMoveGhost(): void {
    this.moveGhost?.destroy();
    this.moveGhost = null;
  }

  private cancelMove(): void {
    if (!this.heldObject) return;
    this.setObjectAt(this.heldObject.originalCol, this.heldObject.originalRow, this.heldObject.object);
    this.destroyMoveGhost();
    this.heldObject = null;
  }

  // --- Atalhos e exportação ----------------------------------------------------

  private setupShortcuts(): void {
    this.input.keyboard!.on('keydown-P', () => this.exportMap());
    this.input.keyboard!.on('keydown-G', () => this.gridOverlay.setVisible(!this.gridOverlay.visible));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.heldObject) this.cancelMove(); // nunca sai perdendo um objeto "na mão".
      this.closeEditor();
    });
  }

  /**
   * Sai do editor e volta pra cena EXATA que o abriu (suporte universal —
   * F2 em qualquer cena, ver `systems/mapEditorLauncher.ts`), não sempre a
   * Fazenda. `scene.run`: retoma se só pausada (caso normal), acorda se
   * dormindo, ou inicia do zero se nunca chegou a rodar (ex.: editor era a
   * própria cena de boot do `gameConfig`) — cobre os três casos sem
   * precisar checar o estado manualmente. A `UIScene` precisa ser acordada
   * AQUI (não mais de graça via `MainScene.create()`, já que a cena de
   * origem agora é RETOMADA, não recriada do zero).
   */
  private closeEditor(): void {
    this.scene.run(this.returnSceneKey);
    if (this.scene.manager.isSleeping(UI_SCENE_KEY)) this.scene.wake(UI_SCENE_KEY);
    this.scene.stop();
  }

  /**
   * Um `exportX` por tipo de mapa (pedido explícito, item 5 — "formatar a
   * string de acordo com a interface correta") — cada um lê
   * `this.objects`/`this.areaCells` e monta exatamente os campos da
   * interface real daquele `mapType`, já como o ARQUIVO `.ts` completo (ver
   * `systems/mapEditorExport.ts`). Baixa direto no navegador (pedido
   * explícito — nada de copiar do console): um clique em cima do arquivo
   * baixado já substitui o `data/maps/*.ts` correspondente.
   */
  private exportMap(): void {
    const text = (() => {
      switch (this.mapType) {
        case 'farm':
          return this.exportFarm();
        case 'forest':
          return this.exportForest();
        case 'cave':
          return this.exportCave();
        case 'beach':
          return this.exportBeach();
        case 'quarry':
          return this.exportQuarry();
        case 'village':
          return this.exportVillage();
      }
    })();

    this.downloadTextFile(MAP_TYPE_FILE_NAMES[this.mapType], text);
  }

  /**
   * Download automático via `Blob` + `<a download>` virtual (pedido
   * explícito) — o jeito padrão de gerar um download client-side sem
   * backend nenhum: o navegador cuida de tudo (nome sugerido, pasta de
   * downloads), o link nunca precisa ficar visível na página, e
   * `URL.revokeObjectURL` libera a memória do Blob assim que o clique
   * dispara o download.
   */
  private downloadTextFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // eslint-disable-next-line no-console
    console.log(`MapEditorScene: ${filename} baixado (${content.length} caracteres).`);
  }

  private exportFarm(): string {
    const treePositions: Array<[number, number]> = [];
    const fences: FenceExportEntry[] = [];
    let shopPosition: [number, number] | null = null;
    let shippingBinPosition: [number, number] | null = null;

    for (const [key, object] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      if (object.type === 'tree') treePositions.push([col, row]);
      else if (object.type === 'fence') fences.push({ col, row, variantId: object.fenceVariantId ?? 'horizontal' });
      else if (object.type === 'shop') shopPosition = [col, row];
      else if (object.type === 'shippingBin') shippingBinPosition = [col, row];
    }

    const text = exportFarmMapData(this.mapData as FarmMapData, {
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      treePositions,
      farmlandArea: this.cellsToArray(this.areaCells),
      fences,
      shopPosition,
      shippingBinPosition,
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      props: this.exportableProps(),
    });

    return text;
  }

  private exportForest(): string {
    const pineTreePositions: Array<[number, number]> = [];
    const birchTreePositions: Array<[number, number]> = [];
    const rockPositions: Array<[number, number]> = [];

    for (const [key, object] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      if (object.type === 'tree') pineTreePositions.push([col, row]);
      else if (object.type === 'birchTree') birchTreePositions.push([col, row]);
      else if (object.type === 'rock') rockPositions.push([col, row]);
    }

    const text = exportForestMapData({
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      pineTreePositions,
      birchTreePositions,
      rockPositions,
      lakeArea: this.computeAreaBoundingRect(),
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      props: this.exportableProps(),
    });

    return text;
  }

  private exportCave(): string {
    let caveEntrancePosition: [number, number] = (this.mapData as CaveMapData).caveEntrancePosition;
    for (const [key, object] of this.objects) {
      if (object.type === 'caveEntrance') caveEntrancePosition = key.split(',').map(Number) as [number, number];
    }

    const text = exportCaveMapData({
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      caveEntrancePosition,
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      props: this.exportableProps(),
    });

    return text;
  }

  private exportBeach(): string {
    const rockPositions: Array<[number, number]> = [];
    const bigRockPositions: Array<[number, number]> = [];

    for (const [key, object] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      if (object.type === 'rock') rockPositions.push([col, row]);
      else if (object.type === 'bigRock') bigRockPositions.push([col, row]);
    }

    const text = exportBeachMapData({
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      oceanArea: this.computeAreaBoundingRect(),
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      rockPositions,
      bigRockPositions,
      props: this.exportableProps(),
    });

    return text;
  }

  private exportQuarry(): string {
    const rockPositions: Array<[number, number]> = [];
    const bigRockPositions: Array<[number, number]> = [];
    const ironOrePositions: Array<[number, number]> = [];
    const coalOrePositions: Array<[number, number]> = [];

    for (const [key, object] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      if (object.type === 'rock') rockPositions.push([col, row]);
      else if (object.type === 'bigRock') bigRockPositions.push([col, row]);
      else if (object.type === 'ironOre') ironOrePositions.push([col, row]);
      else if (object.type === 'coalOre') coalOrePositions.push([col, row]);
    }

    const text = exportQuarryMapData({
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      rockPositions,
      bigRockPositions,
      ironOrePositions,
      coalOrePositions,
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      props: this.exportableProps(),
    });

    return text;
  }

  /**
   * Vilarejo: as estruturas viram `structures` (com o `role` das casas de moradores, que acompanha a casa quando movida), o poço e os
   * pinheiros as posições. Sem poço no mapa (apagado), mantém o que o layout já tinha — a cena sempre desenha um. As 3 casas de
   * moradores (loja/banqueiro/pirata) precisam existir: se faltar alguma, avisa no console (o jogo cai na posição padrão delas).
   */
  private exportVillage(): string {
    const structures: VillageExportStructure[] = [];
    const trees: Array<[number, number]> = [];
    let well = (this.mapData as VillageLayoutData).well;

    for (const [key, object] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      const asset = VILLAGE_ASSET_BY_OBJECT_TYPE.get(object.type);
      if (asset) structures.push({ asset, col, row, ...(object.villageRole ? { role: object.villageRole } : {}) });
      else if (object.type === 'tree') trees.push([col, row]);
      else if (object.type === 'villageWell') well = { col, row };
    }

    for (const role of ['shop', 'banker', 'pirate', 'supplier', 'carpenter'] as const) {
      // eslint-disable-next-line no-console
      if (!structures.some((structure) => structure.role === role)) console.warn(`MapEditorScene: a casa do morador "${role}" não está no mapa — o jogo vai usar a posição padrão dela.`);
    }

    return exportVillageMapData({
      cols: this.gridCols,
      rows: this.gridRows,
      ground: this.groundData,
      backgroundColor: this.backgroundColorHex,
      blockedArea: this.exportableBlockedArea(),
      structures,
      well,
      trees,
      props: this.exportableProps(),
    });
  }

  private cellsToArray(cells: Set<string>): Array<[number, number]> {
    return Array.from(cells).map((key) => key.split(',').map(Number) as [number, number]);
  }

  /**
   * Células dos Blocos de Colisão pra exportar, EXCLUINDO qualquer
   * célula já bloqueada nativamente por uma entidade reconhecida (Casa,
   * Loja, Caixa de Remessas, Árvore, Cerca, e o equivalente em qualquer
   * outro `mapType` — Entrada da Caverna, Pedra, Minério, Bétula) — essas já
   * são bloqueadas de verdade no jogo pela própria entidade
   * (`systems/grid.ts`/`obstacleCells` das cenas externas), então incluí-las
   * também em `blockedArea` seria pura duplicação, sem efeito nenhum a
   * mais. Sobra só o que o usuário pintou "no vazio" de propósito.
   */
  private exportableBlockedArea(): Array<[number, number]> {
    const nativelyBlocked = new Set<string>(this.objects.keys());

    if (this.mapType === 'farm') {
      const map = this.mapData as FarmMapData;
      const { col0, row0, cols, rows } = map.housePosition;
      for (let row = row0; row < row0 + rows; row++) {
        for (let col = col0; col < col0 + cols; col++) {
          nativelyBlocked.add(`${col},${row}`);
        }
      }

      // Bug corrigido (item explícito): um Bloco de Colisão pintado bem em
      // cima da porta — ou de qualquer vizinho cardeal dela — podia isolar
      // a interação de dormir sem nenhum aviso. A própria porta já cai
      // dentro do retângulo da Casa acima, mas os vizinhos FORA dele (ex.:
      // a célula do quintal logo à frente) não caíam — excluídos aqui
      // também, e `systems/grid.ts` ainda força a porta em si a ficar
      // sempre andável como segunda camada de proteção.
      const [doorCol, doorRow] = map.houseDoorPosition;
      nativelyBlocked.add(`${doorCol},${doorRow}`);
      nativelyBlocked.add(`${doorCol - 1},${doorRow}`);
      nativelyBlocked.add(`${doorCol + 1},${doorRow}`);
      nativelyBlocked.add(`${doorCol},${doorRow - 1}`);
      nativelyBlocked.add(`${doorCol},${doorRow + 1}`);
    }

    return Array.from(this.collisionCells)
      .filter((key) => !nativelyBlocked.has(key))
      .map((key) => key.split(',').map(Number) as [number, number]);
  }

  /** Props de decoração ambiente pintados (aba "Decoração") — mesmo formato em TODO tipo de mapa (`XMapData.props`), usado pelos 5 `exportX`. */
  private exportableProps(): Array<[number, number, string]> {
    return Array.from(this.decorationCells.entries()).map(([key, propId]) => {
      const [col, row] = key.split(',').map(Number);
      return [col, row, propId];
    });
  }

  /** Bounding box das células pintadas com a ferramenta "Área" — usado por Floresta/Praia, cujas interfaces guardam um RETÂNGULO (`lakeArea`/`oceanArea`), não uma lista livre de células (essa é só a Terra Arável da Fazenda). */
  private computeAreaBoundingRect(): RectArea {
    let minCol = Infinity;
    let minRow = Infinity;
    let maxCol = -Infinity;
    let maxRow = -Infinity;
    for (const key of this.areaCells) {
      const [col, row] = key.split(',').map(Number);
      minCol = Math.min(minCol, col);
      minRow = Math.min(minRow, row);
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
    }
    if (!isFinite(minCol)) return { col0: 0, row0: 0, cols: 0, rows: 0 };
    return { col0: minCol, row0: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
  }

  // --- Utilidades -----------------------------------------------------------

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.gridCols && row < this.gridRows;
  }
}
