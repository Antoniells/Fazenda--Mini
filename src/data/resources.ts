import { WOOD_KEY, WOOD_FRAME, ROCK_KEY, ROCK_FRAME_1, PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME } from './tiles';
import { SLIME_KEY, SLIME_IDLE_FRAMES } from './enemies';

/**
 * Materiais coletáveis (Fase 7 — Coleta de Recursos): loot de árvores/
 * pedras (`systems/resourceInteraction.ts`), guardados no `Inventory` como
 * uma categoria própria (`SlotCategory: 'resource'`, ver `data/items.ts`) —
 * diferente da colheita da lavoura (que nunca aparece na Hotbar, só é
 * vendida em bloco na Caixa de Remessas), estes precisam aparecer/serem
 * contáveis na Hotbar, então não fazia sentido reaproveitar o Map genérico
 * `Inventory.items` (invisível na UI) nem misturar com sementes/decorações
 * (que têm semântica própria — ver comentário de `Inventory`).
 */
export interface ResourceDefinition {
  id: string;
  name: string;
  textureKey: string;
  /**
   * Nome do frame recortado (registrado em `MainScene`, já feito por outro
   * sistema — ver comentário de cada item abaixo) ou, no caso de drops de
   * inimigo (Fase 8 — Combate: `SLIME_GOO`), o índice numérico de um frame
   * de spritesheet já carregado (`entities/Slime.ts`), sem precisar
   * recortar/nomear nada — o sprite do próprio Slime já é o ícone.
   */
  frameName: string | number;
}

/** Ícone reaproveita o mesmo frame já recortado por `systems/externalMapBuilder.ts` (pilha de madeira). */
export const WOOD: ResourceDefinition = {
  id: 'wood',
  name: 'Madeira',
  textureKey: WOOD_KEY,
  frameName: WOOD_FRAME.name,
};

/** Ícone reaproveita o mesmo boulder já usado como decoração no mundo (`ROCK_FRAME_1`) — é literalmente a pedra que o jogador quebrou. */
export const STONE: ResourceDefinition = {
  id: 'stone',
  name: 'Pedra',
  textureKey: ROCK_KEY,
  frameName: ROCK_FRAME_1.name,
};

/**
 * Bolota (semente de árvore, plantável — ver `systems/treePlanting.ts`):
 * ícone reaproveita o broto da própria árvore (`PINE_SPROUT_FRAME_NAME`,
 * já recortado por `systems/externalMapBuilder.ts`) — mostra visualmente
 * "no que isso se transforma", sem precisar de um ícone de bolota dedicado.
 */
export const ACORN: ResourceDefinition = {
  id: 'acorn',
  name: 'Bolota',
  textureKey: PINE_TREE_KEY,
  frameName: PINE_SPROUT_FRAME_NAME,
};

/** Drop do Slime derrotado (Fase 8 — Combate) — ícone reaproveita o próprio frame de idle do sprite do Slime (`entities/Slime.ts`), sem precisar de um ícone de item dedicado. */
export const SLIME_GOO: ResourceDefinition = {
  id: 'slime-goo',
  name: 'Gosma de Slime',
  textureKey: SLIME_KEY,
  frameName: SLIME_IDLE_FRAMES.start,
};

export const RESOURCES: Record<string, ResourceDefinition> = {
  [WOOD.id]: WOOD,
  [STONE.id]: STONE,
  [ACORN.id]: ACORN,
  [SLIME_GOO.id]: SLIME_GOO,
};
