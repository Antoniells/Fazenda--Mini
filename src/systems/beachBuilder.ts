import Phaser from 'phaser';
import { BEACH_ASSETS, BEACH_PLACEMENTS, BeachAsset } from '../data/maps/beachDecor';
import { TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';

/** Profundidade dos objetos planos de chão (toalhas/tapetes): acima da areia (-1), abaixo de sombras e de tudo ordenado por Y. */
const FLAT_DEPTH = -0.35;

/** Carrega as artes da Praia (casinha do pescador, guarda-sóis, barracas, coqueiros…) — chamado no `loadMapAssets` da `BeachScene`. */
export function preloadBeach(scene: Phaser.Scene): void {
  const seen = new Set<string>();
  for (const asset of Object.values(BEACH_ASSETS)) {
    if (seen.has(asset.key)) continue;
    seen.add(asset.key);
    scene.load.image(asset.key, encodeURI(`/${asset.path}`));
  }
}

/**
 * Desenha os elementos da Praia (`data/maps/beachDecor.ts`): cada peça é um recorte da folha, com o canto inferior esquerdo na célula
 * indicada e a profundidade na borda de baixo dela (o jogador passa atrás/na frente conforme o Y, como em qualquer objeto do mundo).
 * Toalhas e tapetes ficam no chão. A colisão NÃO é criada aqui: vem da mesma fonte, `beachBlockedCells`, no grid da cena.
 */
export function buildBeach(scene: Phaser.Scene): void {
  const tile = TILE_SIZE * DISPLAY_SCALE;

  for (const placement of BEACH_PLACEMENTS) {
    const asset: BeachAsset = BEACH_ASSETS[placement.asset];
    const frameName = `${asset.key}-${placement.asset}`;
    registerFrame(scene, asset.key, { name: frameName, rect: asset.frame });

    const bottom = (placement.row + 1) * tile;
    const image = scene.add.image(placement.col * tile, bottom - asset.frame.height * DISPLAY_SCALE, asset.key, frameName);
    image.setOrigin(0, 0).setScale(DISPLAY_SCALE);
    image.setDepth(asset.flat ? FLAT_DEPTH : bottom);
  }
}
