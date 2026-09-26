import Phaser from 'phaser';
import { removeGrassDetailsAt } from './grassDetails';
import { removeWeedAt } from './wildGrass';
import { FARM_RESOURCES_KEY } from './farmResources';

/**
 * Uma construção (ou a obra dela) foi posta em cima destas células: as PLANTAS que estavam ali — os tufos, lâminas, cogumelos, flores e pedrinhas decorativos da grama e o
 * mato colhível — somem, em vez de ficarem espiando por baixo dela (ou de impedirem o local). Árvores, brotos e pedras NÃO somem: continuam bloqueando o local
 * (`DecorationPlacementSystem.canPlaceAt`). Nas próximas aberturas da Fazenda os tufos não nascem de novo ali (`buildGrassDetails` exclui os pés das construções).
 */
export function clearPlantsUnder(scene: Phaser.Scene, col: number, row: number, width: number, height: number): void {
  const cells: Array<{ col: number; row: number }> = [];
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) cells.push({ col: col + dx, row: row + dy });
  removeGrassDetailsAt(scene, cells);
  for (const cell of cells) removeWeedAt(cell.col, cell.row, FARM_RESOURCES_KEY);
}
