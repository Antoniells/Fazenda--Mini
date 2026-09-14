import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { MapEditorScene } from '../scenes/MapEditorScene';
import { UIScene } from '../scenes/UIScene';
import { ForestScene } from '../scenes/ForestScene';
import { QuarryScene } from '../scenes/QuarryScene';
import { CaveScene } from '../scenes/CaveScene';
import { BeachScene } from '../scenes/BeachScene';

// Tamanho da JANELA (viewport) — fixo, independente de `farmMap.cols/rows`:
// o núcleo da propriedade (agora 40x30, Fase 9) é maior que essa janela, e
// a câmera rola/segue o jogador dentro dele (e dos `farmMap.expansions`
// comprados) em vez de mostrar o mapa inteiro de uma vez (ver
// `MainScene.create`, que já configura os limites da câmera dinamicamente).

// Aqui definimos o "enquadramento" (resolução interna) do jogo.
// 800x600 ou 1024x768 são ótimos para pixel art. 
// O Phaser vai esticar essa resolução para caber no seu monitor, 
// deixando o personagem maior e o enquadramento perfeito!
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT, // Faz a tela esticar para o tamanho do monitor
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  backgroundColor: '#1e1e1e',
  pixelArt: true,
  // A primeira cena da lista roda automaticamente ao abrir o jogo. Pra usar
  // o editor de mapas em vez do jogo, troque a ordem (coloque MapEditorScene
  // primeiro) — nunca precisa remover a outra da lista. UIScene não entra
  // nessa lógica: nunca é a "cena inicial", só é iniciada sob demanda via
  // `scene.launch` (ver `scenes/UIScene.ensureUIScene`), chamado pela
  // MainScene e por cada cena externa assim que criam.
  scene: [MainScene, MapEditorScene, UIScene, ForestScene, QuarryScene, CaveScene, BeachScene],
};
