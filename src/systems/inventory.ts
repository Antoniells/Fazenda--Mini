import { CROPS, DEFAULT_CROP_ID } from '../data/crops';

/** Moedas com que o jogador começa uma nova partida (sem save ainda, então sempre reinicia aqui). */
const STARTING_COINS = 50;
/** O jogador começa com algumas sementes da cultura padrão, para poder plantar sem precisar visitar a loja primeiro. */
const STARTING_SEEDS = 3;
/**
 * Quantas regadas o regador aguenta antes de precisar ser reabastecido no
 * Poço (Fase 6). Cerca de uma rodada completa da lavoura atual (12
 * canteiros) com alguma folga — encher de novo vira parte do ritmo do
 * jogador sem precisar de viagens constantes ao Poço.
 */
export const WATERING_CAN_CAPACITY = 10;

/**
 * Estrutura mínima para guardar o resultado de colheitas, o estoque de
 * sementes (compradas na Loja, consumidas ao plantar), o estoque de
 * decorações/construções (compradas na Loja, consumidas ao posicionar,
 * Fase 6), as cargas do regador (consumidas ao regar, reabastecidas no
 * Poço, Fase 7), qual semente o jogador tem selecionada, e as moedas do
 * jogador. Não é o inventário completo — item de estoque por tipo, sem
 * espaços/pesos/empilhamento — mas já é a base real da economia.
 *
 * `items` (colheita), `seeds` (sementes para plantar) e `decorations`
 * (objetos para posicionar) são estoques deliberadamente separados, mesmo
 * quando indexados pelo mesmo id: vender na Caixa de Remessas (`takeAll`)
 * nunca deve consumir sementes ou decorações, e plantar/posicionar nunca
 * deve consumir colheita — misturar tudo num só Map criaria um bug onde
 * vender esvaziaria também os outros estoques.
 */
export class Inventory {
  private readonly items = new Map<string, number>();
  private readonly seeds = new Map<string, number>([[DEFAULT_CROP_ID, STARTING_SEEDS]]);
  /** Estoque de decorações/construções compradas na Loja (Fase 6), consumido ao posicionar. Mesma separação de responsabilidade dos outros Maps. */
  private readonly decorations = new Map<string, number>();
  private selectedSeedId: string = DEFAULT_CROP_ID;
  private coins = STARTING_COINS;
  /** Cargas restantes do regador (Fase 7) — começa cheio. */
  private wateringCanCharges = WATERING_CAN_CAPACITY;

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

  /** Quantas unidades dessa decoração o jogador tem para posicionar. */
  getDecorationCount(decorationId: string): number {
    return this.decorations.get(decorationId) ?? 0;
  }

  /** Adiciona decorações ao estoque (ex.: compra na Loja). */
  addDecorations(decorationId: string, amount: number): void {
    this.decorations.set(decorationId, this.getDecorationCount(decorationId) + amount);
  }

  /** Consome 1 unidade do estoque, se houver. Retorna `false` (sem consumir nada) se não houver. */
  useDecoration(decorationId: string): boolean {
    const count = this.getDecorationCount(decorationId);
    if (count <= 0) return false;
    this.decorations.set(decorationId, count - 1);
    return true;
  }

  /** Cargas restantes do regador. */
  getWateringCanCharges(): number {
    return this.wateringCanCharges;
  }

  /** Consome 1 carga do regador, se houver. Retorna `false` (sem consumir nada) se estiver vazio. */
  useWaterCharge(): boolean {
    if (this.wateringCanCharges <= 0) return false;
    this.wateringCanCharges -= 1;
    return true;
  }

  /** Enche o regador de volta ao máximo (ex.: interagir com o Poço). */
  refillWateringCan(): void {
    this.wateringCanCharges = WATERING_CAN_CAPACITY;
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
