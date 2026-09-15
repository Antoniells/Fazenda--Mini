import { DEFAULT_CROP_ID } from '../data/crops';
import { HOE, SICKLE, WATERING_CAN_TOOL, AXE, PICKAXE } from '../data/tools';
import { WOODEN_SWORD } from '../data/weapons';
import { SlotCategory, SlotRef } from '../data/items';

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

/** Tamanho da Hotbar (linha de baixo, sempre visível) e do inventário completo (Hotbar + 2 linhas extras, tecla E). */
export const HOTBAR_SIZE = 8;
export const INVENTORY_ROWS = 3;
export const INVENTORY_SIZE = HOTBAR_SIZE * INVENTORY_ROWS;

/**
 * Estrutura mínima para guardar o resultado de colheitas, o estoque de
 * sementes (compradas na Loja, consumidas ao plantar), o estoque de
 * decorações/construções (compradas na Loja, consumidas ao posicionar,
 * Fase 6), as cargas do regador (consumidas ao regar, reabastecidas no
 * Poço, Fase 7), os slots da Hotbar/Inventário (Fase 8) e as moedas do
 * jogador. Não é o inventário completo de um jogo "de verdade" — item de
 * estoque por tipo, sem peso/durabilidade — mas já é a base real da
 * economia e da progressão.
 *
 * `items` (colheita), `seeds` (sementes para plantar) e `decorations`
 * (objetos para posicionar) são estoques deliberadamente separados, mesmo
 * quando indexados pelo mesmo id: vender na Caixa de Remessas (`takeAll`)
 * nunca deve consumir sementes ou decorações, e plantar/posicionar nunca
 * deve consumir colheita — misturar tudo num só Map criaria um bug onde
 * vender esvaziaria também os outros estoques.
 *
 * `slots` (Hotbar + Inventário) não duplica essas quantidades — cada slot
 * só guarda uma *referência* (categoria + id); a quantidade exibida na UI
 * sempre vem ao vivo de `seeds`/`decorations` (ferramentas não têm
 * quantidade, só existem ou não). Isso evita os dois estoques saírem de
 * sincronia.
 */
export class Inventory {
  private readonly items = new Map<string, number>();
  private readonly seeds = new Map<string, number>([[DEFAULT_CROP_ID, STARTING_SEEDS]]);
  /** Estoque de decorações/construções compradas na Loja (Fase 6), consumido ao posicionar. Mesma separação de responsabilidade dos outros Maps. */
  private readonly decorations = new Map<string, number>();
  /** Estoque de materiais coletados (Fase 7 — madeira/pedra/bolota, ver `data/resources.ts`), separado dos outros Maps pela mesma razão. */
  private readonly resources = new Map<string, number>();
  private coins = STARTING_COINS;
  /** Quantas unidades desse material o jogador tem (Fase 7 — madeira/pedra/bolota). */
  getResourceCount(resourceId: string): number {
    return this.resources.get(resourceId) ?? 0;
  }

  /** Adiciona material ao estoque (loot de árvore/pedra, ver `systems/resourceInteraction.ts`) e garante um slot na Hotbar/Inventário pra ele. */
  addResources(resourceId: string, amount: number): void {
    this.resources.set(resourceId, this.getResourceCount(resourceId) + amount);
    this.ensureSlotted('resource', resourceId);
  }

  /**
   * Consome `amount` unidades do estoque (padrão 1, ex.: plantar 1 bolota),
   * se houver o suficiente. `amount` maior que 1 (Fase 8 — Combate: custo
   * misto de espadas, ex. 10 Pedras) só foi necessário a partir das compras
   * de espada; nada antes disso precisava de mais que 1 por vez.
   */
  useResource(resourceId: string, amount = 1): boolean {
    const count = this.getResourceCount(resourceId);
    if (count < amount) return false;
    const remaining = count - amount;
    this.resources.set(resourceId, remaining);
    if (remaining <= 0) this.clearSlotsOf('resource', resourceId);
    return true;
  }

  /** Cargas restantes do regador (Fase 7) — começa cheio. */
  private wateringCanCharges = WATERING_CAN_CAPACITY;

