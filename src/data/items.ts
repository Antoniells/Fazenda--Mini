import { CROPS, ALL_CROPS_ICONS_KEY } from './crops';
import { DECORATIONS } from './decorations';
import { TOOLS, ToolId } from './tools';
import { RESOURCES } from './resources';

/**
 * As 4 categorias que podem ocupar um slot da Hotbar/Inventário. Cada uma
 * já tinha sua própria tabela de dados (`CROPS`, `DECORATIONS`, `TOOLS`,
 * `RESOURCES`) — em vez de fundir tudo numa estrutura só (o que exigiria
 * reescrever essas tabelas), este módulo só sabe resolver "categoria + id"
 * para o visual (ícone/nome) que a UI precisa, mantendo cada tabela isolada
 * e intacta. `resource` (Fase 7 — Coleta de Recursos): madeira, pedra e
 * bolota, ver `data/resources.ts`.
 */
export type SlotCategory = 'tool' | 'seed' | 'decoration' | 'resource';

/** Referência ao conteúdo de um slot — não guarda quantidade (isso continua vindo de `Inventory`, por categoria). */
export interface SlotRef {
  category: SlotCategory;
  id: string;
}

export interface SlotVisual {
  name: string;
  textureKey: string;
  iconFrame: number | string;
}

/** Resolve o visual (nome/textura/frame) de um slot, buscando na tabela certa conforme a categoria. `null` se o id não existir mais (ex.: dado antigo/corrompido). */
export function resolveSlotVisual(ref: SlotRef): SlotVisual | null {
  if (ref.category === 'tool') {
    const tool = TOOLS[ref.id as ToolId];
    return tool ? { name: tool.name, textureKey: tool.textureKey, iconFrame: tool.iconFrame } : null;
  }
  if (ref.category === 'seed') {
    const crop = CROPS[ref.id];
    return crop ? { name: crop.name, textureKey: ALL_CROPS_ICONS_KEY, iconFrame: crop.iconFrameName } : null;
  }
  if (ref.category === 'decoration') {
    const decoration = DECORATIONS[ref.id];
    return decoration ? { name: decoration.name, textureKey: decoration.textureKey, iconFrame: decoration.frameName } : null;
  }
  const resource = RESOURCES[ref.id];
  return resource ? { name: resource.name, textureKey: resource.textureKey, iconFrame: resource.frameName } : null;
}
