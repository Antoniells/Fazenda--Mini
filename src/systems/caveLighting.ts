import Phaser from 'phaser';
import { CAVE_AMBIENT_BOTTOM, CAVE_AMBIENT_TOP, CAVE_PLAYER_LIGHT, CAVE_STAIRS_DOWN_LIGHT, CAVE_STAIRS_UP_LIGHT } from '../data/lighting';
import { CAVE_MAX_FLOOR } from '../data/caveFloors';
import { mixColors } from './ambientLight';
import { enableWorldLighting } from './sceneLighting';

/**
 * LUZ DAS CAVERNAS com a iluminação NATIVA do Phaser 4 (Lights2D — estudo em docs/studies/ILUMINACAO_PHASER4.md): a cor de cada objeto
 * do mundo é multiplicada pela luz ambiente do andar (mais escura quanto mais fundo) somada às luzes: uma quente que segue o personagem
 * (tremulando de leve, como uma lamparina) e uma em cada escada. Diferente do véu escuro + brilho por cima de antes, a luz REVELA as cores
 * de verdade em volta do personagem. Sem normal map no pacote, o Phaser usa a normal plana: a luz é um círculo que se apaga com a distância.
 *
 * Quem liga a luz em todo objeto do mundo (e deixa de fora interface, textos e brilhos em ADD) é `systems/sceneLighting.ts`.
 */

/** Luz ambiente do andar `floor` (1 = mais clara, `CAVE_MAX_FLOOR` = mais escura). */
export function caveAmbientColor(floor: number): number {
  const t = Math.min(1, Math.max(0, (floor - 1) / (CAVE_MAX_FLOOR - 1)));
  return mixColors(CAVE_AMBIENT_TOP, CAVE_AMBIENT_BOTTOM, t);
}

export class CaveLighting {
  private readonly playerLight: Phaser.GameObjects.Light;

  constructor(
    private readonly scene: Phaser.Scene,
    floor: number,
    private readonly follow: Phaser.GameObjects.Sprite,
    private readonly tilePx: number,
    stairs: { up: { col: number; row: number }; down: { col: number; row: number } | null },
  ) {
    enableWorldLighting(scene);
    scene.lights.setAmbientColor(caveAmbientColor(floor));
    const light = CAVE_PLAYER_LIGHT;
    this.playerLight = scene.lights.addLight(follow.x, follow.y + light.offsetY, light.radius, light.color, light.intensity);
    this.stairsLight(stairs.up, CAVE_STAIRS_UP_LIGHT);
    if (stairs.down) this.lightStairsDown(stairs.down);
  }

  /** A luz azul da escada de descida — logo ao abrir o andar, ou quando a escada escondida sob uma pedra aparece (`systems/caveRocks.ts`). */
  lightStairsDown(cell: { col: number; row: number }): void {
    this.stairsLight(cell, CAVE_STAIRS_DOWN_LIGHT);
  }

  private stairsLight(cell: { col: number; row: number }, def: { radius: number; color: number; intensity: number }): void {
    this.scene.lights.addLight((cell.col + 0.5) * this.tilePx, (cell.row + 0.5) * this.tilePx, def.radius, def.color, def.intensity);
  }

  /** A cada quadro: a luz do personagem o acompanha e tremula de leve. */
  update(timeMs: number): void {
    const light = CAVE_PLAYER_LIGHT;
    this.playerLight.setPosition(this.follow.x, this.follow.y + light.offsetY);
    const wave = 0.5 * Math.sin(timeMs / 230) + 0.5 * Math.sin(timeMs / 101 + 1.7);
    this.playerLight.setIntensity(light.intensity * (1 - light.flicker * (0.5 + 0.5 * wave)));
  }
}
