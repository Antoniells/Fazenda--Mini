import Phaser from 'phaser';
import { CLOSE_BUTTON_SHEET_KEY, GAME_CURSOR_RECT, GAME_CURSOR_HOTSPOT, GAME_CURSOR_SCALE, ENTER_CURSOR_RECT, ENTER_CURSOR_HOTSPOT } from '../data/ui';

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

let enterCursorInstalled = false;
/** Classe do `<body>` que liga o ponteiro "entrar" (a regra CSS abaixo só vale com ela — vence o ponteiro padrão do jogo pela especificidade). */
const ENTER_CURSOR_CLASS = 'enter-cursor';

/** Cria (uma vez) a regra CSS do ponteiro "entrar", fatiando a luva de `UI/HUD.png` como o ponteiro padrão. Nunca derruba o jogo. */
function ensureEnterCursorStyle(scene: Phaser.Scene): void {
  if (enterCursorInstalled) return;
  try {
    const source = scene.textures.get(CLOSE_BUTTON_SHEET_KEY).getSourceImage() as CanvasImageSource;
    const { x, y, width, height } = ENTER_CURSOR_RECT;
    const canvas = document.createElement('canvas');
    canvas.width = width * GAME_CURSOR_SCALE;
    canvas.height = height * GAME_CURSOR_SCALE;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    const style = document.createElement('style');
    style.textContent = `body.${ENTER_CURSOR_CLASS} canvas { cursor: url("${canvas.toDataURL('image/png')}") ${ENTER_CURSOR_HOTSPOT.x * GAME_CURSOR_SCALE} ${ENTER_CURSOR_HOTSPOT.y * GAME_CURSOR_SCALE}, pointer !important; }`;
    document.head.appendChild(style);
    enterCursorInstalled = true;
  } catch (error) {
    console.warn('Não foi possível aplicar o ponteiro de entrada.', error);
  }
}

/**
 * Troca o ponteiro pela luva apontando (`ENTER_CURSOR_RECT`) enquanto o mouse estiver sobre uma das áreas devolvidas por `getAreas` (em coordenadas de MUNDO — as casas em que se pode entrar).
 * `blocked` (opcional) desliga o efeito, ex.: com uma janela de UI aberta por cima do mundo. Volta ao ponteiro normal ao sair das áreas e quando a cena fecha.
 */
export function installEnterHoverCursor(scene: Phaser.Scene, getAreas: () => Phaser.Geom.Rectangle[], blocked: () => boolean = () => false): void {
  ensureEnterCursorStyle(scene);
  const setActive = (active: boolean): void => {
    if (typeof document !== 'undefined') document.body.classList.toggle(ENTER_CURSOR_CLASS, active);
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    setActive(!blocked() && getAreas().some((area) => area.contains(pointer.worldX, pointer.worldY)));
  };
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.GAME_OUT, () => setActive(false));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    setActive(false);
  });
}
