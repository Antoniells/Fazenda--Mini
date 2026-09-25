import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GRASS_TILE_IDS } from './grassDetails';
import { isWaterGid } from './waterCells';
import { WATER_SAND_FILL_INDICES } from '../data/tiles';
import { GROUND_TILESETS, BEACH_ANIM_TILESET_ID } from './groundTilesets';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';

/** Intervalo entre duas nuvenzinhas enquanto o jogador anda — o primeiro sopro sai assim que ele começa a andar. */
const PUFF_INTERVAL_MS = 130;
/** Cor da poeira levantada da terra (tingimento sobre a mancha de `Tileset/Shadow.png`, mesma técnica da poeira da enxada): um bege-terra que aparece sobre o chão marrom. */
const DUST_TINT = 0xd9c08f;
const DUST_ALPHA = 0.75;
const PUFF_DURATION_MS = 420;
/** Quantos px acima dos pés (âncora do jogador) a poeira nasce — sai um pouco acima do chão, na altura dos tornozelos, e não colada na sola. */
const DUST_ORIGIN_LIFT_PX = 8;

/**
 * O chão desta célula é "Grama"? `ground` é a camada autorada no editor (GIDs por célula, mesmo esquema de
 * `FarmMapData.ground`): só os dois tons da grama plana (`GRASS_TILE_IDS`) valem — terra, piso, água, ponte etc.
 * têm outro GID. Sem `ground` (ou fora dos limites dele, ex.: trechos de expansão) o chão é gerado sempre como grama.
 */
export function isGrassGround(ground: number[][] | undefined, col: number, row: number): boolean {
  const tileId = ground?.[row]?.[col];
  return tileId === undefined || GRASS_TILE_IDS.includes(tileId);
}

/**
 * O chão desta célula é TERRA (caminho, piso de terra, chão de caverna…)? Vale qualquer GID autorado que NÃO seja a grama plana, água, areia
 * lisa da Praia nem o solo arado (esse é tratado pela lavoura, que sabe o estado de cada canteiro). Sem `ground` não há terra autorada.
 */
export function isDirtGround(ground: number[][] | undefined, col: number, row: number): boolean {
  const tileId = ground?.[row]?.[col];
  if (tileId === undefined || GRASS_TILE_IDS.includes(tileId) || isWaterGid(tileId)) return false;
  const soil = GROUND_TILESETS.find((tileset) => tileset.id === 'soil');
  if (soil && tileId >= soil.firstGid && tileId < soil.firstGid + soil.columns * soil.rows) return false;
  const beach = GROUND_TILESETS.find((tileset) => tileset.id === BEACH_ANIM_TILESET_ID);
  if (beach && tileId >= beach.firstGid && WATER_SAND_FILL_INDICES.includes(tileId - beach.firstGid)) return false; // Areia lisa da Praia.
  return true;
}

/**
 * Poeira nos pés (efeito visual): enquanto o jogador ANDA sobre uma célula de TERRA (`isDirtAt`, quem chama diz qual chão é qual —
 * cada cena tem as próprias regras: caminho de terra, lavoura arada, ruas do Vilarejo, ponte), a cada `PUFF_INTERVAL_MS` sai uma
 * nuvenzinha atrás dele: a mancha do `Shadow.png` tingida de bege-terra, que cresce, sobe um pouco, vai pra trás e some. Parado,
 * na grama ou na ponte não sai nada. Depth logo abaixo do personagem (acima da sombra dele). O listener sai junto com a cena
 * (`shutdown`), como `attachFootstepSounds`.
 */
export function attachFootDust(scene: Phaser.Scene, player: Player, tilePx: number, isDirtAt: (col: number, row: number) => boolean): void {
  let sinceLastPuff = PUFF_INTERVAL_MS;
  let lastX = player.sprite.x;
  let lastY = player.sprite.y;

  const onUpdate = (_time: number, delta: number): void => {
    const { x, y } = player.sprite;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    if (!player.isMoving() || (dx === 0 && dy === 0)) {
      sinceLastPuff = PUFF_INTERVAL_MS;
      return;
    }
    sinceLastPuff += delta;
    if (sinceLastPuff < PUFF_INTERVAL_MS) return;

    // Célula sob os pés: a âncora do jogador é o meio da borda de baixo da célula, então o "meio caminho" entre duas células é onde o chão muda.
    const col = Math.floor(x / tilePx);
    const row = Math.floor((y - tilePx / 2) / tilePx);
    if (!isDirtAt(col, row)) return;

    sinceLastPuff = 0;
    spawnPuff(scene, player, dx, dy);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}

function spawnPuff(scene: Phaser.Scene, player: Player, dx: number, dy: number): void {
  const length = Math.hypot(dx, dy) || 1;
  const backX = -dx / length;
  const backY = -dy / length;

  const startX = player.sprite.x + Phaser.Math.Between(-4, 4);
  const startY = player.sprite.y - DUST_ORIGIN_LIFT_PX;
  const puff = createGroundShadow(scene, startX, startY, DISPLAY_SCALE * 0.5, DISPLAY_SCALE * 0.38);
  puff.setTint(DUST_TINT);
  puff.setTintMode(Phaser.TintModes.FILL); // a mancha-base é escura: só o modo sólido troca a cor de fato (multiplicar preto continua preto).
  puff.setAlpha(DUST_ALPHA);
  puff.setDepth(player.sprite.depth - 0.05);

  scene.tweens.add({
    targets: puff,
    x: startX + backX * 8,
    y: startY + backY * 4 - 7,
    scaleX: puff.scaleX * 2.2,
    scaleY: puff.scaleY * 2.2,
    alpha: 0,
    duration: PUFF_DURATION_MS,
    ease: 'Cubic.easeOut',
    onComplete: () => puff.destroy(),
  });
}
