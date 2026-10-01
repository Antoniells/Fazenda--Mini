import Phaser from 'phaser';

/**
 * ARTE EM CAMADAS (ideia do stardew.me): vários PNGs do pacote do mesmo tamanho (pele, olhos, cabelo, roupa, acessórios, efeitos — na ordem do
 * arquivo Aseprite que vem com eles, de baixo pra cima) empilhados numa textura só, com a chave final. Monta UMA vez (as texturas do Phaser
 * valem pro jogo todo): carrega as camadas no `preload` da cena e empilha quando o carregamento termina (antes do `create`); depois as
 * camadas soltas são descartadas. Nada é desenhado do zero — é a arte do pacote, combinada.
 *
 * Usos: os retratos do Pirata e da Sereia com as 8 expressões (`data/npcs.ts`) e o retrato do personagem (`data/playerPortrait.ts`).
 */

export interface LayerStack {
  /** Chave da textura montada. */
  key: string;
  width: number;
  height: number;
  /** Caminhos (dentro de `assets/`) das camadas, de baixo pra cima. */
  layers: string[];
}

function layerKey(stack: LayerStack, index: number): string {
  return `${stack.key}#layer${index}`;
}

/** Chamar no `preload`: carrega o que falta e monta a textura assim que tudo chegar. Já montada = não faz nada. */
export function preloadLayerStack(scene: Phaser.Scene, stack: LayerStack): void {
  if (scene.textures.exists(stack.key)) return;
  stack.layers.forEach((path, index) => {
    const key = layerKey(stack, index);
    if (!scene.textures.exists(key)) scene.load.image(key, encodeURI(`/${path}`));
  });
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => composeLayerStack(scene, stack));
}

/** Empilha as camadas (já carregadas) na textura `stack.key`. Devolve `false` se falta alguma camada (a textura não é criada). */
export function composeLayerStack(scene: Phaser.Scene, stack: LayerStack): boolean {
  if (scene.textures.exists(stack.key)) return true;
  const keys = stack.layers.map((_, index) => layerKey(stack, index));
  const missing = keys.filter((key) => !scene.textures.exists(key));
  if (missing.length > 0) {
    console.warn(`Arte em camadas "${stack.key}": faltam ${missing.length} camada(s) — fica sem a textura.`);
    return false;
  }
  const canvas = scene.textures.createCanvas(stack.key, stack.width, stack.height);
  if (!canvas) return false;
  const context = canvas.getContext();
  for (const key of keys) context.drawImage(scene.textures.get(key).getSourceImage() as CanvasImageSource, 0, 0);
  canvas.refresh();
  for (const key of keys) scene.textures.remove(key);
  return true;
}

/** Registra (uma vez) o quadro `frame` na textura montada `key`. Devolve `false` se a textura ainda não existe. */
export function ensureLayerFrame(scene: Phaser.Scene, key: string, frame: { name: string; x: number; y: number; width: number; height: number }): boolean {
  if (!scene.textures.exists(key)) return false;
  const texture = scene.textures.get(key);
  if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
  return true;
}
