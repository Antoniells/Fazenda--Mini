import { GRASS_FLAT_TILE_INDEX, GRASS_FLAT_DARK_TILE_INDEX } from '../data/tiles';

/**
 * Variação visual sutil do chão (Fase 9, melhoria de QoL visual): mistura,
 * de forma determinística (mesma célula do mapa = sempre a mesma variante,
 * mesmo recarregando a cena), as duas tonalidades planas de grama já
 * existentes no tileset (`GRASS_FLAT_TILE_INDEX`/`GRASS_FLAT_DARK_TILE_INDEX`).
 * Não introduz nenhum asset novo nem muda a área cultivável/colisão — só
 * decide qual variante desenhar em cada célula do chão já renderizado por
 * `systems/mapBuilder.ts`. As manchas de terra propriamente ditas (com
 * borda orgânica de verdade) vêm de `systems/dirtPaths.ts`, aplicado depois
 * como uma sobreposição nas células que formam caminho/mancha.
 */

/** Fração de células com a variante escura (tom ligeiramente diferente, não uma cor nova). */
const DARK_VARIANT_CHANCE = 0.22;

/**
 * Hash 2D simples e determinístico (mesmos x/y sempre produzem o mesmo
 * resultado, sem precisar guardar nada em lugar nenhum) — não é
 * criptográfico, só precisa distribuir os valores o bastante pra não
 * formar um padrão visual óbvio quando lido em sequência pelo mapa.
 */
export function hash2D(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

/**
 * Decide a variante visual do chão (tom claro ou escuro de grama) numa
 * célula, a partir de coordenadas ABSOLUTAS do mundo (não relativas a um
 * trecho/expansão) — assim o padrão continua coerente nas emendas entre o
 * núcleo e as expansões da propriedade (Fase 6), não importa quando cada
 * trecho é desenhado.
 */
export function pickGroundTileVariant(worldCol: number, worldRow: number): number {
  const n = hash2D(worldCol, worldRow);
  return n < DARK_VARIANT_CHANCE ? GRASS_FLAT_DARK_TILE_INDEX : GRASS_FLAT_TILE_INDEX;
}
