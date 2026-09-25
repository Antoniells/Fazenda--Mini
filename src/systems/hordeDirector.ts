import Phaser from 'phaser';
import { Raider, RaiderContext } from '../entities/Raider';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { Farmland } from './farmland';
import { FarmFences } from './farmFences';
import { playEffect } from './soundEffects';
import { HORDE_ALERT_SOUND, VICTORY_SOUND } from '../data/audio';
import { FarmlandRenderer } from './farmlandRenderer';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from './gameState';
import { handlePlayerDeath } from './playerDeath';
import { PLAYER_ATTACKED_EVENT } from './combat';
import { popText } from './floatingText';
import { save as saveGame } from './saveManager';
import { shouldStartHorde, isDawn, startHorde, registerHordeKill, finishHordeVictory, isFinalNightActive } from './horde';
import { completeCampaign } from './campaign';
import { ENDING_SCENE_KEY } from '../scenes/EndingScene';
import { findWeightedPath } from './hordePathfinding';
import { GridPoint } from './pathfinding';
import { farmMap } from '../data/maps/farmMap';
import { SLIME_GOO } from '../data/resources';
import { hordeEnemyHp, HORDE_INITIAL_BURST, HORDE_SPAWN_BATCH, HORDE_SPAWN_INTERVAL_MS, HORDE_MIN_SPAWN_DISTANCE_TILES, RAIDER_AI } from '../data/horde';

/** Depois de vencer a Noite Final, espera tanto (ms) pro jogador ler a faixa de vitória antes de a tela final abrir. */
const ENDING_DELAY_MS = 5500;

const STATUS_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '15px',
  fontStyle: 'bold',
  color: '#ffb3a8',
  stroke: '#2b1d0e',
  strokeThickness: 4,
};

/**
 * Gerente da horda na CENA da Fazenda: o estado da horda (`gameState.horde`, `systems/horde.ts`) é global e sobrevive a trocas
 * de cena; os inimigos não (são sprites). Este diretor:
 * - dispara a horda (dia 10, 20… a partir das 19:00), avisa com a faixa de aviso e mostra o contador de inimigos;
 * - faz os `Raider`s nascerem nas bordas da propriedade, uma rajada e depois lotes a cada poucos segundos, até o total;
 * - reaproveita o estado se a cena reabrir no meio da horda (o jogador saiu e voltou): nasce o que falta (total - abatidos);
 * - encerra: vitória quando o último inimigo cai OU o dia amanhece (06:00) com o jogador vivo → bônus; o desmaio é tratado
 *   por `playerDeath` (sem bônus, dia avança, só os drops).
 * Os drops dos abatidos vão pro pool da horda (`registerHordeKill`) — nada cai no chão durante o evento.
 */
