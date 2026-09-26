import Phaser from 'phaser';
import { BridgeDefinition, ExpansionDirection } from '../data/maps/farmMap';
import { TILE_SIZE, BRIDGE_KEY, BRIDGE_PATH, PROPS_TILESET_KEY, PROPS_TILESET_PATH, WaterStyleId } from '../data/tiles';
import { preloadGroundTilesets } from '../systems/groundTilesets';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { preloadPet } from '../systems/petSprites';
import { PetCompanion } from '../systems/petCompanion';
import { PET_ROAM } from '../data/pets';
import { gameState } from '../systems/gameState';
import { SHADOW_KEY, SHADOW_PATH } from '../data/effects';
import { buildGroundChunk, buildBridge, bridgeRailingCells, bridgeWalkwayCells, DISPLAY_SCALE } from '../systems/mapBuilder';
import { setupWorldCamera } from '../systems/cameraSetup';
import { WalkableGrid } from '../systems/grid';
import { waterCellsFromGround } from '../systems/waterCells';
import { TileCursor } from '../systems/tileCursor';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { InteractionRegistry } from '../systems/interaction';
import { attachFootstepSounds } from '../systems/soundEffects';
import { attachFootDust, isDirtGround } from '../systems/grassDust';
import { onPlayerStepped } from '../systems/sceneEvents';
import { ensureUIScene, isInventoryOpen, toggleInventoryScreen, closeInventoryScreen, isFurnaceMenuOpen, closeFurnaceMenu, isDialogueOpen } from './UIScene';
import { DebugGridOverlay } from '../systems/debugGridOverlay';
import { MapType } from './MapEditorScene';
import type { DirtZone } from '../systems/dirtPaths';
import { registerMapEditorShortcut } from '../systems/mapEditorLauncher';
import { DayNightOverlay } from '../systems/dayNightOverlay';
import { WorldBlur } from '../systems/worldBlur';
import { advanceWorldTime, describeNewDay } from '../systems/worldTime';
import { shouldStartHorde } from '../systems/horde';
import { LockedMessage } from '../ui/lockedMessage';

/** Dados que chegam de `scene.start(key, data)` ao atravessar a ponte da Fazenda (ver `systems/bridgeSystem.ts`). */
export interface ExternalMapEntryData {
  areaName: string;
  returnSceneKey: string;
  returnSpawn: { col: number; row: number };
  /** Onde o jogador aparece (em vez de em frente à ponte de volta): usado ao sair do interior de uma loja do Vilarejo (`ShopInteriorScene`). */
  spawnPoint?: { col: number; row: number };
}

/** O que cada cena concreta (Floresta/Pedreira/Caverna/Praia) precisa fornecer ao construtor — ver `ExternalMapScene`. */
export interface ExternalMapConfig {
  cols: number;
  rows: number;
  areaName: string;
  /** Identifica qual `data/maps/*.ts` esta cena edita (F2 universal, ver `systems/mapEditorLauncher.ts`) — cada subclasse passa a própria (`'forest'`/`'cave'`/`'beach'`/`'quarry'`). */
  mapType?: MapType;
  /** Tint aplicado ao chão de grama (mesma paleta já usada nos trechos de bioma da Fazenda — ver `mapBuilder.BIOME_TINTS`); `undefined` mantém o verde natural. */
  groundTint?: number;
  /** Saturação do chão (0 = cinza total, 1 = cores naturais; ausente = natural). Um filtro de cor só no chão (`Filters.ColorMatrix`): o tint multiplicativo sozinho não tira o verde da grama. */
  groundSaturation?: number;
  /**
   * Bug corrigido — chão autorado no `MapEditorScene` (Modo Ground) nunca
   * era lido aqui (só `MainScene`/Fazenda consumia `farmMap.ground`): sem
   * isto, pintar o chão de Floresta/Caverna/Praia/Pedreira no editor não
   * tinha NENHUM efeito no jogo de verdade, só no preview do editor.
   */
  ground?: number[][];
  /** Mesmo bug/campo de `ground` acima — nunca aplicado fora da Fazenda. */
  backgroundColor?: string;
  /** Ruas/praças de terra pintadas por cima da grama procedural (só vale sem `ground` autorado) — o Vilarejo. */
  dirtZone?: DirtZone;
  /** Folha da água animada deste mapa (`WATER_STYLES`); ausente = a da Praia. A Floresta usa `'waterGround'` (margem de terra). */
  waterStyle?: WaterStyleId;
  /** Células extras bloqueadas no `WalkableGrid`, além da borda (árvores, pedras, água, etc.) — cada subclasse monta a lista a partir dos próprios dados (`data/maps/*.ts`). */
  obstacleCells: Array<[number, number]>;
  /**
   * Continuidade espacial (pedido explícito do usuário): lado desta cena
   * onde fica a ponte de volta pra Fazenda — sempre o lado OPOSTO de onde
   * fica a ponte da Fazenda que leva aqui (ex.: a ponte da Fazenda fica a
   * Oeste → a ponte de volta na Floresta fica a Leste). Fixo por cena (cada
   * uma só é alcançável por UMA ponte da Fazenda), não vem de `entryData`.
   */
  returnDirection: ExpansionDirection;
}

