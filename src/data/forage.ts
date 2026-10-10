import { FLOWER, MUSHROOM, WILD_GRASS } from './resources';

/**
 * COLETA COM A FOICE (`systems/forage.ts`): as plantinhas, flores e cogumelos que enfeitam a grama — os detalhes espalhados
 * (`data/grassDetails.ts`), a folhagem selvagem da Floresta e os props autorados no editor (`data/mapProps.ts`). Com a Foice na mão,
 * clicar corta; renascem na virada do dia. Pedrinhas, tronco caído, trepadeira e coral não são plantas: ficam de fora.
 */
export type ForageKind = 'plant' | 'flower' | 'mushroom';

/** O que cada tipo solta (1 unidade): plantinha → Capim, flor → Flor Silvestre, cogumelo → Cogumelo. */
export const FORAGE_DROP: Record<ForageKind, string> = {
  plant: WILD_GRASS.id,
  flower: FLOWER.id,
  mushroom: MUSHROOM.id,
};

/** Os detalhes da grama que são plantas (a pedrinha `rock` não é). */
const GRASS_DETAIL_KINDS: Record<string, ForageKind> = {
  tuft: 'plant',
  'blade-a': 'plant',
  'blade-b': 'plant',
  'blade-c': 'plant',
  flower: 'flower',
  mushroom: 'mushroom',
  // As flores da 3ª camada da grama (`FLOWER_DETAILS`).
  'flower-blue': 'flower',
  'flower-blue-light': 'flower',
  'flower-pink': 'flower',
  'flower-white-cluster': 'flower',
  'flower-calla': 'flower',
};

export function forageKindOfGrassDetail(detailId: string): ForageKind | null {
  return GRASS_DETAIL_KINDS[detailId] ?? null;
}

/**
 * Props cujo desenho não bate com a família do nome: a "Moita Azul-esverdeada" é uma flor branca (copo-de-leite) de folhas azul-esverdeadas e a
 * "Samambaia Azul" é um raminho de flores azuis e rosas — as duas dão Flor Silvestre, não Capim.
 */
const PROP_KIND_OVERRIDES: Record<string, ForageKind> = {
  'prop-tuft-teal': 'flower',
  'prop-fern-blue-tall': 'flower',
};

/** Os props do editor que são plantas, pela família do id (`prop-mushroom-*`, `prop-flower*`, `prop-tuft-*`, `prop-fern-*`), salvo `PROP_KIND_OVERRIDES`. */
export function forageKindOfProp(propId: string): ForageKind | null {
  if (PROP_KIND_OVERRIDES[propId]) return PROP_KIND_OVERRIDES[propId];
  if (propId.startsWith('prop-mushroom-')) return 'mushroom';
  if (propId.startsWith('prop-flower')) return 'flower';
  if (propId.startsWith('prop-tuft-') || propId.startsWith('prop-fern-')) return 'plant';
  return null;
}
