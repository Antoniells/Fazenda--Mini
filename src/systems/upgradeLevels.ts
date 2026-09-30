import { farmMap } from '../data/maps/farmMap';
import { HOUSE_LEVELS, HouseLevel } from '../data/houseLevels';
import { FENCE_SKINS, FenceSkin } from '../data/fenceSkins';
import { UPGRADE_TRACKS } from '../data/upgrades';
import { gameState } from './gameState';

/** O estado da casa do jogador AGORA (`gameState.upgrades.house`, `data/houseLevels.ts`). */
export function currentHouseLevel(): HouseLevel {
  const level = Math.max(0, Math.min(UPGRADE_TRACKS.house.steps.length, Math.floor(gameState.upgrades.house ?? 0)));
  return HOUSE_LEVELS[level];
}

/** As células da Fazenda que a casa do nível atual BLOQUEIA (a máscara da arte, posicionada em `farmMap.housePosition`; a célula da porta nunca). */
export function houseSolidCells(): Array<[number, number]> {
  const level = currentHouseLevel();
  const { col0, row0 } = farmMap.housePosition;
  const cells: Array<[number, number]> = [];
  level.solid.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      if (line[dx] === '#' && !(dx === level.door.dx && dy === level.door.dy)) cells.push([col0 + dx, row0 + dy]);
    }
  });
  return cells;
}

/** O material da cerca da lavoura AGORA (`gameState.upgrades.fence`, `data/fenceSkins.ts`). */
export function fenceSkin(): FenceSkin {
  const level = Math.max(0, Math.min(UPGRADE_TRACKS.fence.steps.length, Math.floor(gameState.upgrades.fence ?? 0)));
  return FENCE_SKINS[level];
}
