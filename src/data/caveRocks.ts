/**
 * PEDRAS DAS CAVERNAS (`systems/caveRocks.ts`): só dados. Pedras soltas pelo chão de cada andar, quebradas com a Picareta (as mesmas
 * regras das pedras pequenas da Pedreira — `RockInteractable`). A escada de descida fica escondida debaixo de uma delas: o jogador quebra
 * pedras até achar.
 */

/**
 * As pedras lisas da MESMA folha dos veios (`Objects/Exterior/Mine and Dungeon/stone with minerals.png`, já carregada como `ORE_KEY`):
 * o mesmo formato, contorno e paleta dos veios, só sem o cristal — recortes medidos pixel a pixel (pedra grande, duas pedras, pedrinha).
 */
export const CAVE_ROCK_FRAMES = [
  { name: 'cave-rock-1', rect: { x: 97, y: 148, width: 13, height: 11 } },
  { name: 'cave-rock-2', rect: { x: 49, y: 149, width: 15, height: 10 } },
  { name: 'cave-rock-3', rect: { x: 83, y: 150, width: 10, height: 8 } },
];

/** Quantas pedras um andar tem: um pouco mais a cada andar (18 no 1, 36 a partir do 90 — os andares fundos também são maiores). */
export function caveRockCount(floor: number): number {
  return Math.min(36, 18 + Math.floor(floor * 0.2));
}

/** A pedra da escada fica a pelo menos tantos passos (caminho a pé, contornando paredes) de onde o jogador chega. */
export const HIDDEN_STAIRS_MIN_DISTANCE = 10;
