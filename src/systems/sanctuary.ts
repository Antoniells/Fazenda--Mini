import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { Interactable, InteractionRegistry } from './interaction';
import { PetCompanion } from './petCompanion';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from './gameState';
import { hasMilestone, reachMilestone } from './story';
import { nowMinutes } from './smelting';
import { save as saveGame } from './saveManager';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';
import { buildWaterArea, waterAreaCells } from './externalMapBuilder';
import { FishingSpots } from './fishingSpots';
import { preloadFishingAssets } from './fishingAssets';
import { OPEN_DIALOGUE_EVENT, DialogueAction, DialoguePayload } from '../ui/dialoguePanel';
import { isDialogueOpen } from '../scenes/UIScene';
import { TILE_SIZE, WATER_KEY, WATER_PATH } from '../data/tiles';
import { CARROT, CROPS } from '../data/crops';
import { GOLDEN_CARROT, GOLDEN_CARROT_SEED } from '../data/resources';
import { GOLDEN_FISH_ID } from '../data/fishing';
import { UNLOCK_SOUND } from '../data/audio';
import {
  ALTAR_ART,
  ALTAR_NAME,
  BRAZIER_ART,
  CRYSTAL_ART,
  GOLDEN_CARROT_GROW_MINUTES,
  GOLDEN_TINT,
  SACRIFICE_PAGES,
  SAGE_RABBIT,
  SANCTUARY_LAYOUT,
  SANCTUARY_LINES,
} from '../data/sanctuary';

export const FINAL_CINEMATIC_SCENE_KEY = 'FinalCinematicScene';

