import Phaser from 'phaser';
import { ShopMenu, ShopItem, ShopItemActions, ShopRequirements, ShopTabDefinition } from '../ui/shopMenu';
import { Inventory } from './inventory';
import { Player } from '../entities/Player';
import { CROPS, CARROT, HARVEST_MAX_YIELD, ALL_CROPS_ICONS_KEY } from '../data/crops';
import { CHAIR, DECORATIONS, DecorationDefinition, SPRINKLER_WOOD, WELL } from '../data/decorations';
import type { BuildRequest } from '../data/construction';
import { availableActions, buildHoursOf, cancelOrder, destroyBuilt, targetsFor } from './construction';
import { RESOURCES, STONE, WOOD } from '../data/resources';
import { FISHING_ROD, HAMMER, HAMMER_PRICE, HOE, TOOLS } from '../data/tools';
import { FISHING_ROD_PRICE } from '../data/fishing';
import { TOOL_OFFERS, getToolOffer } from '../data/toolShop';
import { ANIMAL_ICONS, CHICKEN_PRICE, CHICKEN_SHOP_ID, COOP_CAPACITY } from '../data/animals';
import { VILLAGE_SHOP_GOODS, VILLAGE_SHOP_ITEMS } from '../data/villageShop';
import {
  SHOP_TAB_RIBBONS_KEY,
  TAB_FRAME_AGRICULTURE,
  TAB_FRAME_AGRICULTURE_LIGHT,
  TAB_FRAME_ANIMALS,
  TAB_FRAME_ANIMALS_LIGHT,
  TAB_FRAME_CONSTRUCTION,
  TAB_FRAME_CONSTRUCTION_LIGHT,
  TAB_FRAME_SKILLS,
  TAB_FRAME_SKILLS_LIGHT,
  TAB_FRAME_TOOLS,
  TAB_FRAME_TOOLS_LIGHT,
} from '../data/ui';
import { getToolUpgradeBlock, previousToolName } from './toolUpgrade';
import { buyChicken } from './animals';
import { ownsVillageShopItem, purchaseVillageShopItem } from './villageShop';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';
import { SELL_SOUND, SPEND_MONEY_SOUND } from '../data/audio';
import type { NpcId } from '../data/npcs';
import { UPGRADE_TRACKS, UPGRADE_TRACK_IDS, UpgradeTrack, maxUpgradeLevel } from '../data/upgrades';
import { HOUSE_LEVELS } from '../data/houseLevels';
import { FENCE_SKINS } from '../data/fenceSkins';
import { nextUpgradeStep, purchaseUpgrade, upgradeBlocker, upgradeLevel } from './farmUpgrades';

/**
 * As LOJAS dos vendedores do Vilarejo (cada morador que `sells` em `data/npcs.ts`), no mesmo painel de livro do `ShopMenu`:
 *
 * - **Bruno (Ferreiro)** — a aba de Ferramentas inteira: o Martelo, a Vara de Pescar, as ferramentas de Cobre/Ferro/Ouro, as espadas e as armaduras (tudo, menos o Martelo e a Vara: moedas + 5 barras do metal,
 *   feitas na Fornalha — `data/toolShop.ts`, `data/villageShop.ts`).
 * - **Lia (Insumos)** — o que é da lavoura e da casa: Sementes, Móveis (cadeira, mesa, sofá, cômoda, baú) e Animais (a Galinha; um dia, filhotes que crescem).
 * - **Tomás (Marceneiro)** — Estruturas (poço, fornalha, galinheiro), Ferramentas (aspersores) e Materiais (madeira e pedra em pacotes).
 *
 * O Padeiro (Alberto) ainda não vende nada. Cada loja é um `ShopMenu` criado por `createVendorShop`; quem abre/fecha é a `VillageScene`.
 * Toda compra passa por `purchase` (só toca o som de gasto e recusa avisando quando a compra de fato acontece/falha).
 */
export type VendorId = Extract<NpcId, 'blacksmith' | 'supplier' | 'carpenter'>;

/** Pacotes de material do Marceneiro: comprar custa ~1,5x o que a Caixa de Remessas paga por unidade (madeira 1, pedra 2), pra vender de volta nunca valer a pena. */
const MATERIAL_BUNDLE_SIZE = 10;
const MATERIAL_BUNDLES = [
  { id: 'buy-wood', resource: WOOD, price: 15 },
  { id: 'buy-stone', resource: STONE, price: 25 },
];

