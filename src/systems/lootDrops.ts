import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { gameState } from './gameState';
import { createGroundShadow } from './shadow';
import { playEffect } from './soundEffects';
import { resolveSlotVisual } from '../data/items';
import { PICKUP_SOUND } from '../data/audio';
import { computeFitScale } from '../ui/slotIcon';
import { popText } from './floatingText';

/** O que pode "cair no chão": material coletado (madeira/pedra/bolota/gosma), colheita da lavoura ou uma construção desmontada (o aspersor solto pela Picareta). */
export type LootCategory = 'resource' | 'crop' | 'decoration';

export interface LootSpec {
  category: LootCategory;
  id: string;
  amount: number;
}

/** Tamanho (px de mundo) do ícone caído no chão — menor que uma célula (32px). */
const DROP_SIZE_PX = 22;
/** Um monte grande (ex.: 14 de madeira) vira no máximo esta quantidade de itens no chão, cada um carregando parte do total. */
const MAX_STACKS = 6;
/** Distância (px) do jogador até o item pra ele ser "sugado" pra bolsa. */
const PICKUP_RADIUS_PX = 48;
/** Distância (px) em que o item chegou no jogador e vira inventário de verdade. */
const COLLECT_RADIUS_PX = 14;
/** Altura (px) do corpo do jogador acima dos pés — pra onde o item voa. */
const PLAYER_BODY_OFFSET_PX = 16;
const MAGNET_START_SPEED = 220;
const MAGNET_ACCEL = 1400;
const MAGNET_MAX_SPEED = 720;
/** Espalhamento (px) do pulo ao "cuspir" o item. */
const SPREAD_X = 38;
const SPREAD_Y_MIN = -6;
const SPREAD_Y_MAX = 18;
const POP_HEIGHT_PX = 46;
const POP_UP_MS = 150;
const POP_DOWN_MS = 260;
const SPREAD_MS = 400;
/** Tempo (ms) parado no chão antes de poder ser pego — o item precisa "aterrissar" primeiro. */
const PICKUP_GRACE_MS = 120;
/** Vários itens coletados no mesmo instante tocam o som só uma vez a cada tanto. */
const SOUND_COOLDOWN_MS = 90;
/** Janela (ms) pra somar as coletas antes de mostrar o "+N Item" sobre o jogador (14 madeiras em 6 pilhas viram UM texto "+14 Madeira"). */
const PICKUP_TEXT_WINDOW_MS = 260;
const PICKUP_TEXT_ROW_PX = 20;

type DropState = 'flying' | 'idle' | 'magnet';

interface WorldDrop {
  loot: LootSpec;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  /** Posição no CHÃO (a sombra fica aqui); o ícone paira `height` px acima. */
  groundX: number;
  groundY: number;
  height: number;
  state: DropState;
  speed: number;
  bobPhase: number;
  pickableAt: number;
}

/** Entrega o item ao jogador — o mesmo `Inventory` de sempre, só que agora na hora da coleta, não da colheita. */
function grantLoot(loot: LootSpec): void {
  if (loot.category === 'resource') gameState.inventory.addResources(loot.id, loot.amount);
  else if (loot.category === 'decoration') gameState.inventory.addDecorations(loot.id, loot.amount);
  else gameState.inventory.add(loot.id, loot.amount);
}

/**
 * Loot no chão (pedido explícito): árvores, pedras, Slimes e plantações não
 * jogam o item direto na bolsa — "cospem" ele no mundo (`spawnLoot`), um
 * pulinho até o chão, e o jogador pega ao chegar perto: o item é sugado até
 * ele e só então entra no `Inventory` (`grantLoot`).
 *
 * Um `LootManager` por cena, criado no primeiro `spawnLoot` e destruído no
 * `SHUTDOWN` da cena. Sair do mapa com itens ainda no chão NÃO os perde: no
 * shutdown tudo que sobrou vai pra bolsa. Um monte grande vira até
 * `MAX_STACKS` itens (cada um leva parte da quantidade). A arte é sempre a
 * do próprio item (`resolveSlotVisual`, o mesmo ícone da Hotbar).
 */
