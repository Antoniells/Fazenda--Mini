import { WATERING_CAN_ICON_KEY, WATERING_CAN_ICON_PATH } from './ui';

/**
 * Ferramentas permanentes (Hotbar/Inventário): diferente de sementes e
 * decorações, não têm quantidade — o jogador as tem ou não, nunca "gasta"
 * uma enxada. Cada ícone vem de `Icons/RPG icons/Weapons and Armor/1. Wood/`
 * (mesmo pacote já usado pelo ícone do regador na `WaterBar`): folhas de
 * 32x16, dois frames idênticos de 16x16 cada (conferido pixel a pixel) —
 * só o frame 0 é usado. `water` reaproveita a mesma textura já carregada
 * pra `WaterBar` (`WATERING_CAN_ICON_KEY`) em vez de carregar o mesmo PNG
 * de novo com outra chave.
 */
export type ToolId =
  | 'hoe'
  | 'water'
  | 'sickle'
  | 'axe'
  | 'pickaxe'
  | 'axe-copper'
  | 'pickaxe-copper'
  | 'axe-iron'
  | 'axe-gold'
  | 'pickaxe-iron'
  | 'pickaxe-gold'
  | 'hammer';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  textureKey: string;
  texturePath: string;
  iconFrame: number;
}

const TOOLS_BASE_PATH = 'Icons/RPG icons/Weapons and Armor/1. Wood';
/** Mesmas pastas de tier já usadas em `data/weapons.ts` (Ferro/Ouro) — o pacote também tem `Axe.png`/`Pickaxe.png` em cada uma. */
/** O 2º tier da progressão (Madeira > Cobre > Ferro > Ouro, `data/toolProgression.ts`) usa a pasta `2. Cooper` (cobre) do pacote de ícones. */
const COPPER_TOOLS_BASE_PATH = 'Icons/RPG icons/Weapons and Armor/2. Cooper';
const IRON_TOOLS_BASE_PATH = 'Icons/RPG icons/Weapons and Armor/3. Iron';
const GOLD_TOOLS_BASE_PATH = 'Icons/RPG icons/Weapons and Armor/4. Gold';

export const HOE: ToolDefinition = {
  id: 'hoe',
  name: 'Enxada',
  textureKey: 'tool-hoe',
  texturePath: `${TOOLS_BASE_PATH}/Hoe.png`,
  iconFrame: 0,
};

export const WATERING_CAN_TOOL: ToolDefinition = {
  id: 'water',
  name: 'Regador',
  textureKey: WATERING_CAN_ICON_KEY,
  texturePath: WATERING_CAN_ICON_PATH,
  iconFrame: 0,
};

export const SICKLE: ToolDefinition = {
  id: 'sickle',
  name: 'Foice',
  textureKey: 'tool-sickle',
  texturePath: `${TOOLS_BASE_PATH}/Sickle.png`,
  iconFrame: 0,
};

/** Corta árvores maduras (ver `systems/resourceInteraction.ts`) — mesma convenção de ícone das outras ferramentas (folha 32x16, só o frame 0). */
export const AXE: ToolDefinition = {
  id: 'axe',
  name: 'Machado',
  textureKey: 'tool-axe',
  texturePath: `${TOOLS_BASE_PATH}/Axe.png`,
  iconFrame: 0,
};

/** Quebra pedras/rochas (ver `systems/resourceInteraction.ts`). */
export const PICKAXE: ToolDefinition = {
  id: 'pickaxe',
  name: 'Picareta',
  textureKey: 'tool-pickaxe',
  texturePath: `${TOOLS_BASE_PATH}/Pickaxe.png`,
  iconFrame: 0,
};

/**
 * Martelo: conserta cercas destruídas (ver `systems/farmFences.ts`). Comprado na Loja (aba Ferramentas, `HAMMER_PRICE`), diferente
 * das ferramentas de progressão. O pacote de ícones NÃO tem um martelo: o ícone é PROVISÓRIO — a Pá de madeira (`Shovel.png`,
 * folha 32x16, só o frame 0; a Pá não é usada em nenhum outro lugar). Trocar pela arte de martelo quando existir = só mudar
 * `texturePath` aqui, nenhuma lógica depende dele. Bate com a mesma animação da Picareta (`Player.performAction('pickaxe')`).
 */
export const HAMMER_PRICE = 80;
export const HAMMER: ToolDefinition = {
  id: 'hammer',
  name: 'Martelo',
  textureKey: 'tool-hammer',
  texturePath: `${TOOLS_BASE_PATH}/Shovel.png`,
  iconFrame: 0,
};

/**
 * Ferramentas de progressão (Fase 8 — Upgrade de Ferramentas): diferente
 * das 5 acima (dadas de graça no início, nunca compradas), estas só
 * existem comprando no Ferreiro (`data/toolShop.ts`: moedas + 5 barras do metal) — não têm
 * `price` aqui porque essa economia vive inteira na oferta da loja, não no item. Mesma convenção de tier
 * (Madeira/Ferro/Ouro) e mesma folha 32x16 (só o frame 0) já usada pelas
 * Espadas em `data/weapons.ts`.
 */
export const COPPER_AXE: ToolDefinition = {
  id: 'axe-copper',
  name: 'Machado de Cobre',
  textureKey: 'tool-axe-copper',
  texturePath: `${COPPER_TOOLS_BASE_PATH}/Axe.png`,
  iconFrame: 0,
};

export const COPPER_PICKAXE: ToolDefinition = {
  id: 'pickaxe-copper',
  name: 'Picareta de Cobre',
  textureKey: 'tool-pickaxe-copper',
  texturePath: `${COPPER_TOOLS_BASE_PATH}/Pickaxe.png`,
  iconFrame: 0,
};

export const IRON_AXE: ToolDefinition = {
  id: 'axe-iron',
  name: 'Machado de Ferro',
  textureKey: 'tool-axe-iron',
  texturePath: `${IRON_TOOLS_BASE_PATH}/Axe.png`,
  iconFrame: 0,
};

export const GOLD_AXE: ToolDefinition = {
  id: 'axe-gold',
  name: 'Machado de Ouro',
  textureKey: 'tool-axe-gold',
  texturePath: `${GOLD_TOOLS_BASE_PATH}/Axe.png`,
  iconFrame: 0,
};

export const IRON_PICKAXE: ToolDefinition = {
  id: 'pickaxe-iron',
  name: 'Picareta de Ferro',
  textureKey: 'tool-pickaxe-iron',
  texturePath: `${IRON_TOOLS_BASE_PATH}/Pickaxe.png`,
  iconFrame: 0,
};

export const GOLD_PICKAXE: ToolDefinition = {
  id: 'pickaxe-gold',
  name: 'Picareta de Ouro',
  textureKey: 'tool-pickaxe-gold',
  texturePath: `${GOLD_TOOLS_BASE_PATH}/Pickaxe.png`,
  iconFrame: 0,
};

export const TOOLS: Record<ToolId, ToolDefinition> = {
  hoe: HOE,
  water: WATERING_CAN_TOOL,
  sickle: SICKLE,
  axe: AXE,
  pickaxe: PICKAXE,
  'axe-copper': COPPER_AXE,
  'pickaxe-copper': COPPER_PICKAXE,
  'axe-iron': IRON_AXE,
  'axe-gold': GOLD_AXE,
  'pickaxe-iron': IRON_PICKAXE,
  'pickaxe-gold': GOLD_PICKAXE,
  hammer: HAMMER,
};
