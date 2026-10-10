import { FOREST_SCENE_KEY, isForestExpansionCell } from '../data/forestFeatures';
import { resourceNodeRegistry } from './resourceNodeRegistry';

/**
 * Save de antes de a Floresta crescer de 40 x 30 para 56 x 42 (`SaveData.forestExpanded` ausente): ganha uma vez as árvores e pedras
 * ORIGINAIS da área nova (leste e sul — `data/forestFeatures.ts`). Os nós originais vêm do construtor da `ForestScene` (que roda no boot).
 */
export function seedForestExpansion(): void {
  resourceNodeRegistry.restoreInitialWhere(FOREST_SCENE_KEY, (node) => isForestExpansionCell(node.col, node.row));
}
