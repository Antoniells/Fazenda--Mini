import { gameState } from './gameState';
import { Farmland, Plot } from './farmland';
import { DECORATIONS, DecorationDefinition } from '../data/decorations';

/**
 * Quais células um aspersor (decoração com `waterReach`, ver `data/decorations.ts`) alcança, posicionado com o canto superior-esquerdo
 * em (`col`,`row`): as até `radius` células pra fora da borda do `footprint`, sem contar o corpo dele. `'square'` = o quadrado todo em
 * volta; `'cross'` = só as que ficam coladas nos 4 lados (na faixa de linhas ou de colunas do próprio footprint). É a ÚNICA fonte dessa
 * regra — a rega (`waterFromSprinklers`), o grid do modo de posicionamento e a água animada usam esta mesma função.
 */
export function sprinklerReachCells(decoration: DecorationDefinition, col: number, row: number): Array<{ col: number; row: number }> {
  const reach = decoration.waterReach;
  if (!reach) return [];

  const { width, height } = decoration.footprint;
  const cells: Array<{ col: number; row: number }> = [];
  for (let r = row - reach.radius; r < row + height + reach.radius; r++) {
    for (let c = col - reach.radius; c < col + width + reach.radius; c++) {
      const inColumns = c >= col && c < col + width;
      const inRows = r >= row && r < row + height;
      if (inColumns && inRows) continue; // O corpo do aspersor.
      if (reach.shape === 'cross' && !inColumns && !inRows) continue;
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

/**
 * Aspersores: a cada manhã regam sozinhos as terras que alcançam (`sprinklerReachCells`). Só regam o que já está plantado (`growing`) e
 * ainda seco — `Farmland.water` já ignora o resto. Lê as construções de `gameState.placedDecorations` (o registro persistente, não os
 * objetos da cena), então funciona mesmo com a Fazenda fechada e vai pro save junto.
 *
 * Devolve as plantações que foram regadas agora, pra a cena animar respingos.
 */
export function waterFromSprinklers(farmland: Farmland): Plot[] {
  const watered: Plot[] = [];

  for (const record of gameState.placedDecorations.values()) {
    const decoration = DECORATIONS[record.decorationId];
    if (!decoration?.waterReach) continue;

    for (const { col, row } of sprinklerReachCells(decoration, record.col, record.row)) {
      const plot = farmland.getPlot(col, row);
      if (plot && !plot.wateredToday && farmland.water(col, row)) watered.push(plot);
    }
  }

  return watered;
}