class LootManager {
  private readonly drops: WorldDrop[] = [];
  private lastSoundAt = -Infinity;
  /** Coletas recentes ainda não mostradas: `categoria:id` → nome + total. */
  private pickupTotals = new Map<string, { name: string; amount: number }>();
  private pickupTextTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.flush, this);
  }

  spawn(x: number, y: number, loot: LootSpec): void {
    if (loot.amount <= 0) return;

    const visual = resolveSlotVisual({ category: loot.category, id: loot.id });
    if (!visual || !this.scene.textures.exists(visual.textureKey)) {
      // Sem arte pra mostrar: melhor entregar direto do que perder o item.
      grantLoot(loot);
      return;
    }

    const stacks = Math.min(loot.amount, MAX_STACKS);
    const base = Math.floor(loot.amount / stacks);
    const extra = loot.amount - base * stacks;
    for (let i = 0; i < stacks; i++) {
      this.spawnOne(x, y, { ...loot, amount: base + (i < extra ? 1 : 0) }, visual.textureKey, visual.iconFrame);
    }
  }

  private spawnOne(x: number, y: number, loot: LootSpec, textureKey: string, frame: number | string): void {
    const sprite = this.scene.add.image(x, y, textureKey, frame);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(computeFitScale(sprite, DROP_SIZE_PX));

    const shadow = createGroundShadow(this.scene, x, y, 0.55, 0.28);

    const drop: WorldDrop = {
      loot,
      sprite,
      shadow,
      groundX: x,
      groundY: y,
      height: 20,
      state: 'flying',
      speed: MAGNET_START_SPEED,
      bobPhase: Math.random() * Math.PI * 2,
      pickableAt: 0,
    };
    this.drops.push(drop);
    this.place(drop);

    // Pulo: espalha pra um lado (no chão) enquanto sobe e desce (altura, com quique ao pousar).
    const targetX = x + Phaser.Math.Between(-SPREAD_X, SPREAD_X);
    const targetY = y + Phaser.Math.Between(SPREAD_Y_MIN, SPREAD_Y_MAX);
    this.scene.tweens.add({ targets: drop, groundX: targetX, groundY: targetY, duration: SPREAD_MS, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: drop,
      height: POP_HEIGHT_PX,
      duration: POP_UP_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: drop,
          height: 0,
          duration: POP_DOWN_MS,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            if (drop.state === 'flying') {
              drop.state = 'idle';
              drop.pickableAt = this.scene.time.now + PICKUP_GRACE_MS;
            }
          },
        });
      },
    });
  }

  /** Posiciona ícone e sombra a partir do estado do drop (chão + altura). */
  private place(drop: WorldDrop): void {
    drop.sprite.setPosition(drop.groundX, drop.groundY - drop.height);
    drop.sprite.setDepth(drop.groundY + 1);
    drop.shadow.setPosition(drop.groundX, drop.groundY);
    drop.shadow.setDepth(drop.groundY - 0.1);
  }

  private update(time: number, delta: number): void {
    if (this.drops.length === 0) return;

    const playerX = this.player.sprite.x;
    const playerFeetY = this.player.sprite.y;
    const dt = delta / 1000;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];

      if (drop.state === 'idle') {
        drop.height = 3 + Math.sin(time / 260 + drop.bobPhase) * 2; // paira balançando de leve
        const near = Phaser.Math.Distance.Between(drop.groundX, drop.groundY, playerX, playerFeetY) <= PICKUP_RADIUS_PX;
        if (near && time >= drop.pickableAt) drop.state = 'magnet';
      }

      if (drop.state === 'magnet') {
        // Voa até o jogador (o chão do item vai até os pés dele, a altura sobe até o corpo), acelerando.
        const dx = playerX - drop.groundX;
        const dy = playerFeetY - drop.groundY;
        const distance = Math.hypot(dx, dy);
        if (distance <= COLLECT_RADIUS_PX) {
          this.collect(i, time);
          continue;
        }
        drop.speed = Math.min(MAGNET_MAX_SPEED, drop.speed + MAGNET_ACCEL * dt);
        const step = Math.min(distance, drop.speed * dt);
        drop.groundX += (dx / distance) * step;
        drop.groundY += (dy / distance) * step;
        drop.height += (PLAYER_BODY_OFFSET_PX - drop.height) * Math.min(1, dt * 10);
      }

      this.place(drop);
    }
  }

  private collect(index: number, time: number): void {
    const [drop] = this.drops.splice(index, 1);
    grantLoot(drop.loot);
    console.log(`Coletado: +${drop.loot.amount} ${drop.loot.id}.`);
    drop.sprite.destroy();
    drop.shadow.destroy();
    this.queuePickupText(drop.loot);

    if (time - this.lastSoundAt >= SOUND_COOLDOWN_MS) {
      this.lastSoundAt = time;
      playEffect(this.scene, PICKUP_SOUND);
    }
  }

  /** Soma a coleta e (uma vez por janela) mostra "+N Nome" subindo do jogador, um por tipo de item. */
  private queuePickupText(loot: LootSpec): void {
    const key = `${loot.category}:${loot.id}`;
    const total = this.pickupTotals.get(key) ?? { name: resolveSlotVisual({ category: loot.category, id: loot.id })?.name ?? loot.id, amount: 0 };
    total.amount += loot.amount;
    this.pickupTotals.set(key, total);

    if (this.pickupTextTimer) return;
    this.pickupTextTimer = this.scene.time.delayedCall(PICKUP_TEXT_WINDOW_MS, () => {
      this.pickupTextTimer = null;
      let row = 0;
      for (const { name, amount } of this.pickupTotals.values()) {
        popText(this.scene, this.player.sprite.x, this.player.sprite.y - 44 - row * PICKUP_TEXT_ROW_PX, `+${amount} ${name}`, { fontSize: 14, color: '#d8ffb0', rise: 26, duration: 900 });
        row++;
      }
      this.pickupTotals.clear();
    });
  }

  /** Cena fechando (o jogador saiu do mapa): tudo que ainda estava no chão vai pra bolsa em vez de sumir. */
  private flush(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    for (const drop of this.drops) grantLoot(drop.loot);
    this.drops.length = 0;
    managers.delete(this.scene);
  }
}

const managers = new WeakMap<Phaser.Scene, LootManager>();

/**
 * "Cospe" `loot` no mundo, em (`x`, `y`) — a base (pés) do que foi
 * colhido/derrotado, em coordenadas de mundo. O jogador `player` (da mesma
 * cena) pega ao chegar perto; ver `LootManager`.
 */
export function spawnLoot(scene: Phaser.Scene, player: Player, x: number, y: number, loot: LootSpec): void {
  let manager = managers.get(scene);
  if (!manager) {
    manager = new LootManager(scene, player);
    managers.set(scene, manager);
  }
  manager.spawn(x, y, loot);
}
