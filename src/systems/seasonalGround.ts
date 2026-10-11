import Phaser from 'phaser';
import { SEASON_CLIFF_TILESETS, SEASON_GRASS_TILESETS, type SeasonId } from '../data/seasons';
import { GRASS_TILESET_KEY } from '../data/tiles';
import { CLIFF_TILESET_KEY } from '../data/islandEdges';

/**
 * O CHÃO DA ESTAÇÃO (`data/seasons.ts`, `SEASON_GRASS_TILESETS`/`SEASON_CLIFF_TILESETS`): cada mapa monta o chão com a textura de grama
 * de sempre (`GRASS_TILESET_KEY`) e a beirada das ilhas com a de penhasco (`CLIFF_TILESET_KEY`). Antes de montar, a cena aponta essas duas
 * texturas pra folha da estação do dia — as folhas têm o mesmo layout, então chão, grama de baixo, manchas e beirada mudam juntos sem
 * nenhum construtor saber de estação. A cena é refeita a cada entrada (e a cada manhã), então o chão acompanha a virada da estação.
 */

let groundSeason: SeasonId = 'summer';

/** A estação em que o chão foi montado por último (as manchas de grama usam pra escolher a textura delas). */
export function currentGroundSeason(): SeasonId {
  return groundSeason;
}

export function preloadSeasonalGround(scene: Phaser.Scene): void {
  for (const { key, path } of [...Object.values(SEASON_GRASS_TILESETS), ...Object.values(SEASON_CLIFF_TILESETS)]) {
    if (!scene.textures.exists(key)) scene.load.image(key, encodeURI(`/${path}`));
  }
}

/** Faz a textura `aliasKey` mostrar a imagem de `sourceKey` (refaz a textura só se ela mostra outra imagem). */
function pointTexture(scene: Phaser.Scene, aliasKey: string, sourceKey: string): void {
  const textures = scene.textures;
  if (!textures.exists(sourceKey)) return;
  const image = textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  if (textures.exists(aliasKey)) {
    if (textures.get(aliasKey).getSourceImage() === image) return;
    textures.remove(aliasKey);
  }
  textures.addImage(aliasKey, image);
}

/** Antes de montar o chão: grama e penhasco da estação `season`. */
export function applySeasonalGround(scene: Phaser.Scene, season: SeasonId): void {
  pointTexture(scene, GRASS_TILESET_KEY, SEASON_GRASS_TILESETS[season].key);
  pointTexture(scene, CLIFF_TILESET_KEY, SEASON_CLIFF_TILESETS[season].key);
  if (scene.textures.exists(SEASON_GRASS_TILESETS[season].key)) groundSeason = season;
}
