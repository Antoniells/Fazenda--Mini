import { Farmland } from './farmland';
import { FarmlandRenderer } from './farmlandRenderer';
import { InteractionRegistry, Interactable } from './interaction';
import { Inventory } from './inventory';
import { Player } from '../entities/Player';
import { FarmMapData } from '../data/maps/farmMap';
import { CROPS } from '../data/crops';
import { HOE_SOUNDS, WATER_SOUND, PLANT_SOUND, HARVEST_SOUND, SICKLE_SOUND } from '../data/audio';
import { playEffect, playRandomEffect } from './soundEffects';
import { spawnLoot } from './lootDrops';
import { awardXp, rollDoubleDrop } from './skills';
import { gameState } from './gameState';
import { isToolOfFamily } from '../data/toolProgression';
import { tutorial } from './tutorial';
import { popText } from './floatingText';
import { hotbarTopCenter } from '../ui/hotbar';
import { cutWeedAt } from './wildGrass';

/**
 * Uma célula cultivável, quando interagida, decide a ação a partir do
 * próprio estado **e** do slot da Hotbar selecionado (Fase 8) — o
 * clique/movimento só chama `interact()`, sem saber o que é agricultura:
 *
 * - `untilled` + Enxada selecionada = ara.
 * - `tilled` + uma semente selecionada = planta (consome 1 do estoque).
 * - `tilled` (vazio) + Picareta selecionada (qualquer tier) = desfaz o arado: volta a terra normal.
 * - `growing` (não pronta) + Regador selecionado = rega.
 * - `dead` + Foice selecionada = remove a plantação morta.
 * - `growing` pronta = colhe sempre, "com as mãos" — sem exigir ferramenta
 *   (mesma convenção do Stardew Valley).
 *
 * Com o slot errado (ou nenhum) selecionado, o clique não faz nada — só um
 * log dizendo qual ferramenta/item selecionar, mesmo espírito de "clique
 * sem efeito" já usado para estoque em falta.
 *
 * Arar/plantar/regar tocam a animação de ferramenta correspondente no
 * personagem antes de aplicar o efeito (a animação é só representação
 * visual; quem decide o resultado é sempre `Farmland`, nunca a animação).
 * Remover uma plantação morta reaproveita a animação da Foice (`harvest`)
 * — é a mesma ferramenta, sem sentido criar uma ação nova só pra isso.
 */
class PlotInteractable implements Interactable {
  constructor(
    private readonly farmland: Farmland,
    private readonly renderer: FarmlandRenderer,
    private readonly inventory: Inventory,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    // Mato em cima do canteiro (o do tutorial): a Foice o corta; sem ela avisa — nada de terra acontece por baixo dele.
    if (cutWeedAt(this.player, this.col, this.row)) return;

    const plot = this.farmland.getPlot(this.col, this.row);
    if (!plot) return;

    if (plot.state === 'untilled') {
      this.handleTill();
    } else if (plot.state === 'tilled') {
      const selected = this.inventory.getSelectedSlot();
      if (selected?.category === 'tool' && isToolOfFamily(selected.id, 'pickaxe')) this.handleUntill();
      else this.handlePlant();
    } else if (plot.state === 'dead') {
      this.handleClearDead();
    } else if (plot.state === 'growing') {
      if (this.farmland.isReady(plot)) this.handleHarvest();
      else this.handleWater();
    }
  }

  private handleTill(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== 'hoe') {
      console.log('Selecione a Enxada para arar.');
      return;
    }

    // Bloco travado (aspersor em cima): a enxada não age até o aspersor ser removido — sem animação, como qualquer clique sem efeito.
    if (this.farmland.isTillLocked(this.col, this.row)) {
      console.log('Há um aspersor neste bloco — remova-o (clique nele sem a enxada) para arar.');
      return;
    }

