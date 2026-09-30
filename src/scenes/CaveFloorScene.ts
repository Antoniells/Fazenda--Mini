import Phaser from 'phaser';
import { ExternalMapEntryData, buildExternalGrid } from './ExternalMapScene';
import { CAVE_MAX_FLOOR, caveFloorConfig, CaveFloorConfig } from '../data/caveFloors';
import { CaveLayout, generateCaveFloor, generateSanctuaryFloor } from '../systems/caveGenerator';
import { CaveEnemies, enemySheetsFor } from '../systems/caveEnemies';
import { preloadSheets } from '../entities/cave/caveAnims';
import { CAVE_TILES, CAVE_STAIRS } from '../data/caveTiles';
import { TILE_SIZE, ORE_KEY, ORE_PATH } from '../data/tiles';
import { buildOreDeposit } from '../systems/externalMapBuilder';
import { OreInteractable } from '../systems/oreInteraction';
import { placeCaveOres } from '../systems/caveOres';
import { buildCaveLandmarks, forgottenChestCell, isBarrierActive, preloadCaveLandmarks } from '../systems/caveLandmarks';
import { BARRIER_FLOOR, FINAL_FLOOR, FINAL_HORDE_WAVES, FINAL_HORDE_WAVE_DELAY_MS } from '../data/caveLandmarks';
import { SANCTUARY_LINES, SANCTUARY_TINT } from '../data/sanctuary';
import { Sanctuary, grantGoldenSeed, preloadSanctuary } from '../systems/sanctuary';
import { hasMilestone, isWorldAtPeace, reachMilestone } from '../systems/story';
import { isEnchantedPickaxeSelected } from '../systems/enchanting';
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
import { WalkableGrid } from '../systems/grid';
import { attachFootstepSounds, playEffect } from '../systems/soundEffects';
import { onPlayerStepped } from '../systems/sceneEvents';
import { advanceWorldTime, describeNewDay } from '../systems/worldTime';
import { shouldRecallToFarm, recallToFarm } from '../systems/hordeRecall';
import { LockedMessage } from '../ui/lockedMessage';
import { WorldBlur } from '../systems/worldBlur';
import { UNLOCK_SOUND } from '../data/audio';
import { ensureUIScene, isInventoryOpen, toggleInventoryScreen, closeInventoryScreen, isFurnaceMenuOpen, closeFurnaceMenu, isDialogueOpen, isPauseMenuOpen, escapeTogglesPause } from './UIScene';

export const CAVE_FLOOR_SCENE_KEY = 'CaveFloorScene';

/** O que a Caverna (a entrada na superfície, `CaveScene`) ou o andar vizinho manda ao abrir um andar. */
export interface CaveFloorEntryData {
  floor: number;
  /** De onde o jogador vem: de CIMA (desceu a escada do andar anterior, nasce junto da escada de subida) ou de BAIXO (subiu do andar seguinte, nasce junto da escada de descida). */
  from: 'above' | 'below';
  /** Os dados da entrada da Caverna na superfície — pra voltar pra ela ao subir do andar 1. */
  surface: ExternalMapEntryData;
  /** O santuário acabou de se revelar (a Horda Final caiu agora): mostra a fala da luz ao abrir. */
  sanctuaryRevealed?: boolean;
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
  /** Andar 100 depois da Horda Final (`systems/sanctuary.ts`): sem inimigos, o altar, o lago e o ritual. */
  private sanctuary: Sanctuary | null = null;
  /** Andar 100 antes dele: quantas ondas extras da Horda Final já vieram (`FINAL_HORDE_WAVES`). */
  private wavesSpawned = 0;
  private waveIncoming = false;

  constructor() {
    super(CAVE_FLOOR_SCENE_KEY);
  }

  init(data: CaveFloorEntryData): void {
    this.entry = data;
    this.config = caveFloorConfig(data.floor);
    // O andar 100 depois da Horda Final é o santuário: um salão aberto, claro e sem inimigos.
    if (this.isSanctuaryFloor()) this.config = { ...this.config, enemyCount: 0, guardian: false, tint: SANCTUARY_TINT };
    // Depois do fim da história a luz do Sábio Coelho limpou as Cavernas: nenhum andar tem monstros.
    else if (isWorldAtPeace()) this.config = { ...this.config, enemyCount: 0, guardian: false };
    this.layout = this.isSanctuaryFloor() ? generateSanctuaryFloor(this.config) : generateCaveFloor(this.config);
    // A instância da cena é reaproveitada entre `scene.start()`.
    this.isLeaving = false;
    this.sanctuary = null;
    this.wavesSpawned = 0;
    this.waveIncoming = false;
  }

