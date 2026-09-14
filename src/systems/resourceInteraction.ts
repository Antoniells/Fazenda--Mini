import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Interactable, InteractionRegistry } from './interaction';
import { gameState } from './gameState';
import { AXE, PICKAXE } from '../data/tools';
import { WOOD, STONE, ACORN } from '../data/resources';
import { LEAF_FALL_KEY, LEAF_FALL_ANIM_KEY, LEAF_FALL_FRAMES } from '../data/effects';
import { WalkableGrid } from './grid';
import { resourceNodeRegistry } from './resourceNodeRegistry';

/** Sprite + sombra (opcional) de um recurso no mundo — ambos destruídos juntos ao colher. */
interface HarvestableVisual {
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
}

/** Golpes de Machado até uma árvore cair (Fase 9 — pedido explícito). */
const HITS_TO_FELL_TREE = 8;
/** Golpes de Picareta até uma pedra quebrar (Fase 9 — pedido explícito). */
const HITS_TO_BREAK_ROCK = 2;

/** Duração do flash branco (ms) a cada golpe. */
const HIT_FLASH_MS = 80;
/** Deslocamento (px de tela) do tremor a cada golpe. */
const HIT_SHAKE_OFFSET = 3;
const HIT_SHAKE_DURATION_MS = 40;

/**
 * Reação visual a UM golpe (Machado ou Picareta) num alvo — leve tremor
 * (tween de posição, vai-e-volta) + flash branco rápido (tingimento total,
 * revertido logo em seguida), pedido explícito do usuário. Transformações
 * sobre o sprite já existente (tint/tween), nunca uma forma nova desenhada
 * por código (ver regra permanente do projeto sobre não criar arte via
 * código).
 */
function playHitReaction(sprite: Phaser.GameObjects.Image): void {
  const scene = sprite.scene;
  const baseX = sprite.x;

  scene.tweens.add({
    targets: sprite,
    x: baseX + HIT_SHAKE_OFFSET,
    duration: HIT_SHAKE_DURATION_MS,
    yoyo: true,
    repeat: 3,
    ease: 'Sine.easeInOut',
    onComplete: () => { sprite.x = baseX; },
  });

  // Phaser 4 removeu `setTintFill(color)` — o mesmo efeito (tingimento
  // sólido, não multiplicativo) agora é `setTint` + `setTintMode(FILL)`.
  sprite.setTint(0xffffff);
  sprite.setTintMode(Phaser.TintModes.FILL);
  scene.time.delayedCall(HIT_FLASH_MS, () => {
    sprite.clearTint();
    sprite.setTintMode(Phaser.TintModes.MULTIPLY);
  });
}

function ensureLeafFallAnim(scene: Phaser.Scene): void {
  if (scene.anims.exists(LEAF_FALL_ANIM_KEY)) return;
  scene.anims.create({
    key: LEAF_FALL_ANIM_KEY,
    frames: scene.anims.generateFrameNumbers(LEAF_FALL_KEY, LEAF_FALL_FRAMES),
    frameRate: 14,
    repeat: 0,
  });
}

/** Partículas de folhas caindo (Fase 9 — pedido explícito) a cada golpe de Machado numa árvore — mesma técnica de `FarmlandRenderer.spawnWaterSplash` (animação tocada uma vez, sprite se destrói sozinho ao terminar). */
function spawnLeafEffect(sprite: Phaser.GameObjects.Image): void {
  const scene = sprite.scene;
  ensureLeafFallAnim(scene);

  const leaves = scene.add.sprite(sprite.x, sprite.y - sprite.displayHeight * 0.6, LEAF_FALL_KEY, 0);
  leaves.setScale(sprite.scale);
  leaves.setDepth(sprite.depth + 0.1);
  leaves.play(LEAF_FALL_ANIM_KEY);
  leaves.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => leaves.destroy());
}

/**
 * Remove o recurso do mundo/grid/registro depois de colhido — mesmos 4
 * passos pra árvore ou pedra, só o que dropa muda (ver `TreeInteractable`/
 * `RockInteractable`). Colocado aqui (não em `resourceNodeRegistry.ts`) por
 * mexer com game objects do Phaser, que o registro propositalmente não
 * conhece (ele só guarda dados).
 */
