import Phaser from 'phaser';
import { Interactable, InteractionRegistry } from './interaction';
import { Player } from '../entities/Player';
import { ShopMenu } from '../ui/shopMenu';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { structureBaseRow, VILLAGE_SHOP_HOUSE } from '../data/maps/villageMap';
import { TILE_SIZE } from '../data/tiles';
import { VILLAGE_SHOP_ASSETS, VILLAGE_SHOP_GOODS, VILLAGE_SHOP_ITEMS, VILLAGE_SHOP_LAYOUT } from '../data/villageShop';
import type { NpcPost } from '../entities/Npc';
import { Inventory } from './inventory';
import { HOE } from '../data/tools';
import { TAB_FRAME_TOOLS, TAB_FRAME_TOOLS_LIGHT } from '../data/ui';
import { playEffect } from './soundEffects';
import { SPEND_MONEY_SOUND } from '../data/audio';

/** Carrega a mobília da fachada e os ícones do catálogo — chamado no `preload` da `VillageScene`. */
export function preloadVillageShop(scene: Phaser.Scene): void {
  const { fixtures } = VILLAGE_SHOP_ASSETS;
  scene.load.image(fixtures.key, encodeURI(`/${fixtures.path}`));
  // Ícones das armas/armaduras à venda e da aba (a Fazenda os carrega, mas esta cena não depende disso).
  for (const { definition } of VILLAGE_SHOP_GOODS) {
    scene.load.spritesheet(definition.textureKey, encodeURI(`/${definition.texturePath}`), { frameWidth: 16, frameHeight: 16 });
  }
  scene.load.spritesheet(HOE.textureKey, encodeURI(`/${HOE.texturePath}`), { frameWidth: 16, frameHeight: 16 });
}

/**
 * Loja completa do Ferreiro: o painel (uma aba, catálogo de `data/villageShop.ts`), a fachada com o balcão e a compra. Toca o som
 * de gasto só quando a compra aconteceu; recusas só avisam no console (regra em `purchaseVillageShopItem`). Devolve o painel pra
 * cena fechá-lo (ao andar, Esc, E) e atualizar o saldo.
 */
export function createVillageShop(
  scene: Phaser.Scene,
  inventory: Inventory,
  player: Player,
  interactions: InteractionRegistry,
  /** A loja está aberta (o Ferreiro no balcão)? */
  isOpen: () => boolean,
  /** Chamado quando o jogador tenta usar o balcão com a loja fechada (a cena mostra o aviso). */
  onClosed: () => void,
): ShopMenu {
  const buy = (itemId: string): void => {
    const good = VILLAGE_SHOP_GOODS.find((candidate) => candidate.definition.id === itemId);
    const result = purchaseVillageShopItem(inventory, itemId);
    const name = good?.definition.name ?? itemId;

    if (result === 'bought') {
      playEffect(scene, SPEND_MONEY_SOUND);
      console.log(`Comprado no Ferreiro: ${name} por ${good?.price} moedas (saldo: ${inventory.getCoins()}).`);
    } else if (result === 'poor') console.log(`Moedas insuficientes para comprar ${name} (precisa de ${good?.price}).`);
    else if (result === 'full') console.log(`Bolsa cheia — libere um espaço pra levar ${name}.`);
    else if (result === 'owned') console.log(`Você já tem ${name}.`);

    menu.refresh(inventory.getCoins());
  };

  const menu: ShopMenu = new ShopMenu(
    scene,
    [{ category: 'tools', textureKey: HOE.textureKey, iconFrame: HOE.iconFrame, tabFrame: TAB_FRAME_TOOLS.name, tabFrameHover: TAB_FRAME_TOOLS_LIGHT.name }],
    VILLAGE_SHOP_ITEMS,
    buy,
    // Itens do Ferreiro são únicos: depois de comprado (ou fabricado), o botão vira "Já possui".
    (itemId) => ownsVillageShopItem(inventory, itemId),
  );
  buildVillageShop(scene, player, interactions, menu, isOpen, onClosed);
  return menu;
}

/**
 * O gatilho da loja: célula do balcão (ou do NPC atrás dele). É SÓLIDA (a parede da casa), então o clique cai no fluxo de "objeto
 * sólido com interação" do `PlayerController` — mas a célula vizinha andável mais próxima estaria fechada pelo resto da fachada,
 * por isso `approachCell` diz de onde atender: a rua em frente. Ao chegar, o jogador vira de frente e o painel abre (ou fecha).
 */
class ShopCounterInteractable implements Interactable {
  constructor(
    private readonly player: Player,
    private readonly shopMenu: ShopMenu,
    readonly approachCell: { col: number; row: number },
    private readonly isOpen: () => boolean,
    private readonly onClosed: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    if (this.shopMenu.isOpen()) {
      this.shopMenu.close();
      return;
    }
    // Sem o Ferreiro atrás do balcão a loja não atende.
    if (!this.isOpen()) {
      this.onClosed();
      return;
    }
    this.shopMenu.open();
  }
}

