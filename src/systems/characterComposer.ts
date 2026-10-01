import Phaser from 'phaser';
import {
  APPEARANCE_PARTS,
  APPEARANCE_PRESETS,
  EARS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  BODY_OFFSET_IN_64,
  CHARACTER_SHEETS,
  CharacterSheetId,
  PlayerAppearance,
  bodyLayers,
  characterPortraitKey,
  characterSheetKey,
  layerPath,
  portraitLayers,
} from '../data/playerAppearance';

/**
 * MONTA O PERSONAGEM PERSONALIZADO (`data/playerAppearance.ts`): carrega as camadas (cada PNG uma vez só, compartilhado entre as folhas)
 * e empilha cada folha numa textura de canvas — já REORGANIZADA no formato das folhas prontas (`Pre-made`): 3 linhas (baixo, cima, lado)
 * com N quadros cada (a de 1 quadro por direção fica numa linha só), com os quadros numerados como os de um spritesheet. Assim todo o
 * resto (animações, quadro de impacto, pesca, `yOffset` das folhas de 64) funciona igual com o personagem pronto ou o montado. Quadros de
 * 64 (pegar item, pesca): o corpo de 32 vai em (16, 16), onde ele fica nas folhas prontas; a vara de pescar já vem em 64.
 * O retrato sai das camadas do retrato com as mesmas peças. As texturas são globais: a mesma aparência não é montada duas vezes.
 */

const ALL_SHEETS = Object.keys(CHARACTER_SHEETS) as CharacterSheetId[];
const SOURCE_CELL = 32;
export const PORTRAIT_SHEET_SIZE = { width: 320, height: 192 };

function layerKey(path: string): string {
  return `char-layer:${path}`;
}

/** Todas as camadas de uma folha (corpo, ferramenta e efeitos), com o tamanho de quadro de cada uma. */
function sheetLayers(look: PlayerAppearance, id: CharacterSheetId): Array<{ path: string; cell: number }> {
  const sheet = CHARACTER_SHEETS[id];
  const layers = bodyLayers(sheet, look).map((path) => ({ path, cell: SOURCE_CELL }));
  const tool = sheet.tool ? layerPath(sheet.folder, sheet.tool) : null;
  if (tool) layers.push({ path: tool, cell: sheet.toolCell ?? SOURCE_CELL });
  for (const extra of sheet.extras ?? []) {
    const path = layerPath(sheet.folder, extra.id);
    if (path) layers.push({ path, cell: extra.cell });
  }
  return layers;
}

/** Carrega (no `preload`) as camadas das folhas `ids` e do retrato; monta tudo assim que o carregamento terminar. */
export function preloadCharacterLook(scene: Phaser.Scene, look: PlayerAppearance, ids: CharacterSheetId[] = ALL_SHEETS, withPortrait = true): void {
  const pending = ids.filter((id) => !scene.textures.exists(characterSheetKey(look, id)));
  const needPortrait = withPortrait && !scene.textures.exists(characterPortraitKey(look));
  if (pending.length === 0 && !needPortrait) return;
  const paths = new Set<string>();
  for (const id of pending) for (const layer of sheetLayers(look, id)) paths.add(layer.path);
  if (needPortrait) for (const path of portraitLayers(look)) paths.add(path);
  loadLayers(scene, [...paths]);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const id of pending) composeCharacterSheet(scene, look, id);
    if (needPortrait) composeCharacterPortrait(scene, look);
  });
}

/** Carrega camadas soltas (as que ainda não estão no cache). */
export function loadLayers(scene: Phaser.Scene, paths: string[]): void {
  for (const path of paths) {
    const key = layerKey(path);
    if (!scene.textures.exists(key)) scene.load.image(key, encodeURI(`/${path}`));
  }
}

/**
 * Todas as camadas que QUALQUER escolha da Criação de Personagem pode pedir pra folha de repouso e pro retrato — carregadas de uma vez,
 * pra a troca de peça ser instantânea. As peças que dependem de outra (orelha élfica e retrato por tom de pele; olhos e retrato por traço;
 * cabelo por estilo e cor) são cruzadas; as outras variam uma de cada vez sobre essas bases.
 */