/** Célula (na própria parede) de uma ponte nesta direção — mesma convenção de `farmMap.bridges` (centralizada no lado). Exportada para as cenas concretas excluírem essa célula ao sortear posições de respawn (`systems/resourceNodeRegistry.ts`). */
export function computeWallBridgeCell(direction: ExpansionDirection, cols: number, rows: number): { col: number; row: number } {
  const midCol = Math.floor(cols / 2);
  const midRow = Math.floor(rows / 2);
  if (direction === 'north') return { col: midCol, row: 0 };
  if (direction === 'south') return { col: midCol, row: rows - 1 };
  if (direction === 'west') return { col: 0, row: midRow };
  return { col: cols - 1, row: midRow };
}

/**
 * Zona de CHEGADA da ponte de volta: a passarela coberta pela arte (entre os corrimões, sem saída lateral) mais um bloco livre logo
 * depois dela, por onde o jogador sai pro mapa. Nenhuma árvore/pedra pode existir ou nascer aqui — uma só na frente da passarela a
 * fecharia e prenderia o jogador que acabou de chegar. Cenas concretas usam pra limpar/excluir essas células.
 */
export function computeArrivalClearance(direction: ExpansionDirection, cols: number, rows: number): Array<[number, number]> {
  const bridge = computeWallBridgeCell(direction, cols, rows);
  // Passo (dcol, drow) da parede pra dentro do mapa, e o eixo lateral.
  const inward = direction === 'north' ? [0, 1] : direction === 'south' ? [0, -1] : direction === 'west' ? [1, 0] : [-1, 0];
  const lateral = [inward[1], inward[0]];
  const walkwayLength = direction === 'north' || direction === 'south' ? 2 : 3; // Igual a `bridgeWalkwayCells`.

  const cells: Array<[number, number]> = [];
  for (let depth = 0; depth < walkwayLength + 2; depth++) {
    for (let side = -1; side <= 1; side++) {
      if (depth < walkwayLength && side !== 0) continue; // Na passarela só o corredor central; depois dela, um bloco de 3 de largura.
      cells.push([bridge.col + inward[0] * depth + lateral[0] * side, bridge.row + inward[1] * depth + lateral[1] * side]);
    }
  }
  return cells;
}

/** Célula andável logo "na frente" da ponte (uma célula pra dentro do mapa, na direção oposta à parede) — onde o jogador nasce ao chegar. */
function computeSpawnInFrontOf(direction: ExpansionDirection, bridgeCell: { col: number; row: number }): { col: number; row: number } {
  if (direction === 'north') return { col: bridgeCell.col, row: bridgeCell.row + 1 };
  if (direction === 'south') return { col: bridgeCell.col, row: bridgeCell.row - 1 };
  if (direction === 'west') return { col: bridgeCell.col + 1, row: bridgeCell.row };
  return { col: bridgeCell.col - 1, row: bridgeCell.row };
}

const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '16px',
  fontStyle: 'bold',
  color: '#ffe9b3',
  stroke: '#2b1d0e',
  strokeThickness: 3,
};
const HINT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '11px',
  fontStyle: 'bold',
  color: '#ffe9b3',
  stroke: '#2b1d0e',
  strokeThickness: 2,
};

