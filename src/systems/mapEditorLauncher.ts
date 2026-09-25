import Phaser from 'phaser';
import { MapType } from '../scenes/MapEditorScene';

const MAP_EDITOR_SCENE_KEY = 'MapEditorScene';

/**
 * F2 universal (pedido explícito do usuário — o atalho só funcionava na
 * Fazenda): fonte ÚNICA da escuta da tecla F2 em QUALQUER cena jogável
 * (`MainScene.create` e `ExternalMapScene.create`, nunca duplicada por
 * cena). Pausa a cena atual (preserva jogador/câmera/estado — nunca um
 * `stop`, que destruiria tudo) e sobrepõe o `MapEditorScene`, informando o
 * `mapType` certo e a própria chave da cena pra ele saber pra onde voltar
 * (`MapEditorInitData.returnSceneKey`, lido por `MapEditorScene.closeEditor`).
 */
export function registerMapEditorShortcut(scene: Phaser.Scene, mapType: MapType): void {
  scene.input.keyboard?.on('keydown-F2', () => {
    if (scene.scene.isActive(MAP_EDITOR_SCENE_KEY) || scene.scene.isPaused(MAP_EDITOR_SCENE_KEY)) return; // já aberto — evita reentrância.
    scene.scene.pause();
    scene.scene.launch(MAP_EDITOR_SCENE_KEY, { mapType, returnSceneKey: scene.scene.key });
  });
}