    this.player.performAction('hoe', () => {
      const tilled = this.farmland.till(this.col, this.row, gameState.weather.raining);
      playRandomEffect(this.player.sprite.scene, HOE_SOUNDS);
      this.renderer.spawnHoeDust(this.col, this.row);
      this.refreshWithNeighbors();
      if (tilled) tutorial.notify({ kind: 'act', action: 'till' });
    });
  }

  /** A Picareta bate no canteiro arado (vazio) e ele volta a ser terra normal — mesma poeira/som de terra da enxada, pela mesma animação de golpe da Picareta. */
  private handleUntill(): void {
    this.player.performAction('pickaxe', () => {
      if (!this.farmland.untill(this.col, this.row)) return;
      playRandomEffect(this.player.sprite.scene, HOE_SOUNDS);
      this.renderer.spawnHoeDust(this.col, this.row);
      this.refreshWithNeighbors(); // A borda do autotile dos vizinhos muda junto.
    });
  }

  private handlePlant(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'seed') {
      console.log('Selecione uma semente para plantar.');
      return;
    }

    const seedId = selected.id;
    if (this.inventory.getSeedCount(seedId) <= 0) {
      // Sem sementes no estoque — nada a plantar. Sem animação, já que a
      // ação não teria efeito nenhum (mesmo espírito de "clique sem
      // efeito" usado em qualquer obstáculo/célula sem interação).
      console.log(`Sem sementes de ${CROPS[seedId]?.name ?? seedId} — compre na loja.`);
      return;
    }

    this.player.performAction('plant', () => {
      // O canteiro pode ter mudado entre o clique e o impacto do golpe (ex.: a terra arada voltou a seca na virada do dia): planta PRIMEIRO
      // e só gasta a semente se a plantação de fato aconteceu — antes a semente sumia sem nada plantado.
      if (this.inventory.getSeedCount(seedId) <= 0 || !this.farmland.plant(this.col, this.row, seedId, gameState.weather.raining)) return;
      this.inventory.useSeed(seedId);
      playEffect(this.player.sprite.scene, PLANT_SOUND);
      this.refresh();
      tutorial.notify({ kind: 'act', action: 'plant' });
    });
  }

  private handleWater(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== 'water') {
      console.log('Selecione o Regador para regar.');
      return;
    }

    // Já regado hoje (regador de antes, chuva ou aspersor): não gasta água nem toca a animação. No tutorial isto conta como regar (senão, num dia de chuva, o passo nunca fecharia).
    const plot = this.farmland.getPlot(this.col, this.row);
    if (plot && this.farmland.isWatered(plot)) {
      const { x, y } = this.renderer.getCellCenter(this.col, this.row);
      popText(this.player.sprite.scene, x, y - 30, 'Já está regado', { color: '#9fd8ff', fontSize: 13 });
      tutorial.notify({ kind: 'act', action: 'water' });
      return;
    }

    if (this.inventory.getWateringCanCharges() <= 0) {
      // Aviso flutuante em cima da Hotbar (pedido explícito do usuário) — mesma fonte/estilo do "+1 Madeira" etc. (`popText`), só
      // fixo na tela (`screenFixed`) em vez de nascer em cima do canteiro, já que é sobre o ITEM (o regador), não sobre a célula.
      const scene = this.player.sprite.scene;
      const { x, y } = hotbarTopCenter(scene);
      popText(scene, x, y, 'Regador Vazio', { screenFixed: true, color: '#ff8a8a' });
      return;
    }

    this.player.performAction(
      'water',
      () => {
        // Mesma regra: só gasta a carga se o canteiro ainda aceita água (a plantação pode ter morrido/sido colhida durante o golpe).
        const watered = this.farmland.water(this.col, this.row);
        if (watered && this.inventory.useWaterCharge() && this.inventory.getWateringCanCharges() === 0) tutorial.notifyWaterEmpty();
        this.renderer.spawnWaterSplash(this.col, this.row);
        this.refresh();
        if (watered) tutorial.notify({ kind: 'act', action: 'water' });
      },
      () => playEffect(this.player.sprite.scene, WATER_SOUND),
    );
  }

  private handleClearDead(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== 'sickle') {
      console.log('Selecione a Foice para remover a plantação morta.');
      return;
    }

    this.player.performAction(
      'harvest',
      () => {
        this.farmland.clearDead(this.col, this.row);
        // `clearDead` vai de 'dead' pra 'tilled' — as duas já contam como
        // "arada" (`Farmland.isTilled`), então a borda dos vizinhos não muda
        // de verdade aqui. Mesmo assim atualiza os vizinhos por pedido
        // explícito (e o custo é desprezível: só recalcula o mesmo frame).
        this.refreshWithNeighbors();
      },
      () => playEffect(this.player.sprite.scene, SICKLE_SOUND),
    );
  }

  private handleHarvest(): void {
    this.player.performAction('harvest', () => {
      // O "pulo" precisa acontecer ANTES do refresh() — ele já retira a
      // imagem do controle do renderer, então o refresh() (que vai
      // encontrar a célula vazia) não tenta destruí-la de novo por cima
      // da animação.
      this.renderer.playHarvestPop(this.col, this.row);
      playEffect(this.player.sprite.scene, HARVEST_SOUND);
      const result = this.farmland.harvest(this.col, this.row, gameState.weather.raining);
      if (result) {
        // A colheita cai no chão (o som de coleta toca quando o jogador pega — ver `systems/lootDrops.ts`).
        const { x, y } = this.renderer.getCellCenter(this.col, this.row);
        const scene = this.player.sprite.scene;
        const amount = rollDoubleDrop(scene, result.amount, x, y - 28);
        spawnLoot(scene, this.player, x, y, { category: 'crop', id: result.cropId, amount });
        awardXp(scene, 'harvest', x, y - 12);
        console.log(`Colheita: ${amount} ${result.cropId} caiu no chão.`);
      }
      this.refresh();
    });
  }

  private refresh(): void {
    const updated = this.farmland.getPlot(this.col, this.row);
    if (updated) this.renderer.renderPlot(this.farmland, updated);
  }

  /** Como `refresh()`, mas também atualiza a borda do autotile dos 4 vizinhos — ver `FarmlandRenderer.renderPlotAndNeighbors`. */
  private refreshWithNeighbors(): void {
    const updated = this.farmland.getPlot(this.col, this.row);
    if (updated) this.renderer.renderPlotAndNeighbors(this.farmland, updated);
  }
}

/** Registra um `PlotInteractable` para cada célula cultivável do mapa. */
export function registerFarmlandInteractables(
  map: FarmMapData,
  farmland: Farmland,
  renderer: FarmlandRenderer,
  inventory: Inventory,
  player: Player,
  registry: InteractionRegistry,
): void {
  for (const [col, row] of map.farmlandArea) {
    registry.set(col, row, new PlotInteractable(farmland, renderer, inventory, player, col, row));
  }
}