/** Assets do santuário (a cena do andar 100 carrega junto com os dela). */
export function preloadSanctuary(scene: Phaser.Scene): void {
  const load = (key: string, fn: () => void): void => {
    if (!scene.textures.exists(key)) fn();
  };
  load(ALTAR_ART.key, () => scene.load.spritesheet(ALTAR_ART.key, encodeURI(`/${ALTAR_ART.path}`), { frameWidth: ALTAR_ART.frameSize, frameHeight: ALTAR_ART.frameSize }));
  load(BRAZIER_ART.key, () => scene.load.spritesheet(BRAZIER_ART.key, encodeURI(`/${BRAZIER_ART.path}`), { frameWidth: BRAZIER_ART.frameWidth, frameHeight: BRAZIER_ART.frameHeight }));
  load(CRYSTAL_ART.key, () => scene.load.image(CRYSTAL_ART.key, encodeURI(`/${CRYSTAL_ART.path}`)));
  load(SAGE_RABBIT.key, () => scene.load.spritesheet(SAGE_RABBIT.key, encodeURI(`/${SAGE_RABBIT.path}`), { frameWidth: SAGE_RABBIT.frameSize, frameHeight: SAGE_RABBIT.frameSize }));
  load(WATER_KEY, () => scene.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`)));
  load(CARROT.textureKey, () => scene.load.spritesheet(CARROT.textureKey, encodeURI(`/${CARROT.texturePath}`), { frameWidth: 16, frameHeight: 16 }));
  preloadFishingAssets(scene);
}

/** A terra entrega a semente (uma vez só: se ela já está na Bolsa, plantada ou colhida, não entrega de novo). Devolve se entregou. */
export function grantGoldenSeed(): boolean {
  const { inventory, sanctuary } = gameState;
  if (hasMilestone('goldenCarrot') || sanctuary.plantedAt !== null || inventory.getResourceCount(GOLDEN_CARROT_SEED.id) > 0) return false;
  inventory.addResources(GOLDEN_CARROT_SEED.id, 1);
  return true;
}

/** Em que ponto está a Cenoura no altar: 0 (plantada) a 1 (madura); `null` se não plantada. */
function carrotGrowth(): number | null {
  const { plantedAt } = gameState.sanctuary;
  if (plantedAt === null) return null;
  return Math.min(1, (nowMinutes() - plantedAt) / GOLDEN_CARROT_GROW_MINUTES);
}

class AltarInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(private readonly sanctuary: Sanctuary) {}
  interact(): void {
    this.sanctuary.talkToAltar();
  }
}

export interface SanctuaryContext {
  scene: Phaser.Scene;
  tilePx: number;
  grid: WalkableGrid;
  interactions: InteractionRegistry;
  player: Player;
  message: LockedMessage;
  /** O pet que acompanha o jogador (pode não existir). */
  petCompanion: () => PetCompanion | undefined;
}

/**
 * O SANTUÁRIO do andar 100 (Fase 11, `data/sanctuary.ts`), montado pela `CaveFloorScene` depois da Horda Final: o altar do Sábio Coelho no
 * centro (onde a semente é plantada e a Cenoura Dourada colhida), braseiros acesos, o lago cristalino (ponto de pesca `sanctuary` — o Peixe
 * Dourado) com pedestais de cristal, e o RITUAL: com os dois pilares na Bolsa, o altar exige o sacrifício final; o pet vai até ele, vira a
 * Amizade Dourada e o Sábio Coelho desperta — a cena corta pra cinemática da onda de luz (`scenes/FinalCinematicScene.ts`).
 */
export class Sanctuary {
  private altar!: Phaser.GameObjects.Sprite;
  private carrot: Phaser.GameObjects.Image | null = null;
  private fishingSpots!: FishingSpots;
  private ritual: 'none' | 'dialogue' | 'walking' | 'ascending' | 'awakening' = 'none';

  constructor(private readonly ctx: SanctuaryContext) {}

  build(): void {
    const { scene, tilePx, grid, interactions, player } = this.ctx;
    this.ensureFrames();

    // O altar (3x3 células, base no centro do salão); as duas fileiras de baixo são sólidas e todas as 9 respondem.
    const { col, row } = SANCTUARY_LAYOUT.altar;
    const altarX = col * tilePx + tilePx / 2;
    const altarY = (row + 1) * tilePx;
    createGroundShadow(scene, altarX, altarY - 6, DISPLAY_SCALE * 2.6, DISPLAY_SCALE * 0.7).setDepth(altarY - 1);
    this.altar = scene.add.sprite(altarX, altarY, ALTAR_ART.key, hasMilestone('awakening') ? ALTAR_ART.awakeFrames[ALTAR_ART.awakeFrames.length - 1] : ALTAR_ART.dormantFrame);
    this.altar.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(altarY);
    const altarInteractable = new AltarInteractable(this);
    for (let dr = -2; dr <= 0; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr > -2) grid.block(col + dc, row + dr);
        interactions.set(col + dc, row + dr, altarInteractable);
      }
    }
    this.refreshCarrot();
    if (hasMilestone('awakening')) this.showRabbit(false);

    // Braseiros acesos (a "luz divina" do santuário).
    if (!scene.anims.exists('sanctuary-brazier-flame')) {
      scene.anims.create({ key: 'sanctuary-brazier-flame', frames: scene.anims.generateFrameNumbers(BRAZIER_ART.key, { frames: BRAZIER_ART.flameFrames }), frameRate: 8, repeat: -1 });
    }
    for (const brazier of SANCTUARY_LAYOUT.braziers) {
      const x = brazier.col * tilePx + tilePx / 2;
      const y = (brazier.row + 1) * tilePx;
      const sprite = scene.add.sprite(x, y, BRAZIER_ART.key, BRAZIER_ART.flameFrames[0]).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y);
      sprite.play({ key: 'sanctuary-brazier-flame', startFrame: Phaser.Math.Between(0, BRAZIER_ART.flameFrames.length - 1) });
      grid.block(brazier.col, brazier.row);
    }

    // O lago cristalino e os pedestais de cristal nos cantos.
    const { lake } = SANCTUARY_LAYOUT;
    buildWaterArea(scene, TILE_SIZE, lake.col0, lake.row0, lake.cols, lake.rows);
    const water = waterAreaCells(lake.col0, lake.row0, lake.cols, lake.rows);
    for (const [c, r] of water) grid.block(c, r);
    this.fishingSpots = new FishingSpots(scene, player, tilePx, 'sanctuary', grid, interactions, water);
    for (const crystal of SANCTUARY_LAYOUT.crystals) {
      const x = crystal.col * tilePx + tilePx / 2;
      const y = (crystal.row + 1) * tilePx;
      const frames = [0, 1, 2, 3].map((index) => ({ key: CRYSTAL_ART.key, frame: CRYSTAL_ART.frame(crystal.color, index).name }));
      const animKey = `sanctuary-crystal-${crystal.color}`;
      if (!scene.anims.exists(animKey)) scene.anims.create({ key: animKey, frames, frameRate: 3, repeat: -1 });
      scene.add.sprite(x, y, CRYSTAL_ART.key, frames[0].frame).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y).play(animKey);
      grid.block(crystal.col, crystal.row);
    }
  }

  update(delta: number): void {
    this.fishingSpots?.update(delta);
    this.refreshCarrot();
    // O jogador fechou a conversa do sacrifício (Fechar ou ESC): o pet vai até o altar.
    if (this.ritual === 'dialogue' && !isDialogueOpen()) this.petWalksToAltar();
  }

  // --- O altar -------------------------------------------------------------------------------------------------------------------

  talkToAltar(): void {
    if (this.ritual !== 'none') return;
    const { inventory, sanctuary } = gameState;
    const actions: DialogueAction[] = [];
    let text: string;

    if (hasMilestone('awakening')) {
      text = SANCTUARY_LINES.awakened;
    } else if (hasMilestone('goldenCarrot')) {
      const hasCarrot = inventory.getResourceCount(GOLDEN_CARROT.id) > 0;
      const hasFish = inventory.getResourceCount(GOLDEN_FISH_ID) > 0;
      if (hasCarrot && hasFish) {
        text = SANCTUARY_LINES.offer;
        actions.push({ label: 'Oferecer os pilares', onSelect: () => this.startRitual() });
      } else {
        text = hasFish ? SANCTUARY_LINES.needCarrot : SANCTUARY_LINES.needFish;
      }
    } else if (sanctuary.plantedAt === null) {
      text = SANCTUARY_LINES.plant;
      const hasSeed = inventory.getResourceCount(GOLDEN_CARROT_SEED.id) > 0;
      actions.push({ label: 'Plantar a semente', enabled: hasSeed, onSelect: () => this.plant() });
    } else if ((carrotGrowth() ?? 0) < 1) {
      const minutesLeft = Math.max(1, Math.ceil(GOLDEN_CARROT_GROW_MINUTES * (1 - (carrotGrowth() ?? 0))));
      text = `${SANCTUARY_LINES.growing} (faltam cerca de ${Math.ceil(minutesLeft / 60)} h)`;
    } else {
      text = SANCTUARY_LINES.ripe;
      actions.push({ label: 'Colher a Cenoura Dourada', enabled: inventory.hasRoomFor({ category: 'resource', id: GOLDEN_CARROT.id }), onSelect: () => this.harvest() });
    }
    this.open({ speaker: ALTAR_NAME, text, actions });
  }

  private plant(): void {
    if (!gameState.inventory.useResource(GOLDEN_CARROT_SEED.id, 1)) return;
    gameState.sanctuary.plantedAt = nowMinutes();
    playEffect(this.ctx.scene, UNLOCK_SOUND);
    popText(this.ctx.scene, this.altar.x, this.altar.y - 90, 'A semente foi plantada', { color: '#fff2a8', fontSize: 14 });
    this.refreshCarrot();
    saveGame();
  }

  private harvest(): void {
    gameState.inventory.addResources(GOLDEN_CARROT.id, 1);
    gameState.sanctuary.plantedAt = null;
    reachMilestone('goldenCarrot');
    playEffect(this.ctx.scene, UNLOCK_SOUND);
    this.ctx.scene.cameras.main.flash(260, 255, 230, 150);
    popText(this.ctx.scene, this.altar.x, this.altar.y - 90, '+1 Cenoura Dourada', { color: '#ffd65a', fontSize: 16 });
    this.refreshCarrot();
    saveGame();
  }

  /** A Cenoura crescendo no altar: os quadros de crescimento da cenoura da lavoura, em dourado. */
  private refreshCarrot(): void {
    const growth = carrotGrowth();
    if (growth === null) {
      this.carrot?.destroy();
      this.carrot = null;
      return;
    }
    const frames = CROPS[CARROT.id].growthFrames;
    const frame = frames[Math.min(frames.length - 1, Math.floor(growth * (frames.length - 1)))];
    if (!this.carrot) {
      // Em cima da laje (a arte do altar é 48px; o tampo fica ~2/3 da altura acima da base).
      this.carrot = this.ctx.scene.add.image(this.altar.x, this.altar.y - 40, CARROT.textureKey, frame).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setTint(GOLDEN_TINT);
      this.carrot.setDepth(this.altar.depth + 1);
    } else if (this.carrot.frame.name !== String(frame)) {
      this.carrot.setFrame(frame);
    }
  }

  // --- O ritual ------------------------------------------------------------------------------------------------------------------

  /** O ritual está rodando (a cena não deixa o chamado da horda interromper). */
  isRitualRunning(): boolean {
    return this.ritual !== 'none';
  }

  private startRitual(): void {
    const { inventory } = gameState;
    if (inventory.getResourceCount(GOLDEN_CARROT.id) < 1 || inventory.getResourceCount(GOLDEN_FISH_ID) < 1) return;
    this.ctx.player.beginScripted(); // O jogador fica parado, assistindo.
    this.ritual = 'dialogue';
    const petName = this.ctx.petCompanion()?.pet.getName() ?? 'Seu companheiro';
    this.open({ speaker: ALTAR_NAME, text: '', pages: SACRIFICE_PAGES.map((page) => page.replace('{pet}', petName)), actions: [] });
  }

  private petWalksToAltar(): void {
    this.ritual = 'walking';
    const pet = this.ctx.petCompanion()?.pet;
    if (!pet) {
      this.ctx.scene.time.delayedCall(800, () => this.ascend());
      return;
    }
    const { col, row } = SANCTUARY_LAYOUT.altar;
    // Pra frente do altar, ao lado do jogador.
    const target = this.ctx.grid.isWalkable(col, row + 1) && (this.ctx.player.col !== col || this.ctx.player.row !== row + 1) ? { col, row: row + 1 } : { col: col + 1, row: row + 1 };
    pet.walkToScripted(target, () => this.ascend());
  }

  private ascend(): void {
    this.ritual = 'ascending';
    // Ponto sem volta: os dois pilares ficam no altar e o pet vira o terceiro.
    gameState.inventory.useResource(GOLDEN_CARROT.id, 1);
    gameState.inventory.useResource(GOLDEN_FISH_ID, 1);
    reachMilestone('goldenFriendship');
    const { scene } = this.ctx;
    const pet = this.ctx.petCompanion()?.pet;
    this.ctx.message.show('A AMIZADE DOURADA', 'O terceiro pilar sempre esteve ao seu lado.');
    const done = (): void => this.awaken();
    if (pet) pet.ascend(GOLDEN_TINT, done);
    else scene.time.delayedCall(1200, done);
    // O pet partiu: não volta a aparecer (um filhote chega depois do fim — `systems/ending.ts`).
    gameState.petUnlocked = false;
    saveGame();
  }

  /** O Sábio Coelho desperta: a runa do altar acende, a terra treme, o coelho aparece — e a tela vai à cinemática. */
  private awaken(): void {
    this.ritual = 'awakening';
    const { scene } = this.ctx;
    if (!scene.anims.exists('sage-altar-awaken')) {
      scene.anims.create({ key: 'sage-altar-awaken', frames: scene.anims.generateFrameNumbers(ALTAR_ART.key, { frames: ALTAR_ART.awakeFrames }), frameRate: 4, repeat: 0 });
    }
    this.altar.play('sage-altar-awaken');
    scene.cameras.main.shake(1800, 0.01);
    playEffect(scene, UNLOCK_SOUND);
    scene.time.delayedCall(1500, () => {
      scene.cameras.main.flash(500, 255, 250, 220);
      this.showRabbit(true);
      this.ctx.message.show('O SÁBIO COELHO DESPERTOU', 'Com os Três Pilares reunidos, a oferenda se completa.');
    });
    scene.time.delayedCall(5200, () => {
      scene.cameras.main.fadeOut(1400, 255, 255, 255);
      scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(FINAL_CINEMATIC_SCENE_KEY));
    });
  }

  /** O Sábio Coelho sentado sobre o altar (animado). `appear` = surge com um brilho. */
  private showRabbit(appear: boolean): void {
    const { scene } = this.ctx;
    if (!scene.anims.exists('sage-rabbit-sit')) {
      scene.anims.create({ key: 'sage-rabbit-sit', frames: scene.anims.generateFrameNumbers(SAGE_RABBIT.key, { frames: SAGE_RABBIT.sitFrames }), frameRate: 3, repeat: -1 });
    }
    const rabbit = scene.add.sprite(this.altar.x, this.altar.y - 44, SAGE_RABBIT.key, SAGE_RABBIT.sitFrames[0]).setOrigin(0.5, 1).setScale(SAGE_RABBIT.scale);
    rabbit.setDepth(this.altar.depth + 2).play('sage-rabbit-sit');
    if (appear) {
      rabbit.setAlpha(0).setScale(SAGE_RABBIT.scale * 0.4);
      scene.tweens.add({ targets: rabbit, alpha: 1, scale: SAGE_RABBIT.scale, duration: 900, ease: 'Back.easeOut' });
    }
  }

  // --- Apoio ---------------------------------------------------------------------------------------------------------------------

  private open(payload: DialoguePayload): void {
    this.ctx.scene.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
  }

  private ensureFrames(): void {
    const crystals = this.ctx.scene.textures.get(CRYSTAL_ART.key);
    for (const color of ['pink', 'blue'] as const) {
      for (let index = 0; index < 4; index += 1) {
        const { name, rect } = CRYSTAL_ART.frame(color, index);
        if (!crystals.has(name)) crystals.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }
  }
}
