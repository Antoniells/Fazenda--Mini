import type { ShopItem } from '../ui/shopMenu';
import { IRON_SWORD, GOLD_SWORD, WeaponDefinition } from './weapons';
import { WOOD_ARMOR, IRON_ARMOR, ArmorDefinition } from './armors';

/**
 * Loja do Vilarejo: a casa de madeira com toldo (`house8`), logo na entrada da rua principal, vira uma loja. Um NPC (o Ferreiro) fica
 * atrás de um balcão na porta; clicar no balcão/NPC leva o jogador até a rua em frente e abre o painel de compra (`ui/shopMenu.ts`,
 * uma SEGUNDA instância, com o catálogo próprio daqui — a Loja da Fazenda continua a mesma). Só DADOS: o desenho e o gatilho estão
 * em `systems/villageShop.ts`.
 */

/**
 * Horário da loja: só atende com o Ferreiro atrás do balcão (`data/npcs.ts`, lugar `post`) — de manhã e à tarde; no almoço, à noite e
 * na chuva ele não está lá e o balcão avisa que está fechado.
 */
export const VILLAGE_SHOP_HOURS_TEXT = 'A loja abre das 07:00 às 12:00 e das 13:00 às 18:00.';

/**
 * Posições dos elementos da fachada da casa `VILLAGE_SHOP_HOUSE` (`data/maps/villageMap.ts`), em px da ARTE da casa (16px de arte = 1 célula; a arte da casa tem 128x128), medidas a partir do
 * canto superior-esquerdo dela. A porta com toldo fica em x 16..32 (centro 24); a varanda vai até y≈112.
 */
export const VILLAGE_SHOP_LAYOUT = {
  /** Balcão (canto superior-esquerdo): fica na frente da porta, sobre a varanda. */
  counter: { x: 8, y: 80 },
  /** Pés do NPC: atrás do balcão (o balcão cobre o corpo dele da cintura pra baixo). */
  npc: { x: 24, y: 92 },
  /** Vitrine (base, centro) na varanda, ao lado da porta. */
  display: { x: 74, y: 106 },
  /** Células do balcão/NPC que disparam a interação (todas sólidas — a parede da casa): colunas e linhas. */
  triggerCols: [3, 4, 5, 6],
  triggerRows: [12, 13],
  /** Linha da rua em frente ao balcão, de onde o jogador atende (o clique leva ele até lá). */
  approachRow: 14,
};

/** A arte da fachada: a folha de mobília da ferraria. (O Ferreiro em si é um morador com rotina: `data/npcs.ts`.) */
export const VILLAGE_SHOP_ASSETS = {
  fixtures: {
    key: 'village-shop-fixtures',
    path: 'Objects/Interior/Blacksmith.png',
    counterFrame: { name: 'village-shop-counter', rect: { x: 2, y: 64, width: 45, height: 32 } },
    displayFrame: { name: 'village-shop-display', rect: { x: 114, y: 65, width: 28, height: 31 } },
  },
};

/**
 * CATÁLOGO do Ferreiro: armas e armaduras PRONTAS, compradas direto em moedas (sem Bancada nem receita). Preço de conveniência: ~1,5x o
 * valor da receita/arma equivalente (`data/recipes.ts`, `data/weapons.ts`) — a Bancada, que exige receita + materiais, continua sendo a
 * opção mais barata. A espada de madeira (inicial, de graça) não é vendida.
 */
export interface VillageShopGood {
  kind: 'weapon' | 'armor';
  definition: WeaponDefinition | ArmorDefinition;
  price: number;
}

export const VILLAGE_SHOP_GOODS: VillageShopGood[] = [
  { kind: 'weapon', definition: IRON_SWORD, price: 750 },
  { kind: 'weapon', definition: GOLD_SWORD, price: 1800 },
  { kind: 'armor', definition: WOOD_ARMOR, price: 300 },
  { kind: 'armor', definition: IRON_ARMOR, price: 900 },
];

/** Aba única do painel (ícone/cor da categoria "Ferramentas") e os itens do catálogo, no formato do `ShopMenu`. */
export const VILLAGE_SHOP_ITEMS: ShopItem[] = VILLAGE_SHOP_GOODS.map(({ kind, definition, price }) => ({
  id: definition.id,
  category: 'tools' as const,
  name: definition.name,
  description:
    kind === 'weapon'
      ? `Dano ${(definition as WeaponDefinition).damage} por golpe. Aperte Espaço com ela na mão pra atacar.`
      : `Defesa ${(definition as ArmorDefinition).defense}: reduz o dano que você leva. Vista-a na aba Armadura do Inventário.`,
  textureKey: definition.textureKey,
  iconFrame: definition.iconFrame,
  price,
}));
