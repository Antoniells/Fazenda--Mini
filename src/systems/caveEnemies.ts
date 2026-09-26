import Phaser from 'phaser';
import { Enemy, EnemyStats } from '../entities/Enemy';
import { Slime } from '../entities/Slime';
import { CaveWalker } from '../entities/cave/CaveWalker';
import { SpikeEnemy } from '../entities/cave/SpikeEnemy';
import { BloomEnemy } from '../entities/cave/BloomEnemy';
import { Player } from '../entities/Player';
import { BLOOM_SHEETS, CAVE_ENEMY_STATS, CaveEnemyKind, SPIKE_SHEETS, SheetDef, slimeSheet } from '../data/caveEnemies';
import { WalkerKind, walkerConfig } from '../data/caveWalkers';
import { CaveFloorConfig } from '../data/caveFloors';
import { IRON_ORE, SLIME_GOO } from '../data/resources';
import { CaveLayout } from './caveGenerator';
import { WalkableGrid } from './grid';
import { gameState } from './gameState';
import { handlePlayerDeath } from './playerDeath';
import { PLAYER_ATTACKED_EVENT } from './combat';
import { spawnLoot } from './lootDrops';
import { awardXp } from './skills';
import { popText } from './floatingText';

/** Tamanho do Slime Guardião em relação ao slime comum. */
const GUARDIAN_SIZE = 1.7;

/** Todas as folhas de animação de que os bichos deste andar precisam (a cena as carrega no `preload`, e só as deste andar). */
export function enemySheetsFor(config: CaveFloorConfig): SheetDef[] {
  const sheets: SheetDef[] = [];
  for (const { kind } of config.roster) {
    if (kind === 'slime') sheets.push(slimeSheet(config.slimeColor));
    else if (kind === 'spike') sheets.push(...Object.values(SPIKE_SHEETS));
    else if (kind === 'bloom') sheets.push(...Object.values(BLOOM_SHEETS));
    else {
      const color = kind === 'myconid' ? config.myconidColor : kind === 'sprout' ? config.sproutColor : '';
      sheets.push(...Object.values(walkerConfig(kind, color).sheets));
    }
  }
  if (config.guardian) sheets.push(slimeSheet(config.slimeColor, true));
  return sheets;
}

/** Sorteia um tipo pelo peso. */
function pickKind(roster: CaveFloorConfig['roster']): Exclude<CaveEnemyKind, 'guardian'> {
  const total = roster.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of roster) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return roster[0].kind;
}

/**
 * Os inimigos de UM andar da Caverna: nasce o grupo do andar (quantidade, tipos e força de `caveFloorConfig`) nas células sorteadas do layout (longe da chegada),
 * mais o Slime Guardião nos andares de múltiplo de 10; atualiza a IA de todos, aplica o dano que acerta o jogador (com a invencibilidade de `PlayerHealth`, como
 * na Floresta) e dá a recompensa de cada um que cai — moedas (crescem com o andar), XP e, mais fundo, Ferro; o Slime ainda solta gosma. Os mortos não voltam: entrar de novo no andar
 * gera um grupo novo.
 */
