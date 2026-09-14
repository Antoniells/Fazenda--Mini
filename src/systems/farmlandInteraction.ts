import { Farmland } from './farmland';
import { FarmlandRenderer } from './farmlandRenderer';
import { InteractionRegistry, Interactable } from './interaction';
import { Inventory } from './inventory';
import { Player } from '../entities/Player';
import { FarmMapData } from '../data/maps/farmMap';
import { CROPS } from '../data/crops';

/**
 * Uma célula cultivável, quando interagida, decide a ação a partir do
 * próprio estado **e** do slot da Hotbar selecionado (Fase 8) — o
 * clique/movimento só chama `interact()`, sem saber o que é agricultura:
 *
 * - `untilled` + Enxada selecionada = ara.
 * - `tilled` + uma semente selecionada = planta (consome 1 do estoque).
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

    const plot = this.farmland.getPlot(this.col, this.row);
    if (!plot) return;

    if (plot.state === 'untilled') {
      this.handleTill();
    } else if (plot.state === 'tilled') {
      this.handlePlant();
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

    this.player.performAction('hoe', () => {
      this.farmland.till(this.col, this.row);
      this.renderer.spawnHoeDust(this.col, this.row);
      this.refreshWithNeighbors();
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
      this.inventory.useSeed(seedId);
      this.farmland.plant(this.col, this.row, seedId);
      this.refresh();
    });
  }

  private handleWater(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== 'water') {
      console.log('Selecione o Regador para regar.');
      return;
    }

    if (this.inventory.getWateringCanCharges() <= 0) {
      console.log('Regador vazio — encha no Poço.');
      return;
    }

    this.player.performAction('water', () => {
      this.inventory.useWaterCharge();
      this.farmland.water(this.col, this.row);
      this.renderer.spawnWaterSplash(this.col, this.row);
      this.refresh();
    });
  }

  private handleClearDead(): void {
    const selected = this.inventory.getSelectedSlot();
    if (!selected || selected.category !== 'tool' || selected.id !== 'sickle') {
      console.log('Selecione a Foice para remover a plantação morta.');
      return;
    }

    this.player.performAction('harvest', () => {
      this.farmland.clearDead(this.col, this.row);
      // `clearDead` vai de 'dead' pra 'tilled' — as duas já contam como
      // "arada" (`Farmland.isTilled`), então a borda dos vizinhos não muda
      // de verdade aqui. Mesmo assim atualiza os vizinhos por pedido
      // explícito (e o custo é desprezível: só recalcula o mesmo frame).
      this.refreshWithNeighbors();
    });
  }

  private handleHarvest(): void {
    this.player.performAction('harvest', () => {
      // O "pulo" precisa acontecer ANTES do refresh() — ele já retira a
      // imagem do controle do renderer, então o refresh() (que vai
      // encontrar a célula vazia) não tenta destruí-la de novo por cima
      // da animação.
      this.renderer.playHarvestPop(this.col, this.row);
      const result = this.farmland.harvest(this.col, this.row, this.inventory);
      if (result) {
        console.log(
          `Colheita: +${result.amount} ${result.cropId} (total: ${this.inventory.getCount(result.cropId)})`,
        );
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