const isFurniture = (decoration: DecorationDefinition): boolean => decoration.placement === 'house';

const decorationItem = (decoration: DecorationDefinition, category: ShopItem['category']): ShopItem => ({
  id: decoration.id,
  category,
  name: decoration.name,
  description: decoration.description,
  textureKey: decoration.textureKey,
  iconFrame: decoration.frameName,
  price: decoration.price,
  materials: decoration.materials?.map(({ resourceId, amount }) => ({ resourceId, name: RESOURCES[resourceId].name, amount })),
});

/** Estrutura do Marceneiro: não vai pra Bolsa — comprar abre a Fazenda pra escolher o local, e o Tomás constrói no dia seguinte. */
const constructionItem = (decoration: DecorationDefinition): ShopItem => ({
  ...decorationItem(decoration, 'construction'),
  description: `${decoration.description} O Tomás constrói no dia seguinte (leva ${buildHoursOf(decoration.id)}h).`,
});

const seedItems = (): ShopItem[] =>
  Object.values(CROPS).map((crop) => ({
    id: crop.id,
    category: 'agriculture' as const,
    name: `Semente de ${crop.name}`,
    description: `Cresce em ${crop.growthFrames.length - 1} dias (regue todo dia). Rende de 1 a ${HARVEST_MAX_YIELD} por colheita (com sorte!), vendida a ${crop.sellPrice} moedas cada.`,
    textureKey: ALL_CROPS_ICONS_KEY,
    iconFrame: crop.seedFrameName,
    price: crop.seedPrice,
  }));

const toolItems = (): ShopItem[] => [
  // Martelo: compra DIRETA em moedas (conserta as cercas destruídas pela horda).
  {
    id: HAMMER.id,
    category: 'tools' as const,
    name: HAMMER.name,
    description: 'Conserta cercas destruídas pelos ataques. Com o Martelo na mão, clique na cerca quebrada.',
    textureKey: HAMMER.textureKey,
    iconFrame: HAMMER.iconFrame,
    price: HAMMER_PRICE,
  },
  // Vara de Pescar: compra DIRETA em moedas (pesca na Praia e no lago da Floresta).
  {
    id: FISHING_ROD.id,
    category: 'tools' as const,
    name: FISHING_ROD.name,
    description: 'Pesca na Praia e no lago da Floresta. Com a Vara na mão, clique na água (ou encare a água e aperte F).',
    textureKey: FISHING_ROD.textureKey,
    iconFrame: FISHING_ROD.iconFrame,
    price: FISHING_ROD_PRICE,
  },
  // Ferramentas de progressão: moedas + as barras do metal (feitas na Fornalha); a nova substitui a do tier anterior no mesmo slot.
  ...TOOL_OFFERS.map((offer): ShopItem => {
    const tool = TOOLS[offer.toolId];
    const bar = RESOURCES[offer.barId];
    return {
      id: tool.id,
      category: 'tools',
      name: tool.name,
      description: `Substitui ${previousToolName(tool.id)} no mesmo slot.`,
      textureKey: tool.textureKey,
      iconFrame: tool.iconFrame,
      price: offer.price,
      materials: [{ resourceId: offer.barId, name: bar.name, amount: offer.barAmount }],
    };
  }),
];

/** Id dos itens da aba Melhorias: `upgrade-house`, `upgrade-plot`, `upgrade-fence`. */
const UPGRADE_ID_PREFIX = 'upgrade-';

/** O ícone de cada melhoria (mostra o que a compra traz): a arte da casa/cerca do PRÓXIMO nível (a do último, se já está no máximo) e, no plantio, a cenoura. */
function upgradeIcon(track: UpgradeTrack): { textureKey: string; iconFrame: string | number } {
  const level = Math.min(upgradeLevel(track) + 1, maxUpgradeLevel(track));
  if (track === 'house') {
    const house = HOUSE_LEVELS[level];
    return { textureKey: house.textureKey, iconFrame: house.frame?.name ?? '__BASE' };
  }
  if (track === 'fence') return { textureKey: FENCE_SKINS[level].textureKey, iconFrame: FENCE_SKINS[level].edgeTop };
  return { textureKey: ALL_CROPS_ICONS_KEY, iconFrame: CARROT.cropFrameName };
}

