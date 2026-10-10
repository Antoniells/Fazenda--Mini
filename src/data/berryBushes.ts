/**
 * ARBUSTOS FRUTÍFEROS da Fazenda (`systems/berryBushes.ts`): a folha `Objects/Tree/Deep Forest/bushes.png` (144 x 288 = 3 colunas x 9 fileiras de
 * 48 x 32) — a coluna do meio é o arbusto verde e as fileiras 5-8 dela, o tom MAIS CLARO, trazem o ciclo inteiro: liso, com flores brancas (duas
 * variações) e cheio de frutinhas vermelhas. Clicar num arbusto com frutas faz cair `BERRIES_PER_HARVEST` Frutinhas Silvestres (comestíveis) e ele
 * volta a ficar liso; cada virada de dia ele anda um passo no ciclo e dá frutas de novo em `BERRY_DAYS_TO_FRUIT` dias.
 */
export const BERRY_BUSH_KEY = 'berry-bush';
export const BERRY_BUSH_PATH = 'Objects/Tree/Deep Forest/bushes.png';
export const BERRY_BUSH_FRAME_WIDTH = 48;
export const BERRY_BUSH_FRAME_HEIGHT = 32;

/** Os quadros do ciclo (fileira x 3 + coluna 1): liso, florindo, florido e com frutas. */
export const BERRY_BUSH_FRAMES = { bare: 16, budding: 19, flowering: 22, fruit: 25 } as const;

/** Dias depois da colheita até ter frutas de novo. */
export const BERRY_DAYS_TO_FRUIT = 5;
/** Frutinhas que caem por colheita ([mín, máx], sorteado). */
export const BERRIES_PER_HARVEST: [number, number] = [2, 3];

/** O quadro do arbusto pelos dias desde a última colheita: liso no dia, florindo na 1ª metade da espera, florido na 2ª e, a partir de `BERRY_DAYS_TO_FRUIT`, com frutas. */
export function berryBushFrame(daysSinceHarvest: number): number {
  if (daysSinceHarvest >= BERRY_DAYS_TO_FRUIT) return BERRY_BUSH_FRAMES.fruit;
  if (daysSinceHarvest >= Math.ceil(BERRY_DAYS_TO_FRUIT / 2)) return BERRY_BUSH_FRAMES.flowering;
  if (daysSinceHarvest >= 1) return BERRY_BUSH_FRAMES.budding;
  return BERRY_BUSH_FRAMES.bare;
}

/** Quantos dias faltam pras frutas (0 = já tem). */
export function daysUntilBerries(daysSinceHarvest: number): number {
  return Math.max(0, BERRY_DAYS_TO_FRUIT - daysSinceHarvest);
}

/**
 * Onde ficam os arbustos (célula do pé — ela fica sólida): células de grama livres, espalhadas, longe das árvores/pedras e fora da lavoura no
 * tamanho máximo. Um arbusto que o save ainda não conhece nasce com frutas.
 */
export const FARM_BERRY_BUSHES: ReadonlyArray<[number, number]> = [
  [48, 19],
  [52, 19],
  [4, 22],
  [31, 15],
  [39, 15],
  [7, 27],
  [29, 11],
  [32, 29],
];

export const berryBushKey = (col: number, row: number): string => `${col},${row}`;

export function isBerryBushCell(col: number, row: number): boolean {
  return FARM_BERRY_BUSHES.some(([c, r]) => c === col && r === row);
}
