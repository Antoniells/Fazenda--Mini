import Phaser from 'phaser';
import { ExternalMapEntryData, buildExternalGrid } from './ExternalMapScene';
import { CAVE_MAX_FLOOR, caveFloorConfig, CaveFloorConfig } from '../data/caveFloors';
import { CaveLayout, generateCaveFloor } from '../systems/caveGenerator';
import { CaveEnemies, enemySheetsFor } from '../systems/caveEnemies';
import { preloadSheets } from '../entities/cave/caveAnims';
import { CAVE_TILES, CAVE_STAIRS } from '../data/caveTiles';
import { TILE_SIZE } from '../data/tiles';
import { SHADOW_KEY, SHADOW_PATH } from '../data/effects';
import { PET_ROAM } from '../data/pets';
import { gameState } from '../systems/gameState';
import { save as saveGame } from '../systems/saveManager';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { setupWorldCamera } from '../systems/cameraSetup';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { preloadPet } from '../systems/petSprites';
import { PetCompanion } from '../systems/petCompanion';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { InteractionRegistry } from '../systems/interaction';
import { attachFootstepSounds, playEffect } from '../systems/soundEffects';
import { onPlayerStepped } from '../systems/sceneEvents';
import { advanceWorldTime, describeNewDay } from '../systems/worldTime';
import { shouldStartHorde } from '../systems/horde';
import { LockedMessage } from '../ui/lockedMessage';
import { WorldBlur } from '../systems/worldBlur';
import { UNLOCK_SOUND } from '../data/audio';
import { ensureUIScene, isInventoryOpen, toggleInventoryScreen, closeInventoryScreen, isFurnaceMenuOpen, closeFurnaceMenu, isDialogueOpen } from './UIScene';

export const CAVE_FLOOR_SCENE_KEY = 'CaveFloorScene';

/** O que a Caverna (a entrada na superfície, `CaveScene`) ou o andar vizinho manda ao abrir um andar. */
export interface CaveFloorEntryData {
  floor: number;
  /** De onde o jogador vem: de CIMA (desceu a escada do andar anterior, nasce junto da escada de subida) ou de BAIXO (subiu do andar seguinte, nasce junto da escada de descida). */
  from: 'above' | 'below';
  /** Os dados da entrada da Caverna na superfície — pra voltar pra ela ao subir do andar 1. */
  surface: ExternalMapEntryData;
}

const FADE_MS = 300;
const VOID_COLOR = '#08090d';
const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: '"Courier New", Courier, monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffe9b3', stroke: '#2b1d0e', strokeThickness: 3 };
const HINT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffe9b3', stroke: '#2b1d0e', strokeThickness: 3 };

/**
 * Um ANDAR da Caverna (1 a 100, `data/caveFloors.ts`): um salão de dungeon gerado pelo número do andar (`systems/caveGenerator.ts`: paredes, escada de subida onde o jogador
 * chega, escada de descida no lado oposto), povoado pelos inimigos daquele andar (`systems/caveEnemies.ts`) — quanto mais fundo, mais e mais fortes. Pisar na escada de
 * descida leva ao andar seguinte, na de subida ao anterior (do andar 1, de volta à entrada na superfície). O jogador ataca com a espada (ESPAÇO) como em qualquer lugar; morrer
 * o leva pra casa (`systems/playerDeath.ts`). O andar mais fundo alcançado (`gameState.cave.deepest`) vai pro save e libera um atalho a cada 5 andares na entrada.
 */
export class CaveFloorScene extends Phaser.Scene {
  private entry!: CaveFloorEntryData;
  private config!: CaveFloorConfig;
  private layout!: CaveLayout;
  private player!: Player;
  private controller!: PlayerController;
  private enemies!: CaveEnemies;
  private petCompanion?: PetCompanion;
  private lockedMessage!: LockedMessage;
  private worldBlur!: WorldBlur;
  private counterText!: Phaser.GameObjects.Text;
  private isLeaving = false;
  private hordeWarned = false;

