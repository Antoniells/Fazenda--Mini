/**
 * AS ESPÉCIES DE ÁRVORE (cortáveis, `kind: 'tree'` do `systems/resourceNodeRegistry.ts`):
 *
 * - **Pinheiro** (`Pine Tree.png`) — a árvore de sempre, da Fazenda e da Floresta.
 * - **Bétula** (`Birch Tree.png`) — a da Floresta.
 * - **Carvalho** (`Crops/Fruits Tree/Spring/Cherry Tree.png`, a copa verde clara) e o **Carvalho Rosa**, o tipo RARO de carvalho (a mesma
 *   folha, a copa rosa florida): nasce de uma Bolota de Carvalho com `PINK_OAK_CHANCE`.
 *
 * Cada espécie tem a sua BOLOTA (`data/resources.ts`): cortar a árvore solta a bolota dela (o Carvalho Rosa solta a de Carvalho) e
 * plantar a bolota faz nascer aquela espécie (`systems/treeVariety.ts`, `systems/treePlanting.ts`). A arte de cada uma: `data/tiles.ts`.
 */
export type TreeSpecies = 'pine' | 'birch' | 'oak' | 'pink-oak';

export const TREE_SPECIES_NAMES: Record<TreeSpecies, string> = {
  pine: 'Pinheiro',
  birch: 'Bétula',
  oak: 'Carvalho',
  'pink-oak': 'Carvalho Rosa',
};

/** A chance de uma Bolota de Carvalho (e de um dos Carvalhos novos da Fazenda) dar um Carvalho Rosa. */
export const PINK_OAK_CHANCE = 0.15;

/**
 * Os 6 Carvalhos que a Fazenda ganhou depois do mapa autorado (cada um com o sorteio de `PINK_OAK_CHANCE` de sair rosa): células de
 * grama livres, longe das outras árvores, das pedras e dos caminhos. Uma partida nova já nasce com eles; um save de antes deles os recebe
 * uma vez ao carregar (`gameState.farmOaksSeeded`), nas células que estiverem livres.
 */
export const EXTRA_FARM_OAKS: ReadonlyArray<[number, number]> = [
  [19, 3],
  [45, 13],
  [8, 15],
  [42, 29],
  [12, 30],
  [22, 33],
];

/**
 * Mais 10 árvores na Fazenda (pedido depois dos 6 Carvalhos): 6 Carvalhos (cada um com o sorteio do Carvalho Rosa) e 4 Pinheiros, em
 * células de grama livres, espalhadas, longe das outras árvores/pedras e FORA da lavoura no tamanho máximo (a última melhoria de Plantio)
 * — senão a ampliação as cortaria. Partida nova já nasce com elas; save de antes as recebe uma vez ao carregar (`farmMoreTreesSeeded`).
 */
export const MORE_FARM_TREES: ReadonlyArray<{ col: number; row: number; species: 'oak' | 'pine' }> = [
  { col: 25, row: 11, species: 'oak' },
  { col: 35, row: 14, species: 'pine' },
  { col: 53, row: 2, species: 'oak' },
  { col: 28, row: 29, species: 'oak' },
  { col: 39, row: 2, species: 'pine' },
  { col: 2, row: 32, species: 'oak' },
  { col: 31, row: 19, species: 'pine' },
  { col: 31, row: 24, species: 'oak' },
  { col: 23, row: 28, species: 'pine' },
  { col: 33, row: 39, species: 'oak' },
];

/** Mais 8 árvores na Fazenda (5 Carvalhos e 3 Pinheiros), com as mesmas regras das de cima. */
export const EVEN_MORE_FARM_TREES: ReadonlyArray<{ col: number; row: number; species: 'oak' | 'pine' }> = [
  { col: 38, row: 19, species: 'oak' },
  { col: 3, row: 18, species: 'pine' },
  { col: 41, row: 24, species: 'oak' },
  { col: 17, row: 28, species: 'oak' },
  { col: 13, row: 9, species: 'pine' },
  { col: 37, row: 9, species: 'oak' },
  { col: 47, row: 38, species: 'pine' },
  { col: 13, row: 39, species: 'oak' },
];

/**
 * As LEVAS de árvores extras da Fazenda (depois do mapa autorado), cada uma com um id: partida nova já nasce com todas; um save guarda os
 * ids das levas que já recebeu (`SaveData.farmTreeBatches`) e ganha as que faltam uma vez ao carregar. Árvore nova = uma leva nova aqui.
 */
export interface ExtraFarmTreeBatch {
  id: string;
  trees: ReadonlyArray<{ col: number; row: number; species: 'oak' | 'pine' }>;
}
export const EXTRA_FARM_TREE_BATCHES: readonly ExtraFarmTreeBatch[] = [
  { id: 'oaks-1', trees: EXTRA_FARM_OAKS.map(([col, row]) => ({ col, row, species: 'oak' as const })) },
  { id: 'trees-2', trees: MORE_FARM_TREES },
  { id: 'trees-3', trees: EVEN_MORE_FARM_TREES },
];