export function creationLayerPaths(): string[] {
  const paths = new Set<string>();
  const looks: PlayerAppearance[] = [];
  for (const skin of SKIN_TONES) {
    for (const ears of EARS) {
      for (const eyeStyle of EYE_STYLES) {
        const base: PlayerAppearance = { ...APPEARANCE_PRESETS.Alex, skin, ears, eyeStyle };
        for (const { part, options } of APPEARANCE_PARTS) for (const option of options) looks.push({ ...base, [part]: option.value });
        // Cabelo: cada estilo em cada cor (um arquivo por combinação).
        for (const hair of HAIR_STYLES) for (const hairColor of HAIR_COLORS) looks.push({ ...base, hair, hairColor });
      }
    }
  }
  for (const look of looks) {
    for (const layer of sheetLayers(look, 'idle')) paths.add(layer.path);
    for (const path of portraitLayers(look)) paths.add(path);
  }
  return [...paths];
}

/** Uma textura de canvas `key` do tamanho pedido: reaproveita a que já existe (redesenha por cima, limpa) ou cria. */
function canvasFor(scene: Phaser.Scene, key: string, width: number, height: number): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    if (existing instanceof Phaser.Textures.CanvasTexture && existing.width === width && existing.height === height) {
      existing.getContext().clearRect(0, 0, width, height);
      return existing;
    }
    scene.textures.remove(key);
  }
  return scene.textures.createCanvas(key, width, height);
}

function sourceOf(scene: Phaser.Scene, path: string): CanvasImageSource | null {
  const key = layerKey(path);
  return scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as CanvasImageSource) : null;
}

/**
 * Empilha a folha `id` da aparência `look` (as camadas já carregadas) na textura `key` (padrão: a chave da aparência), no formato das
 * folhas prontas. Devolve `false` se falta camada (a folha não é criada).
 */
export function composeCharacterSheet(scene: Phaser.Scene, look: PlayerAppearance, id: CharacterSheetId, key = characterSheetKey(look, id)): boolean {
  const sheet = CHARACTER_SHEETS[id];
  const layers = sheetLayers(look, id).map((layer) => ({ ...layer, source: sourceOf(scene, layer.path) }));
  const missing = layers.filter((layer) => !layer.source);
  if (missing.length > 0) {
    console.warn(`Personagem "${id}": faltam ${missing.length} camada(s) — ${missing.map((layer) => layer.path).join(', ')}`);
    return false;
  }
  const n = sheet.framesPerDirection;
  const cell = sheet.cellSize;
  const columns = n > 1 ? n : 3;
  const rows = n > 1 ? 3 : 1;
  const canvas = canvasFor(scene, key, columns * cell, rows * cell);
  if (!canvas) return false;
  const context = canvas.getContext();
  const bodyOffset = cell === 64 ? BODY_OFFSET_IN_64 : 0;
  // Quadro k da folha final = quadro k da folha em camadas (lá a ordem é baixo, cima, DIREITA, esquerda — o "lado" das prontas é a direita).
  for (let k = 0; k < 3 * n; k++) {
    const dx = (k % columns) * cell;
    const dy = Math.floor(k / columns) * cell;
    for (const layer of layers) {
      const offset = layer.cell === cell ? 0 : bodyOffset;
      context.drawImage(layer.source!, k * layer.cell, 0, layer.cell, layer.cell, dx + offset, dy + offset, layer.cell, layer.cell);
    }
  }
  canvas.refresh();
  for (let index = 0; index < columns * rows; index++) {
    if (!canvas.has(String(index))) canvas.add(index, 0, (index % columns) * cell, Math.floor(index / columns) * cell, cell, cell);
  }
  return true;
}

/** Empilha o retrato da aparência (320x192, o rosto neutro no 1º quadro). */
export function composeCharacterPortrait(scene: Phaser.Scene, look: PlayerAppearance, key = characterPortraitKey(look)): boolean {
  const sources = portraitLayers(look).map((path) => sourceOf(scene, path));
  if (sources.some((source) => !source)) return false;
  const canvas = canvasFor(scene, key, PORTRAIT_SHEET_SIZE.width, PORTRAIT_SHEET_SIZE.height);
  if (!canvas) return false;
  const context = canvas.getContext();
  for (const source of sources) context.drawImage(source!, 0, 0);
  canvas.refresh();
  return true;
}
