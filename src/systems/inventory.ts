import { CROPS, DEFAULT_CROP_ID } from '../data/crops';

/** Moedas com que o jogador começa uma nova partida (sem save ainda, então sempre reinicia aqui). */
const STARTING_COINS = 50;
/** O jogador começa com algumas sementes da cultura padrão, para poder plantar sem precisar visitar a loja primeiro. */
const STARTING_SEEDS = 3;

/**
 * Estrutura mínima para guardar o resultado de colheitas, o estoque de
 * sementes (compradas na Loja, consumidas ao plantar), qual semente o
 * jogador tem selecionada, e as moedas do jogador. Não é o inventário
 * completo — item de estoque por tipo, sem espaços/pesos/empilhamento —
 * mas já é a base real da Fase 5 (Economia).
 *
 * `items` (colheita) e `seeds` (sementes para plantar) são estoques
 * deliberadamente separados, mesmo indexados pelo mesmo `cropId`: vender
 * na Caixa de Remessas (`takeAll`) nunca deve consumir sementes, e plantar
 * nunca deve consumir colheita — misturar os dois num só Map criaria um
 * bug onde vender esvaziaria também o estoque de plantio.
 */
export class Inventory {
  private readonly items = new Map<string, number>();
  private readonly seeds = new Map<string, number>([[DEFAULT_CROP_ID, STARTING_SEEDS]]);
  private selectedSeedId: string = DEFAULT_CROP_ID;
  private coins = STARTING_COINS;

  add(itemId: string, amount: number): void {
    this.items.set(itemId, this.getCount(itemId) + amount);
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Remove todas as unidades de um item e devolve quantas havia (0 se nenhuma). Usado ao vender tudo de uma vez no `ShippingBinInteractable`. */
  takeAll(itemId: string): number {
    const amount = this.getCount(itemId);
    if (amount > 0) this.items.delete(itemId);
    return amount;
  }

  /** Semente atualmente ativa — usada por `PlotInteractable` ao plantar. */
  getSelectedSeedId(): string {
    return this.selectedSeedId;
  }

  /** Troca a semente ativa. Ignora ids que não correspondem a uma cultura conhecida. */
  selectSeed(cropId: string): boolean {
    if (!CROPS[cropId]) return false;
    this.selectedSeedId = cropId;
    return true;
  }

  /** Quantas sementes dessa cultura o jogador tem para plantar. */
  getSeedCount(cropId: string): number {
    return this.seeds.get(cropId) ?? 0;
  }

  /** Adiciona sementes ao estoque (ex.: compra na Loja). */
  addSeeds(cropId: string, amount: number): void {
    this.seeds.set(cropId, this.getSeedCount(cropId) + amount);
  }

  /** Consome 1 semente do estoque, se houver. Retorna `false` (sem consumir nada) se não houver. */
  useSeed(cropId: string): boolean {
    const count = this.getSeedCount(cropId);
    if (count <= 0) return false;
    this.seeds.set(cropId, count - 1);
    return true;
  }

  getCoins(): number {
    return this.coins;
  }

  addCoins(amount: number): void {
    this.coins += amount;
  }

  /** Gasta moedas se houver saldo suficiente. Retorna `false` (sem gastar nada) se não houver. */
  spendCoins(amount: number): boolean {
    if (amount > this.coins) return false;
    this.coins -= amount;
    return true;
  }
}