  preload(): void {
    this.load.spritesheet(CAVE_TILES.key, encodeURI(`/${CAVE_TILES.path}`), { frameWidth: CAVE_TILES.size, frameHeight: CAVE_TILES.size });
    this.load.spritesheet(CAVE_STAIRS.key, encodeURI(`/${CAVE_STAIRS.path}`), { frameWidth: CAVE_STAIRS.size, frameHeight: CAVE_STAIRS.size });
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);
    preloadSheets(this, enemySheetsFor(this.config));
    if (!this.textures.exists(ORE_KEY)) this.load.image(ORE_KEY, encodeURI(`/${ORE_PATH}`));
    preloadCaveLandmarks(this);
    if (this.config.floor === FINAL_FLOOR) preloadSanctuary(this);
  }

  private isSanctuaryFloor(): boolean {
    return this.config.floor === FINAL_FLOOR && hasMilestone('sanctuary');
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
    for (const menuOpen of [isInventoryOpen, isFurnaceMenuOpen, isDialogueOpen, isPauseMenuOpen]) this.controller.addInputInterceptor({ isActive: () => menuOpen(), handleClick: () => {} });
    this.controller.addInputInterceptor({ isActive: () => this.isLeaving, handleClick: () => {} });

    // Andar 50: o baú esquecido fica ao lado da escada de descida — ninguém nasce em cima dele.
    const chestCell = this.config.floor === BARRIER_FLOOR ? forgottenChestCell(stairsDown, cols) : null;
    if (chestCell) this.layout.spawnCells = this.layout.spawnCells.filter((cell) => cell.col !== chestCell.col || cell.row !== chestCell.row);

    this.enemies = new CaveEnemies(this, this.config, this.layout, grid, tilePx, this.player);
    this.controller.setEnemyProvider(() => this.enemies.getAliveEnemies());

    if (!this.isSanctuaryFloor()) this.buildOres(grid, interactions);
    this.lockedMessage = new LockedMessage(this);
    if (chestCell) {
      buildCaveLandmarks({
        scene: this,
        floor: this.config.floor,
        tilePx,
        stairsDown,
        chestCell,
        grid,
        interactions,
        player: this.player,
        message: this.lockedMessage,
        canBreakBarrier: () => isEnchantedPickaxeSelected(), // A Picareta encantada na Mesa do Mago.
        onBarrierBroken: () => this.refreshCounter(),
      });
    }

    setupWorldCamera(this, this.player.sprite, cols * tilePx, rows * tilePx);
    this.worldBlur = new WorldBlur(this.cameras.main);
    ensureUIScene(this);
    attachFootstepSounds(this, () => 'bridge');

    if (gameState.petUnlocked) this.petCompanion = new PetCompanion(this, this.player, this.controller, grid, tilePx, PET_ROAM.area, (col, row) => col > 0 && row > 0 && col < cols - 1 && row < rows - 1);

    if (this.isSanctuaryFloor()) {
      this.sanctuary = new Sanctuary({ scene: this, tilePx, grid, interactions, player: this.player, message: this.lockedMessage, petCompanion: () => this.petCompanion });
      this.sanctuary.build();
      if (this.entry.sanctuaryRevealed) this.time.delayedCall(700, () => this.lockedMessage.show('O SANTUÁRIO', SANCTUARY_LINES.revealed));
    }

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
      else escapeTogglesPause(); // Nada aberto: a Pausa.
    });

    this.buildHud(isBottom);
    this.enemies.onCleared = () => {
      if (this.config.floor === FINAL_FLOOR && !this.isSanctuaryFloor()) this.nextFinalWave();
      else this.lockedMessage.show('ANDAR LIMPO', 'A escada de descida está livre.');
    };
    if (this.config.floor === FINAL_FLOOR && !this.isSanctuaryFloor() && !isWorldAtPeace()) this.time.delayedCall(400, () => this.lockedMessage.show('A HORDA FINAL', `Derrote cada criatura: ${FINAL_HORDE_WAVES.length + 1} ondas.`));

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

  /**
   * Os VEIOS do andar (`systems/caveOres.ts`): encostados nas paredes, fora de onde os inimigos nascem, sem fechar passagem — minerados
   * com a Picareta como os da Pedreira, mas de uma visita só. A primeira Azurita (andar 45+) é um marco da história.
   */
  private buildOres(grid: WalkableGrid, interactions: InteractionRegistry): void {
    const { spawnCells } = this.layout;
    const occupied = new Set(spawnCells.slice(0, this.config.enemyCount + 1).map((cell) => `${cell.col},${cell.row}`));
    const last = spawnCells[spawnCells.length - 1];
    if (last) occupied.add(`${last.col},${last.row}`);
    for (const ore of placeCaveOres(this.config, this.layout, occupied)) {
      const sprite = buildOreDeposit(this, TILE_SIZE, ore.col, ore.row, ore.kind);
      grid.block(ore.col, ore.row);
      interactions.set(ore.col, ore.row, new OreInteractable(this.player, { sprite }, grid, interactions, null, ore.col, ore.row, ore.kind, (kind) => {
        if (kind === 'azurite' && reachMilestone('azurite')) this.lockedMessage.show('AZURITA!', 'Um minério raro e cintilante. Dizem que serve para forjar magia.');
      }));
    }
  }

  /** HORDA FINAL (andar 100): cada vez que o andar esvazia vem a próxima onda; depois da última, o santuário se revela. */
  private nextFinalWave(): void {
    if (this.wavesSpawned < FINAL_HORDE_WAVES.length) {
      const wave = FINAL_HORDE_WAVES[this.wavesSpawned];
      this.wavesSpawned += 1;
      this.waveIncoming = true;
      this.lockedMessage.show(`ONDA ${this.wavesSpawned + 1} DE ${FINAL_HORDE_WAVES.length + 1}`, wave.guardian ? 'A última onda vem com um Guardião!' : 'A horda não para!');
      this.time.delayedCall(FINAL_HORDE_WAVE_DELAY_MS, () => {
        this.waveIncoming = false;
        this.enemies.spawnWave(wave.count, wave.guardian);
      });
      return;
    }
    this.revealSanctuary();
  }

  /** A Horda Final caiu: o marco `sanctuary`, a semente dourada na Bolsa e, num clarão, o andar reabre como o santuário. */
  private revealSanctuary(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;
    reachMilestone('sanctuary');
    grantGoldenSeed();
    saveGame();
    this.cameras.main.shake(900, 0.008);
    this.cameras.main.fadeOut(1600, 255, 250, 220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data: CaveFloorEntryData = { floor: FINAL_FLOOR, from: 'above', surface: this.entry.surface, sanctuaryRevealed: true };
      this.scene.start(CAVE_FLOOR_SCENE_KEY, data);
    });
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
    const name = this.isSanctuaryFloor() ? 'O Santuário do Sábio Coelho' : isBottom ? 'O Fundo da Caverna' : `Andar ${this.config.floor}`;
    this.add.text(centerX, 20, `Caverna — ${name}`, TITLE_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.counterText = this.add.text(centerX, 42, '', HINT_STYLE).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000);
    this.refreshCounter();
  }

  private refreshCounter(): void {
    if (this.isSanctuaryFloor()) {
      this.counterText.setText('Um lugar de paz');
      return;
    }
    if (isWorldAtPeace()) {
      this.counterText.setText('As Cavernas estão em paz');
      return;
    }
    const { left, total } = this.enemies.remaining();
    if (this.config.floor === FINAL_FLOOR) {
      const wave = `HORDA FINAL — onda ${this.wavesSpawned + 1}/${FINAL_HORDE_WAVES.length + 1}`;
      this.counterText.setText(this.waveIncoming ? `${wave} — prepare-se!` : `${wave} — inimigos: ${left}/${total}`);
      return;
    }
    const guardian = this.config.guardian ? ' (Guardião!)' : '';
    const cleared = isBarrierActive(this.config.floor) ? 'Andar limpo — uma barreira mágica bloqueia a descida' : 'Andar limpo — pise na escada pra descer';
    this.counterText.setText(left > 0 ? `Inimigos: ${left}/${total}${guardian}` : cleared);
  }

  update(time: number, delta: number): void {
    if (isPauseMenuOpen()) {
      this.worldBlur.setActive(true); // Pausa aberta: o andar (e o relógio) para.
      return;
    }
    const menuOpen = isInventoryOpen() || isFurnaceMenuOpen() || isDialogueOpen();
    if (!menuOpen) {
      this.controller.update(time, delta);
      this.petCompanion?.update(time, delta);
      this.enemies.update(time, delta);
      this.sanctuary?.update(delta);
    }
    this.refreshCounter();

    // O dia corre aqui também (a Caverna não pausa o relógio).
    const { dayTurn, hordeMissed } = advanceWorldTime(delta, false);
    if (dayTurn) {
      const { title, subtitle } = describeNewDay();
      this.lockedMessage.show(title, subtitle);
    }
    if (hordeMissed) this.lockedMessage.show('A HORDA PASSOU', 'Você estava longe da Fazenda: sem recompensa.');
    // Hora da horda: o jogador é levado pra Fazenda, mesmo do fundo da Caverna (`systems/hordeRecall.ts`).
    if (!this.isLeaving && !this.sanctuary?.isRitualRunning() && shouldRecallToFarm()) {
      this.isLeaving = true;
      recallToFarm(this);
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
