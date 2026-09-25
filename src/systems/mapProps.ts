import Phaser from 'phaser';
import { MAP_PROPS } from '../data/mapProps';
import { PROPS_TILESET_KEY } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';

const PROPS_BY_ID = new Map(MAP_PROPS.map((prop) => [prop.id, prop]));

/** Props `flat` (deitados no chão, ex.: tronco caído): acima do chão (-1), da água e da terra arada (-0.5) e abaixo de qualquer coisa ordenada por Y (personagem, pet, árvores, props com volume). */
const FLAT_PROP_DEPTH = -0.4;

/** Registra um frame por `MAP_PROPS` — `!texture.has` porque texturas são globais e sobrevivem entre reaberturas de cena (mesmo critério de `MapEditorScene.registerFrames`). Chamado tanto pelo editor quanto pelo jogo de verdade, sempre a partir da MESMA fonte (`data/mapProps.ts`), pra nunca divergir. */
export function registerMapPropFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(PROPS_TILESET_KEY);
  for (const prop of MAP_PROPS) {
    if (!texture.has(prop.id)) texture.add(prop.id, 0, prop.frame.x, prop.frame.y, prop.frame.width, prop.frame.height);
  }
}

/**
 * Desenha os props de decoração autorados no `MapEditorScene` (aba
 * "Decoração") no mapa de verdade — puramente visual, sem colisão nenhuma
 * (pedido explícito do usuário: decoração ambiente nunca bloqueia o
 * jogador), então nunca toca no `WalkableGrid`. Ancorado embaixo-centro da
 * célula (mesmo critério de `GROUND_ANCHORED_OFFSET` do editor) e com
 * profundidade pelo Y (mesmo critério de `externalMapBuilder.buildRock`),
 * pra o jogador poder passar na frente/atrás corretamente — exceto os props
 * `flat` (tronco caído), que ficam no chão, atrás de todos (`FLAT_PROP_DEPTH`).
 */
export function buildMapProps(scene: Phaser.Scene, tileSize: number, props: Array<[number, number, string]>): void {
  registerMapPropFrames(scene);
  const tile = tileSize * DISPLAY_SCALE;

  for (const [col, row, propId] of props) {
    const def = PROPS_BY_ID.get(propId);
    if (!def) continue; // Prop removido/renomeado em `data/mapProps.ts` desde a exportação deste mapa — ignora em vez de quebrar a cena.

    const x = col * tile + tile / 2;
    const y = row * tile + tile;
    const view = scene.add.image(x, y, PROPS_TILESET_KEY, propId);
    view.setOrigin(0.5, 1);
    view.setScale(DISPLAY_SCALE);
    view.setDepth(def.flat ? FLAT_PROP_DEPTH : y);
  }
}
