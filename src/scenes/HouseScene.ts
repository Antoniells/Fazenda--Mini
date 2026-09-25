import Phaser from 'phaser';
import { houseMap, HOUSE_ART } from '../data/maps/houseMap';
import { TILE_SIZE } from '../data/tiles';
import { SHADOW_KEY, SHADOW_PATH } from '../data/effects';
import { PLAYER_START } from '../data/player';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildExternalGrid } from './ExternalMapScene';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { InteractionRegistry } from '../systems/interaction';
import { createGroundShadow } from '../systems/shadow';
import { attachFootstepSounds, playEffect } from '../systems/soundEffects';
import { DOOR_SOUND, DOOR_KNOCK_SOUND, SLEEP_SOUND } from '../data/audio';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { preloadPet } from '../systems/petSprites';
import { PetCompanion } from '../systems/petCompanion';
import { recordSleepInBed } from '../systems/petEvent';
import { getSleepBlockReason, shouldStartHorde } from '../systems/horde';
import { onPlayerStepped } from '../systems/sceneEvents';
import { PET_ROAM } from '../data/pets';
import { gameState } from '../systems/gameState';
import { registerSleepInteractable } from '../systems/sleepInteraction';
import { startNextDay } from '../systems/dayCycle';
import { advanceWorldTime } from '../systems/worldTime';
import { DayNightOverlay } from '../systems/dayNightOverlay';
import { WorldBlur } from '../systems/worldBlur';
import { dayMusic } from '../systems/dayMusic';
import {
  ensureUIScene,
  isInventoryOpen,
  toggleInventoryScreen,
  closeInventoryScreen,
  isCraftingMenuOpen,
  closeCraftingMenu,
  isChestMenuOpen,
  closeChestMenu,
  HOTBAR_CHANGED_EVENT,
} from './UIScene';
import { FurniturePlacementSystem, preloadFurniture } from '../systems/furniturePlacement';
import { DECORATIONS, DecorationDefinition, PET_BED } from '../data/decorations';
import type { GridPoint } from '../systems/pathfinding';

export const HOUSE_SCENE_KEY = 'HouseScene';
const MAIN_SCENE_KEY = 'MainScene';

const FADE_MS = 300;
const SLEEP_FADE_MS = 700;
/** O cômodo (8x8 células = 256px) é ampliado 2x na câmera pra ocupar bem a janela — inteiro, então os pixels continuam nítidos. */
const ROOM_ZOOM = 2;
/** Fração do véu da noite aplicada dentro de casa (ao ar livre é 1): o cômodo tem luz própria, mas escurece com o resto do mundo. */
const INDOOR_NIGHT_INTENSITY = 0.55;
const ROOM_BACKGROUND = '#1b120b';

/**
 * As células que a caminha do bichinho ocupa AGORA (lidas de `gameState.placedFurniture`, então acompanham a caminha sendo posicionada,
 * recolhida ou trocada de lugar com a cena aberta) — o pet (`Pet`, pedido explícito do usuário) escolhe, na hora de decidir dormir, um
 * lado livre dela e sobe nela. Vazio se não há caminha posicionada.
 */
function petBedCells(): GridPoint[] {
  const cells: GridPoint[] = [];
  for (const record of gameState.placedFurniture.values()) {
    if (record.decorationId !== PET_BED.id) continue;
    const footprint = DECORATIONS[PET_BED.id]?.footprint ?? { width: 1, height: 1 };
    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) cells.push({ col: record.col + dx, row: record.row + dy });
    }
  }
  return cells;
}

const HINT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '8px',
  fontStyle: 'bold',
  color: '#ffe9b3',
  stroke: '#2b1d0e',
  strokeThickness: 2,
  align: 'center',
};

/**
 * Interior da casa (pedido explícito): cômodo fechado de 8x8 (`data/maps/
 * houseMap.ts`) — borda de parede bloqueada, chão de madeira (placeholder),
 * a cama e a porta de saída. Entra-se pela porta da Fazenda
 * (`systems/enterHouseInteraction.ts`, fade out → esta cena) e sai-se pisando
 * na célula da porta (fade out → volta à Fazenda, em frente à porta de fora).
 *
 * DORMIR mora aqui, na cama (`systems/sleepInteraction.ts`): fade out →
 * `startNextDay` (relógio pras 06:00, vida cheia, lavoura/clima/mundo do dia
 * seguinte, SALVA) → fade in — acordando no mesmo lugar, dentro de casa. O
 * relógio corre aqui dentro como em qualquer cena (`systems/worldTime.ts`) e o véu
 * da noite também aparece, só mais leve (`INDOOR_NIGHT_INTENSITY`: dentro de casa há luz).
 *
 * Mesma "cola" das cenas de mapa (Player, PlayerController, `UIScene`
 * persistente pra Hotbar/Inventário/HUD), só que sem ponte, sem lavoura e com
 * a câmera parada no centro do cômodo (não segue o jogador — o cômodo cabe
 * inteiro na janela).
 */