/** Preenche (ou atualiza, no lugar) as 3 melhorias com o degrau que vem agora — no nível máximo ficam com o último degrau, como "Já possui". */
function syncUpgradeItems(items: ShopItem[]): void {
  for (const item of items) {
    if (!item.id.startsWith(UPGRADE_ID_PREFIX)) continue;
    const track = item.id.slice(UPGRADE_ID_PREFIX.length) as UpgradeTrack;
    const definition = UPGRADE_TRACKS[track];
    const level = upgradeLevel(track);
    const step = nextUpgradeStep(track) ?? definition.steps[definition.steps.length - 1];
    const shownLevel = Math.min(level + 1, definition.steps.length);
    item.name = `${step.name} (${shownLevel + 1}/${definition.steps.length + 1})`;
    item.description = step.description;
    item.price = step.price;
    item.materials = step.materials.map(({ resourceId, amount }) => ({ resourceId, name: RESOURCES[resourceId].name, amount }));
    Object.assign(item, upgradeIcon(track));
  }
}

const upgradeItems = (): ShopItem[] => {
  const items = UPGRADE_TRACK_IDS.map((track): ShopItem => ({ id: `${UPGRADE_ID_PREFIX}${track}`, category: 'upgrades', name: '', description: '', textureKey: '', iconFrame: 0, price: 0 }));
  syncUpgradeItems(items);
  return items;
};

const animalItems = (): ShopItem[] => [
  {
    id: CHICKEN_SHOP_ID,
    category: 'animals' as const,
    name: 'Galinha',
    description: `Precisa de um Galinheiro com vaga (cada um abriga ${COOP_CAPACITY}). Põe 1 ovo por dia: recolha no galinheiro e venda na Caixa de Remessas.`,
    textureKey: ANIMAL_ICONS.key,
    iconFrame: ANIMAL_ICONS.chicken.name,
    price: CHICKEN_PRICE,
  },
];

const materialItems = (): ShopItem[] =>
  MATERIAL_BUNDLES.map(({ id, resource, price }) => ({
    id,
    category: 'tools' as const,
    name: `${resource.name} (x${MATERIAL_BUNDLE_SIZE})`,
    description: `Um pacote com ${MATERIAL_BUNDLE_SIZE} de ${resource.name}, pra construir e fabricar.`,
    textureKey: resource.textureKey,
    iconFrame: resource.frameName,
    price,
  }));

const tab = (category: ShopTabDefinition['category'], textureKey: string, iconFrame: string | number, frame: { name: string }, light: { name: string }): ShopTabDefinition => ({
  category,
  textureKey,
  iconFrame,
  tabFrame: frame.name,
  tabFrameHover: light.name,
});

interface VendorCatalog {
  tabs: ShopTabDefinition[];
  items: ShopItem[];
}

