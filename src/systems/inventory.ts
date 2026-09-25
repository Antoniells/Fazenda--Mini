import { DEFAULT_CROP_ID } from '../data/crops';
import { HOE, SICKLE, WATERING_CAN_TOOL, AXE, PICKAXE } from '../data/tools';
import { WOODEN_SWORD } from '../data/weapons';
import { SlotCategory, SlotRef } from '../data/items';
import { ARMORS } from '../data/armors';
import { TOOL_PROGRESSION, ToolFamily, getToolTierInfo, getPreviousToolId } from '../data/toolProgression';

/** Formato salvo pelo `SaveManager` (Fase 10 — Persistência) — um campo por `Map`/`Set` privado da classe, todos convertidos pra formas serializáveis em JSON (`Record`/array). */
export interface InventorySaveData {
  coins: number;
  items: Record<string, number>;
  seeds: Record<string, number>;
  decorations: Record<string, number>;
  resources: Record<string, number>;
  wateringCanCharges: number;
  everHarvested: string[];
  totalHarvested: Record<string, number>;
  unlockedRecipes: string[];
  slots: Array<SlotRef | null>;
  selectedHotbarIndex: number;
  /** Ausente em saves anteriores à armadura equipável. */
  equippedArmor?: string | null;
}

/** Moedas com que o jogador começa uma nova partida (sem save ainda, então sempre reinicia aqui). */
const STARTING_COINS = 70;
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

  /** Remove até `amount` unidades de um material (venda na Caixa de Remessas) e devolve quantas saíram de fato — nunca mais que o estoque. Zerou: some da Bolsa. */
  takeResource(resourceId: string, amount: number): number {
    const taken = Math.min(this.getResourceCount(resourceId), Math.max(0, amount));
    if (taken > 0) this.useResource(resourceId, taken);
    return taken;
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

  /**
   * Total HISTÓRICO já colhido de cada item, na vida da partida — nunca
   * diminui (diferente de `items`, o estoque ATUAL, que cai ao vender em
   * `takeAll`). Base do "Total já coletado" da aba Descobertas (pedido
   * explícito, item 3): a aba é só informativa, não deve refletir o estoque
   * que o jogador ainda está carregando, e sim o quanto ele já colheu na
   * vida do personagem, mesmo depois de vender tudo.
   */
  private readonly totalHarvested = new Map<string, number>();

  /**
   * Colheita da lavoura (bug corrigido — item 3: isto ia só pro registro de
   * estoque/descobertas, nunca ganhava um slot físico na Bolsa, então
   * parecia "sumir"). `ensureSlotted('crop', ...)` dá ao fruto colhido um
   * slot próprio na Hotbar/Inventário, separado do slot de `'seed'` da
   * mesma cultura (ver `SlotCategory`/`resolveSlotVisual`).
   */
  add(itemId: string, amount: number): void {
    this.items.set(itemId, this.getCount(itemId) + amount);
    if (amount > 0) {
      this.everHarvested.add(itemId);
      this.totalHarvested.set(itemId, this.getTotalHarvested(itemId) + amount);
      this.ensureSlotted('crop', itemId);
    }
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Já colheu ao menos uma vez esse item, alguma hora (mesmo que o estoque atual esteja zerado)? Ver `everHarvested`. */
  hasHarvested(itemId: string): boolean {
    return this.everHarvested.has(itemId);
  }

  /** Total histórico já colhido (nunca some, mesmo depois de vender) — ver `totalHarvested`. Usado pela aba Descobertas. */
  getTotalHarvested(itemId: string): number {
    return this.totalHarvested.get(itemId) ?? 0;
  }

  /** Remove todas as unidades de um item e devolve quantas havia (0 se nenhuma). Usado ao vender tudo de uma vez no `ShippingBinInteractable`. */
  takeAll(itemId: string): number {
    const amount = this.getCount(itemId);
    if (amount > 0) {
      this.items.delete(itemId);
      // Vendeu tudo: some da Bolsa igual a semente/decoração zerada (ver
      // `useSeed`/`useDecoration`) — `totalHarvested`/`everHarvested`
      // continuam intactos, só o estoque físico é que esvazia.
      this.clearSlotsOf('crop', itemId);
    }
    return amount;
  }

  /** Remove até `amount` unidades de uma colheita (venda pelo menu da Caixa de Remessas, ver `ui/shippingBinMenu.ts`) e devolve quantas saíram de fato — nunca mais que o estoque. Zerou: some da Bolsa. */
  takeCrop(itemId: string, amount: number): number {
    const have = this.getCount(itemId);
    const taken = Math.min(have, Math.max(0, amount));
    if (taken <= 0) return 0;
    if (taken === have) {
      this.items.delete(itemId);
      this.clearSlotsOf('crop', itemId);
    } else {
      this.items.set(itemId, have - taken);
    }
    return taken;
  }

  /**
   * Consome 1 unidade de uma colheita (comer, ver `systems/eating.ts`) —
   * diferente de `takeAll` (vender tudo). Zerou: some da Bolsa igual a uma
   * semente/decoração esgotada. `totalHarvested`/`everHarvested` (Descobertas)
   * não mudam: comer não "desfaz" ter colhido.
   */
  useCrop(itemId: string): boolean {
    const count = this.getCount(itemId);
    if (count <= 0) return false;
    if (count === 1) {
      this.items.delete(itemId);
      this.clearSlotsOf('crop', itemId);
    } else {
      this.items.set(itemId, count - 1);
    }
    return true;
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

  // --- Pilhas genéricas (baú) ----------------------------------------------------------------------------------
  // Mover itens entre a Bolsa e um baú precisa tratar TODAS as categorias do mesmo jeito (`SlotRef` + quantidade),
  // sem o baú conhecer os Maps privados. Ferramentas e armaduras são "pilhas de 1" (existem ou não); receitas não se movem.

  /** Quantas unidades desse item a Bolsa tem (ferramenta/armadura: 1 se ocupa algum slot). */
  getStackCount(ref: SlotRef): number {
    switch (ref.category) {
      case 'crop':
        return this.getCount(ref.id);
      case 'seed':
        return this.getSeedCount(ref.id);
      case 'decoration':
        return this.getDecorationCount(ref.id);
      case 'resource':
        return this.getResourceCount(ref.id);
      case 'tool':
      case 'armor':
        return this.slots.some((slot) => slot?.category === ref.category && slot.id === ref.id) ? 1 : 0;
      default:
        return 0;
    }
  }

  /** A Bolsa aceita mais desse item? (já tem a pilha, ou existe um slot livre) */
  hasRoomFor(ref: SlotRef): boolean {
    return this.slots.some((slot) => slot === null || (slot.category === ref.category && slot.id === ref.id));
  }

  /** Tira até `amount` unidades da Bolsa e devolve quantas saíram (nunca mais que o estoque). Zerou: o slot some. Armadura tirada da Bolsa deixa de estar vestida. */
  removeStack(ref: SlotRef, amount: number): number {
    const taken = Math.min(this.getStackCount(ref), Math.max(0, Math.floor(amount)));
    if (taken <= 0) return 0;

    switch (ref.category) {
      case 'crop':
        return this.takeCrop(ref.id, taken);
      case 'seed': {
        const remaining = this.getSeedCount(ref.id) - taken;
        this.seeds.set(ref.id, remaining);
        if (remaining <= 0) this.clearSlotsOf('seed', ref.id);
        return taken;
      }
      case 'decoration': {
        const remaining = this.getDecorationCount(ref.id) - taken;
        this.decorations.set(ref.id, remaining);
        if (remaining <= 0) this.clearSlotsOf('decoration', ref.id);
        return taken;
      }
      case 'resource':
        return this.takeResource(ref.id, taken);
      case 'tool':
        this.clearSlotsOf('tool', ref.id);
        return 1;
      case 'armor':
        this.clearSlotsOf('armor', ref.id);
        if (this.equippedArmorId === ref.id) this.equippedArmorId = null;
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Põe de volta na Bolsa (vindo de um baú) e devolve quantas unidades entraram (0 = recusado). NÃO conta como colheita
   * nova (`totalHarvested`/Descobertas não mudam). Uma ferramenta só volta se a Bolsa não tiver outra da mesma família
   * (Machado/Picareta seguem a progressão linear, sem ferramenta dupla — ver `upgradeTool`).
   */
  addStack(ref: SlotRef, amount: number): number {
    const count = Math.max(0, Math.floor(amount));
    if (count <= 0) return 0;

    switch (ref.category) {
      case 'crop':
        this.items.set(ref.id, this.getCount(ref.id) + count);
        this.ensureSlotted('crop', ref.id);
        return count;
      case 'seed':
        this.addSeeds(ref.id, count);
        return count;
      case 'decoration':
        this.addDecorations(ref.id, count);
        return count;
      case 'resource':
        this.addResources(ref.id, count);
        return count;
      case 'tool': {
        const info = getToolTierInfo(ref.id);
        const conflicts = info ? this.getToolTier(info.family) !== -1 : this.hasTool(ref.id);
        if (conflicts) return 0;
        this.unlockTool(ref.id);
        return 1;
      }
      case 'armor':
        if (this.getStackCount(ref) > 0) return 0;
        this.unlockArmor(ref.id);
        return 1;
      default:
        return 0;
    }
  }

  /** Todos os itens da Bolsa como pilhas (na ordem dos slots) — o que o menu do baú lista pra guardar. */
  getBagStacks(): Array<{ ref: SlotRef; amount: number }> {
    const stacks: Array<{ ref: SlotRef; amount: number }> = [];
    for (const slot of this.slots) {
      if (!slot) continue;
      const amount = this.getStackCount(slot);
      if (amount > 0) stacks.push({ ref: { category: slot.category, id: slot.id }, amount });
    }
    return stacks;
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
    if (!(amount >= 0) || amount > this.coins) return false; // valor negativo/NaN nunca "gasta" (viraria ganho)
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

  /**
   * UPGRADE de ferramenta (progressão Madeira > Pedra > Ferro > Ouro, `data/toolProgression.ts`): o item novo
   * SUBSTITUI o do tier anterior no MESMO slot (o antigo é destruído; nada de item extra, nem outro slot). Só vale
   * pro próximo tier de quem tem o anterior na Bolsa — devolve `false` (e não muda nada) se não é um upgrade, se
   * pula tier, se o jogador já tem esse tier (ou um maior) ou se falta o anterior. Mantém o slot selecionado da Hotbar.
   */
  upgradeTool(toolId: string): boolean {
    const previousId = getPreviousToolId(toolId);
    if (!previousId) return false;
    const info = getToolTierInfo(toolId)!;
    if (this.getToolTier(info.family) >= info.tier) return false;

    const index = this.slots.findIndex((slot) => slot?.category === 'tool' && slot.id === previousId);
    if (index === -1) return false;
    this.slots[index] = { category: 'tool', id: toolId };
    return true;
  }

  /** Maior tier que o jogador tem da família na Bolsa (0 = Madeira … 3 = Ouro); `-1` se não tem nenhuma. */
  getToolTier(family: ToolFamily): number {
    let best = -1;
    for (const slot of this.slots) {
      if (slot?.category !== 'tool') continue;
      const info = getToolTierInfo(slot.id);
      if (info && info.family === family) best = Math.max(best, info.tier);
    }
    return best;
  }

  /**
   * Saves antigos (do fluxo anterior, em que fabricar dava um item NOVO) podem ter dois tiers da mesma família:
   * deixa só o MAIOR, no slot do mais antigo, e libera os outros — o mesmo resultado de ter feito os upgrades no novo sistema.
   */
  private normalizeToolTiers(): void {
    for (const family of Object.keys(TOOL_PROGRESSION) as ToolFamily[]) {
      const owned: Array<{ index: number; tier: number }> = [];
      this.slots.forEach((slot, index) => {
        const info = slot?.category === 'tool' ? getToolTierInfo(slot.id) : null;
        if (info && info.family === family) owned.push({ index, tier: info.tier });
      });
      if (owned.length < 2) continue;

      const best = owned.reduce((a, b) => (b.tier > a.tier ? b : a));
      const first = owned.reduce((a, b) => (b.index < a.index ? b : a));
      for (const { index } of owned) this.slots[index] = null;
      this.slots[first.index] = { category: 'tool', id: TOOL_PROGRESSION[family][best.tier] };
    }
  }

  /** Já tem esta armadura na Bolsa? */
  hasArmor(armorId: string): boolean {
    return this.slots.some((slot) => slot?.category === 'armor' && slot.id === armorId);
  }

  /** Sobra pelo menos um slot livre na Bolsa? (Dar um item sem slot livre o perderia — quem vende algo único confere antes de cobrar.) */
  hasFreeSlot(): boolean {
    return this.slots.some((slot) => slot === null);
  }

  /** Igual a `unlockTool`, mas para a categoria `'armor'` (Fase 8 — Crafting: fabricar uma armadura na Bancada de Trabalho, ver `ui/craftingMenu.ts`). */
  unlockArmor(armorId: string): void {
    this.ensureSlotted('armor', armorId);
  }

  /** Armadura vestida (Fase 8 — Crafting): só o id — continua ocupando o slot dela na Bolsa, "equipar" é só marcar qual vale. `null` = nenhuma. */
  private equippedArmorId: string | null = null;

  getEquippedArmorId(): string | null {
    return this.equippedArmorId;
  }

  /** Defesa da armadura vestida (0 sem armadura) — reduz o dano recebido, ver `reduceDamage` em `systems/playerHealth.ts`. */
  getDefense(): number {
    return this.equippedArmorId ? ARMORS[this.equippedArmorId]?.defense ?? 0 : 0;
  }

  /** Veste a armadura (se ela estiver na Bolsa); se já era a vestida, tira. Trocar por outra substitui a anterior. */
  toggleArmor(armorId: string): void {
    if (this.equippedArmorId === armorId) {
      this.equippedArmorId = null;
      return;
    }
    const owned = this.slots.some((slot) => slot?.category === 'armor' && slot.id === armorId);
    if (owned && ARMORS[armorId]) this.equippedArmorId = armorId;
  }

  /**
   * Receitas já compradas na Loja (Fase 8 — Crafting/Bancada de Trabalho):
   * diferente de `slots` (Hotbar/Inventário), uma receita comprada não
   * ocupa slot nenhum — é só uma permissão permanente pra fabricar aquele
   * item na Bancada, consultada por quantidade ilimitada de vezes (cada
   * fabricação gasta `RecipeDefinition.ingredients`, não a receita em si).
   * Mesma ideia de `gameState.unlockedBridges` (`systems/bridgeSystem.ts`),
   * só que por partida (`Inventory`), não global.
   */
  private readonly unlockedRecipes = new Set<string>();

  /** Desbloqueia uma receita (compra na Loja) — chamado por `MainScene.buyRecipe`. */
  unlockRecipe(recipeId: string): void {
    this.unlockedRecipes.add(recipeId);
  }

  /** Se o jogador já comprou essa receita — usado pra não vender a mesma receita duas vezes. */
  hasRecipe(recipeId: string): boolean {
    return this.unlockedRecipes.has(recipeId);
  }

  /** Índice do slot da Hotbar atualmente selecionado (0-7). */
  getSelectedHotbarIndex(): number {
    return this.selectedHotbarIndex;
  }

  /** Conteúdo do slot da Hotbar selecionado — o que dita a ação ao interagir com o terreno (`systems/farmlandInteraction.ts`). */
  getSelectedSlot(): SlotRef | null {
    return this.getSlot(this.selectedHotbarIndex);
  }

  /** Troca o slot ativo da Hotbar. Ignora índices fora de 0-7 (e não inteiros: um NaN aqui ia parar no save). */
  selectHotbarSlot(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) return;
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
   * Bolsa cheia: um item que chega sem slot livre (loot, compra) fica com o ESTOQUE contado mas sem slot — "órfão", invisível e sem
   * como selecionar. Toda vez que um slot é liberado (`clearSlotsOf`) e ao carregar um save, dá slot a quem estiver esperando.
   */
  private slotOrphanedStock(): void {
    const stocks: Array<[SlotCategory, Map<string, number>]> = [
      ['crop', this.items],
      ['seed', this.seeds],
      ['decoration', this.decorations],
      ['resource', this.resources],
    ];
    for (const [category, stock] of stocks) {
      for (const [id, amount] of stock) if (amount > 0) this.ensureSlotted(category, id);
    }
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
    this.slotOrphanedStock();
  }

  serialize(): InventorySaveData {
    return {
      coins: this.coins,
      items: Object.fromEntries(this.items),
      seeds: Object.fromEntries(this.seeds),
      decorations: Object.fromEntries(this.decorations),
      resources: Object.fromEntries(this.resources),
      wateringCanCharges: this.wateringCanCharges,
      everHarvested: Array.from(this.everHarvested),
      totalHarvested: Object.fromEntries(this.totalHarvested),
      unlockedRecipes: Array.from(this.unlockedRecipes),
      slots: this.slots.slice(),
      selectedHotbarIndex: this.selectedHotbarIndex,
      equippedArmor: this.equippedArmorId,
    };
  }

  /** Reconstrói a partir de `serialize()` — nasce com os padrões de "jogo novo" (`new Inventory()`) e substitui tudo pelo que foi salvo, então nenhum campo escapa sem ser restaurado. */
  static deserialize(data: InventorySaveData): Inventory {
    const inventory = new Inventory();
    inventory.coins = data.coins;
    inventory.items.clear();
    for (const [id, amount] of Object.entries(data.items)) inventory.items.set(id, amount);
    inventory.seeds.clear();
    for (const [id, amount] of Object.entries(data.seeds)) inventory.seeds.set(id, amount);
    inventory.decorations.clear();
    for (const [id, amount] of Object.entries(data.decorations)) inventory.decorations.set(id, amount);
    inventory.resources.clear();
    for (const [id, amount] of Object.entries(data.resources)) inventory.resources.set(id, amount);
    inventory.wateringCanCharges = data.wateringCanCharges;
    inventory.everHarvested.clear();
    for (const id of data.everHarvested) inventory.everHarvested.add(id);
    inventory.totalHarvested.clear();
    for (const [id, amount] of Object.entries(data.totalHarvested)) inventory.totalHarvested.set(id, amount);
    inventory.unlockedRecipes.clear();
    for (const id of data.unlockedRecipes) inventory.unlockedRecipes.add(id);
    for (let index = 0; index < inventory.slots.length; index++) inventory.slots[index] = data.slots[index] ?? null;
    inventory.selectedHotbarIndex = data.selectedHotbarIndex;
    inventory.normalizeToolTiers();
    if (!Number.isInteger(inventory.selectedHotbarIndex) || inventory.selectedHotbarIndex < 0 || inventory.selectedHotbarIndex >= HOTBAR_SIZE) inventory.selectedHotbarIndex = 0;
    inventory.slotOrphanedStock();
    inventory.equippedArmorId = data.equippedArmor && ARMORS[data.equippedArmor] ? data.equippedArmor : null;
    return inventory;
  }
}