  /**
   * Slots da Hotbar (índices 0-7) + 2 linhas extras do Inventário completo
   * (8-23) — ver `HOTBAR_SIZE`/`INVENTORY_SIZE`. O jogador começa com as 3
   * ferramentas fixas nos 3 primeiros slots e um estoque inicial de
   * sementes de cenoura no 4º (pedido explícito) — sem sistema de
   * arrastar/reorganizar ainda, as ferramentas não saem desses slots.
   */
  private readonly slots: Array<SlotRef | null> = new Array(INVENTORY_SIZE).fill(null);
  private selectedHotbarIndex = 0;

  constructor() {
    this.slots[0] = { category: 'tool', id: HOE.id };
    this.slots[1] = { category: 'tool', id: WATERING_CAN_TOOL.id };
    this.slots[2] = { category: 'tool', id: SICKLE.id };
    this.slots[3] = { category: 'seed', id: DEFAULT_CROP_ID };
    // Fase 7 — Coleta de Recursos: Machado/Picareta são ferramentas
    // permanentes, mesma convenção das 3 primeiras (o jogador já nasce com
    // elas, sem precisar comprar na Loja).
    this.slots[4] = { category: 'tool', id: AXE.id };
    this.slots[5] = { category: 'tool', id: PICKAXE.id };
    // Fase 8 — Combate: Espada de Madeira é a arma inicial, mesma convenção
    // das ferramentas acima (o jogador já nasce com ela).
    this.slots[6] = { category: 'tool', id: WOODEN_SWORD.id };
  }

  /**
   * Toda colheita que algum dia passou por `add` — diferente de `items`
   * (estoque ATUAL, some ao vender tudo em `takeAll`), esse registro nunca é
   * apagado: é a base do "diário de descobertas" da aba Agricultura (Fase 9
   * — Interface, pedido explícito do usuário), que precisa lembrar que o
   * jogador já colheu uma cultura mesmo depois de vender/consumir tudo.
   */
  private readonly everHarvested = new Set<string>();