function catalogFor(id: VendorId): VendorCatalog {
  switch (id) {
    case 'blacksmith':
      return {
        tabs: [tab('tools', HOE.textureKey, HOE.iconFrame, TAB_FRAME_TOOLS, TAB_FRAME_TOOLS_LIGHT)],
        items: [...toolItems(), ...VILLAGE_SHOP_ITEMS],
      };
    case 'supplier':
      return {
        tabs: [
          tab('agriculture', ALL_CROPS_ICONS_KEY, CARROT.seedFrameName, TAB_FRAME_AGRICULTURE, TAB_FRAME_AGRICULTURE_LIGHT),
          tab('construction', CHAIR.textureKey, CHAIR.frameName, TAB_FRAME_CONSTRUCTION, TAB_FRAME_CONSTRUCTION_LIGHT),
          tab('animals', ANIMAL_ICONS.key, ANIMAL_ICONS.chicken.name, TAB_FRAME_ANIMALS, TAB_FRAME_ANIMALS_LIGHT),
        ],
        items: [
          ...seedItems(),
          ...Object.values(DECORATIONS)
            .filter((decoration) => !decoration.notForSale && isFurniture(decoration))
            .map((decoration) => decorationItem(decoration, 'construction')),
          ...animalItems(),
        ],
      };
    case 'carpenter':
      return {
        tabs: [
          tab('construction', WELL.textureKey, WELL.frameName, TAB_FRAME_CONSTRUCTION, TAB_FRAME_CONSTRUCTION_LIGHT),
          tab('tools', SPRINKLER_WOOD.textureKey, SPRINKLER_WOOD.frameName, TAB_FRAME_TOOLS, TAB_FRAME_TOOLS_LIGHT),
          tab('upgrades', HOUSE_LEVELS[HOUSE_LEVELS.length - 1].textureKey, HOUSE_LEVELS[HOUSE_LEVELS.length - 1].frame?.name ?? '__BASE', TAB_FRAME_SKILLS, TAB_FRAME_SKILLS_LIGHT),
        ],
        items: [
          // Construções: o Tomás as constrói no local escolhido. Ferramentas: aspersores (vão direto pra Bolsa) e os pacotes de material.
          ...Object.values(DECORATIONS)
            .filter((decoration) => !decoration.notForSale && decoration.carpenterBuilt)
            .map(constructionItem),
          ...Object.values(DECORATIONS)
            .filter((decoration) => !decoration.notForSale && !isFurniture(decoration) && !decoration.carpenterBuilt)
            .map((decoration) => decorationItem(decoration, 'tools')),
          ...materialItems(),
          ...upgradeItems(),
        ],
      };
  }
}

/** Registra os recortes das fitas das abas (idempotente: a Fazenda também os registra, mas a Vila não depende disso). */
function ensureTabRibbons(scene: Phaser.Scene): void {
  const texture = scene.textures.get(SHOP_TAB_RIBBONS_KEY);
  for (const ribbon of [
    TAB_FRAME_TOOLS,
    TAB_FRAME_TOOLS_LIGHT,
    TAB_FRAME_AGRICULTURE,
    TAB_FRAME_AGRICULTURE_LIGHT,
    TAB_FRAME_CONSTRUCTION,
    TAB_FRAME_CONSTRUCTION_LIGHT,
    TAB_FRAME_ANIMALS,
    TAB_FRAME_ANIMALS_LIGHT,
    TAB_FRAME_SKILLS,
    TAB_FRAME_SKILLS_LIGHT,
  ]) {
    if (!texture.has(ribbon.name)) texture.add(ribbon.name, 0, ribbon.rect.x, ribbon.rect.y, ribbon.rect.width, ribbon.rect.height);
  }
}

/** O jogador já tem este item (compras únicas: ferramentas de progressão, Martelo e as armas/armaduras do Ferreiro)? O botão vira "Já possui". */
function owns(inventory: Inventory, itemId: string): boolean {
  if (itemId.startsWith(UPGRADE_ID_PREFIX)) return nextUpgradeStep(itemId.slice(UPGRADE_ID_PREFIX.length) as UpgradeTrack) === null; // Melhoria no nível máximo.
  return (!!getToolOffer(itemId) && getToolUpgradeBlock(inventory, itemId) === 'owned') || ((itemId === HAMMER.id || itemId === FISHING_ROD.id) && inventory.hasTool(itemId)) || VILLAGE_SHOP_GOODS.some((good) => good.definition.id === itemId && ownsVillageShopItem(inventory, itemId));
}

