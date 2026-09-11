import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { INVENTORY_UI_KEY, SELECTION_CORNER_NAMES, SELECTION_CORNER_RECTS } from '../data/ui';

const CURSOR_SCALE = 2;
const CURSOR_DEPTH = 900; // Acima de qualquer sprite do mundo (Y-sort chega no máximo à altura do mapa), abaixo dos HUDs (1000+).

type CornerKey = keyof typeof SELECTION_CORNER_NAMES;

/**
 * Destaque visual (moldura de 4 cantos, não um quadrado desenhado por
 * código) sobre o canteiro que o mouse está sobre. Reaproveita os mesmos
 * cantinhos de "cursor de seleção" de `UI/Inventory/Slots.png` já usados
 * como asset de UI — aqui posicionados no mundo, um em cada canto da
 * célula, em vez de ficarem fixos num HUD.
 *
 * Só destaca células de `farmMap.farmlandArea` (onde faz sentido plantar/
 * regar/colher) — passar o mouse sobre grama, cerca ou objetos não mostra
 * nada.
 */
export class TileCursor {
  private readonly corners: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly farmlandCells: Set<string>;
  private readonly tilePx: number;
  private hoveredKey: string | null = null;

  constructor(scene: Phaser.Scene, map: FarmMapData, tilePx: number) {
    this.tilePx = tilePx;
    this.farmlandCells = new Set(map.farmlandArea.map(([col, row]) => `${col},${row}`));

    const texture = scene.textures.get(INVENTORY_UI_KEY);
    for (const key of Object.keys(SELECTION_CORNER_NAMES) as CornerKey[]) {
      const name = SELECTION_CORNER_NAMES[key];
      if (!texture.has(name)) {
        const rect = SELECTION_CORNER_RECTS[key];
        texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }

    const makeCorner = (name: string, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = scene.add.image(0, 0, INVENTORY_UI_KEY, name);
      corner.setOrigin(originX, originY);
      corner.setScale(CURSOR_SCALE);
      corner.setDepth(CURSOR_DEPTH);
      corner.setVisible(false);
      return corner;
    };

    this.corners = {
      topLeft: makeCorner(SELECTION_CORNER_NAMES.topLeft, 0, 0),
      topRight: makeCorner(SELECTION_CORNER_NAMES.topRight, 1, 0),
      bottomLeft: makeCorner(SELECTION_CORNER_NAMES.bottomLeft, 0, 1),
      bottomRight: makeCorner(SELECTION_CORNER_NAMES.bottomRight, 1, 1),
    };

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerMove(pointer.x, pointer.y);
    });
  }

  private handlePointerMove(x: number, y: number): void {
    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    const key = `${col},${row}`;

    if (key === this.hoveredKey) return;
    this.hoveredKey = key;

    if (!this.farmlandCells.has(key)) {
      this.setVisible(false);
      return;
    }

    const left = col * this.tilePx;
    const top = row * this.tilePx;
    const right = left + this.tilePx;
    const bottom = top + this.tilePx;

    this.corners.topLeft.setPosition(left, top);
    this.corners.topRight.setPosition(right, top);
    this.corners.bottomLeft.setPosition(left, bottom);
    this.corners.bottomRight.setPosition(right, bottom);
    this.setVisible(true);
  }

  private setVisible(visible: boolean): void {
    for (const corner of Object.values(this.corners)) corner.setVisible(visible);
  }
}