export class CaveEnemies {
  private readonly enemies: Enemy[] = [];
  private killed = 0;
  private readonly total: number;
  /** Chamado uma vez, quando o último inimigo do andar cai. */
  onCleared: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CaveFloorConfig,
    layout: CaveLayout,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly player: Player,
  ) {
    const kinds: Array<CaveEnemyKind> = Array.from({ length: config.enemyCount }, () => pickKind(config.roster));
    if (config.guardian) kinds.unshift('guardian');
    this.total = kinds.length;

    kinds.forEach((kind, index) => {
      // O guardião nasce mais ao fundo (o último de `spawnCells` é o mais aleatório/longe; o primeiro serve o resto).
      const cell = layout.spawnCells[(kind === 'guardian' ? layout.spawnCells.length - 1 : index) % layout.spawnCells.length];
      const x = cell.col * tilePx + tilePx / 2;
      const y = (cell.row + 1) * tilePx;
      this.enemies.push(this.create(kind, x, y));
    });
  }

  private statsFor(kind: CaveEnemyKind): EnemyStats {
    const base = CAVE_ENEMY_STATS[kind];
    return {
      maxHp: Math.round(base.hp * this.config.hpMult),
      contactDamage: Math.max(1, Math.round(base.damage * this.config.dmgMult)),
      moveSpeed: base.speed,
      hitSound: base.hitSound,
    };
  }

  private create(kind: CaveEnemyKind, x: number, y: number): Enemy {
    const stats = this.statsFor(kind);
    const onDeath = (deathX: number, deathY: number): void => this.reward(kind, deathX, deathY);
    const onHit = (damage: number, time: number, attacker: Enemy): void => this.hurtPlayer(damage, time, attacker);
    const { grid, tilePx, scene } = this;

    switch (kind) {
      case 'slime':
        return new Slime(scene, x, y, onDeath, grid, tilePx, onHit, stats, slimeSheet(this.config.slimeColor).key);
      case 'guardian':
        return new Slime(scene, x, y, onDeath, grid, tilePx, onHit, stats, slimeSheet(this.config.slimeColor, true).key, GUARDIAN_SIZE);
      case 'spike':
        return new SpikeEnemy(scene, x, y, stats, grid, tilePx, onDeath, onHit);
      case 'bloom':
        return new BloomEnemy(scene, x, y, stats, onDeath, onHit);
      default: {
        const walker: WalkerKind = kind;
        const color = walker === 'myconid' ? this.config.myconidColor : walker === 'sprout' ? this.config.sproutColor : '';
        return new CaveWalker(scene, x, y, stats, walkerConfig(walker, color), grid, tilePx, onDeath, onHit);
      }
    }
  }

  /** Um inimigo caiu: moedas, XP e (às vezes) Ferro; o Slime solta gosma. */
  private reward(kind: CaveEnemyKind, x: number, y: number): void {
    const base = CAVE_ENEMY_STATS[kind];
    const coins = Math.round(Phaser.Math.Between(base.coins[0], base.coins[1]) * this.config.coinMult);
    gameState.inventory.addCoins(coins);
    popText(this.scene, x, y - 46, `+${coins}`, { color: '#ffd84a', fontSize: 16 });
    awardXp(this.scene, kind === 'guardian' ? 'raider' : 'slime', x, y - 20, 150);

    if (kind === 'slime' || kind === 'guardian') spawnLoot(this.scene, this.player, x, y, { category: 'resource', id: SLIME_GOO.id, amount: Phaser.Math.Between(1, 2) });
    const ironChance = kind === 'guardian' ? 1 : Math.min(0.25, 0.02 + this.config.floor * 0.003);
    if (Math.random() < ironChance) {
      const amount = kind === 'guardian' ? Phaser.Math.Between(3, 5) : 1;
      spawnLoot(this.scene, this.player, x, y, { category: 'resource', id: IRON_ORE.id, amount }); // Minério BRUTO: a barra sai da Fornalha.
    }

    this.killed += 1;
    if (this.killed >= this.total) this.onCleared?.();
  }

  /** Um golpe acertou: desconta a vida (respeitando a invencibilidade de `PlayerHealth`) e dá o feedback; o pet companheiro é avisado pra revidar. */
  private hurtPlayer(damage: number, time: number, attacker: Enemy): void {
    this.scene.events.emit(PLAYER_ATTACKED_EVENT, attacker);
    if (!gameState.playerHealth.takeDamage(damage, time, gameState.inventory.getDefense())) return;
    this.player.playHurtFeedback();
    if (gameState.playerHealth.isDead()) handlePlayerDeath(this.scene);
  }

  getAliveEnemies(): Enemy[] {
    return this.enemies.filter((enemy) => !enemy.isDead());
  }

  /** Quantos restam / quantos eram (pro contador do andar). */
  remaining(): { left: number; total: number } {
    return { left: this.total - this.killed, total: this.total };
  }

  update(time: number, delta: number): void {
    for (const enemy of this.enemies) enemy.update(time, delta, this.player.sprite.x, this.player.sprite.y);
  }
}