/** Efetiva a compra de `itemId` (cada tipo de item tem a sua regra de recusa); nada é cobrado numa recusa. */
function purchase(scene: Phaser.Scene, inventory: Inventory, player: Player, itemId: string, hooks: VendorHooks): void {
  const coinsBefore = inventory.getCoins();
  const warn = (message: string): void => popText(scene, player.sprite.x, player.sprite.y - 44, message, { color: '#ff8a8a', fontSize: 14 });

  if (CROPS[itemId]) {
    const crop = CROPS[itemId];
    if (inventory.spendCoins(crop.seedPrice)) inventory.addSeeds(itemId, 1);
    else console.log(`Moedas insuficientes para comprar semente de ${crop.name} (precisa de ${crop.seedPrice}).`);
  } else if (DECORATIONS[itemId]?.carpenterBuilt) {
    // Nada é cobrado agora: a Fazenda mostra os locais livres e o dinheiro sai ao confirmar o local (`systems/buildFlow.ts`).
    const decoration = DECORATIONS[itemId];
    if (inventory.getCoins() >= decoration.price) hooks.startBuild({ mode: 'order', decorationId: itemId });
    else console.log(`Moedas insuficientes para encomendar ${decoration.name} (precisa de ${decoration.price}).`);
  } else if (DECORATIONS[itemId]) {
    const decoration = DECORATIONS[itemId];
    const materials = decoration.materials ?? [];
    if (materials.some(({ resourceId, amount }) => inventory.getResourceCount(resourceId) < amount)) {
      warn('Faltam materiais'); // Nada é cobrado: as moedas só saem com todos os materiais em mãos.
    } else if (inventory.spendCoins(decoration.price)) {
      for (const { resourceId, amount } of materials) inventory.useResource(resourceId, amount);
      inventory.addDecorations(itemId, 1);
      console.log(`Comprado: 1 ${decoration.name} por ${decoration.price} moedas. Tecla B para posicionar.`);
    } else console.log(`Moedas insuficientes para comprar ${decoration.name} (precisa de ${decoration.price}).`);
  } else if (getToolOffer(itemId)) {
    // Ferramenta de progressão: tier seguinte a quem tem o anterior; gasta as moedas E as barras (nada é cobrado numa recusa).
    const offer = getToolOffer(itemId)!;
    const block = getToolUpgradeBlock(inventory, itemId);
    if (block === 'owned') console.log('Você já tem essa ferramenta (ou uma melhor).');
    else if (block === 'needsPrevious') warn(`Precisa: ${previousToolName(itemId)}`);
    else if (inventory.getResourceCount(offer.barId) < offer.barAmount) warn(`Faltam barras de ${RESOURCES[offer.barId].name.replace('Barra de ', '')}`);
    else if (inventory.spendCoins(offer.price)) {
      inventory.useResource(offer.barId, offer.barAmount);
      inventory.upgradeTool(itemId);
    } else console.log(`Moedas insuficientes para ${TOOLS[offer.toolId].name} (precisa de ${offer.price}).`);
  } else if (itemId.startsWith(UPGRADE_ID_PREFIX)) {
    // Melhoria do Marceneiro (casa, plantio, cerca): confere tudo antes de cobrar; comprada, o mundo já está no novo nível na próxima vez que a cena abrir.
    const track = itemId.slice(UPGRADE_ID_PREFIX.length) as UpgradeTrack;
    const result = purchaseUpgrade(inventory, track);
    if (result === 'bought') popText(scene, player.sprite.x, player.sprite.y - 44, 'Melhoria concluída!', { color: '#b8f5a0', fontSize: 14 });
    else if (result === 'blocked') warn(upgradeBlocker(track) ?? 'Tem algo no caminho');
    else if (result === 'noMaterials') warn('Faltam materiais');
    else if (result === 'poor') console.log('Moedas insuficientes para a melhoria.');
  } else if (itemId === HAMMER.id) {
    if (inventory.hasTool(HAMMER.id)) console.log('Você já tem o Martelo.');
    else if (inventory.spendCoins(HAMMER_PRICE)) inventory.unlockTool(HAMMER.id);
    else console.log(`Moedas insuficientes para comprar o Martelo (precisa de ${HAMMER_PRICE}).`);
  } else if (itemId === FISHING_ROD.id) {
    if (inventory.hasTool(FISHING_ROD.id)) console.log('Você já tem a Vara de Pescar.');
    else if (inventory.spendCoins(FISHING_ROD_PRICE)) inventory.unlockTool(FISHING_ROD.id);
    else console.log(`Moedas insuficientes para a Vara de Pescar (precisa de ${FISHING_ROD_PRICE}).`);
  } else if (itemId === CHICKEN_SHOP_ID) {
    const result = buyChicken();
    if (result === 'noCoop') warn('Compre um Galinheiro antes');
    else if (result === 'full') warn('Galinheiro lotado');
    else if (result === 'poor') console.log(`Moedas insuficientes para comprar uma galinha (precisa de ${CHICKEN_PRICE}).`);
  } else {
    const bundle = MATERIAL_BUNDLES.find((candidate) => candidate.id === itemId);
    if (bundle) {
      if (inventory.spendCoins(bundle.price)) inventory.addResources(bundle.resource.id, MATERIAL_BUNDLE_SIZE);
      else console.log(`Moedas insuficientes para o pacote de ${bundle.resource.name} (precisa de ${bundle.price}).`);
    } else if (VILLAGE_SHOP_GOODS.some((good) => good.definition.id === itemId)) {
      const result = purchaseVillageShopItem(inventory, itemId);
      if (result === 'full') warn('Bolsa cheia');
      else if (result === 'noMaterials') warn('Faltam barras');
    }
  }

  // Só toca se a compra realmente aconteceu (o saldo caiu) — recusas ficam em silêncio.
  if (inventory.getCoins() < coinsBefore) playEffect(scene, SPEND_MONEY_SOUND);
}

