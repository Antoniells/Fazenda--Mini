import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { WalkableGrid } from './grid';
import {
  INVENTORY_UI_KEY,
  SELECTION_CORNER_NAMES,
  SELECTION_CORNER_RECTS,
  EXTRAS_UI_KEY,
  GLOBAL_CURSOR_CORNER_NAMES,
  GLOBAL_CURSOR_CORNER_RECTS,
} from '../data/ui';

const FARMLAND_CURSOR_SCALE = 2;
/** O cantinho branco (`Extras.png`) já nasce 8x8 (o dobro do marrom, 4x4) — escala 1 mantém o mesmo tamanho final na tela (8x8) que o cursor de plantação. */
const GLOBAL_CURSOR_SCALE = 1;
const CURSOR_DEPTH = -0.3; // Acima de qualquer sprite do mundo (Y-sort chega no máximo à altura do mapa), abaixo dos HUDs (1000+).

type CornerKey = keyof typeof SELECTION_CORNER_NAMES;

/** Cria os 4 cantinhos de um conjunto (marrom ou branco), todos ocultos até o primeiro `handlePointerMove`. */
function createCornerSet(
  scene: Phaser.Scene,
  textureKey: string,
  names: Record<CornerKey, string>,
  rects: Record<CornerKey, { x: number; y: number; width: number; height: number }>,
  scale: number,
): Record<CornerKey, Phaser.GameObjects.Image> {
  const texture = scene.textures.get(textureKey);
  for (const key of Object.keys(names) as CornerKey[]) {
    const name = names[key];
    if (!texture.has(name)) {
      const rect = rects[key];
      texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
  }

  const makeCorner = (name: string, originX: number, originY: number): Phaser.GameObjects.Image => {
    const corner = scene.add.image(0, 0, textureKey, name);
    corner.setOrigin(originX, originY);
    corner.setScale(scale);
    corner.setDepth(CURSOR_DEPTH);
    corner.setVisible(false);
    return corner;
  };

  return {
    topLeft: makeCorner(names.topLeft, 0, 0),
    topRight: makeCorner(names.topRight, 1, 0),
    bottomLeft: makeCorner(names.bottomLeft, 0, 1),
    bottomRight: makeCorner(names.bottomRight, 1, 1),
  };
}

function positionCornerSet(
  corners: Record<CornerKey, Phaser.GameObjects.Image>,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  corners.topLeft.setPosition(left, top);
  corners.topRight.setPosition(right, top);
  corners.bottomLeft.setPosition(left, bottom);
  corners.bottomRight.setPosition(right, bottom);
}

function setCornerSetVisible(corners: Record<CornerKey, Phaser.GameObjects.Image>, visible: boolean): void {
  for (const corner of Object.values(corners)) corner.setVisible(visible);
}

/**
 * Destaque visual (moldura de 4 cantos, não um quadrado desenhado por
 * código) sobre a célula que o mouse está — em QUALQUER célula dentro dos
 * limites do mapa (Fase 9), não só na lavoura, com dois visuais diferentes
 * conforme o terreno:
 *
 * - Célula de `farmMap.farmlandArea` (onde faz sentido plantar/regar/
 *   colher): cantinhos marrons de `UI/Inventory/Slots.png` (já existentes).
 * - Qualquer outra célula dentro de `grid.inBounds()` (grama, caminho,
 *   etc.): cantinhos brancos/azulados de `UI/Extras.png` — "cursor global",
 *   só pra indicar onde o jogador está mirando.
 * - Fora dos limites do mapa (`!grid.inBounds()`): nenhum dos dois.
 */
export class TileCursor {
  private readonly farmlandCorners: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly globalCorners: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly farmlandCells: Set<string>;
  private readonly grid: WalkableGrid;
  private readonly tilePx: number;
  private hoveredKey: string | null = null;

  constructor(scene: Phaser.Scene, map: FarmMapData, tilePx: number, grid: WalkableGrid) {
    this.tilePx = tilePx;
    this.grid = grid;
    this.farmlandCells = new Set(map.farmlandArea.map(([col, row]) => `${col},${row}`));

    this.farmlandCorners = createCornerSet(
      scene,
      INVENTORY_UI_KEY,
      SELECTION_CORNER_NAMES,
      SELECTION_CORNER_RECTS,
      FARMLAND_CURSOR_SCALE,
    );
    this.globalCorners = createCornerSet(
      scene,
      EXTRAS_UI_KEY,
      GLOBAL_CURSOR_CORNER_NAMES,
      GLOBAL_CURSOR_CORNER_RECTS,
      GLOBAL_CURSOR_SCALE,
    );

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // worldX/worldY — com a câmera podendo rolar (Fase 6, Expansão), x/y
      // são coordenadas de tela, não do mundo.
      this.handlePointerMove(pointer.worldX, pointer.worldY);
    });
  }

  private handlePointerMove(x: number, y: number): void {
    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    const key = `${col},${row}`;

    if (key === this.hoveredKey) return;
    this.hoveredKey = key;

    if (!this.grid.inBounds(col, row)) {
      setCornerSetVisible(this.farmlandCorners, false);
      setCornerSetVisible(this.globalCorners, false);
      return;
    }

    const left = col * this.tilePx;
    const top = row * this.tilePx;
    const right = left + this.tilePx;
    const bottom = top + this.tilePx;

    const isFarmland = this.farmlandCells.has(key);

    if (isFarmland) {
      positionCornerSet(this.farmlandCorners, left, top, right, bottom);
    } else {
      positionCornerSet(this.globalCorners, left, top, right, bottom);
    }
    setCornerSetVisible(this.farmlandCorners, isFarmland);
    setCornerSetVisible(this.globalCorners, !isFarmland);
  }
}
