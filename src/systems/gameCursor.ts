import Phaser from 'phaser';
import { CLOSE_BUTTON_SHEET_KEY, GAME_CURSOR_RECT, GAME_CURSOR_HOTSPOT, GAME_CURSOR_SCALE } from '../data/ui';

let installed = false;

/**
 * Troca o ponteiro do mouse pela seta do próprio jogo (primeiro ícone de
 * `UI/HUD.png`, ver `GAME_CURSOR_RECT`), em qualquer cena e em qualquer
 * elemento — inclusive sobre botões, que antes mostravam a mãozinha do
 * sistema (`useHandCursor`).
 *
 * O recorte da folha é ampliado com pixels nítidos (sem suavização) num
 * canvas e vira o `cursor: url(...)` do CSS da página — nada é desenhado por
 * código, só a arte real é fatiada e ampliada. A regra vai numa folha de
 * estilo com `!important` justamente pra vencer o `canvas.style.cursor =
 * 'pointer'` que o Phaser aplica sozinho ao passar sobre objetos interativos.
 *
 * Idempotente (chamada por qualquer cena de entrada) e nunca derruba o jogo:
 * se algo falhar, fica o ponteiro padrão do sistema.
 */
export function installGameCursor(scene: Phaser.Scene): void {
  if (installed) return;

  try {
    const source = scene.textures.get(CLOSE_BUTTON_SHEET_KEY).getSourceImage() as CanvasImageSource;
    const { x, y, width, height } = GAME_CURSOR_RECT;

    const canvas = document.createElement('canvas');
    canvas.width = width * GAME_CURSOR_SCALE;
    canvas.height = height * GAME_CURSOR_SCALE;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);

    const hotspotX = GAME_CURSOR_HOTSPOT.x * GAME_CURSOR_SCALE;
    const hotspotY = GAME_CURSOR_HOTSPOT.y * GAME_CURSOR_SCALE;
    const style = document.createElement('style');
    style.textContent = `canvas { cursor: url("${canvas.toDataURL('image/png')}") ${hotspotX} ${hotspotY}, auto !important; }`;
    document.head.appendChild(style);
    installed = true;
  } catch (error) {
    console.warn('Não foi possível aplicar o cursor do jogo.', error);
  }
}
