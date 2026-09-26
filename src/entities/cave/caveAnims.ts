import Phaser from 'phaser';
import { DIRECTION_ROW, Direction, SheetDef } from '../../data/caveEnemies';

export const DIRECTIONS: Direction[] = ['down', 'up', 'right', 'left'];

/** Carrega (no `preload` da cena) as folhas de animação como spritesheets — as que já estão no cache do jogo não são pedidas de novo. */
export function preloadSheets(scene: Phaser.Scene, sheets: SheetDef[]): void {
  for (const sheet of sheets) {
    if (scene.textures.exists(sheet.key)) continue;
    scene.load.spritesheet(sheet.key, encodeURI(`/${sheet.path}`), { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
  }
}

/** Chave da animação `kind` de uma folha numa direção. */
export const dirAnimKey = (sheet: SheetDef, kind: string, direction: Direction): string => `${sheet.key}:${kind}:${direction}`;

interface AnimOptions {
  frameRate: number;
  repeat: number;
  /** Só uma faixa de quadros da linha (padrão: a linha inteira). */
  from?: number;
  to?: number;
}

/** Cria (uma vez por jogo) a animação `kind` da folha nas 4 direções: cada direção é uma LINHA da folha (`DIRECTION_ROW`), cada quadro uma coluna. */
export function ensureDirAnims(scene: Phaser.Scene, sheet: SheetDef, kind: string, options: AnimOptions): void {
  for (const direction of DIRECTIONS) {
    const key = dirAnimKey(sheet, kind, direction);
    if (scene.anims.exists(key)) continue;
    const rowStart = DIRECTION_ROW[direction] * sheet.frames;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheet.key, { start: rowStart + (options.from ?? 0), end: rowStart + (options.to ?? sheet.frames - 1) }),
      frameRate: options.frameRate,
      repeat: options.repeat,
    });
  }
}

/** A direção dominante de um vetor (o eixo de maior módulo). */
export function directionOf(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

export const DIRECTION_VECTOR: Record<Direction, { dx: number; dy: number }> = {
  down: { dx: 0, dy: 1 },
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
};
