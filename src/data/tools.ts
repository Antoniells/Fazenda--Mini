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
export type ToolId = 'hoe' | 'water' | 'sickle' | 'axe' | 'pickaxe';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  textureKey: string;
  texturePath: string;
  iconFrame: number;
}

const TOOLS_BASE_PATH = 'Icons/RPG icons/Weapons and Armor/1. Wood';

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

export const TOOLS: Record<ToolId, ToolDefinition> = {
  hoe: HOE,
  water: WATERING_CAN_TOOL,
  sickle: SICKLE,
  axe: AXE,
  pickaxe: PICKAXE,
};
