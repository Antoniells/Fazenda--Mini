import Phaser from 'phaser';
import { Chicken, ChickenWorld } from '../entities/Chicken';
import { Player } from '../entities/Player';
import { PlayerController } from './playerController';
import { WalkableGrid } from './grid';
import { findPath, GridPoint } from './pathfinding';
import { getCoopState, getPlacedCoops, petChicken } from './animals';
import { popText } from './floatingText';
import { CHICKEN_BEDTIME_HOUR, CHICKEN_WAKE_HOUR, EGG_ICON, EGG_TIERS, MAX_AFFECTION, eggTierForAffection } from '../data/animals';
import { CHICKEN_COOP } from '../data/decorations';
import { resourceDisplayName } from '../data/resources';

/** Ovo flutuando sobre o galinheiro quando há ovos a recolher: profundidade acima do mundo (ordenado por Y), abaixo dos avisos e do véu de luz. */
const EGG_INDICATOR_DEPTH = 4500;
const EGG_INDICATOR_SCALE = 2.2;
const EGG_BOB_PX = 4;
/** Distância (células, máximo entre os eixos) a que o jogador ainda alcança a galinha pra fazer carinho. */
const PET_RANGE_CELLS = 2;

interface EggIndicator {
  image: Phaser.GameObjects.Image;
  tween: Phaser.Tweens.Tween;
}

/**
 * As galinhas da Fazenda: mantém, a cada quadro, uma `Chicken` viva pra cada galinha registrada em `gameState.animals` (galinheiros lidos
 * de `gameState.placedDecorations` — comprou uma galinha nova, ela aparece; o estado é a fonte de verdade, nada é guardado aqui) e um ovinho
 * boiando sobre cada galinheiro com ovos a recolher. À noite (`CHICKEN_BEDTIME_HOUR`..`CHICKEN_WAKE_HOUR`) todas se recolhem; de manhã saem.
 * A cor de cada uma vem do registro dela (`ChickenRecord.variant`, sorteada na compra): recriar a cena não a muda.
 *
 * Carinho (pedido explícito): clicar numa galinha leva o jogador até ela e, ao chegar perto, ela ganha 1 carinho (só um por dia, no máximo
 * `MAX_AFFECTION`) — o carinho acumulado define a melhor qualidade dos ovos que ela põe (`systems/animals.ts`, `EGG_TIERS`), e o carinho
 * de CADA DIA (junto do Capim no comedouro) decide se o ovo de amanhã sai nela (`eggTierForCare`).
 * Criado pela `MainScene`; a cena chama `update`. As galinhas andam só onde `canStand` deixa: andável e fora da lavoura.
 */
