import { describe, expect, it } from 'vitest';
import { cellInsideBridge, farmBridgeCell, farmIslandRegion, groundWithSeaAround, islandRimTiles } from '../../src/systems/islandLayout';
import { CLIFF_TILES } from '../../src/data/islandEdges';
import { farmMap, type ExpansionDirection } from '../../src/data/maps/farmMap';

const none = new Set<ExpansionDirection>();

describe('ilhas e abismo', () => {
  it('a moldura fica toda FORA do mapa: borda em cima, um lado de cada vez, e embaixo a borda de baixo mais o paredão até a água', () => {
    const region = { col0: 0, row0: 0, cols: 4, rows: 3 };
    const tiles = islandRimTiles(region);
    const at = (col: number, row: number) => tiles.filter((tile) => tile.col === col && tile.row === row).map((tile) => tile.index);

    for (const tile of tiles) {
      const inside = tile.col >= 0 && tile.col < 4 && tile.row >= 0 && tile.row < 3;
      expect(inside).toBe(false);
    }
    expect(new Set(tiles.map((tile) => `${tile.col},${tile.row}`)).size).toBe(tiles.length); // Nenhuma célula repetida.
    expect(tiles.length).toBe((4 + 2) * 3 + 3 * 2); // 3 faixas de largura 6 (cima, baixo, paredão) + as 2 colunas dos lados.

    expect(at(-1, -1)).toEqual([CLIFF_TILES.topLeft]);
    expect(at(4, -1)).toEqual([CLIFF_TILES.topRight]);
    expect(at(-1, 1)).toEqual([CLIFF_TILES.left]);
    expect(at(4, 1)).toEqual([CLIFF_TILES.right]);
    expect(at(-1, 3)).toEqual([CLIFF_TILES.bottomLeft]);
    expect(at(2, 3)).toEqual([CLIFF_TILES.bottom]);
    expect(at(4, 4)).toEqual([CLIFF_TILES.faceRight]);
    expect([at(0, -1)[0], at(1, -1)[0]].sort()).toEqual([...CLIFF_TILES.top].sort()); // A borda de cima alterna as 2 peças.
  });

  it('a ilha da Fazenda cresce com os trechos comprados', () => {
    expect(farmIslandRegion(farmMap, none)).toEqual({ col0: 0, row0: 0, cols: farmMap.cols, rows: farmMap.rows });
    const west = farmMap.expansions.find((chunk) => chunk.direction === 'west')!;
    const north = farmMap.expansions.find((chunk) => chunk.direction === 'north')!;
    expect(farmIslandRegion(farmMap, new Set<ExpansionDirection>(['west', 'north']))).toEqual({
      col0: west.col0,
      row0: north.row0,
      cols: farmMap.cols - west.col0,
      rows: farmMap.rows - north.row0,
    });
  });

  it('a ponte da Fazenda fica na parede do núcleo e, comprado o trecho daquele lado, vai pra parede de fora dele', () => {
    for (const bridge of farmMap.bridges) {
      expect(farmBridgeCell(bridge, farmMap.expansions, none)).toEqual({ col: bridge.col, row: bridge.row });
      const chunk = farmMap.expansions.find((entry) => entry.direction === bridge.direction);
      if (!chunk) continue; // O lado leste não tem trecho: a ponte do Vilarejo nunca muda.
      const moved = farmBridgeCell(bridge, farmMap.expansions, new Set([bridge.direction]));
      const region = farmIslandRegion(farmMap, new Set([bridge.direction]));
      if (bridge.direction === 'west') expect(moved).toEqual({ col: region.col0, row: bridge.row });
      if (bridge.direction === 'north') expect(moved).toEqual({ col: bridge.col, row: region.row0 });
      if (bridge.direction === 'south') expect(moved).toEqual({ col: bridge.col, row: region.row0 + region.rows - 1 });
    }
  });

  it('quem volta por uma ponte aparece uma célula pra dentro da ilha', () => {
    expect(cellInsideBridge('west', { col: -12, row: 10 })).toEqual({ col: -11, row: 10 });
    expect(cellInsideBridge('east', { col: 55, row: 21 })).toEqual({ col: 54, row: 21 });
    expect(cellInsideBridge('north', { col: 10, row: -8 })).toEqual({ col: 10, row: -7 });
    expect(cellInsideBridge('south', { col: 30, row: 49 })).toEqual({ col: 30, row: 48 });
  });

  it('a Praia ganha uma faixa de mar em volta do chão (só no desenho)', () => {
    const ground = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const padded = groundWithSeaAround(ground, 2, 99);
    expect(padded.length).toBe(6);
    expect(padded.every((row) => row.length === 7)).toBe(true);
    expect(padded[2].slice(2, 5)).toEqual([1, 2, 3]);
    expect(padded[3].slice(2, 5)).toEqual([4, 5, 6]);
    expect(padded[0]).toEqual(new Array(7).fill(99));
    expect(padded[3][0]).toBe(99);
    expect(ground).toEqual([[1, 2, 3], [4, 5, 6]]); // O chão original (colisão) não muda.
  });
});