  add(itemId: string, amount: number): void {
    this.items.set(itemId, this.getCount(itemId) + amount);
    if (amount > 0) this.everHarvested.add(itemId);
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Já colheu ao menos uma vez esse item, alguma hora (mesmo que o estoque atual esteja zerado)? Ver `everHarvested`. */
  hasHarvested(itemId: string): boolean {
    return this.everHarvested.has(itemId);
  }

  /** Remove todas as unidades de um item e devolve quantas havia (0 se nenhuma). Usado ao vender tudo de uma vez no `ShippingBinInteractable`. */
  takeAll(itemId: string): number {
    const amount = this.getCount(itemId);
    if (amount > 0) this.items.delete(itemId);
    return amount;
  }

  /** Quantas sementes dessa cultura o jogador tem para plantar. */
  getSeedCount(cropId: string): number {
    return this.seeds.get(cropId) ?? 0;
  }

  /** Adiciona sementes ao estoque (ex.: compra na Loja) e garante um slot na Hotbar/Inventário pra elas, se ainda não tiverem um. */
  addSeeds(cropId: string, amount: number): void {
    this.seeds.set(cropId, this.getSeedCount(cropId) + amount);
    this.ensureSlotted('seed', cropId);
  }

  /** Consome 1 semente do estoque, se houver. Retorna `false` (sem consumir nada) se não houver. */
  useSeed(cropId: string): boolean {
    const count = this.getSeedCount(cropId);
    if (count <= 0) return false;
    const remaining = count - 1;
    this.seeds.set(cropId, remaining);
    if (remaining <= 0) this.clearSlotsOf('seed', cropId);
    return true;
  }

  /** Quantas unidades dessa decoração o jogador tem para posicionar. */
  getDecorationCount(decorationId: string): number {
    return this.decorations.get(decorationId) ?? 0;
  }

  /** Adiciona decorações ao estoque (ex.: compra na Loja) e garante um slot na Hotbar/Inventário pra elas, se ainda não tiverem um. */
  addDecorations(decorationId: string, amount: number): void {
    this.decorations.set(decorationId, this.getDecorationCount(decorationId) + amount);
    this.ensureSlotted('decoration', decorationId);
  }

  /** Consome 1 unidade do estoque, se houver. Retorna `false` (sem consumir nada) se não houver. */
  useDecoration(decorationId: string): boolean {
    const count = this.getDecorationCount(decorationId);
    if (count <= 0) return false;
    const remaining = count - 1;
    this.decorations.set(decorationId, remaining);
    if (remaining <= 0) this.clearSlotsOf('decoration', decorationId);
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

  /** Conteúdo de um slot (0-7 = Hotbar, 8-23 = resto do Inventário). `null` se vazio ou fora do intervalo. */
  getSlot(index: number): SlotRef | null {
    return this.slots[index] ?? null;
  }

  /** Se já existe uma ferramenta/arma (categoria `'tool'`) com esse id em algum slot — usado antes de comprar uma espada na Loja pra não vender a mesma duas vezes (Fase 8 — Combate). */
  hasTool(toolId: string): boolean {
    return this.slots.some((slot) => slot?.category === 'tool' && slot?.id === toolId);
  }

  /** Dá uma ferramenta/arma nova ao jogador (compra na Loja, ex.: espada — Fase 8) — mesma mecânica de `ensureSlotted` já usada por sementes/decorações/materiais, só que pra uma categoria sem quantidade própria. */
  unlockTool(toolId: string): void {
    this.ensureSlotted('tool', toolId);
  }

  /** Índice do slot da Hotbar atualmente selecionado (0-7). */
  getSelectedHotbarIndex(): number {
    return this.selectedHotbarIndex;
  }

  /** Conteúdo do slot da Hotbar selecionado — o que dita a ação ao interagir com o terreno (`systems/farmlandInteraction.ts`). */
  getSelectedSlot(): SlotRef | null {
    return this.getSlot(this.selectedHotbarIndex);
  }

  /** Troca o slot ativo da Hotbar. Ignora índices fora de 0-7. */
  selectHotbarSlot(index: number): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.selectedHotbarIndex = index;
  }

  /**
   * Troca o conteúdo de dois slots (Fase 9 — Interface, drag and drop
   * pedido explícito do usuário): arrastar o item A para cima do item B
   * troca os dois de lugar no array `slots`, funcione com Hotbar ou resto
   * do Inventário, cheio ou vazio dos dois lados. Substitui a antiga regra
   * de "ferramentas não saem do slot inicial" — agora qualquer slot pode
   * ser reorganizado livremente.
   */
  swapSlots(indexA: number, indexB: number): void {
    if (indexA === indexB) return;
    if (indexA < 0 || indexA >= this.slots.length || indexB < 0 || indexB >= this.slots.length) return;
    const temp = this.slots[indexA];
    this.slots[indexA] = this.slots[indexB];
    this.slots[indexB] = temp;
  }

  /** Se `category`+`id` ainda não ocupam nenhum slot, ocupa o primeiro vazio (Hotbar antes do resto do Inventário). Chamado ao ganhar sementes/decorações novas. */
  private ensureSlotted(category: SlotCategory, id: string): void {
    const alreadySlotted = this.slots.some((slot) => slot?.category === category && slot?.id === id);
    if (alreadySlotted) return;

    const emptyIndex = this.slots.findIndex((slot) => slot === null);
    if (emptyIndex !== -1) this.slots[emptyIndex] = { category, id };
  }

  /**
   * Esvazia (`null`) todos os slots que apontam pra esse item — chamado
   * por `useSeed`/`useDecoration` quando o estoque chega a 0, pra o item
   * sair da Hotbar/Inventário em vez de continuar aparecendo com a
   * contagem zerada (ex.: plantar a última semente ou posicionar a última
   * decoração no mundo).
   */
  private clearSlotsOf(category: SlotCategory, id: string): void {
    for (let index = 0; index < this.slots.length; index++) {
      if (this.slots[index]?.category === category && this.slots[index]?.id === id) {
        this.slots[index] = null;
      }
    }
  }
}
