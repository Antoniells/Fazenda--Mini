import { CROPS, ALL_CROPS_ICONS_KEY } from './crops';
import { DECORATIONS } from './decorations';
import { TOOLS, ToolId } from './tools';
import { RESOURCES } from './resources';
import { WEAPONS } from './weapons';
import { ARMORS } from './armors';
import { nameWithQuality, parseQualityId } from './quality';
import { QUALITY_ICON_FRAME, qualityIconKey } from '../systems/qualityIcons';

/**
 * As categorias que podem ocupar um slot da Hotbar/Inventário. Cada uma já
 * tinha sua própria tabela de dados (`CROPS`, `DECORATIONS`, `TOOLS`,
 * `RESOURCES`) — em vez de fundir tudo numa estrutura só (o que exigiria
 * reescrever essas tabelas), este módulo só sabe resolver "categoria + id"
 * para o visual (ícone/nome) que a UI precisa, mantendo cada tabela isolada
 * e intacta. `resource` (Fase 7 — Coleta de Recursos): madeira, pedra e
 * bolota, minérios e barras, ver `data/resources.ts`. `armor`: armaduras
 * (`data/armors.ts`).
 */
// `crop` (bug corrigido — colheita ia só pro registro de estoque, nunca
// ganhava slot físico na Bolsa): o vegetal/fruta já colhido, separado de
// `seed` (a semente ainda não plantada) mesmo indexado pelo mesmo
// `CropDefinition.id` — os dois podem coexistir em slots diferentes.
export type SlotCategory = 'tool' | 'seed' | 'decoration' | 'resource' | 'armor' | 'crop';

/** Referência ao conteúdo de um slot — não guarda quantidade (isso continua vindo de `Inventory`, por categoria). */
export interface SlotRef {
  category: SlotCategory;
  id: string;
}

export interface SlotVisual {
  name: string;
  textureKey: string;
  iconFrame: number | string;
  /** Tingimento opcional do ícone (só tingir uma arte real já existente, nunca fabricar um ícone por código — CLAUDE.md). `undefined` = sem tint. */
  tint?: number;
}

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
    // Saquinho de semente (pedido explícito — antes usava o mesmo frame do
    // fruto colhido, ver `crop.cropFrameName`/categoria 'crop' abaixo).
    const crop = CROPS[ref.id];
    return crop ? { name: crop.name, textureKey: ALL_CROPS_ICONS_KEY, iconFrame: crop.seedFrameName } : null;
  }
  if (ref.category === 'crop') {
    // Fruto/vegetal já colhido (pedido explícito, item 4) — o que vai pra
    // Bolsa depois de colher (ver `Inventory.add`).
    const crop = CROPS[ref.id];
    return crop ? { name: crop.name, textureKey: ALL_CROPS_ICONS_KEY, iconFrame: crop.cropFrameName } : null;
  }
  if (ref.category === 'decoration') {
    const decoration = DECORATIONS[ref.id];
    return decoration ? { name: decoration.name, textureKey: decoration.textureKey, iconFrame: decoration.frameName } : null;
  }
  if (ref.category === 'armor') {
    const armor = ARMORS[ref.id];
    return armor ? { name: armor.name, textureKey: armor.textureKey, iconFrame: armor.iconFrame } : null;
  }
  // Recurso, possivelmente com qualidade (`egg@silver`): o nome ganha "(Prata)" e o ícone é o do item com a estrela (`systems/qualityIcons.ts`).
  const { baseId, quality } = parseQualityId(ref.id);
  const resource = RESOURCES[baseId];
  if (!resource) return null;
  if (quality === 'normal' || !resource.hasQuality) return { name: resource.name, textureKey: resource.textureKey, iconFrame: resource.frameName, tint: resource.tint };
  return { name: nameWithQuality(resource.name, quality), textureKey: qualityIconKey(baseId, quality), iconFrame: QUALITY_ICON_FRAME };
}