export class HordeDirector {
  private readonly raiders: Raider[] = [];
  private readonly statusText: Phaser.GameObjects.Text;
  private nextSpawnAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly farmland: Farmland,
    private readonly farmlandRenderer: FarmlandRenderer,
    private readonly fences: FarmFences,
    private readonly player: Player,
    private readonly message: LockedMessage,
  ) {
    this.statusText = scene.add.text(scene.scale.width / 2, 74, '', STATUS_STYLE);
    this.statusText.setOrigin(0.5, 0).setScrollFactor(0).setDepth(4000).setVisible(false);

    // A cena reabriu no meio da horda: os inimigos que faltam voltam a chegar.
    if (gameState.horde.active) this.spawnBurst(HORDE_INITIAL_BURST);
  }

  /** Inimigos vivos — o `PlayerController` usa pra colisão e pro golpe de espada. */
  getAliveEnemies(): Enemy[] {
    return this.raiders.filter((raider) => !raider.isDead());
  }

  update(time: number, delta: number): void {
    if (shouldStartHorde()) this.begin(time);

    const { horde } = gameState;
    if (!horde.active) {
      this.statusText.setVisible(false);
      return;
    }

    // Chegada em lotes.
    if (time >= this.nextSpawnAt && this.remainingToSpawn() > 0) {
      this.spawnBurst(HORDE_SPAWN_BATCH);
      this.nextSpawnAt = time + HORDE_SPAWN_INTERVAL_MS;
    }

    const playerX = this.player.sprite.x;
    const playerY = this.player.sprite.y;
    for (const raider of this.raiders) raider.update(time, delta, playerX, playerY);

    this.statusText.setVisible(true);
    const name = isFinalNightActive() ? 'NOITE FINAL' : `HORDA ${horde.number}`;
    this.statusText.setText(`${name}  —  inimigos restantes: ${Math.max(0, horde.total - horde.killed)}`);

    if (horde.killed >= horde.total) this.victory('Horda derrotada!');
    else if (isDawn()) this.victory('Você sobreviveu à noite!');
  }

  // --- Início/fim ---------------------------------------------------------------------------------------------------

  private begin(time: number): void {
    const horde = startHorde();
    playEffect(this.scene, HORDE_ALERT_SOUND);
    if (isFinalNightActive()) this.message.show('A NOITE FINAL!', 'A última horda chegou. Defenda a Fazenda até o amanhecer!');
    else this.message.show(`HORDA ${horde.number}!`, 'Proteja a fazenda até o amanhecer.');
    this.nextSpawnAt = time + HORDE_SPAWN_INTERVAL_MS;
    this.spawnBurst(HORDE_INITIAL_BURST);
    saveGame(); // O estado da horda já vai pro save (recarregar não "cancela" o evento).
  }

  private victory(title: string): void {
    for (const raider of this.raiders) raider.vanish();
    this.raiders.length = 0;
    this.fences.healDamaged(); // As cercas só machucadas se recuperam; as DESTRUÍDAS esperam o Martelo.

    playEffect(this.scene, VICTORY_SOUND);
    const summary = finishHordeVictory();
    if (summary.finalNightWon) {
      // A Noite Final foi vencida: a campanha se completa e, depois da faixa de vitória, abre a tela final (epílogo).
      completeCampaign();
      this.message.show('A FAZENDA ESTÁ SALVA!', `Recompensa: ${summary.lines.join(', ')}.`);
      saveGame();
      this.statusText.setVisible(false);
      this.scene.time.delayedCall(ENDING_DELAY_MS, () => this.scene.scene.start(ENDING_SCENE_KEY));
      return;
    }
    // Cercas destruídas ficam assim até o Martelo: avisa quantas faltam consertar.
    const broken = this.fences.destroyedCount();
    const repairHint = broken > 0 ? ` ${broken} cerca(s) destruída(s) — conserte com o Martelo.` : '';
    this.message.show(title, `Recompensa: ${summary.lines.join(', ')}.${repairHint}`);
    console.log(`Horda vencida. Recompensa: ${summary.lines.join(', ')}.`);
    this.statusText.setVisible(false);
    saveGame();
  }

  // --- Nascimento ---------------------------------------------------------------------------------------------------

  private remainingToSpawn(): number {
    const { horde } = gameState;
    return horde.total - horde.killed - this.getAliveEnemies().length;
  }

  private spawnBurst(count: number): void {
    const toSpawn = Math.min(count, this.remainingToSpawn());
    for (let i = 0; i < toSpawn; i++) {
      const cell = this.pickSpawnCell();
      if (cell) this.spawnRaider(cell);
    }
  }

  /** Célula andável na borda da propriedade, longe do jogador e com rota até a lavoura (nunca nasce trancado). */
  private pickSpawnCell(): GridPoint | null {
    const playerCol = Math.floor(this.player.sprite.x / this.tilePx);
    const playerRow = Math.floor((this.player.sprite.y - this.tilePx / 2) / this.tilePx);
    const target = { col: farmMap.houseDoorPosition[0], row: farmMap.houseDoorPosition[1] + 1 };

    for (let attempt = 0; attempt < 60; attempt++) {
      const side = Phaser.Math.Between(0, 3);
      const col = side === 0 ? 2 : side === 1 ? farmMap.cols - 3 : Phaser.Math.Between(2, farmMap.cols - 3);
      const row = side === 2 ? 2 : side === 3 ? farmMap.rows - 3 : Phaser.Math.Between(2, farmMap.rows - 3);
      if (!this.grid.isWalkable(col, row)) continue;
      if (Math.hypot(col - playerCol, row - playerRow) < HORDE_MIN_SPAWN_DISTANCE_TILES) continue;
      if (!findWeightedPath(this.grid, { col, row }, target, (c, r) => this.fences.isFence(c, r), RAIDER_AI.fenceBreakCost)) continue;
      return { col, row };
    }
    return null;
  }

  private spawnRaider(cell: GridPoint): void {
    const context: RaiderContext = {
      grid: this.grid,
      tilePx: this.tilePx,
      farmland: this.farmland,
      fences: this.fences,
      hurtPlayer: (damage, time, attacker) => this.hurtPlayer(damage, time, attacker),
      damageFence: (col, row) => {
        this.fences.damage(col, row, 1);
      },
      destroyCrop: (col, row) => {
        if (!this.farmland.destroyCrop(col, row)) return;
        const plot = this.farmland.getPlot(col, row);
        if (plot) this.farmlandRenderer.renderPlot(this.farmland, plot);
      },
    };

    const raider = new Raider(this.scene, cell.col, cell.row, context, (x, y) => this.onRaiderDied(x, y), hordeEnemyHp(gameState.horde.number));
    this.raiders.push(raider);
  }

  private onRaiderDied(x: number, y: number): void {
    const amount = Phaser.Math.Between(1, 2);
    registerHordeKill(SLIME_GOO.id, amount);
    // O drop fica guardado até o fim da horda (não cai no chão) — o texto avisa.
    popText(this.scene, x, y - 24, `+${amount} ${SLIME_GOO.name}`, { color: '#d8ffb0', fontSize: 13 });
  }

  /** Mesma regra do Slime: avisa a cena (o pet revida) e só então desconta a vida (a invencibilidade pós-dano pode absorver). */
  private hurtPlayer(damage: number, time: number, attacker: Enemy): void {
    this.scene.events.emit(PLAYER_ATTACKED_EVENT, attacker);
    if (!gameState.playerHealth.takeDamage(damage, time, gameState.inventory.getDefense())) return;
    this.player.playHurtFeedback();
    if (gameState.playerHealth.isDead()) handlePlayerDeath(this.scene);
  }
}
