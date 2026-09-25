import Phaser from 'phaser';
import {
  TILE_SIZE,
  GRASS_TILESET_KEY,
  GRASS_TILESET_PATH,
  SOIL_TILESET_KEY,
  SOIL_TILESET_PATH,
  WATER_KEY,
  WATER_PATH,
  WATER_STYLES,
} from '../data/tiles';

/** Id (e chave de textura) do tileset "Beach animations tiles" importado no editor — o mar/lago pintados com ele são reconhecidos como água pelo autotile (`systems/waterAutotile.ts`). */
export const BEACH_ANIM_TILESET_ID = 'imported-tileset-1789696244851';

/** Um tileset pintável no Modo Ground do `MapEditorScene`, com sua própria faixa de GID (ver `GROUND_TILESETS`). */
export interface GroundTilesetConfig {
  id: string;
  label: string;
  textureKey: string;
  /** Caminho do arquivo (relativo a `assets/`, sem barra inicial — mesma convenção de `data/tiles.ts`) — `preloadGroundTilesets` usa isto pra carregar automaticamente, sem precisar de um `load.image` escrito à mão em cada cena. */
  path: string;
  tileSize: number;
  columns: number;
  rows: number;
  firstGid: number;
}

/**
 * Fonte ÚNICA da convenção de GID usada tanto pelo `MapEditorScene`
 * (`ui/tilePickerPanel.ts`, pra pintar) quanto pelo motor do jogo de verdade
 * (`systems/mapBuilder.ts`, pra renderizar `XMapData.ground`) — os dois
 * precisam concordar exatamente nas mesmas faixas de GID por tileset, senão
 * um chão pintado no editor renderizaria errado (ou nem apareceria) no jogo.
 *
 * `Tileset Grass Summer.png`/`Tilled Soil and wet soil.png`: dimensões
 * conferidas por pixel (largura/altura reais ÷ 16). Grama usa `firstGid: 0`
 * de propósito, pra continuar batendo com os índices brutos já usados em
 * todo o resto do jogo (`GRASS_FLAT_TILE_INDEX` etc.) sem deslocar nada do
 * que já existia antes do Modo Ground existir; os demais tilesets começam
 * bem acima do maior (960 tiles) pra nunca colidir.
 *
 * Extensibilidade (pedido explícito do usuário — "deixa essa etapa mais
 * automática"): adicionar um tileset novo agora é UM passo só, nenhum deles
 * em código de UI nem em `load.image` escrito à mão:
 * 1) uma entrada nova neste array (`path` incluído) — `preloadGroundTilesets`
 *    (chamado pelo `MapEditorScene`, `MainScene` e `ExternalMapScene`) já
 *    carrega TODOS os tilesets daqui sozinho, nenhuma cena precisa saber
 *    quantos existem ou adicionar seu próprio `load.image`.
 * As abas do `TilePickerPanel`, o registro de tilesets do `Tilemap`
 * (`buildGroundLayer`/`mapBuilder.buildGroundChunk`) e a exportação
 * (`mapEditorExport.ts`, que só serializa os GIDs brutos) já são 100%
 * gerados a partir deste array — nenhum deles precisa mudar.
 */
export const GROUND_TILESETS: GroundTilesetConfig[] = [
  { id: 'grass', label: 'Grama', textureKey: GRASS_TILESET_KEY, path: GRASS_TILESET_PATH, tileSize: TILE_SIZE, columns: 24, rows: 40, firstGid: 0 },
  { id: 'soil', label: 'Solo', textureKey: SOIL_TILESET_KEY, path: SOIL_TILESET_PATH, tileSize: TILE_SIZE, columns: 24, rows: 8, firstGid: 2000 },
  { id: 'water', label: 'Água', textureKey: WATER_KEY, path: WATER_PATH, tileSize: TILE_SIZE, columns: 1, rows: 1, firstGid: 3000 },
  {
    id: BEACH_ANIM_TILESET_ID,
    label: 'Beach animations tiles',
    textureKey: BEACH_ANIM_TILESET_ID,
    path: 'Tileset/Beach animations tiles.png',
    tileSize: TILE_SIZE,
    columns: 24,
    rows: 16,
    firstGid: 4000,
  },
];

/**
 * Único ponto que carrega todos os tilesets de chão — chamado pelo
 * `preload()` de `MapEditorScene`, `MainScene` e `ExternalMapScene`, em vez
 * de cada um repetir `this.load.image(...)` por tileset (pedido explícito:
 * "deixa essa etapa mais automática"). O Phaser ignora uma chave já em
 * cache, então chamar isto em toda cena que possa desenhar chão autorado
 * (`XMapData.ground`) — qualquer uma, já que o Modo Ground é universal — é
 * seguro e sem custo de rede extra.
 */
export function preloadGroundTilesets(scene: Phaser.Scene): void {
  for (const ts of GROUND_TILESETS) scene.load.image(ts.textureKey, encodeURI(`/${ts.path}`));
  // Folhas do autotile animado da água (frames NUMÉRICOS 16x16 — uma por estilo, `WATER_STYLES`: Praia e Floresta), como spritesheet e com chave estável.
  for (const style of Object.values(WATER_STYLES)) {
    scene.load.spritesheet(style.textureKey, encodeURI(`/${style.path}`), { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
  }
}