export class ChickenFlock {
  private readonly chickens: Chicken[] = [];
  private readonly indicators = new Map<string, EggIndicator>();
  private readonly world: ChickenWorld;
  private pendingPet: Chicken | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    farmlandCells: Set<string>,
    private readonly getHours: () => number,
    private readonly player: Player,
    controller: PlayerController,
  ) {
    this.world = { tilePx, canStand: (col, row) => grid.isWalkable(col, row) && !farmlandCells.has(`${col},${row}`) };
    controller.addWorldClickHandler((x, y) => this.handleClick(x, y));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private isNight(): boolean {
    const hours = this.getHours();
    return hours >= CHICKEN_BEDTIME_HOUR || hours < CHICKEN_WAKE_HOUR;
  }

  /** A célula de onde as galinhas saem: a primeira livre em frente à porta (lado direito da base do galinheiro). */
  private doorCell(col: number, row: number): { col: number; row: number } {
    const preferred = { col: col + CHICKEN_COOP.footprint.width - 1, row: row + CHICKEN_COOP.footprint.height };
    const candidates = [preferred, { col: preferred.col - 1, row: preferred.row }, { col: preferred.col + 1, row: preferred.row }, { col: preferred.col, row: preferred.row + 1 }];
    return candidates.find((cell) => this.world.canStand(cell.col, cell.row)) ?? preferred;
  }

  update(time: number, delta: number): void {
    const night = this.isNight();
    const coops = getPlacedCoops();

    for (const coop of coops) {
      const state = getCoopState(coop.key);
      const mine = this.chickens.filter((chicken) => chicken.coop === coop.key);
      // Galinha nova (comprada): aparece na porta — já dentro, se for noite. A cor vem do registro dela.
      for (let i = mine.length; i < state.chickens; i++) {
        const door = this.doorCell(coop.col, coop.row);
        this.chickens.push(new Chicken(this.scene, this.world, coop.key, i, state.birds![i].variant, door.col, door.row, night));
      }
      this.syncEggIndicator(coop.key, coop.col, coop.row, state.eggs > 0);
    }

    // Galinheiro que sumiu do mundo: as galinhas dele também.
    for (let i = this.chickens.length - 1; i >= 0; i--) {
      if (!coops.some((coop) => coop.key === this.chickens[i].coop)) {
        this.chickens[i].destroy();
        this.chickens.splice(i, 1);
      }
    }
    for (const [key, indicator] of this.indicators) {
      if (!coops.some((coop) => coop.key === key)) {
        indicator.tween.remove();
        indicator.image.destroy();
        this.indicators.delete(key);
      }
    }

    for (const chicken of this.chickens) {
      if (night && !chicken.isInside()) chicken.goInside();
      else if (!night && chicken.isInside()) chicken.comeOut(time);
      chicken.update(time, delta);
    }

    // O jogador foi até a galinha (clique): quando para, faz o carinho se ela está ao alcance.
    if (this.pendingPet && !this.player.isMoving()) {
      const chicken = this.pendingPet;
      this.pendingPet = null;
      if (!chicken.isInside() && this.isNear(chicken)) this.pet(chicken, time);
    }
  }

  private isNear(chicken: Chicken): boolean {
    const cell = chicken.getCell();
    return Math.abs(this.player.col - cell.col) <= PET_RANGE_CELLS && Math.abs(this.player.row - cell.row) <= PET_RANGE_CELLS;
  }

  /** Clique no mundo: se caiu numa galinha (visível), vai até ela e faz carinho. Devolve `true` se consumiu o clique. */
  private handleClick(x: number, y: number): boolean {
    for (const chicken of this.chickens) {
      if (chicken.isInside()) continue;
      const bounds = chicken.sprite.getBounds();
      if (!bounds.contains(x, y)) continue;

      if (this.isNear(chicken)) {
        this.pet(chicken, this.scene.time.now);
        return true;
      }
      const path = this.pathNextTo(chicken);
      if (!path) return true; // Sem caminho até ela: consome o clique mesmo assim.
      this.pendingPet = chicken;
      this.player.setPath(path, (col, row) => this.grid.isWalkable(col, row));
      return true;
    }
    return false;
  }

  /** Rota do jogador até uma célula andável colada na galinha (a mais curta); `null` se não houver. */
  private pathNextTo(chicken: Chicken): GridPoint[] | null {
    const cell = chicken.getCell();
    const from = { col: this.player.col, row: this.player.row };
    let best: GridPoint[] | null = null;
    for (const [dc, dr] of [[0, 1], [0, -1], [-1, 0], [1, 0], [0, 0]]) {
      const candidate = { col: cell.col + dc, row: cell.row + dr };
      if (!this.grid.isWalkable(candidate.col, candidate.row)) continue;
      const path = findPath(this.grid, from, candidate);
      if (path && path.length > 0 && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  /** O carinho em si: vira o jogador pra ela, atualiza o estado e mostra o resultado (e avisa quando a qualidade dos ovos sobe de degrau). */
  private pet(chicken: Chicken, time: number): void {
    const cell = chicken.getCell();
    this.player.faceDirection(cell.col - this.player.col, cell.row - this.player.row);
    const { result, affection } = petChicken(chicken.coop, chicken.index);
    const x = chicken.sprite.x;
    const y = chicken.sprite.y - 26;

    if (result === 'already') {
      popText(this.scene, x, y, 'Já ganhou carinho hoje', { color: '#fff2a8', fontSize: 12 });
      return;
    }
    chicken.reactToPet(time);
    if (result === 'max') {
      // Carinho no máximo: não sobe mais, mas o de hoje conta pra felicidade (a qualidade do ovo de amanhã).
      popText(this.scene, x, y, `Feliz! Carinho no máximo (${MAX_AFFECTION}/${MAX_AFFECTION})`, { color: '#ffb0d8', fontSize: 12 });
      return;
    }
    popText(this.scene, x, y, `+1 carinho (${affection}/${MAX_AFFECTION})`, { color: '#ffb0d8', fontSize: 13 });
    const tier = eggTierForAffection(affection);
    if (tier > eggTierForAffection(affection - 1)) {
      popText(this.scene, x, y - 16, `Agora põe: ${resourceDisplayName(EGG_TIERS[tier].resourceId)}`, { color: '#ffe066', fontSize: 12, delay: 200 });
    }
  }

  /** Mostra/esconde o ovinho boiando sobre o galinheiro `key` (perto da porta). */
  private syncEggIndicator(key: string, col: number, row: number, visible: boolean): void {
    let indicator = this.indicators.get(key);
    if (!indicator) {
      const x = (col + CHICKEN_COOP.footprint.width - 0.6) * this.tilePx;
      const y = (row + CHICKEN_COOP.footprint.height) * this.tilePx - this.tilePx * 1.4;
      const image = this.scene.add.image(x, y, EGG_ICON.key, 0).setScale(EGG_INDICATOR_SCALE).setDepth(EGG_INDICATOR_DEPTH);
      const tween = this.scene.tweens.add({ targets: image, y: y - EGG_BOB_PX, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      indicator = { image, tween };
      this.indicators.set(key, indicator);
    }
    indicator.image.setVisible(visible);
  }

  private destroy(): void {
    for (const chicken of this.chickens) chicken.destroy();
    this.chickens.length = 0;
    this.pendingPet = null;
    for (const indicator of this.indicators.values()) {
      indicator.tween.remove();
      indicator.image.destroy();
    }
    this.indicators.clear();
  }
}
