import { Farmland } from './farmland';
import { FarmlandRenderer } from './farmlandRenderer';
import { InteractionRegistry, Interactable } from './interaction';
import { Inventory } from './inventory';
import { Player } from '../entities/Player';
import { FarmMapData } from '../data/maps/farmMap';
import { CROPS } from '../data/crops';

/**
 * Uma célula cultivável, quando interagida: ara se estiver comum, planta se
 * estiver arada e vazia, rega se estiver crescendo (e não pronta), colhe se
 * estiver pronta, ou limpa se a plantação tiver morrido. Cada célula decide
 * sua própria ação a partir do próprio estado — o clique/movimento só chama
 * `interact()`, sem saber o que é agricultura.
 *
 * Arar/plantar/regar/colher tocam a animação de ferramenta correspondente
 * no personagem antes de aplicar o efeito (a animação é só representação
 * visual; quem decide o resultado é sempre `Farmland`, nunca a animação).
 *
 * Plantar consome 1 semente do estoque da cultura selecionada
 * (`Inventory.useSeed`, Fase 5) — sem estoque, não planta (compre na Loja).
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
      this.player.performAction('hoe', () => {
        this.farmland.till(this.col, this.row);
        this.renderer.spawnHoeDust(this.col, this.row);
        this.refresh();
      });
    } else if (plot.state === 'tilled') {
      const seedId = this.inventory.getSelectedSeedId();
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
    } else if (plot.state === 'dead') {
      // Limpar uma plantação morta é uma ação simples, sem ferramenta própria.
      this.farmland.clearDead(this.col, this.row);
      this.refresh();
    } else if (plot.state === 'growing') {
      if (this.farmland.isReady(plot)) {
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
      } else {
        // Sem água no regador — nada a fazer (mesmo espírito de "clique sem
        // efeito" já usado para sementes em falta). Encher de novo no Poço.
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
    }
  }

  private refresh(): void {
    const updated = this.farmland.getPlot(this.col, this.row);
    if (updated) this.renderer.renderPlot(this.farmland, updated);
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
