import Phaser from 'phaser';
import { Slime } from '../entities/Slime';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { DISPLAY_SCALE } from './mapBuilder';
import { gameState } from './gameState';
import { SLIME_GOO } from '../data/resources';

/** Quantos Slimes nascem na Floresta ao entrar na cena (pedido explícito do usuário: só lá, nenhuma outra cena). */
const SLIME_COUNT = 5;
/** Distância (px) considerada "encostou" no jogador, pra aplicar dano de contato. */
const CONTACT_RADIUS_PX = 14;

function randomWalkableCell(cols: number, rows: number, grid: WalkableGrid): { col: number; row: number } | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const col = Phaser.Math.Between(1, cols - 2);
    const row = Phaser.Math.Between(1, rows - 2);
    if (grid.isWalkable(col, row)) return { col, row };
  }
  return null;
}

/**
 * Gerencia os Slimes de uma cena (Fase 8 — Combate): nasce com `SLIME_COUNT`
 * deles em células andáveis aleatórias (mesma técnica de tentativas de
 * `resourceNodeRegistry.findFreeCell`), atualiza a IA de todos a cada
 * frame, dropa "Gosma de Slime" direto no `Inventory` quando um morre (loot
 * simples: sem sprite de item caído no chão, não pedido) e aplica dano de
 * contato no jogador (com a invencibilidade de `PlayerHealth`).
 */
export class SlimeSpawner {
  private readonly slimes: Slime[] = [];

  constructor(scene: Phaser.Scene, tileSize: number, cols: number, rows: number, grid: WalkableGrid) {
    const tile = tileSize * DISPLAY_SCALE;

    for (let i = 0; i < SLIME_COUNT; i++) {
      const cell = randomWalkableCell(cols, rows, grid);
      if (!cell) continue;
      const x = cell.col * tile + tile / 2;
      const y = (cell.row + 1) * tile; // Agora a âncora (pés) fica no FUNDO do bloco, igual ao player!
      // Adicionamos o "grid" e o "tile" para o Slime saber onde pisar
      this.slimes.push(new Slime(scene, x, y, () => this.dropLoot(), grid, tile));
    }
  }

  private dropLoot(): void {
    const amount = Phaser.Math.Between(1, 3);
    gameState.inventory.addResources(SLIME_GOO.id, amount);
    console.log(`Slime derrotado: +${amount} ${SLIME_GOO.name}.`);
  }

  /** Só os vivos — usado por `systems/combat.ts` pra testar o golpe de espada contra eles. */
  getAliveEnemies(): Enemy[] {
    return this.slimes.filter((slime) => !slime.isDead());
  }

  update(time: number, delta: number, player: Player): void {
    for (const slime of this.slimes) slime.update(time, delta, player.sprite.x, player.sprite.y);
    this.checkContactDamage(player, time);
  }

  private checkContactDamage(player: Player, time: number): void {
    // Aproxima o "corpo" do jogador (não os pés, onde `sprite` está ancorado — origin 0.5,1) pra medir a distância dali.
    const playerBodyY = player.sprite.y - player.sprite.displayHeight / 2;

    for (const slime of this.slimes) {
      if (slime.isDead()) continue;
      const distance = Phaser.Math.Distance.Between(player.sprite.x, playerBodyY, slime.x, slime.y);
      if (distance > CONTACT_RADIUS_PX) continue;

      const damage = slime.getContactDamage();
      if (gameState.playerHealth.takeDamage(damage, time)) {
        console.log(`Um Slime encostou em você! -${damage} HP (restam ${gameState.playerHealth.getHp()}/${gameState.playerHealth.getMaxHp()}).`);
      }
    }
  }
}
