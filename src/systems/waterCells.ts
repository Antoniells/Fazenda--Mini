import { GROUND_TILESETS, BEACH_ANIM_TILESET_ID } from './groundTilesets';
import { WATER_SAND_FILL_INDICES } from '../data/tiles';

const FLAT_WATER = GROUND_TILESETS.find((tileset) => tileset.id === 'water');
const BEACH_ANIM = GROUND_TILESETS.find((tileset) => tileset.id === BEACH_ANIM_TILESET_ID);

/** GID do tile de água plana ("Água") — o que `groundWithWaterRect` grava nas células de um retângulo de água. */
export const FLAT_WATER_GID = FLAT_WATER?.firstGid ?? 3000;

/**
 * Cópia do chão autorado com um RETÂNGULO forçado a água (o `oceanArea`/`lakeArea` dos mapas). Antes esse retângulo era desenhado por
 * cima do chão como uma textura de água plana (`buildWaterArea`), que não combinava com a água animada pintada em volta (o autotile,
 * `systems/waterAutotile.ts`) e deixava faixas de cores diferentes no mar; agora ele entra no MESMO chão, então a água inteira é uma só
 * — animada, com as bordas de areia certas — e a colisão (`waterCellsFromGround`) continua valendo pelas mesmas células.
 */
export function groundWithWaterRect(ground: number[][] | undefined, area: { col0: number; row0: number; cols: number; rows: number }): number[][] | undefined {
  if (!ground) return undefined;
  const copy = ground.map((row) => [...row]);
  for (let row = area.row0; row < area.row0 + area.rows; row++) {
    for (let col = area.col0; col < area.col0 + area.cols; col++) {
      if (copy[row] && col >= 0 && col < copy[row].length) copy[row][col] = FLAT_WATER_GID;
    }
  }
  return copy;
}

/**
 * Esta célula pintada no editor (GID) é água? Vale o tile de água plana ("Água") e qualquer tile
 * de "Beach animations tiles" que não seja areia lisa — o lago da Floresta e o mar da Praia foram
 * pintados à mão com ele, e as bordas de água/areia desse tileset contam como água (o autotile
 * refaz a borda certa pelos vizinhos, ver `systems/waterAutotile.ts`).
 *
 * Fonte ÚNICA do que é água: o autotile desenha por ela e as colisões (`waterCellsFromGround`) bloqueiam
 * por ela, então o que se vê como água e o que não dá pra pisar nunca divergem. Sem Phaser (só dados).
 */
export function isWaterGid(gid: number): boolean {
  if (FLAT_WATER && gid >= FLAT_WATER.firstGid && gid < FLAT_WATER.firstGid + FLAT_WATER.columns * FLAT_WATER.rows) return true;
  if (BEACH_ANIM && gid >= BEACH_ANIM.firstGid && gid < BEACH_ANIM.firstGid + BEACH_ANIM.columns * BEACH_ANIM.rows) {
    return !WATER_SAND_FILL_INDICES.includes(gid - BEACH_ANIM.firstGid);
  }
  return false;
}

/** Células (col, row) de água do chão autorado (`XMapData.ground`) — pra bloquear no `WalkableGrid` (não dá pra andar na água) e pra o respawn de árvores/pedras não nascer nela. */
export function waterCellsFromGround(ground: number[][] | undefined): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  if (!ground) return cells;
  for (let row = 0; row < ground.length; row++) {
    for (let col = 0; col < ground[row].length; col++) {
      if (isWaterGid(ground[row][col])) cells.push([col, row]);
    }
  }
  return cells;
}
