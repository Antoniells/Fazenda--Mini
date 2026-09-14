import Phaser from 'phaser';
import { BridgeDefinition, ExpansionDirection } from '../data/maps/farmMap';
import { GRASS_TILESET_KEY, GRASS_TILESET_PATH, TILE_SIZE, BRIDGE_KEY, BRIDGE_PATH } from '../data/tiles';
import { PLAYER_IDLE_KEY, PLAYER_IDLE_PATH, PLAYER_WALK_KEY, PLAYER_WALK_PATH, PLAYER_FRAME_SIZE } from '../data/player';
import { SHADOW_KEY, SHADOW_PATH } from '../data/effects';
import { buildGroundChunk, buildBridge, DISPLAY_SCALE } from '../systems/mapBuilder';
import { setupWorldCamera } from '../systems/cameraSetup';
import { WalkableGrid } from '../systems/grid';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { InteractionRegistry, Interactable } from '../systems/interaction';
import { ensureUIScene, isInventoryOpen, toggleInventoryScreen, closeInventoryScreen } from './UIScene';

/** Dados que chegam de `scene.start(key, data)` ao atravessar a ponte da Fazenda (ver `systems/bridgeSystem.ts`). */
export interface ExternalMapEntryData {
  areaName: string;
  returnSceneKey: string;
  returnSpawn: { col: number; row: number };
}

/** O que cada cena concreta (Floresta/Pedreira/Caverna/Praia) precisa fornecer ao construtor — ver `ExternalMapScene`. */
export interface ExternalMapConfig {
  cols: number;
  rows: number;
  areaName: string;
  /** Tint aplicado ao chão de grama (mesma paleta já usada nos trechos de bioma da Fazenda — ver `mapBuilder.BIOME_TINTS`); `undefined` mantém o verde natural. */
  groundTint?: number;
  /** Células extras bloqueadas no `WalkableGrid`, além da borda (árvores, pedras, água, etc.) — cada subclasse monta a lista a partir dos próprios dados (`data/maps/*.ts`). */
  obstacleCells: Array<[number, number]>;
  /**
   * Continuidade espacial (pedido explícito do usuário): lado desta cena
   * onde fica a ponte de volta pra Fazenda — sempre o lado OPOSTO de onde
   * fica a ponte da Fazenda que leva aqui (ex.: a ponte da Fazenda fica a
   * Leste → a ponte de volta na Floresta fica a Oeste). Fixo por cena (cada
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
function buildExternalGrid(cols: number, rows: number, obstacleCells: Array<[number, number]>): WalkableGrid {
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

/** Interagir com a ponte de volta (sempre destravada — voltar pra Fazenda nunca teve requisito). */
class ReturnBridgeInteractable implements Interactable {
  constructor(private readonly scene: ExternalMapScene) {}

  interact(): void {
    this.scene.returnToFarm();
  }
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

  constructor(
    key: string,
    private readonly config: ExternalMapConfig,
  ) {
    super(key);
  }

  init(data: ExternalMapEntryData): void {
    this.entryData = data;
  }

  preload(): void {
    // Todos já carregados pela MainScene (única forma de chegar aqui é
    // atravessando uma ponte de lá) — recarregar é só uma garantia barata
    // caso essa premissa mude no futuro; o Phaser ignora uma chave já em
    // cache, sem custo de rede extra.
    this.load.image(GRASS_TILESET_KEY, encodeURI(`/${GRASS_TILESET_PATH}`));
    this.load.image(BRIDGE_KEY, encodeURI(`/${BRIDGE_PATH}`));
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    this.load.spritesheet(PLAYER_IDLE_KEY, encodeURI(`/${PLAYER_IDLE_PATH}`), {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE,
    });
    this.load.spritesheet(PLAYER_WALK_KEY, encodeURI(`/${PLAYER_WALK_PATH}`), {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE,
    });

    this.loadMapAssets();
  }

  /** Hook: cada cena carrega aqui só os assets específicos do próprio bioma (árvores extras, pedras, minério, entrada de caverna, água). */
  protected loadMapAssets(): void {}

  create(): void {
    const { cols, rows } = this.config;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;

    buildGroundChunk(this, TILE_SIZE, 0, 0, cols, rows, undefined, this.config.groundTint);

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

    const grid = buildExternalGrid(cols, rows, this.config.obstacleCells);

    const interactions = new InteractionRegistry();
    interactions.set(bridgeCell.col, bridgeCell.row, new ReturnBridgeInteractable(this));

    const spawn = computeSpawnInFrontOf(returnDirection, bridgeCell);
    this.player = new Player(this, spawn.col, spawn.row, tilePx);
    // Mesma escala aplicada na MainScene logo após instanciar o Player —
    // faltava aqui, por isso o personagem aparecia minúsculo nas cenas novas.
    this.player.sprite.setScale(DISPLAY_SCALE);
    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    // Inventário (Fase 8 — Interface): agora pode abrir em qualquer mapa, não
    // só na Fazenda — mesma técnica de "roubar" o clique enquanto aberto já
    // usada lá (ver `scenes/MainScene.ts`).
    this.controller.addInputInterceptor({
      isActive: () => isInventoryOpen(),
      handleClick: () => {},
    });
    setupWorldCamera(this, this.player.sprite, cols * tilePx, rows * tilePx);

    ensureUIScene(this);

    this.input.keyboard!.on('keydown-E', () => toggleInventoryScreen());
    this.input.keyboard!.on('keydown-ESC', () => {
      if (isInventoryOpen()) closeInventoryScreen();
    });

    this.buildMapContent({ tilePx, grid, interactions, player: this.player });

    const centerX = (cols * tilePx) / 2;
    this.add.text(centerX, 20, `Você está em: ${this.config.areaName}`, TITLE_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.add
      .text(centerX, 42, 'Ande até a ponte para voltar para a Fazenda.', HINT_STYLE)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(4000);
  }

  /**
   * Hook: cada cena desenha aqui suas próprias decorações (árvores, pedras,
   * minério, água, entrada de caverna) e registra as interações de coleta
   * (Fase 7 — `grid`/`interactions` já prontos, incluindo a ponte de volta).
   */
  protected buildMapContent(_ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {}

  update(time: number, delta: number): void {
    // Mesmo bloqueio de movimento da Fazenda enquanto o Inventário está
    // aberto (ver `MainScene.isInputLocked`) — aqui não há Menu de
    // Pausa/Dormir ainda, então o Inventário é a única causa possível.
    if (!isInventoryOpen()) this.controller.update(time, delta);
  }

  returnToFarm(): void {
    this.scene.start(this.entryData.returnSceneKey, { spawnPoint: this.entryData.returnSpawn });
  }
}