/** Bordas bloqueadas + qualquer célula extra informada (árvores/pedras/água/etc.) — ver `WalkableGrid`. */
export function buildExternalGrid(cols: number, rows: number, obstacleCells: Array<[number, number]>): WalkableGrid {
  const blocked = new Set<string>();
  const key = (col: number, row: number): string => `${col},${row}`;

  for (let col = 0; col < cols; col++) {
    blocked.add(key(col, 0));
    blocked.add(key(col, rows - 1));
  }
  for (let row = 0; row < rows; row++) {
    blocked.add(key(0, row));
    blocked.add(key(cols - 1, row));
  }
  for (const [col, row] of obstacleCells) blocked.add(key(col, row));

  const inBounds = (col: number, row: number): boolean => col >= 0 && row >= 0 && col < cols && row < rows;
  const isWalkable = (col: number, row: number): boolean => inBounds(col, row) && !blocked.has(key(col, row));
  const block = (col: number, row: number): void => {
    blocked.add(key(col, row));
  };
  const unblock = (col: number, row: number): void => {
    blocked.delete(key(col, row));
  };

  return { cols, rows, inBounds, isWalkable, block, unblock };
}

/**
 * Base compartilhada das 4 cenas de destino das pontes (Floresta/Pedreira/
 * Caverna/Praia — Sistema de Cenas): cada uma só define o próprio tamanho,
 * tint de chão e decorações (`buildMapContent`), reaproveitando toda a
 * "cola" comum — carregar/posicionar o jogador, câmera (mesmo
 * comportamento da Fazenda, ver `systems/cameraSetup.ts`), grid com borda
 * bloqueada, a ponte de volta e a `UIScene` persistente. Evita 4 arquivos
 * de cena quase idênticos, do mesmo jeito que a antiga `ExternalAreaScene`
 * (agora substituída por esta base + subclasses) evitava isso quando as 4
 * pontes ainda apontavam pra um único placeholder genérico.
 */
export abstract class ExternalMapScene extends Phaser.Scene {
  protected entryData!: ExternalMapEntryData;
  protected player!: Player;
  protected controller!: PlayerController;
  /** Pet companheiro (nasce ao lado do jogador em toda cena de mapa) — ver `systems/petCompanion.ts`. */
  protected petCompanion?: PetCompanion;
  /** DEBUG TEMPORÁRIO — ver `systems/debugGridOverlay.ts`. `protected` pra `ForestScene` poder plugar `setEnemyProvider`. */
  protected debugGridOverlay!: DebugGridOverlay;
  /** Corredor da ponte de volta (célula da ponte + trecho coberto pela arte) — cenas concretas usam pra não espalhar decoração em cima dela (ver `buildWildFoliage`). Preenchido antes de `buildMapContent`. */
  protected bridgeWalkway: Array<[number, number]> = [];
  /** Trava contra reentrância (mesmo bug/fix de `BridgeSystem.isTransitioning`): sem isso, pisar várias vezes na célula da ponte durante o `fadeOut` de `returnToFarm` disparava `scene.start` mais de uma vez. */
  protected isTransitioning = false;
  /** Véu de dia/noite e faixa "DIA n": o relógio corre em toda cena (`systems/worldTime.ts`), não só na Fazenda. */
  private dayNightOverlay!: DayNightOverlay;
  private worldBlur!: WorldBlur;
  protected lockedMessage!: LockedMessage;
  /** Já avisou (nesta visita) que a noite de horda começou com o jogador longe da Fazenda. */
  private hordeWarned = false;

  constructor(
    key: string,
    private readonly config: ExternalMapConfig,
  ) {
    super(key);
  }

  init(data: ExternalMapEntryData): void {
    this.entryData = data;
    // O Phaser reaproveita a mesma instância da cena entre `scene.start()`
    // (não recria a classe) — sem isso, a trava de reentrância ligada em
    // `returnToFarm()` continuava `true` pra sempre depois da primeira
    // viagem, travando qualquer transição seguinte por esta mesma ponte.
    this.isTransitioning = false;
    this.hordeWarned = false;
  }

  preload(): void {
    // Todos os tilesets de chão (Grama/Solo/Água + qualquer um importado e
    // colado em `GROUND_TILESETS`) — necessário mesmo fora da Fazenda agora
    // que `this.config.ground` (autorado no editor) pode referenciar GID de
    // QUALQUER tileset, não só o de grama (bug corrigido — ver doc de
    // `ExternalMapConfig.ground`).
    preloadGroundTilesets(this);
    this.load.image(BRIDGE_KEY, encodeURI(`/${BRIDGE_PATH}`));
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    // Props de decoração ambiente (aba "Decoração" do MapEditorScene) —
    // carregado aqui uma vez só, pras 4 cenas externas, em vez de repetir em
    // cada `loadMapAssets` (ver `systems/mapProps.ts`).
    this.load.image(PROPS_TILESET_KEY, encodeURI(`/${PROPS_TILESET_PATH}`));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);

