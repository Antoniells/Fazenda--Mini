import { hash2D } from './groundVariation';
import { PINK_OAK_CHANCE, type TreeSpecies } from '../data/trees';
import { ACORN, BIRCH_ACORN, OAK_ACORN } from '../data/resources';

/**
 * A ESPÉCIE DE CADA ÁRVORE e as BOLOTAS (`data/trees.ts`).
 *
 * Árvore plantada (e os Carvalhos novos da Fazenda) guarda a espécie no nó do registro (`ResourceNode.species`, vai pro save). As árvores
 * do mapa e as que brotam sozinhas não guardam nada: quem decide é a CÉLULA (ruído determinístico) — no meio dos pinheiros, de vez em
 * quando um Carvalho, e mais raro um Carvalho Rosa. Assim saves antigos já aparecem com eles e uma árvore que renasce no mesmo lugar
 * volta igual.
 */

/** Árvore sem espécie guardada: a fração que é Carvalho Rosa (pela célula). */
export const WORLD_PINK_OAK_CHANCE = 0.12;
/** Árvore sem espécie guardada: a fração que é Carvalho (entre as que não são Carvalho Rosa). */
export const WORLD_OAK_CHANCE = 0.35;

/** A espécie de uma árvore sem espécie guardada, pela célula. */
export function worldTreeSpeciesAt(col: number, row: number): TreeSpecies {
  if (hash2D(col * 31 + 977, row * 17 + 4421) < WORLD_PINK_OAK_CHANCE) return 'pink-oak';
  if (hash2D(col * 53 + 211, row * 29 + 1873) < WORLD_OAK_CHANCE) return 'oak';
  return 'pine';
}

/** A espécie de uma árvore: a guardada no nó, ou (sem nenhuma — o "pinheiro de nascença") a da célula. */
export function resolveTreeSpecies(species: TreeSpecies | undefined, col: number, row: number): TreeSpecies {
  return species ?? worldTreeSpeciesAt(col, row);
}

/** A bolota que cada espécie solta ao ser cortada (o Carvalho Rosa é um carvalho: solta a de Carvalho). */
const ACORN_OF_SPECIES: Record<TreeSpecies, string> = {
  pine: ACORN.id,
  birch: BIRCH_ACORN.id,
  oak: OAK_ACORN.id,
  'pink-oak': OAK_ACORN.id,
};

export function acornIdForSpecies(species: TreeSpecies): string {
  return ACORN_OF_SPECIES[species];
}

/** As bolotas plantáveis. */
export const ACORN_IDS: readonly string[] = [ACORN.id, OAK_ACORN.id, BIRCH_ACORN.id];

export function isAcornId(id: string): boolean {
  return ACORN_IDS.includes(id);
}

/** O carvalho que nasce de um sorteio (`roll` em [0, 1)): rosa com `PINK_OAK_CHANCE`. */
export function rollOakSpecies(roll: number = Math.random()): TreeSpecies {
  return roll < PINK_OAK_CHANCE ? 'pink-oak' : 'oak';
}

/** A espécie que nasce ao plantar esta bolota (a de Carvalho sorteia o Carvalho Rosa). */
export function speciesFromAcorn(acornId: string, roll: number = Math.random()): TreeSpecies {
  if (acornId === OAK_ACORN.id) return rollOakSpecies(roll);
  if (acornId === BIRCH_ACORN.id) return 'birch';
  return 'pine';
}
