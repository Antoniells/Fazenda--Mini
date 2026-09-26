import Phaser from 'phaser';
import { Slime } from '../entities/Slime';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { DISPLAY_SCALE } from './mapBuilder';
import { gameState } from './gameState';
import { handlePlayerDeath } from './playerDeath';
import { SLIME_GOO } from '../data/resources';
import { spawnLoot } from './lootDrops';
import { awardXp } from './skills';
import { PLAYER_ATTACKED_EVENT } from './combat';

/** Quantos Slimes existem na Floresta por dia (pedido explícito do usuário: só lá, nenhuma outra cena). */
const SLIME_COUNT = 8;

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
 * deles (menos os já derrotados hoje, ver abaixo) em células andáveis
 * aleatórias (mesma técnica de tentativas de
 * `resourceNodeRegistry.findFreeCell`), atualiza a IA de todos a cada
 * frame, dropa "Gosma de Slime" no chão quando um morre (loot no mundo, ver
 * `systems/lootDrops.ts`) e aplica o dano dos
 * ataques que acertam o jogador (com a invencibilidade de `PlayerHealth`).
 * Renascimento: os mortos só voltam depois de passar um dia — a contagem de
 * mortos vive em `gameState.slimeRespawn` (sobrevive a sair e entrar na cena
 * e vai pro save). Slimes vivos NÃO têm posição/vida guardadas: ao reentrar,
 * os que sobraram nascem de novo em lugares aleatórios, com a vida cheia.
 * Cada Slime decide sozinho QUANDO atacar e se o golpe acertou (ver
 * `entities/Slime.ts`) — aqui só se aplica o resultado.
 */
export class SlimeSpawner {
  private readonly slimes: Slime[] = [];

  constructor(private readonly scene: Phaser.Scene, tileSize: number, cols: number, rows: number, grid: WalkableGrid, private readonly player: Player) {
    const tile = tileSize * DISPLAY_SCALE;

    const record = gameState.slimeRespawn;
    const today = gameState.gameClock.getDay();
    if (record.day !== today) {
      // Passou pelo menos um dia desde a última contagem: todos renascem.
      record.day = today;
      record.killed = 0;
    }
    const aliveCount = Math.max(0, SLIME_COUNT - record.killed);

    for (let i = 0; i < aliveCount; i++) {
      const cell = randomWalkableCell(cols, rows, grid);
      if (!cell) continue;
      const x = cell.col * tile + tile / 2;
      const y = (cell.row + 1) * tile; // Agora a âncora (pés) fica no FUNDO do bloco, igual ao player!
      // Adicionamos o "grid" e o "tile" para o Slime saber onde pisar
      this.slimes.push(new Slime(scene, x, y, (deathX, deathY) => this.dropLoot(deathX, deathY), grid, tile, (damage, time, attacker) => this.hurtPlayer(damage, time, attacker)));
    }
  }

  private dropLoot(x: number, y: number): void {
    gameState.slimeRespawn.killed += 1;
    const amount = Phaser.Math.Between(1, 3);
    // A gosma cai no chão onde o Slime morreu; o jogador pega ao chegar perto (ver `systems/lootDrops.ts`).
    spawnLoot(this.scene, this.player, x, y, { category: 'resource', id: SLIME_GOO.id, amount });
    awardXp(this.scene, 'slime', x, y - 20);
    console.log(`Slime derrotado: +${amount} ${SLIME_GOO.name}.`);
  }

  /** Só os vivos — usado por `systems/combat.ts` pra testar o golpe de espada contra eles. */
  getAliveEnemies(): Enemy[] {
    return this.slimes.filter((slime) => !slime.isDead());
  }

  update(time: number, delta: number): void {
    for (const slime of this.slimes) slime.update(time, delta, this.player.sprite.x, this.player.sprite.y);
  }

  /** Um golpe acertou: desconta a vida (respeitando a invencibilidade de `PlayerHealth` — dois Slimes acertando juntos não somam) e só então dá o feedback visual, pra um golpe ignorado não piscar o jogador à toa. */
  private hurtPlayer(damage: number, time: number, attacker: Enemy): void {
    // Avisa a cena ANTES do teste de invencibilidade: o golpe foi uma agressão mesmo que a janela pós-dano o tenha absorvido — o pet revida do mesmo jeito.
    this.scene.events.emit(PLAYER_ATTACKED_EVENT, attacker);
    if (!gameState.playerHealth.takeDamage(damage, time, gameState.inventory.getDefense())) return;
    this.player.playHurtFeedback();
    if (gameState.playerHealth.isDead()) handlePlayerDeath(this.scene);
  }
}
