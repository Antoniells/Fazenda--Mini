import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { gameState } from './gameState';
import { getFishingSheets, FishingPhase, FISHING_Y_OFFSET } from '../data/player';
import { ensureFishingAnimations } from './playerSprites';
import { registerFishingFrames } from './fishingAssets';
import { hasRoomForFish, landFish, pickFish, reelChallenge, ReelChallenge } from './fishing';
import {
  BITE_WAIT_MAX_MS,
  BITE_WAIT_MIN_MS,
  FISHING_UI,
  FishDefinition,
  FishingLocation,
  FISH_RARITY,
  HOOK_WINDOW_MS,
  REEL_MISSES_ALLOWED,
  REEL_TIMEOUT_MS,
  fishTextureKey,
} from '../data/fishing';
import { INTERACT_BUBBLE_FRAME, INTERACT_BUBBLE_KEY } from '../data/events';
import { popText } from './floatingText';
import { awardXp } from './skills';
import { playEffect } from './soundEffects';
import { SELL_SOUND } from '../data/audio';
import { PLAYER_ATTACKED_EVENT } from './combat';
import { isPauseMenuOpen } from '../scenes/UIScene';

type SessionState = 'casting' | 'waiting' | 'bite' | 'reeling' | 'ending' | 'done';

/** Acima de tudo no mundo (o minijogo e o "!" ficam por cima de árvores e telhados). */
const UI_DEPTH = 5200;
/** Quanto tempo a pose final (peixe erguido ou linha vazia) fica antes de liberar o jogador. */
const RESULT_HOLD_MS = 650;
const MOVE_KEYS = new Set(['W', 'A', 'S', 'D', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT']);

/**
 * UMA pescaria, do lançamento ao resultado (Fase 11 — pesca). Quem cria é `systems/fishingSpots.ts` quando o jogador usa a Vara na
 * água; a cena chama `update(delta)` a cada quadro (a Pausa para tudo, porque a cena deixa de chamar).
 *
 * 1. LANÇAR: a animação de arremesso (`Casting`, na direção em que o jogador está virado — ele já encarou a água).
 * 2. ESPERAR: a linha na água (`Wait Idle`) por 1,8-4,8 s. Apertar antes da hora puxa a linha vazia; andar recolhe.
 * 3. MORDEU: o balão "!" aparece e a vara verga (`Hooked`) — Espaço ou clique em até 1,3 s fisga; senão o peixe foge.
 * 4. MINIJOGO DE TIMING (`Roll`): acima da cabeça, uma barra com uma faixa verde e um marcador indo e voltando. Espaço/clique com o
 *    marcador dentro da faixa = um acerto (uma estrela acende e a faixa muda de lugar). Os acertos pedidos, a velocidade e a largura
 *    da faixa vêm da raridade do peixe (`FISH_RARITY`) e da Sorte do Pescador. Um erro é tolerado; o segundo solta o peixe, e 8 s sem
 *    completar também.
 * 5. RESULTADO: pegou → `Captured Fish`, o ícone do peixe sobe da cabeça, o nome e o XP aparecem, o peixe vai pra Bolsa. Perdeu →
 *    `Captured no Fish`.
 * Levar dano no meio (Floresta) cancela a pescaria.
 */
export class FishingSession {
  private state: SessionState = 'casting';
  private stateMs = 0;
  private waitMs = 0;
  private fish: FishDefinition | null = null;
  private challenge: ReelChallenge | null = null;
  private hits = 0;
  private misses = 0;
  /** Posição do marcador (0-1) e da faixa verde (início, 0-1). */
  private markerT = 0;
  private sweepElapsed = 0;
  private zoneStart = 0;

  private bubble: Phaser.GameObjects.Image | null = null;
  private bar: Phaser.GameObjects.Container | null = null;
  private zoneImage: Phaser.GameObjects.Image | null = null;
  private markerImage: Phaser.GameObjects.Image | null = null;
  private stars: Phaser.GameObjects.Image[] = [];

  private readonly sheets: ReturnType<typeof getFishingSheets>;
  private readonly onPress = (): void => this.press();
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.code === 'Space') this.press();
    else if (MOVE_KEYS.has(event.key.toUpperCase()) && (this.state === 'waiting' || this.state === 'casting')) this.finish(false, null);
  };
  private readonly onHurt = (): void => {
    if (this.state !== 'ending' && this.state !== 'done') this.finish(false, 'A pescaria foi interrompida!');
  };
  private readonly onShutdown = (): void => this.cleanup();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly location: FishingLocation,
    private readonly tilePx: number,
  ) {
    this.sheets = getFishingSheets(gameState.profile.characterId);
  }

  isDone(): boolean {
    return this.state === 'done';
  }

  /** Começa a lançar. `false` se o jogador não pode agora (andando, ocupado, sentado). */
  start(): boolean {
    if (!this.player.beginScripted()) return false;
    ensureFishingAnimations(this.scene, gameState.profile.characterId);
    registerFishingFrames(this.scene);

    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPress);
    this.scene.input.keyboard?.on('keydown', this.onKey);
    this.scene.events.on(PLAYER_ATTACKED_EVENT, this.onHurt);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);

    this.play('cast');
    this.player.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.state !== 'casting') return;
      this.enter('waiting');
      this.waitMs = Phaser.Math.Between(BITE_WAIT_MIN_MS, BITE_WAIT_MAX_MS);
      this.play('wait');
    });
    return true;
  }

  update(delta: number): void {
    this.stateMs += delta;
    switch (this.state) {
      case 'waiting':
        if (this.stateMs >= this.waitMs) this.bite();
        break;
      case 'bite':
        this.placeAboveHead(this.bubble, 6);
        if (this.stateMs >= HOOK_WINDOW_MS) this.finish(false, 'O peixe fugiu...');
        break;
      case 'reeling':
        this.updateReel(delta);
        if (this.stateMs >= REEL_TIMEOUT_MS) this.finish(false, 'O peixe escapou!');
        break;
      default:
        break;
    }
  }

  // --- Fases ---------------------------------------------------------------------------------------------------------------

  private enter(state: SessionState): void {
    this.state = state;
    this.stateMs = 0;
  }

  private play(phase: FishingPhase): void {
    this.player.playScripted(`${this.sheets[phase].key}-${this.player.getFacing()}`, FISHING_Y_OFFSET);
  }

  private bite(): void {
    this.fish = pickFish(this.location);
    if (!this.fish) {
      this.finish(false, 'Nada morde aqui...');
      return;
    }
    this.enter('bite');
    this.play('hooked');
    this.bubble = this.scene.add.image(0, 0, INTERACT_BUBBLE_KEY, INTERACT_BUBBLE_FRAME.name).setScale(2).setDepth(UI_DEPTH).setOrigin(0.5, 1);
    this.placeAboveHead(this.bubble, 6);
    this.scene.tweens.add({ targets: this.bubble, scale: { from: 1.2, to: 2 }, duration: 160, ease: 'Back.easeOut' });
  }

  private press(): void {
    if (isPauseMenuOpen()) return;
    if (this.state === 'waiting') {
      this.finish(false, 'Cedo demais!');
    } else if (this.state === 'bite') {
      this.bubble?.destroy();
      this.bubble = null;
      this.startReel();
    } else if (this.state === 'reeling') {
      this.strike();
    }
  }

  // --- Minijogo --------------------------------------------------------------------------------------------------------------

  private startReel(): void {
    const fish = this.fish!;
    this.challenge = reelChallenge(fish);
    this.hits = 0;
    this.misses = 0;
    this.sweepElapsed = 0;
    this.enter('reeling');
    this.play('reel');
    this.buildBar(fish);
    this.moveZone();
  }

  /** A barra (trilha + faixa + marcador + peixe na caixinha) e as estrelas dos acertos, num contêiner acima da cabeça. */
  private buildBar(fish: FishDefinition): void {
    const { scale, track, trackInner, trackBox } = FISHING_UI;
    const width = track.rect.width * scale;
    const height = track.rect.height * scale;
    const container = this.scene.add.container(0, 0).setDepth(UI_DEPTH);

    const trackImage = this.scene.add.image(-width / 2, -height / 2, FISHING_UI.barsKey, track.name).setOrigin(0, 0).setScale(scale);
    this.zoneImage = this.scene.add.image(0, -height / 2 + trackInner.y * scale, FISHING_UI.barsKey, FISHING_UI.zone.name).setOrigin(0, 0);
    this.zoneImage.setScale(1, (trackInner.height / FISHING_UI.zone.rect.height) * scale);
    this.markerImage = this.scene.add.image(0, -height / 2 + trackInner.y * scale, FISHING_UI.barsKey, FISHING_UI.marker.name).setOrigin(0.5, 0);
    this.markerImage.setScale(scale, (trackInner.height / FISHING_UI.marker.rect.height) * scale);
    const icon = this.scene.add.image(-width / 2 + trackBox.x * scale, -height / 2 + trackBox.y * scale, fishTextureKey(fish), 0).setScale(1.25);
    container.add([trackImage, this.zoneImage, this.markerImage, icon]);

    // Estrelas: uma por acerto pedido, apagadas até acertar.
    const needed = this.challenge!.hits;
    const starGap = 12 * 2;
    this.stars = [];
    for (let index = 0; index < needed; index += 1) {
      const x = (index - (needed - 1) / 2) * starGap;
      const star = this.scene.add.image(x, -height / 2 - 12, FISHING_UI.barsKey, FISHING_UI.starEmpty.name).setScale(2);
      this.stars.push(star);
      container.add(star);
    }
    // A câmera de interface (`systems/uiCamera.ts`) esconde todo objeto novo até classificá-lo, mas só olha a lista da cena — filhos de
    // contêiner nunca são classificados. Quem decide a câmera é o contêiner: os filhos ficam sem filtro próprio.
    for (const child of container.list) child.cameraFilter = 0;
    this.bar = container;
    this.placeAboveHead(container, 40);
    container.setScale(0.6);
    this.scene.tweens.add({ targets: container, scale: 1, duration: 140, ease: 'Back.easeOut' });
  }

  /** Faixa verde num lugar novo, longe de onde o marcador está agora (senão bastava apertar de novo). */
  private moveZone(): void {
    const zone = this.challenge!.zone;
    let start = Math.random() * (1 - zone);
    for (let attempt = 0; attempt < 8 && Math.abs(start + zone / 2 - this.markerT) < zone; attempt += 1) start = Math.random() * (1 - zone);
    this.zoneStart = start;
    const { scale, trackInner, track } = FISHING_UI;
    const innerWidth = trackInner.width * scale;
    const left = -(track.rect.width * scale) / 2 + trackInner.x * scale;
    this.zoneImage!.setX(left + start * innerWidth);
    this.zoneImage!.setScale(Math.max(1, zone * innerWidth), this.zoneImage!.scaleY);
  }

  private updateReel(delta: number): void {
    const { sweepMs } = this.challenge!;
    this.sweepElapsed += delta;
    const phase = (this.sweepElapsed % (sweepMs * 2)) / sweepMs;
    this.markerT = phase <= 1 ? phase : 2 - phase;
    const { scale, trackInner, track } = FISHING_UI;
    const left = -(track.rect.width * scale) / 2 + trackInner.x * scale;
    this.markerImage!.setX(left + this.markerT * trackInner.width * scale);
    this.placeAboveHead(this.bar, 40);
  }

  private strike(): void {
    const { zone, hits } = this.challenge!;
    const inside = this.markerT >= this.zoneStart && this.markerT <= this.zoneStart + zone;
    const { x, y } = this.headAnchor();
    if (inside) {
      this.stars[this.hits]?.setFrame(FISHING_UI.starFull.name);
      this.hits += 1;
      if (this.hits >= hits) {
        this.finish(true, null);
        return;
      }
      this.stateMs = 0; // O prazo recomeça a cada acerto.
      this.sweepElapsed *= 0.5;
      this.moveZone();
      popText(this.scene, x, y - 70, 'Boa!', { color: '#b8f5a0', fontSize: 13, rise: 18 });
      return;
    }
    this.misses += 1;
    if (this.misses > REEL_MISSES_ALLOWED) {
      this.finish(false, 'O peixe escapou!');
      return;
    }
    this.scene.cameras.main.shake(90, 0.003);
    popText(this.scene, x, y - 70, 'Quase!', { color: '#ffb3a8', fontSize: 13, rise: 18 });
  }

  // --- Fim -------------------------------------------------------------------------------------------------------------------

  /** Termina a pescaria: `caught` = o peixe fisgado vai pra Bolsa. `message` aparece sobre a cabeça (em caso de falha). */
  private finish(caught: boolean, message: string | null): void {
    if (this.state === 'ending' || this.state === 'done') return;
    const fish = this.fish;
    this.enter('ending');
    this.destroyVisuals();
    const { x, y } = this.headAnchor();

    if (caught && fish && !hasRoomForFish(fish)) {
      caught = false;
      message = 'Bolsa cheia: o peixe voltou pra água.';
    }

    if (caught && fish) {
      landFish(fish);
      this.play('catch');
      playEffect(this.scene, SELL_SOUND);
      const trophy = this.scene.add.image(x, y - 10, fishTextureKey(fish), 0).setScale(2.5).setDepth(UI_DEPTH);
      this.scene.tweens.add({ targets: trophy, y: y - 44, duration: 420, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: trophy, alpha: 0, delay: 1100, duration: 300, onComplete: () => trophy.destroy() });
      const rarity = FISH_RARITY[fish.rarity];
      popText(this.scene, x, y - 58, `+1 ${fish.name}`, { color: '#fff2a8', fontSize: 15, delay: 150 });
      if (fish.rarity !== 'common') popText(this.scene, x, y - 78, rarity.label, { color: '#9fe8ff', fontSize: 12, delay: 250 });
      awardXp(this.scene, 'fish', x, y - 38, 400);
    } else {
      this.play('miss');
      if (message) popText(this.scene, x, y - 40, message, { color: '#ffb3a8', fontSize: 13 });
    }

    // A pose final toca até o fim e segura um pouco; então o jogador é liberado.
    const release = (): void => {
      if (this.state === 'done') return;
      this.scene.time.delayedCall(RESULT_HOLD_MS, () => this.cleanup());
    };
    this.player.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, release);
    this.scene.time.delayedCall(2500, () => this.cleanup()); // Rede de segurança (a animação pode ter sido trocada por outra).
  }

  private destroyVisuals(): void {
    this.bubble?.destroy();
    this.bubble = null;
    this.bar?.destroy();
    this.bar = null;
    this.zoneImage = null;
    this.markerImage = null;
    this.stars = [];
  }

  private cleanup(): void {
    if (this.state === 'done') return;
    this.state = 'done';
    this.destroyVisuals();
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPress);
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.events.off(PLAYER_ATTACKED_EVENT, this.onHurt);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.player.endScripted();
  }

  // --- Posição ---------------------------------------------------------------------------------------------------------------

  /** Topo da cabeça do personagem (a célula dele, não o sprite: o sprite da pesca é maior e tem outra margem). */
  private headAnchor(): { x: number; y: number } {
    return { x: this.player.col * this.tilePx + this.tilePx / 2, y: (this.player.row + 1) * this.tilePx - 50 };
  }

  private placeAboveHead(target: Phaser.GameObjects.Components.Transform | null, gap: number): void {
    if (!target) return;
    const { x, y } = this.headAnchor();
    target.setPosition(x, y - gap);
  }
}