    this.loadMapAssets();
  }

  /** Hook: cada cena carrega aqui só os assets específicos do próprio bioma (árvores extras, pedras, minério, entrada de caverna, água). */
  protected loadMapAssets(): void {}

  create(): void {
    const { cols, rows } = this.config;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;

    const groundLayer = buildGroundChunk(this, TILE_SIZE, 0, 0, cols, rows, this.config.dirtZone, this.config.groundTint, this.config.ground, this.config.waterStyle);
    if (this.config.groundSaturation !== undefined) {
      groundLayer.enableFilters().filters!.internal.addColorMatrix().colorMatrix.saturate(this.config.groundSaturation - 1);
    }
    // Mesmo tratamento de `MainScene.create()` pro `farmMap.backgroundColor`
    // — opcional, sem ele mantém a cor padrão do Phaser (preto).
    if (this.config.backgroundColor) this.cameras.main.setBackgroundColor(this.config.backgroundColor);

    // Continuidade espacial (pedido explícito): a ponte de volta fica no
    // lado OPOSTO da ponte da Fazenda que trouxe o jogador até aqui (ver
    // `ExternalMapConfig.returnDirection`), e ele nasce exatamente na
    // frente dela, não num canto fixo qualquer.
    const { returnDirection } = this.config;
    const bridgeCell = computeWallBridgeCell(returnDirection, cols, rows);
    const returnBridge: BridgeDefinition = {
      direction: returnDirection,
      col: bridgeCell.col,
      row: bridgeCell.row,
      destinationName: 'Fazenda',
      destinationSceneKey: this.entryData.returnSceneKey,
      requirement: {},
    };
    buildBridge(this, TILE_SIZE, returnBridge);
    this.bridgeWalkway = bridgeWalkwayCells(returnBridge);

// A água pintada no chão (lago/mar) bloqueia sozinha — não depende de `blockedArea`/`lakeArea` estarem preenchidos no mapa.
    const grid = buildExternalGrid(cols, rows, [...this.config.obstacleCells, ...waterCellsFromGround(this.config.ground)]);
    const interactions = new InteractionRegistry();

    // 1. Libera a passagem na célula da ponte (furando a borda bloqueada do mapa)
    grid.unblock(bridgeCell.col, bridgeCell.row);

    // Colisão dos corrimões laterais (pedido explícito do usuário, mesma
    // regra da Fazenda — ver `bridgeRailingCells`): a ponte de volta aqui
    // não tem trava/placa (sempre destravada), mas a arte é igualmente
    // mais larga que 1 tile, então precisa do mesmo "túnel" invisível.
    for (const [col, row] of bridgeRailingCells(returnBridge)) grid.block(col, row);

    attachFootstepSounds(this, (col, row) => (col === bridgeCell.col && row === bridgeCell.row ? 'bridge' : 'grass'));

    // 2. Escuta quando o jogador pisa na célula da ponte para acionar a viagem
    onPlayerStepped(this, (col, row) => {
      if (col === bridgeCell.col && row === bridgeCell.row && !this.isTransitioning) {
        this.isTransitioning = true;
        this.returnToFarm();
      }
    });

    const spawn = this.entryData.spawnPoint ?? computeSpawnInFrontOf(returnDirection, bridgeCell);
    this.player = new Player(this, spawn.col, spawn.row, tilePx);
    // Mesma escala aplicada na MainScene logo após instanciar o Player —
    // faltava aqui, por isso o personagem aparecia minúsculo nas cenas novas.
    this.player.sprite.setScale(DISPLAY_SCALE);
    // Poeira nos pés só sobre TERRA (GID autorado que não é grama/água/areia, ou a rua de terra do Vilarejo; fora a ponte de volta) — ver `systems/grassDust.ts`.
    attachFootDust(this, this.player, tilePx, (col, row) => !(col === bridgeCell.col && row === bridgeCell.row) && (isDirtGround(this.config.ground, col, row) || !!this.config.dirtZone?.has(col, row)));
    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    this.debugGridOverlay = new DebugGridOverlay(this, grid, tilePx, this.player); // DEBUG TEMPORÁRIO
    // Inventário (Fase 8 — Interface): agora pode abrir em qualquer mapa, não
    // só na Fazenda — mesma técnica de "roubar" o clique enquanto aberto já
    // usada lá (ver `scenes/MainScene.ts`).
    this.controller.addInputInterceptor({
      isActive: () => isInventoryOpen(),
      handleClick: () => {},
    });
    this.controller.addInputInterceptor({
      isActive: () => isFurnaceMenuOpen(),
      handleClick: () => {},
    });
    // Conversa com um morador aberta: o clique é só dela.
    this.controller.addInputInterceptor({
      isActive: () => isDialogueOpen(),
      handleClick: () => {},
    });
    setupWorldCamera(this, this.player.sprite, cols * tilePx, rows * tilePx);
    this.dayNightOverlay = new DayNightOverlay(this);
    this.worldBlur = new WorldBlur(this.cameras.main);
    this.lockedMessage = new LockedMessage(this);

    // Mesmo destaque de célula sob o mouse já usado na Fazenda (Fase 9,
    // pedido explícito do usuário) — sem lavoura aqui, então sempre o
    // cantinho branco/global (`farmlandArea` fica no padrão vazio).
    new TileCursor(this, tilePx, grid);

    ensureUIScene(this);

    this.input.keyboard!.on('keydown-E', () => {
      if (isDialogueOpen()) return; // Em conversa, o E não abre o Inventário por cima.
      if (isFurnaceMenuOpen()) closeFurnaceMenu();
      toggleInventoryScreen();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (isInventoryOpen()) {
        closeInventoryScreen();
        return;
      }
      if (isFurnaceMenuOpen()) closeFurnaceMenu();
    });
    if (this.config.mapType) registerMapEditorShortcut(this, this.config.mapType); // Só os mapas com editor (o Vilarejo não tem).

    this.buildMapContent({ tilePx, grid, interactions, player: this.player });

    // Depois do conteúdo do mapa (árvores/pedras/água já bloqueados no grid): o pet nunca nasce nem passeia em cima de obstáculo.
    // (fora do anel da borda — parede e a célula da ponte de volta — pra ele nunca ficar parado em cima do "portão".)
    // (só depois de desbloqueado pelo evento da caixa — `systems/petEvent.ts`.)
    if (gameState.petUnlocked) this.petCompanion = new PetCompanion(this, this.player, this.controller, grid, tilePx, PET_ROAM.area, (col, row) => col > 0 && row > 0 && col < cols - 1 && row < rows - 1);

    const centerX = this.scale.width / 2;
    this.add.text(centerX, 20, `Você está em: ${this.config.areaName}`, TITLE_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.add
      .text(centerX, 42, 'Ande até a ponte para voltar para a Fazenda.', HINT_STYLE)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(4000);
      this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  /**
   * Hook: cada cena desenha aqui suas próprias decorações (árvores, pedras,
   * minério, água, entrada de caverna) e registra as interações de coleta
   * (Fase 7 — `grid`/`interactions` já prontos, incluindo a ponte de volta).
   */
  protected buildMapContent(_ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {}

  update(time: number, delta: number): void {
    // Mesmo bloqueio de movimento da Fazenda enquanto o Inventário/Fornalha
    // está aberto (ver `MainScene.isInputLocked`) — aqui não há Menu de
    // Pausa/Dormir ainda, então esses dois são as únicas causas possíveis.
    if (!isInventoryOpen() && !isFurnaceMenuOpen() && !isDialogueOpen()) {
      this.controller.update(time, delta);
      this.petCompanion?.update(time, delta);
    }

    // O dia corre aqui também: véu da noite, virada de dia (meia-noite) e a faixa "DIA n".
    const { dayTurn, hordeMissed } = advanceWorldTime(delta, false);
    if (dayTurn) {
      const { title, subtitle } = describeNewDay();
      this.lockedMessage.show(title, subtitle);
    }
    if (hordeMissed) this.lockedMessage.show('A HORDA PASSOU', 'Você estava longe da Fazenda: sem recompensa.');
    // A horda só começa com o jogador na Fazenda (é ela quem a conduz): longe dela, avisa pra ele voltar antes da meia-noite.
    if (!this.hordeWarned && shouldStartHorde()) {
      this.hordeWarned = true;
      this.lockedMessage.show('A HORDA CHEGOU!', 'Volte para a Fazenda e defenda-a antes da meia-noite!');
    }
    this.dayNightOverlay.setHours(gameState.gameClock.getHours());
    this.worldBlur.setActive(isInventoryOpen() || isFurnaceMenuOpen() || isDialogueOpen());
    this.debugGridOverlay.update(); // DEBUG TEMPORÁRIO — remover junto com `systems/debugGridOverlay.ts`.
  }

returnToFarm(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.entryData.returnSceneKey, { spawnPoint: this.entryData.returnSpawn });
    });
  }
}
