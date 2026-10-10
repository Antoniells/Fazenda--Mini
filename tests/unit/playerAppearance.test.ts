import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import {
  APPEARANCE_PARTS,
  APPEARANCE_PRESETS,
  CHARACTER_SHEETS,
  CharacterSheetId,
  EARS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  PlayerAppearance,
  SKIN_TONES,
  bodyLayers,
  layerPath,
  portraitLayers,
  sanitizeAppearance,
} from '../../src/data/playerAppearance';
import { getFishingSheets, getPlayerAssets } from '../../src/data/player';
import { creationLayerPaths } from '../../src/systems/characterComposer';
import { gameState } from '../../src/systems/gameState';
import { getSlotSummary, load, save } from '../../src/systems/saveManager';

const assetExists = (path: string): boolean => existsSync(resolve(__dirname, '../../assets', path));

/** Toda escolha de cada peça, sobre bases que cruzam pele × orelha × traço, e cabelo estilo × cor. */
function everyLook(): PlayerAppearance[] {
  const looks: PlayerAppearance[] = [];
  for (const skin of SKIN_TONES) {
    for (const ears of EARS) {
      for (const eyeStyle of EYE_STYLES) {
        const base = { ...APPEARANCE_PRESETS.Alex, skin, ears, eyeStyle };
        for (const { part, options } of APPEARANCE_PARTS) for (const option of options) looks.push({ ...base, [part]: option.value } as PlayerAppearance);
        for (const hair of HAIR_STYLES) for (const hairColor of HAIR_COLORS) looks.push({ ...base, hair, hairColor });
      }
    }
  }
  return looks;
}

/** Quantas camadas de corpo a aparência pede (pele, olhos, roupa, cabelo + os opcionais). */
const expectedBodyLayers = (look: PlayerAppearance): number => 4 + (look.accessory !== 'none' ? 1 : 0) + (look.ears === 'elf' ? 1 : 0) + (look.beard !== 'none' ? 1 : 0);

describe('personalização do personagem', () => {
  beforeEach(freshGame);

  // Lê dezenas de PNGs do disco: com a máquina ocupada passava dos 5 s padrão do Vitest.
  it('toda escolha existe em TODAS as folhas do jogo (nenhuma peça some numa ação)', { timeout: 20_000 }, () => {
    const looks = everyLook();
    for (const id of Object.keys(CHARACTER_SHEETS) as CharacterSheetId[]) {
      const sheet = CHARACTER_SHEETS[id];
      if (sheet.tool) expect(layerPath(sheet.folder, sheet.tool), `${id}: ferramenta`).not.toBeNull();
      for (const look of looks) expect(bodyLayers(sheet, look).length, `${id}: ${JSON.stringify(look)}`).toBe(expectedBodyLayers(look));
    }
  });

  it('o retrato tem todas as peças de toda escolha, e os arquivos existem', () => {
    const files = new Set<string>(); // Cada arquivo conferido uma vez só (as aparências repetem camadas).
    for (const look of everyLook()) {
      const layers = portraitLayers(look);
      expect(layers.length).toBe(4 + 1 + (look.beard !== 'none' ? 1 : 0) + (look.accessory !== 'none' ? 1 : 0));
      for (const layer of layers) files.add(layer);
    }
    for (const file of files) expect(assetExists(file), file).toBe(true);
  });

  // Idem: lê as imagens de cada escolha.
  it('a Criação de Personagem carrega antes tudo o que qualquer escolha pede', { timeout: 20_000 }, () => {
    const preloaded = new Set(creationLayerPaths());
    for (const look of everyLook()) {
      for (const path of [...bodyLayers(CHARACTER_SHEETS.idle, look), ...portraitLayers(look)]) expect(preloaded.has(path), path).toBe(true);
    }
  });

  it('o personagem montado usa os MESMOS quadros das folhas prontas, em texturas próprias', () => {
    const look = { ...APPEARANCE_PRESETS.Tori, accessory: 'wizard' as const };
    const ready = getPlayerAssets('Tori');
    const composed = getPlayerAssets({ characterId: 'Tori', appearance: look });
    expect(composed.composed).toEqual(look);
    expect(composed.idleKey).not.toBe(ready.idleKey);
    for (const action of Object.keys(ready.actions) as Array<keyof typeof ready.actions>) {
      const { key: _readyKey, path: _readyPath, ...readyFrames } = ready.actions[action];
      const { key, path: _path, ...composedFrames } = composed.actions[action];
      expect(composedFrames).toEqual(readyFrames);
      expect(key).not.toBe(ready.actions[action].key);
    }
    const fishing = getFishingSheets({ characterId: 'Tori', appearance: look });
    expect(Object.values(fishing).every((sheet) => !sheet.rowOffsets)).toBe(true);
  });

  it('a aparência vai pro save e volta; peça inválida cai na do modelo', () => {
    gameState.profile.appearance = { ...APPEARANCE_PRESETS.Manu, beard: 'ginger', ears: 'elf' };
    save(0);
    gameState.profile.appearance = undefined;
    expect(load(0)).toBe(true);
    expect(gameState.profile.appearance).toEqual({ ...APPEARANCE_PRESETS.Manu, beard: 'ginger', ears: 'elf' });
    expect(getSlotSummary(0).appearance?.ears).toBe('elf');
    expect(sanitizeAppearance({ skin: '9', hair: 'josh', accessory: 'beret' })).toEqual({ ...APPEARANCE_PRESETS.Alex, hair: 'josh' });
  });

  it('save de antes da personalização continua com o personagem pronto', () => {
    gameState.profile.appearance = undefined;
    save(0);
    expect(load(0)).toBe(true);
    expect(gameState.profile.appearance).toBeUndefined();
    expect(getPlayerAssets(gameState.profile).composed).toBeUndefined();
  });
});