/** Onde o Ferreiro fica ATRÁS do balcão (pés e profundidade, em px do mundo): o NPC do ofício aparece aqui no expediente (`Npc` lugar `post`). */
export function getVillageShopPost(): NpcPost {
  const tile = TILE_SIZE * DISPLAY_SCALE;
  const baseDepth = (structureBaseRow(VILLAGE_SHOP_HOUSE) + 1) * tile;
  return {
    x: VILLAGE_SHOP_HOUSE.col * tile + VILLAGE_SHOP_LAYOUT.npc.x * DISPLAY_SCALE,
    y: VILLAGE_SHOP_HOUSE.row * tile + VILLAGE_SHOP_LAYOUT.npc.y * DISPLAY_SCALE,
    depth: baseDepth + 0.2, // Abaixo do balcão (baseDepth + 0.4), acima da casa.
  };
}

/**
 * Monta a fachada da loja na casa `VILLAGE_SHOP_HOUSE`: o NPC (Ferreiro, em repouso, de frente) atrás do balcão na porta, a vitrine na
 * varanda e o gatilho de interação nas células do balcão/NPC. A casa já é sólida (máscara de colisão do vilarejo) — nada aqui muda
 * o grid. Profundidades logo acima da casa: NPC < vitrine < balcão (o balcão cobre o corpo do NPC); o jogador, na rua, fica na frente de tudo.
 */
export function buildVillageShop(
  scene: Phaser.Scene,
  player: Player,
  interactions: InteractionRegistry,
  shopMenu: ShopMenu,
  isOpen: () => boolean,
  onClosed: () => void,
): void {
  const tile = TILE_SIZE * DISPLAY_SCALE;
  const houseX = VILLAGE_SHOP_HOUSE.col * tile;
  const houseY = VILLAGE_SHOP_HOUSE.row * tile;
  const baseDepth = (structureBaseRow(VILLAGE_SHOP_HOUSE) + 1) * tile;
  const art = DISPLAY_SCALE; // px de tela por px de arte

  const { fixtures } = VILLAGE_SHOP_ASSETS;
  registerFrame(scene, fixtures.key, fixtures.counterFrame);
  registerFrame(scene, fixtures.key, fixtures.displayFrame);

  const display = scene.add.image(houseX + VILLAGE_SHOP_LAYOUT.display.x * art, houseY + VILLAGE_SHOP_LAYOUT.display.y * art, fixtures.key, fixtures.displayFrame.name);
  display.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(baseDepth + 0.3);

  const counter = scene.add.image(houseX + VILLAGE_SHOP_LAYOUT.counter.x * art, houseY + VILLAGE_SHOP_LAYOUT.counter.y * art, fixtures.key, fixtures.counterFrame.name);
  counter.setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(baseDepth + 0.4);

  // Gatilho: cada célula do balcão/NPC leva o jogador à célula da rua na MESMA coluna.
  for (const col of VILLAGE_SHOP_LAYOUT.triggerCols) {
    for (const row of VILLAGE_SHOP_LAYOUT.triggerRows) {
      interactions.set(col, row, new ShopCounterInteractable(player, shopMenu, { col, row: VILLAGE_SHOP_LAYOUT.approachRow }, isOpen, onClosed));
    }
  }
}

/** O Ferreiro já entregou este item ao jogador? (espada: na Bolsa; armadura: idem) — o painel mostra "Já possui". */
export function ownsVillageShopItem(inventory: Inventory, itemId: string): boolean {
  const good = VILLAGE_SHOP_GOODS.find((candidate) => candidate.definition.id === itemId);
  if (!good) return false;
  return good.kind === 'weapon' ? inventory.hasTool(itemId) : inventory.hasArmor(itemId);
}

export type VillagePurchaseResult = 'bought' | 'owned' | 'full' | 'poor' | 'unknown';

/**
 * Compra um item do Ferreiro: item único (não vende duas vezes), exige um slot livre na Bolsa (senão o item se perderia) e só
 * então debita as moedas e entrega. Devolve o resultado pra quem chama avisar/tocar o som — nada é cobrado em nenhum caso de recusa.
 */
export function purchaseVillageShopItem(inventory: Inventory, itemId: string): VillagePurchaseResult {
  const good = VILLAGE_SHOP_GOODS.find((candidate) => candidate.definition.id === itemId);
  if (!good) return 'unknown';
  if (ownsVillageShopItem(inventory, itemId)) return 'owned';
  if (!inventory.hasFreeSlot()) return 'full';
  if (!inventory.spendCoins(good.price)) return 'poor';

  if (good.kind === 'weapon') inventory.unlockTool(itemId);
  else inventory.unlockArmor(itemId);
  return 'bought';
}