export class HouseScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  private petCompanion?: PetCompanion;
  private furniture!: FurniturePlacementSystem;
  private isSleeping = false;
  private isLeaving = false;
  private dayNightOverlay!: DayNightOverlay;
  private worldBlur!: WorldBlur;

  constructor() {
    super(HOUSE_SCENE_KEY);
  }

  init(): void {
    // A instância da cena é reaproveitada entre `scene.start()` — sem isso as travas ficariam `true` depois da 1ª visita.
    this.isSleeping = false;
    this.isLeaving = false;
  }

  preload(): void {
    // Auto-suficiente (nunca depende de a Fazenda já ter carregado algo): chão/cama, sombra e o sprite do personagem escolhido.
    this.load.image(HOUSE_ART.floor.key, encodeURI(`/${HOUSE_ART.floor.path}`));
    this.load.image(HOUSE_ART.bed.key, encodeURI(`/${HOUSE_ART.bed.path}`));
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);
    preloadFurniture(this);
  }

  create(): void {
    const { cols, rows, exitPosition, spawnPosition, bedPosition, bedFootprint } = houseMap;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;

    Player.createAnimations(this, gameState.profile.characterId);

    this.buildRoom(cols, rows, tilePx, exitPosition);

    // Colisão: parede em volta + as células da cama.
    const bedCells: Array<[number, number]> = [];
    for (let dy = 0; dy < bedFootprint.height; dy++) {
      for (let dx = 0; dx < bedFootprint.width; dx++) bedCells.push([bedPosition[0] + dx, bedPosition[1] + dy]);
    }
    const grid = buildExternalGrid(cols, rows, bedCells);
    grid.unblock(exitPosition[0], exitPosition[1]); // A porta fura a parede de baixo.

    this.buildBed(bedPosition, bedFootprint, tilePx);

    this.player = new Player(this, spawnPosition[0], spawnPosition[1], tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);
    this.player.faceDirection(0, -1); // Entra de frente pro cômodo.

    // Dormir mora na cama: interagir com qualquer célula dela (o `PlayerController` leva o jogador até ao lado).
    const interactions = new InteractionRegistry();
    registerSleepInteractable(bedCells, this.player, () => this.sleep(), interactions);
    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);

    // O pet entra junto e passeia pelo cômodo — só a porta de saída fica fora do passeio dele.
    // O pet só existe depois de desbloqueado (evento da caixa, `systems/petEvent.ts`).
    if (gameState.petUnlocked) {
      this.petCompanion = new PetCompanion(
        this,
        this.player,
        this.controller,
        grid,
        tilePx,
        PET_ROAM.house,
        (col, row) => !(col === exitPosition[0] && row === exitPosition[1]),
        petBedCells,
      );
    }

    // Móveis (Baú, Cadeira, Mesa, Sofá, Cômoda): posicionados aqui dentro, bloqueiam o grid; o cômodo nunca perde o acesso à cama.
    const bedSet = new Set(bedCells.map(([c, r]) => `${c},${r}`));
    const bedAccess: Array<{ col: number; row: number }> = [];
    for (const [c, r] of bedCells) {
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const cell = { col: c + dc, row: r + dr };
        if (!bedSet.has(`${cell.col},${cell.row}`) && grid.isWalkable(cell.col, cell.row)) bedAccess.push(cell);
      }
    }
    this.furniture = new FurniturePlacementSystem(this, tilePx, grid, gameState.inventory, interactions, this.player, {
      cols,
      rows,
      reserved: [{ col: spawnPosition[0], row: spawnPosition[1] }, { col: exitPosition[0], row: exitPosition[1] }],
      spawn: { col: spawnPosition[0], row: spawnPosition[1] },
      bedAccess,
    });
    this.furniture.restorePlacements();
    this.controller.addInputInterceptor(this.furniture);

    // Trava de clique enquanto dorme / Inventário, Bancada ou Baú aberto (mesma ideia da Fazenda).
    this.controller.addInputInterceptor({
      isActive: () => this.isSleeping || this.isLeaving || isInventoryOpen() || isCraftingMenuOpen() || isChestMenuOpen(),
      handleClick: () => {},
    });

    // Sentado (Cadeira/Sofá): o primeiro clique só levanta (não anda nem age junto).
    this.controller.addInputInterceptor({
      isActive: () => this.player.isSitting(),
      handleClick: () => this.player.standUp(),
    });

    // Selecionar um móvel na Hotbar entra no modo de posicionamento (como as decorações na Fazenda); qualquer outra seleção sai dele. Tecla B alterna.
    const selectedFurniture = (): DecorationDefinition | undefined => {
      const slot = gameState.inventory.getSelectedSlot();
      const decoration = slot?.category === 'decoration' ? DECORATIONS[slot.id] : undefined;
      return decoration?.placement === 'house' ? decoration : undefined;
    };
    const onHotbarChanged = (): void => {
      const furniture = selectedFurniture();
      if (furniture) {
        if (!this.furniture.isActive()) this.furniture.toggle(furniture);
      } else this.furniture.cancel();
    };
    this.game.events.on(HOTBAR_CHANGED_EVENT, onHotbarChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(HOTBAR_CHANGED_EVENT, onHotbarChanged));
    this.input.keyboard!.on('keydown-B', () => {
      const furniture = selectedFurniture();
      if (furniture) this.furniture.toggle(furniture);
    });

    // Sons de passo de madeira (a "ponte" é o único piso de tábua do jogo).
    attachFootstepSounds(this, () => 'bridge');

    // Pisar na porta = sair.
    onPlayerStepped(this, (col, row) => {
      if (col === exitPosition[0] && row === exitPosition[1]) this.leaveHouse();
    });

    // Câmera parada no centro do cômodo, ampliada.
    const cam = this.cameras.main;
    cam.setBackgroundColor(ROOM_BACKGROUND);
    cam.setZoom(ROOM_ZOOM);
    cam.centerOn((cols * tilePx) / 2, (rows * tilePx) / 2);

    ensureUIScene(this);
    this.input.keyboard!.on('keydown-E', () => {
      if (isChestMenuOpen()) return; // O baú já mostra a bolsa; E não abre outra tela por cima.
      if (isCraftingMenuOpen()) closeCraftingMenu();
      this.furniture.cancel();
      toggleInventoryScreen();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.furniture.isActive()) this.furniture.cancel();
      else if (isChestMenuOpen()) closeChestMenu();
      else if (isInventoryOpen()) closeInventoryScreen();
      else if (isCraftingMenuOpen()) closeCraftingMenu();
    });

    // Dica (some sozinha): a cama é o jeito de dormir.
    const hint = this.add
      .text((cols * tilePx) / 2 + tilePx * 0.8, tilePx * 3.3, 'Clique na cama\npara dormir', HINT_STYLE)
      .setOrigin(0.5, 0.5)
      .setResolution(ROOM_ZOOM)
      .setDepth(4000);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 900, onComplete: () => hint.destroy() });

    this.dayNightOverlay = new DayNightOverlay(this, INDOOR_NIGHT_INTENSITY);
    this.worldBlur = new WorldBlur(this.cameras.main);

    cam.fadeIn(FADE_MS, 0, 0, 0);
  }

  /** Chão de tábuas + paredes (a mesma tábua escurecida) + a porta (tábua clara) — tudo com a arte real do `HOUSE_ART`. */
  private buildRoom(cols: number, rows: number, tilePx: number, exit: [number, number]): void {
    const texture = this.textures.get(HOUSE_ART.floor.key);
    const { name, rect } = HOUSE_ART.floor.frame;
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isWall = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
        const isDoor = col === exit[0] && row === exit[1];

        const tile = this.add.image(col * tilePx, row * tilePx, HOUSE_ART.floor.key, name);
        tile.setOrigin(0, 0);
        tile.setScale(DISPLAY_SCALE);
        tile.setDepth(isWall ? 0 : -1);
        if (isDoor) tile.setTint(HOUSE_ART.doorTint);
        else if (isWall) tile.setTint(HOUSE_ART.wallTint);
      }
    }
  }

  private buildBed(bedPosition: [number, number], footprint: { width: number; height: number }, tilePx: number): void {
    const texture = this.textures.get(HOUSE_ART.bed.key);
    const { name, rect } = HOUSE_ART.bed.frame;
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);

    const x = bedPosition[0] * tilePx + (footprint.width * tilePx) / 2;
    const y = (bedPosition[1] + footprint.height) * tilePx;

    const shadow = createGroundShadow(this, x, y - 4, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    shadow.setDepth(y - 0.2);

    const bed = this.add.image(x, y, HOUSE_ART.bed.key, name);
    bed.setOrigin(0.5, 1);
    bed.setScale(DISPLAY_SCALE);
    bed.setDepth(y);
  }

  update(time: number, delta: number): void {
    const menuOpen = isInventoryOpen() || isCraftingMenuOpen() || isChestMenuOpen();
    if (!this.isSleeping && !this.isLeaving && !menuOpen) this.controller.update(time, delta);
    if (!this.isLeaving && !menuOpen) this.petCompanion?.update(time, delta);

    // A horda chegou com o jogador em casa: ele é posto pra fora (a Fazenda precisa de defesa).
    if (!this.isLeaving && !this.isSleeping && (gameState.horde.active || shouldStartHorde())) {
      this.showNotice('A horda chegou! Defenda a Fazenda!');
      this.leaveHouse();
    }

    // O dia corre aqui também (a horda que amanhece com o jogador em casa termina sem bônus — ver `advanceWorldTime`).
    // Dormindo, `startNextDay` conduz o relógio: não soma tempo por cima.
    if (!this.isSleeping) advanceWorldTime(delta, false);
    this.dayNightOverlay.setNightAlpha(gameState.gameClock.getNightAlpha());
    this.worldBlur.setActive(menuOpen);
  }

  /** Sai pela porta: fade out e volta à Fazenda, na célula em frente à porta de fora. */
  private leaveHouse(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;
    playEffect(this, DOOR_SOUND);
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(MAIN_SCENE_KEY, { spawnPoint: { col: PLAYER_START.col, row: PLAYER_START.row } });
    });
  }

  /**
   * Dormir (pedido explícito): fade out → `startNextDay` (acorda às 06:00,
   * vida cheia, mundo/lavoura do dia seguinte, SALVA) → fade in. A música do
   * dia sai junto com a tela escurecendo e volta sozinha quando o dia novo
   * começa (`dayMusic` deriva isso do relógio).
   */
  private sleep(): void {
    if (this.isSleeping || this.isLeaving) return;

    // Dormir pularia a horda (a cada 10 dias): durante ela — e no dia dela, antes de ela rolar — a cama fica bloqueada.
    const blocked = getSleepBlockReason();
    if (blocked) {
      this.showNotice(blocked);
      return;
    }
    this.isSleeping = true;

    playEffect(this, SLEEP_SOUND);
    dayMusic.endDay(SLEEP_FADE_MS);
    const camera = this.cameras.main;
    camera.fadeOut(SLEEP_FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Conta o sono ANTES da virada (que salva): o 3º sono faz a caixa do pet aparecer lá fora (evento narrativo).
      const petBoxAppeared = recordSleepInBed();
      startNextDay();
      console.log(`Dia ${gameState.gameClock.getDay()} começou (dormiu).`);
      this.showWakeUpMessage(petBoxAppeared);

      camera.fadeIn(SLEEP_FADE_MS, 0, 0, 0);
      camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isSleeping = false;
      });
    });
  }

  /** Aviso curto no centro do cômodo (some sozinho) — ex.: a cama bloqueada por causa da horda. */
  private showNotice(message: string): void {
    const { cols, rows } = houseMap;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;
    const text = this.add
      .text((cols * tilePx) / 2, (rows * tilePx) / 2, message, { ...HINT_STYLE, fontSize: '10px', strokeThickness: 3, align: 'center', wordWrap: { width: cols * tilePx * 0.85 } })
      .setOrigin(0.5, 0.5)
      .setResolution(ROOM_ZOOM)
      .setDepth(4000);
    this.tweens.add({ targets: text, alpha: 0, delay: 2600, duration: 700, onComplete: () => text.destroy() });
  }

  /** "Bom dia!" + o número do dia, no centro do cômodo — aparece ao acordar e some sozinho. */
  private showWakeUpMessage(petBoxAppeared = false): void {
    const { cols, rows } = houseMap;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;
    const extra = petBoxAppeared ? '\n(Você ouviu algo do lado de fora...)' : '';
    if (petBoxAppeared) playEffect(this, DOOR_KNOCK_SOUND); // Batem na porta: a caixa do pet chegou.
    const text = this.add
      .text((cols * tilePx) / 2, (rows * tilePx) / 2 - tilePx, `Bom dia!\nDia ${gameState.gameClock.getDay()}${extra}`, { ...HINT_STYLE, fontSize: '14px', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 0.5)
      .setResolution(ROOM_ZOOM)
      .setDepth(4000)
      .setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, y: text.y - 8, duration: 500, hold: 1500, yoyo: true, ease: 'Sine.easeOut', onComplete: () => text.destroy() });
  }
}
