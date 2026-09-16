import { CROPS, ALL_CROPS_ICONS_KEY } from './crops';
import { DECORATIONS } from './decorations';
import { TOOLS, ToolId } from './tools';
import { RESOURCES } from './resources';
import { WEAPONS } from './weapons';
import { ARMORS } from './armors';
import { RECIPES } from './recipes';

/**
 * As categorias que podem ocupar um slot da Hotbar/Inventário. Cada uma já
 * tinha sua própria tabela de dados (`CROPS`, `DECORATIONS`, `TOOLS`,
 * `RESOURCES`) — em vez de fundir tudo numa estrutura só (o que exigiria
 * reescrever essas tabelas), este módulo só sabe resolver "categoria + id"
 * para o visual (ícone/nome) que a UI precisa, mantendo cada tabela isolada
 * e intacta. `resource` (Fase 7 — Coleta de Recursos): madeira, pedra e
 * bolota, ver `data/resources.ts`. `armor`/`recipe` (Fase 8 — Crafting):
 * armaduras (`data/armors.ts`) e as receitas compradas na Loja antes de
 * fabricar na Bancada de Trabalho (`data/recipes.ts`).
 */
export type SlotCategory = 'tool' | 'seed' | 'decoration' | 'resource' | 'armor' | 'recipe';

/** Referência ao conteúdo de um slot — não guarda quantidade (isso continua vindo de `Inventory`, por categoria). */
export interface SlotRef {
  category: SlotCategory;
  id: string;
}

export interface SlotVisual {
  name: string;
  textureKey: string;
  iconFrame: number | string;
  /** Tingimento opcional (Fase 8 — Crafting): só usado por Receitas, que reaproveitam o ícone do item final ainda não fabricado (ver `RECIPE_ICON_TINT` abaixo) — não fabricar um ícone novo por código, só tingir uma arte real já existente (CLAUDE.md). `undefined` = sem tint, mesmo visual de antes para todas as outras categorias. */
  tint?: number;
}

/** Dourado claro/pergaminho — o pacote de assets não tem um ícone de pergaminho dedicado, então a Receita reaproveita o ícone do item que ela produz, só tingido, pra diferenciar "ainda é só o desenho" de "já fabricado". */
const RECIPE_ICON_TINT = 0xdcc48e;

/** Resolve o visual (nome/textura/frame) de um slot, buscando na tabela certa conforme a categoria. `null` se o id não existir mais (ex.: dado antigo/corrompido). */
export function resolveSlotVisual(ref: SlotRef): SlotVisual | null {
  if (ref.category === 'tool') {
    const tool = TOOLS[ref.id as ToolId];
    if (tool) return { name: tool.name, textureKey: tool.textureKey, iconFrame: tool.iconFrame };
    // Espadas (Fase 8 — Progressão): ocupam o mesmo slot de categoria 'tool'
    // (são equipáveis/selecionáveis igual Machado/Picareta), mas vivem na
    // própria tabela (`data/weapons.ts`, têm `dano`/custo que `ToolDefinition` não tem).
    const weapon = WEAPONS[ref.id];
    return weapon ? { name: weapon.name, textureKey: weapon.textureKey, iconFrame: weapon.iconFrame } : null;
  }
  if (ref.category === 'seed') {
    const crop = CROPS[ref.id];
    return crop ? { name: crop.name, textureKey: ALL_CROPS_ICONS_KEY, iconFrame: crop.iconFrameName } : null;
  }
  if (ref.category === 'decoration') {
    const decoration = DECORATIONS[ref.id];
    return decoration ? { name: decoration.name, textureKey: decoration.textureKey, iconFrame: decoration.frameName } : null;
  }
  if (ref.category === 'armor') {
    const armor = ARMORS[ref.id];
    return armor ? { name: armor.name, textureKey: armor.textureKey, iconFrame: armor.iconFrame } : null;
  }
  if (ref.category === 'recipe') {
    const recipe = RECIPES[ref.id];
    if (!recipe) return null;
    // O item que a receita produz vive na categoria 'armor' só quando a
    // própria receita é de armadura — Ferramenta/Arma resultam sempre num
    // item de SlotCategory 'tool' (mesma convenção de Espada acima).
    const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });
    if (!itemVisual) return null;
    return { name: `Receita: ${itemVisual.name}`, textureKey: itemVisual.textureKey, iconFrame: itemVisual.iconFrame, tint: RECIPE_ICON_TINT };
  }
  const resource = RESOURCES[ref.id];
  return resource ? { name: resource.name, textureKey: resource.textureKey, iconFrame: resource.frameName } : null;
}