  constructor() {
    super(CAVE_FLOOR_SCENE_KEY);
  }

  init(data: CaveFloorEntryData): void {
    this.entry = data;
    this.config = caveFloorConfig(data.floor);
    this.layout = generateCaveFloor(this.config);
    // A instância da cena é reaproveitada entre `scene.start()`.
    this.isLeaving = false;
    this.hordeWarned = false;
  }

  preload(): void {
    this.load.spritesheet(CAVE_TILES.key, encodeURI(`/${CAVE_TILES.path}`), { frameWidth: CAVE_TILES.size, frameHeight: CAVE_TILES.size });
    this.load.spritesheet(CAVE_STAIRS.key, encodeURI(`/${CAVE_STAIRS.path}`), { frameWidth: CAVE_STAIRS.size, frameHeight: CAVE_STAIRS.size });
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);
    preloadSheets(this, enemySheetsFor(this.config));
  }

  create(): void {
    const tilePx = TILE_SIZE * DISPLAY_SCALE;
    const { cols, rows, walls, stairsUp, stairsDown, playerSpawn } = this.layout;
    const isBottom = this.config.floor >= CAVE_MAX_FLOOR;

    this.cameras.main.setBackgroundColor(VOID_COLOR);
    this.buildTiles(tilePx);

    // Escadas: a de subida onde o jogador chega e a de descida (o último andar não tem — é o fundo).
    this.addStairs(stairsUp, CAVE_STAIRS.upFrame, tilePx);
    if (!isBottom) this.addStairs(stairsDown, CAVE_STAIRS.downFrame, tilePx);

    const wallCells: Array<[number, number]> = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (walls[row][col]) wallCells.push([col, row]);
    const grid = buildExternalGrid(cols, rows, wallCells);
    const interactions = new InteractionRegistry();

    Player.createAnimations(this, gameState.profile.characterId);
    // Nasce junto da escada por onde chegou.
    const spawn = this.entry.from === 'below' ? { col: stairsDown.col, row: stairsDown.row + 1 } : playerSpawn;
    this.player = new Player(this, spawn.col, spawn.row, tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);
    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    for (const menuOpen of [isInventoryOpen, isFurnaceMenuOpen, isDialogueOpen]) this.controller.addInputInterceptor({ isActive: () => menuOpen(), handleClick: () => {} });
    this.controller.addInputInterceptor({ isActive: () => this.isLeaving, handleClick: () => {} });

    this.enemies = new CaveEnemies(this, this.config, this.layout, grid, tilePx, this.player);
    this.controller.setEnemyProvider(() => this.enemies.getAliveEnemies());

    setupWorldCamera(this, this.player.sprite, cols * tilePx, rows * tilePx);
    this.worldBlur = new WorldBlur(this.cameras.main);
    this.lockedMessage = new LockedMessage(this);
    ensureUIScene(this);
    attachFootstepSounds(this, () => 'bridge');

    if (gameState.petUnlocked) this.petCompanion = new PetCompanion(this, this.player, this.controller, grid, tilePx, PET_ROAM.area, (col, row) => col > 0 && row > 0 && col < cols - 1 && row < rows - 1);

    onPlayerStepped(this, (col, row) => {
      if (this.isLeaving) return;
      if (col === stairsUp.col && row === stairsUp.row) this.travel(this.config.floor - 1, 'below');
      else if (!isBottom && col === stairsDown.col && row === stairsDown.row) this.travel(this.config.floor + 1, 'above');
    });

    this.input.keyboard!.on('keydown-E', () => {
      if (isDialogueOpen()) return;
      if (isFurnaceMenuOpen()) closeFurnaceMenu();
      toggleInventoryScreen();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (isInventoryOpen()) closeInventoryScreen();
      else if (isFurnaceMenuOpen()) closeFurnaceMenu();
    });

    this.buildHud(isBottom);
    this.enemies.onCleared = () => this.lockedMessage.show(isBottom ? 'O FUNDO DA CAVERNA' : 'ANDAR LIMPO', isBottom ? 'Você derrotou o Guardião do abismo!' : 'A escada de descida está livre.');

    // Registra o andar alcançado e libera o atalho a cada 5 andares.
    const firstTime = this.config.floor > gameState.cave.deepest;
    if (firstTime) {
      gameState.cave.deepest = this.config.floor;
      if (this.config.floor % 5 === 0) {
        playEffect(this, UNLOCK_SOUND);
        this.lockedMessage.show('ATALHO DESBLOQUEADO', `Você pode começar direto no andar ${this.config.floor}.`);
        saveGame();
      }
    }
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  /** Chão e paredes do `Tileset` de dungeon, com o tom da zona (um clima diferente a cada 10 andares). */
  private buildTiles(tilePx: number): void {
    const { cols, rows, walls } = this.layout;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wall = walls[row][col];
        const hash = (col * 73856093) ^ (row * 19349663);
        const variants = wall ? CAVE_TILES.wallFrames : CAVE_TILES.floorFrames;
        // Rachaduras (as variações 1+) só de vez em quando; o chão liso (0) domina.
        const frame = wall ? variants[Math.abs(hash) % variants.length] : Math.abs(hash) % 7 === 0 ? variants[1 + (Math.abs(hash >> 3) % (variants.length - 1))] : variants[0];
        const tile = this.add.image(col * tilePx, row * tilePx, CAVE_TILES.key, frame);
        tile.setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(wall ? 0 : -2).setTint(this.config.tint);
      }
    }
  }

  private addStairs(cell: { col: number; row: number }, frame: number, tilePx: number): void {
    const stairs = this.add.image(cell.col * tilePx, cell.row * tilePx, CAVE_STAIRS.key, frame);
    stairs.setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(-1).setTint(this.config.tint);
  }

  private buildHud(isBottom: boolean): void {
    const centerX = this.scale.width / 2;
    const name = isBottom ? 'O Fundo da Caverna' : `Andar ${this.config.floor}`;
    this.add.text(centerX, 20, `Caverna — ${name}`, TITLE_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.counterText = this.add.text(centerX, 42, '', HINT_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.refreshCounter();
  }

  private refreshCounter(): void {
    const { left, total } = this.enemies.remaining();
    const guardian = this.config.guardian ? ' (Guardião!)' : '';
    this.counterText.setText(left > 0 ? `Inimigos: ${left}/${total}${guardian}` : 'Andar limpo — pise na escada pra descer');
  }

  update(time: number, delta: number): void {
    const menuOpen = isInventoryOpen() || isFurnaceMenuOpen() || isDialogueOpen();
    if (!menuOpen) {
      this.controller.update(time, delta);
      this.petCompanion?.update(time, delta);
      this.enemies.update(time, delta);
    }
    this.refreshCounter();

    // O dia corre aqui também (a Caverna não pausa o relógio).
    const { dayTurn, hordeMissed } = advanceWorldTime(delta, false);
    if (dayTurn) {
      const { title, subtitle } = describeNewDay();
      this.lockedMessage.show(title, subtitle);
    }
    if (hordeMissed) this.lockedMessage.show('A HORDA PASSOU', 'Você estava longe da Fazenda: sem recompensa.');
    if (!this.hordeWarned && shouldStartHorde()) {
      this.hordeWarned = true;
      this.lockedMessage.show('A HORDA CHEGOU!', 'Volte para a Fazenda e defenda-a antes da meia-noite!');
    }
    this.worldBlur.setActive(menuOpen);
  }

  /** Escada usada: vai ao andar `floor` (0 = a entrada na superfície). */
  private travel(floor: number, from: 'above' | 'below'): void {
    if (this.isLeaving) return;
    this.isLeaving = true;
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (floor <= 0) {
        // De volta à superfície, em frente à entrada da caverna.
        this.scene.start('CaveScene', { ...this.entry.surface, spawnPoint: { col: 12, row: 5 } });
        return;
      }
      const data: CaveFloorEntryData = { floor, from, surface: this.entry.surface };
      this.scene.start(CAVE_FLOOR_SCENE_KEY, data);
    });
  }
}
