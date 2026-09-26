import Phaser from 'phaser';
import {
  WATER_STYLES,
  WaterStyleId,
  WaterDiagonal,
  WATER_AUTOTILE_PHASES,
  WATER_AUTOTILE_PHASE_STRIDE,
  WATER_AUTOTILE_PHASE_MS,
  WATER_AUTOTILE_INTERIOR_MASK,
  WATER_NEIGHBOR,
} from '../data/tiles';
import { isWaterGid } from './waterCells';

/** Acima do chão (-1) e abaixo da terra arada/props de chão (-0.5/-0.4) e de tudo ordenado por Y. */
const WATER_DEPTH = -0.9;

/**
 * Bitmask dos 4 vizinhos ortogonais que também são água (N=1, E=2, S=4, W=8) — a mesma ideia do
 * solo arado (`pickSoilAutotileKey`), só que em bits (16 combinações = 16 tiles, ver
 * `WATER_AUTOTILE_FRAMES`). Fora do mapa conta como água: um lago que encosta na borda continua
 * pra fora em vez de ganhar uma margem de areia colada na borda.
 */
export function computeWaterMask(isWater: (col: number, row: number) => boolean, col: number, row: number): number {
  let mask = 0;
  if (isWater(col, row - 1)) mask |= WATER_NEIGHBOR.N;
  if (isWater(col + 1, row)) mask |= WATER_NEIGHBOR.E;
  if (isWater(col, row + 1)) mask |= WATER_NEIGHBOR.S;
  if (isWater(col - 1, row)) mask |= WATER_NEIGHBOR.W;
  return mask;
}

/** A diagonal onde há areia numa célula de água de miolo (os 4 vizinhos ortogonais são água); `null` se as 4 diagonais são água. Com duas ou mais, vale a primeira. */
function innerCornerOf(isWater: (col: number, row: number) => boolean, col: number, row: number): WaterDiagonal | null {
  if (!isWater(col - 1, row - 1)) return 'NW';
  if (!isWater(col + 1, row - 1)) return 'NE';
  if (!isWater(col - 1, row + 1)) return 'SW';
  if (!isWater(col + 1, row + 1)) return 'SE';
  return null;
}

/**
 * Autotile animado da água: para cada célula de água do chão autorado (`authoredGround`, GIDs do
 * editor), desenha o tile certo do `WATER_AUTOTILE_FRAMES` conforme os vizinhos — bordas de areia
 * onde a água acaba, cápsulas e ilhotas onde ela é estreita, miolo liso no meio — por cima do
 * chão. Um único timer da cena troca as 4 fases da animação de todas as células de borda de uma vez
 * (o miolo liso é igual em todas as fases e não precisa trocar), então a água inteira anda em
 * sincronia. Não mexe em colisão: a água bloqueia pelas mesmas células (`waterCellsFromGround`, ver `systems/waterCells.ts`), calculadas nas cenas/no grid.
 * `scale` = DISPLAY_SCALE (passado de fora pra este módulo não importar `mapBuilder`, que o importa).
 * `styleId`: qual folha de água usar (`WATER_STYLES`) — a Praia usa a de areia, a Floresta a de terra.
 */
export function buildWaterAutotile(
  scene: Phaser.Scene,
  tileSize: number,
  scale: number,
  originCol: number,
  originRow: number,
  authoredGround: number[][],
  styleId: WaterStyleId = 'beach',
): void {
  const style = WATER_STYLES[styleId];
  const rows = authoredGround.length;
  const cols = authoredGround.reduce((max, row) => Math.max(max, row.length), 0);

  const isWaterCell = (col: number, row: number): boolean => {
    const inside = col >= 0 && row >= 0 && col < cols && row < rows;
    if (!inside) return true;
    const gid = authoredGround[row]?.[col];
    return gid !== undefined && isWaterGid(gid);
  };

  const tile = tileSize * scale;
  const animated: Array<{ image: Phaser.GameObjects.Image; baseFrame: number }> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gid = authoredGround[row]?.[col];
      if (gid === undefined || !isWaterGid(gid)) continue;

      const mask = computeWaterMask(isWaterCell, col, row);
      const alternate = style.alternates[mask];
      let baseFrame = alternate ? alternate.frames[(alternate.axis === 'col' ? col : row) % 2] : style.frames[mask];
      // Miolo com areia numa diagonal: o tile do canto interno (senão sobra um quadrado azul avançando sobre a areia).
      if (mask === WATER_AUTOTILE_INTERIOR_MASK) {
        const corner = innerCornerOf(isWaterCell, col, row);
        if (corner) baseFrame = style.innerCorners[corner];
      }
      const image = scene.add.image((originCol + col) * tile, (originRow + row) * tile, style.textureKey, baseFrame);
      image.setOrigin(0, 0);
      image.setScale(scale);
      image.setDepth(WATER_DEPTH);
      if (baseFrame !== style.frames[WATER_AUTOTILE_INTERIOR_MASK]) animated.push({ image, baseFrame });
    }
  }

  if (animated.length === 0) return;

  let phase = 0;
  scene.time.addEvent({
    delay: WATER_AUTOTILE_PHASE_MS,
    loop: true,
    callback: () => {
      phase = (phase + 1) % WATER_AUTOTILE_PHASES;
      for (const { image, baseFrame } of animated) image.setFrame(baseFrame + phase * WATER_AUTOTILE_PHASE_STRIDE);
    },
  });
}
