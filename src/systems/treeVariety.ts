import { hash2D } from './groundVariation';

/**
 * AS ÁRVORES DIFERENTES no meio dos pinheiros: a CEREJEIRA rosa florida (rara, na Fazenda e na Floresta) e a mesma árvore com a copa
 * VERDE (só na Fazenda) — as duas da folha `CHERRY_TREE_*` de `data/tiles.ts`. É só a aparência — corta, dá madeira e cresce igual ao
 * pinheiro, e nada disso vai pro save: quem decide é a CÉLULA (ruído determinístico), então a mesma célula sempre mostra a mesma árvore,
 * saves antigos já aparecem com elas e uma árvore que renasce no mesmo lugar volta igual.
 */

/** A fração das árvores (pinheiros) que viram cerejeira. */
export const CHERRY_TREE_CHANCE = 0.12;
/** A fração das árvores da Fazenda que viram a árvore verde (entre as que não viraram cerejeira). */
export const LEAFY_TREE_CHANCE = 0.25;

/** Como a árvore de uma célula aparece: o pinheiro, a cerejeira florida ou a árvore verde. */
export type TreeLook = 'pine' | 'cherry' | 'leafy';
/** Onde a árvore está: a árvore verde só nasce na Fazenda. */
export type TreePlace = 'farm' | 'forest';

/** A árvore desta célula é uma cerejeira? (A bétula nunca é: ela já é a variedade da Floresta.) */
export function isCherryTreeCell(col: number, row: number): boolean {
  return hash2D(col * 31 + 977, row * 17 + 4421) < CHERRY_TREE_CHANCE;
}

/** A aparência da árvore (pinheiro de nascença) nesta célula. */
export function treeLookAt(col: number, row: number, place: TreePlace): TreeLook {
  if (isCherryTreeCell(col, row)) return 'cherry';
  if (place === 'farm' && hash2D(col * 53 + 211, row * 29 + 1873) < LEAFY_TREE_CHANCE) return 'leafy';
  return 'pine';
}
