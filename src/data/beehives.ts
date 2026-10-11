/**
 * COLMEIAS NAS ÁRVORES (`systems/beehives.ts`): quando uma árvore cresce até adulta (muda → adulta, na virada do dia), há
 * `BEEHIVE_CHANCE` de nascer uma colmeia nela, com abelhas voando em volta; derrubar a árvore solta Mel (`data/resources.ts`, `HONEY`).
 *
 * Arte: a folha `Objects/Tree/Common/No Shadow/Pine Tree.png` já tem o pinheiro COM colmeia (quadro 32x48 em x 128, y 48). As outras
 * espécies não têm — recebem a mesma colmeia por cima, recortada desse quadro (só os pixels que diferem do pinheiro comum: o retângulo
 * `BEEHIVE_RECT_IN_FRAME`, conferido comparando os dois quadros pixel a pixel). As abelhas: `Animals/Forest/Bugs/Bee/Bees.png`
 * (64x16, 4 quadros de 16x16 da abelha batendo as asas).
 */
export const BEEHIVE_CHANCE = 0.15;

export const PINE_BEEHIVE_FRAME = { name: 'pine-tree-beehive', rect: { x: 128, y: 48, width: 32, height: 48 } };
/** Onde fica a colmeia dentro do quadro de árvore (32x48): o retângulo que muda entre o pinheiro comum e o com colmeia. */
export const BEEHIVE_RECT_IN_FRAME = { x: 16, y: 23, width: 12, height: 13 };

export const BEES_KEY = 'bees';
export const BEES_PATH = 'Animals/Forest/Bugs/Bee/Bees.png';
export const BEES_FRAME_SIZE = 16;
export const BEES_FRAME_COUNT = 4;
/** Quantas abelhas voam em volta de cada colmeia. */
export const BEES_PER_HIVE = 2;

/** Mel ao derrubar uma árvore com colmeia ([mín, máx], antes do drop duplo). */
export const HONEY_DROP: [number, number] = [1, 2];

/** A árvore que acabou de ficar adulta ganha colmeia? (`roll` em [0, 1)). */
export function rollBeehive(roll: number = Math.random()): boolean {
  return roll < BEEHIVE_CHANCE;
}