function clearHarvestedNode(
  visual: HarvestableVisual,
  grid: WalkableGrid,
  interactions: InteractionRegistry,
  sceneKey: string,
  col: number,
  row: number,
): void {
  visual.sprite.destroy();
  visual.shadow?.destroy();
  grid.unblock(col, row);
  interactions.remove(col, row);
  resourceNodeRegistry.removeNode(sceneKey, col, row);
}

/**
 * Árvore madura — só ela é cortável (brotos/mudas ainda não têm
 * `Interactable` registrado, ver `ForestScene`). Precisa do Machado
 * selecionado (mesmo padrão de checagem de ferramenta de
 * `systems/farmlandInteraction.ts`). Agora tem "vida" (Fase 9, pedido
 * explícito): são necessários `HITS_TO_FELL_TREE` golpes — cada um toca a
 * animação do Machado + tremor/flash no tronco + folhas caindo, e só o
 * ÚLTIMO golpe derruba a árvore de verdade (drop + remoção do mundo).
 */
export class TreeInteractable implements Interactable {
  private hits = 0;

  constructor(
    private readonly player: Player,
    private readonly visual: HarvestableVisual,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    private readonly sceneKey: string,
    private readonly col: number,
    private readonly row: number,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    const selected = gameState.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== AXE.id) {
      console.log('Selecione o Machado para cortar a árvore.');
      return;
    }

    this.player.performAction('axe', () => {
      this.hits++;
      playHitReaction(this.visual.sprite);
      spawnLeafEffect(this.visual.sprite);

      if (this.hits < HITS_TO_FELL_TREE) {
        console.log(`Árvore: golpe ${this.hits}/${HITS_TO_FELL_TREE}.`);
        return;
      }

      const wood = Phaser.Math.Between(12, 16);
      const acorns = Phaser.Math.Between(0, 2);
      gameState.inventory.addResources(WOOD.id, wood);
      if (acorns > 0) gameState.inventory.addResources(ACORN.id, acorns);

      console.log(
        `Árvore cortada: +${wood} Madeira` + (acorns > 0 ? ` e +${acorns} Bolota${acorns > 1 ? 's' : ''}` : '') + '.',
      );

      clearHarvestedNode(this.visual, this.grid, this.interactions, this.sceneKey, this.col, this.row);
    });
  }
}

/**
 * Pedra pequena ou rocha grande (`big` decide o range de drop) — precisa da
 * Picareta selecionada. Mesma estrutura de `TreeInteractable`, com vida
 * própria (Fase 9, pedido explícito): `HITS_TO_BREAK_ROCK` golpes, cada um
 * com tremor/flash, o último quebra a pedra de verdade.
 */
export class RockInteractable implements Interactable {
  private hits = 0;

  constructor(
    private readonly player: Player,
    private readonly visual: HarvestableVisual,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    private readonly sceneKey: string,
    private readonly col: number,
    private readonly row: number,
    private readonly big: boolean,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    const selected = gameState.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== PICKAXE.id) {
      console.log('Selecione a Picareta para quebrar a pedra.');
      return;
    }

    this.player.performAction('pickaxe', () => {
      this.hits++;
      playHitReaction(this.visual.sprite);

      if (this.hits < HITS_TO_BREAK_ROCK) {
        console.log(`${this.big ? 'Rocha' : 'Pedra'}: golpe ${this.hits}/${HITS_TO_BREAK_ROCK}.`);
        return;
      }

      const stone = this.big ? Phaser.Math.Between(8, 10) : Phaser.Math.Between(1, 3);
      gameState.inventory.addResources(STONE.id, stone);
      console.log(`${this.big ? 'Rocha' : 'Pedra'} quebrada: +${stone} Pedra.`);

      clearHarvestedNode(this.visual, this.grid, this.interactions, this.sceneKey, this.col, this.row);
    });
  }
}