/** O que a loja precisa da cena que a abriu: levar o jogador à Fazenda pra escolher local (encomenda do Marceneiro) — a cena acrescenta pra onde voltar. */
export interface VendorHooks {
  startBuild(request: Omit<BuildRequest, 'returnTo'>): void;
}

/**
 * Ações dos ícones da loja do Marceneiro (`ShopItemActions`): mover qualquer uma das construções/encomendas do item; cancelar uma encomenda
 * (devolve tudo) e destruir uma construção pronta (devolve 80%). Com UMA candidata, cancelar/destruir agem na hora; com várias (ou pra
 * mover, que precisa do novo local) abre a Fazenda pro jogador escolher.
 */
function carpenterActions(scene: Phaser.Scene, player: Player, hooks: VendorHooks, refresh: () => void): ShopItemActions {
  const refunded = (amount: number): void => {
    playEffect(scene, SELL_SOUND);
    popText(scene, player.sprite.x, player.sprite.y - 44, `+${amount} moedas`, { color: '#b8f5a0', fontSize: 14 });
    refresh();
  };
  return {
    available: (itemId) => availableActions(itemId),
    onAction: (itemId, action) => {
      const targets = targetsFor(itemId, action);
      if (targets.length === 0) return;
      const only = targets.length === 1 ? targets[0] : undefined;
      if (action === 'cancel' && only?.kind === 'order') {
        refunded(cancelOrder(only.id));
      } else if (action === 'destroy' && only?.kind === 'built') {
        const result = destroyBuilt(only.col, only.row);
        if (result === 'locked') popText(scene, player.sprite.x, player.sprite.y - 44, 'Tem galinhas aí dentro', { color: '#ff8a8a', fontSize: 14 });
        else if (result !== null) refunded(result);
      } else {
        hooks.startBuild({ mode: action, decorationId: itemId, target: only });
      }
    },
  };
}

/** Cria a loja do vendedor `id` (fechada). Quem a usa a abre/fecha e chama `refresh(coins)` enquanto aberta. */
export function createVendorShop(scene: Phaser.Scene, id: VendorId, inventory: Inventory, player: Player, hooks: VendorHooks): ShopMenu {
  ensureTabRibbons(scene);
  const { tabs, items } = catalogFor(id);
  // Materiais e bloqueios das ofertas (as barras das ferramentas do Ferreiro): a loja mostra o que o jogador tem e apaga o que ele ainda não pode comprar.
  const requirements: ShopRequirements = {
    count: (resourceId) => inventory.getResourceCount(resourceId),
    blockedReason: (itemId) => {
      if (itemId.startsWith(UPGRADE_ID_PREFIX)) return upgradeBlocker(itemId.slice(UPGRADE_ID_PREFIX.length) as UpgradeTrack);
      return getToolOffer(itemId) && getToolUpgradeBlock(inventory, itemId) === 'needsPrevious' ? `Precisa: ${previousToolName(itemId)}` : null;
    },
  };
  let menu: ShopMenu;
  menu = new ShopMenu(
    scene,
    tabs,
    items,
    (itemId) => {
      purchase(scene, inventory, player, itemId, hooks);
      if (itemId.startsWith(UPGRADE_ID_PREFIX)) {
        syncUpgradeItems(items); // A melhoria passou pro próximo degrau.
        menu.refreshItems();
      }
      menu.refresh(inventory.getCoins());
    },
    (itemId) => owns(inventory, itemId),
    id === 'carpenter' ? carpenterActions(scene, player, hooks, () => menu.refresh(inventory.getCoins())) : undefined,
    requirements,
  );
  return menu;
}
