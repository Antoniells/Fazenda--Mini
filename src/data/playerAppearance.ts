import type { CharacterId } from './player';
import { CHARACTER_LAYER_FILES } from './characterLayers.generated';

/**
 * APARÊNCIA DO PERSONAGEM (personalização — ideia do stardew.me): o personagem é montado das camadas do pacote
 * (`Character/Character/PNG/<ação>/...`: pele, olhos, roupa, cabelo, acessórios e a ferramenta, nessa ordem — a do Aseprite que vem com
 * elas) em TODAS as folhas que o jogo usa, e o retrato sai das camadas de `Character/Character/Portrait/PNG` com as mesmas peças. Só
 * DADOS: quais peças existem, os nomes mostrados, os modelos prontos e, pra cada folha, a lista de camadas — quem empilha é
 * `systems/characterComposer.ts`. Os nomes reais dos arquivos vêm de `characterLayers.generated.ts` (gerado por
 * `tools/scan-character-layers.mjs`).
 */

export const SKIN_TONES = ['1', '2', '3', '4'] as const;
export const EYE_COLORS = ['black', 'blue', 'brown', 'green'] as const;
/** Traço dos olhos (os cílios): o "feminino" também escolhe o rosto e a roupa femininos do retrato. */
export const EYE_STYLES = ['male', 'female'] as const;
export const HAIR_STYLES = ['standard', 'josh', 'sebastian', 'fawn', 'iridessa', 'lyria', 'silvermist'] as const;
export const HAIR_COLORS = ['black', 'brown', 'blonde', 'ginger'] as const;
export const CLOTHES_COLORS = ['blue', 'green', 'pink', 'purple', 'red'] as const;
export const BEARDS = ['none', 'black', 'brown', 'blonde', 'ginger'] as const;
export const EARS = ['human', 'elf'] as const;
/** Acessórios de cabeça (um por vez). A boina fica de fora: falta na folha de regar (sumiria ao regar). */
export const ACCESSORIES = [
  'none',
  'farm',
  'cook',
  'wizard',
  'pirate',
  'pirate-eyepatch',
  'santa-hat',
  'leprechaun',
  'cow',
  'chicken',
  'frog',
  'deer',
  'butterfly/red',
  'butterfly/pink',
  'butterfly/purple',
  'butterfly/blue',
  'butterfly/green',
] as const;

export interface PlayerAppearance {
  skin: (typeof SKIN_TONES)[number];
  eyes: (typeof EYE_COLORS)[number];
  eyeStyle: (typeof EYE_STYLES)[number];
  hair: (typeof HAIR_STYLES)[number];
  hairColor: (typeof HAIR_COLORS)[number];
  clothes: (typeof CLOTHES_COLORS)[number];
  beard: (typeof BEARDS)[number];
  ears: (typeof EARS)[number];
  accessory: (typeof ACCESSORIES)[number];
}

export type AppearancePart = keyof PlayerAppearance;

/** As escolhas de cada peça, com o nome mostrado na Criação de Personagem (na ordem das linhas da tela). */
export const APPEARANCE_PARTS: Array<{ part: AppearancePart; label: string; options: Array<{ value: string; name: string }> }> = [
  { part: 'skin', label: 'Pele', options: SKIN_TONES.map((value) => ({ value, name: `Tom ${value}` })) },
  { part: 'hair', label: 'Cabelo', options: HAIR_STYLES.map((value, index) => ({ value, name: `Estilo ${index + 1}` })) },
  {
    part: 'hairColor',
    label: 'Cor do cabelo',
    options: [
      { value: 'black', name: 'Preto' },
      { value: 'brown', name: 'Castanho' },
      { value: 'blonde', name: 'Loiro' },
      { value: 'ginger', name: 'Ruivo' },
    ],
  },
  {
    part: 'eyes',
    label: 'Olhos',
    options: [
      { value: 'black', name: 'Pretos' },
      { value: 'blue', name: 'Azuis' },
      { value: 'brown', name: 'Castanhos' },
      { value: 'green', name: 'Verdes' },
    ],
  },
  {
    part: 'eyeStyle',
    label: 'Rosto',
    options: [
      { value: 'male', name: 'Traço 1' },
      { value: 'female', name: 'Traço 2 (cílios)' },
    ],
  },
  {
    part: 'clothes',
    label: 'Roupa',
    options: [
      { value: 'blue', name: 'Jardineira azul' },
      { value: 'green', name: 'Jardineira verde' },
      { value: 'pink', name: 'Jardineira rosa' },
      { value: 'purple', name: 'Jardineira roxa' },
      { value: 'red', name: 'Jardineira vermelha' },
    ],
  },
  {
    part: 'beard',
    label: 'Barba',
    options: [
      { value: 'none', name: 'Sem barba' },
      { value: 'black', name: 'Preta' },
      { value: 'brown', name: 'Castanha' },
      { value: 'blonde', name: 'Loira' },
      { value: 'ginger', name: 'Ruiva' },
    ],
  },
  {
    part: 'ears',
    label: 'Orelhas',
    options: [
      { value: 'human', name: 'Humanas' },
      { value: 'elf', name: 'Élficas' },
    ],
  },
  {
    part: 'accessory',
    label: 'Acessório',
    options: [
      { value: 'none', name: 'Nenhum' },
      { value: 'farm', name: 'Chapéu de palha' },
      { value: 'cook', name: 'Chapéu de cozinheiro' },
      { value: 'wizard', name: 'Chapéu de mago' },
      { value: 'pirate', name: 'Chapéu de pirata' },
      { value: 'pirate-eyepatch', name: 'Tapa-olho' },
      { value: 'santa-hat', name: 'Gorro de Natal' },
      { value: 'leprechaun', name: 'Cartola verde' },
      { value: 'cow', name: 'Gorro de vaquinha' },
      { value: 'chicken', name: 'Gorro de galinha' },
      { value: 'frog', name: 'Gorro de sapo' },
      { value: 'deer', name: 'Gorro de cervo' },
      { value: 'butterfly/red', name: 'Laço vermelho' },
      { value: 'butterfly/pink', name: 'Laço rosa' },
      { value: 'butterfly/purple', name: 'Laço roxo' },
      { value: 'butterfly/blue', name: 'Laço azul' },
      { value: 'butterfly/green', name: 'Laço verde' },
    ],
  },
];

/** Os 5 personagens prontos viram MODELOS: as peças mais parecidas com cada um (o jogador ajusta a partir daí). */
export const APPEARANCE_PRESETS: Record<CharacterId, PlayerAppearance> = {
  Alex: { skin: '1', eyes: 'blue', eyeStyle: 'male', hair: 'sebastian', hairColor: 'blonde', clothes: 'blue', beard: 'none', ears: 'human', accessory: 'none' },
  Josh: { skin: '1', eyes: 'blue', eyeStyle: 'male', hair: 'josh', hairColor: 'black', clothes: 'blue', beard: 'none', ears: 'human', accessory: 'none' },
  Lyria: { skin: '1', eyes: 'brown', eyeStyle: 'female', hair: 'lyria', hairColor: 'brown', clothes: 'red', beard: 'none', ears: 'human', accessory: 'none' },
  Manu: { skin: '3', eyes: 'black', eyeStyle: 'female', hair: 'standard', hairColor: 'black', clothes: 'pink', beard: 'none', ears: 'human', accessory: 'cow' },
  Tori: { skin: '1', eyes: 'green', eyeStyle: 'female', hair: 'silvermist', hairColor: 'ginger', clothes: 'purple', beard: 'none', ears: 'human', accessory: 'none' },
};

/** A aparência lida de um save (ou de onde for) com cada peça conferida — peça desconhecida vira a do modelo `fallback`. */
export function sanitizeAppearance(raw: unknown, fallback: PlayerAppearance = APPEARANCE_PRESETS.Alex): PlayerAppearance {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result = { ...fallback };
  for (const { part, options } of APPEARANCE_PARTS) {
    const value = source[part];
    if (typeof value === 'string' && options.some((option) => option.value === value)) (result as Record<string, string>)[part] = value;
  }
  return result;
}

/** Uma assinatura curta e estável da aparência (vai nas chaves das texturas montadas: mesma aparência = mesma textura). */
export function appearanceSignature(look: PlayerAppearance): string {
  return APPEARANCE_PARTS.map(({ part }) => look[part]).join('.').replace(/[^a-z0-9.]/g, '_');
}

// --- As folhas ---------------------------------------------------------------------------------------------------------------------

const PNG = 'Character/Character/PNG';
const PORTRAIT = 'Character/Character/Portrait/PNG';

/** Variação da ferramenta (o pacote traz 10 cores de cada): a 3ª é a de metal, a mesma dos personagens prontos. */
export const TOOL_VARIANT = 3;

/** As folhas do personagem que o jogo usa (as mesmas de `data/player.ts`). */
export type CharacterSheetId = 'idle' | 'walk' | 'hoe' | 'plant' | 'water' | 'harvest' | 'axe' | 'pickaxe' | 'sword' | 'well' | 'eat' | 'fish-cast' | 'fish-wait' | 'fish-hooked' | 'fish-reel' | 'fish-catch' | 'fish-miss';

export interface CharacterSheetDef {
  folder: string;
  /** Quadros por direção (a folha em camadas tem as 4 direções numa linha só: baixo, cima, direita, esquerda). */
  framesPerDirection: number;
  /** Tamanho do quadro na folha final: 64 quando a pré-pronta usa quadro de 64 (o corpo de 32 vai no meio, `BODY_OFFSET_IN_64`). */
  cellSize: 32 | 64;
  /** Ferramenta (por cima de tudo), id da peça na pasta. */
  tool?: string;
  /** A ferramenta já vem em quadros de 64 (a vara de pescar). */
  toolCell?: 64;
  /** Camadas extras por cima (efeitos da pasta: o peixe fisgado, o suor). */
  extras?: Array<{ id: string; cell: 32 | 64 }>;
}

/** Onde o corpo (quadro de 32) fica dentro de um quadro de 64 — conferido nas posições das camadas do Aseprite da pesca: (16, 16). */
export const BODY_OFFSET_IN_64 = 16;

export const CHARACTER_SHEETS: Record<CharacterSheetId, CharacterSheetDef> = {
  idle: { folder: `${PNG}/1. Idle`, framesPerDirection: 4, cellSize: 32 },
  walk: { folder: `${PNG}/2. Walk`, framesPerDirection: 6, cellSize: 32 },
  hoe: { folder: `${PNG}/4. Pickaxe, Hoe and Catching insects`, framesPerDirection: 6, cellSize: 32, tool: `weapons/hoe/${TOOL_VARIANT}` },
  pickaxe: { folder: `${PNG}/4. Pickaxe, Hoe and Catching insects`, framesPerDirection: 6, cellSize: 32, tool: `weapons/pickaxe/${TOOL_VARIANT}` },
  axe: { folder: `${PNG}/5. Axe and Sickle`, framesPerDirection: 6, cellSize: 32, tool: `weapons/axe/${TOOL_VARIANT}` },
  harvest: { folder: `${PNG}/5. Axe and Sickle`, framesPerDirection: 6, cellSize: 32, tool: `weapons/sickle/${TOOL_VARIANT}` },
  plant: { folder: `${PNG}/6. Shovel`, framesPerDirection: 5, cellSize: 32, tool: `weapons/shovel/${TOOL_VARIANT}` },
  water: { folder: `${PNG}/7. Watering`, framesPerDirection: 8, cellSize: 32, tool: `weapons/watering/${TOOL_VARIANT}` },
  sword: { folder: `${PNG}/8. SwordAttack`, framesPerDirection: 10, cellSize: 32, tool: `weapons/sword/${TOOL_VARIANT}` },
  well: { folder: `${PNG}/13.3 Carrying - Pick Up`, framesPerDirection: 4, cellSize: 64 },
  eat: { folder: `${PNG}/18. Setting`, framesPerDirection: 1, cellSize: 32 },
  'fish-cast': { folder: `${PNG}/12. Fishing - Cast`, framesPerDirection: 15, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64 },
  'fish-wait': { folder: `${PNG}/12.1. Fishing - Wait`, framesPerDirection: 4, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64 },
  'fish-hooked': { folder: `${PNG}/12.2. Fishing - Bite`, framesPerDirection: 8, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64 },
  'fish-reel': { folder: `${PNG}/12.3. Fishing - Reel`, framesPerDirection: 4, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64, extras: [{ id: 'fx-sweating', cell: 32 }] },
  'fish-catch': { folder: `${PNG}/12.4. Fishing - Catch`, framesPerDirection: 4, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64, extras: [{ id: 'weapons/fish-fx', cell: 64 }] },
  // Não pegou nada: a mesma pose da captura, sem o peixe.
  'fish-miss': { folder: `${PNG}/12.4. Fishing - Catch`, framesPerDirection: 4, cellSize: 64, tool: `weapons/${TOOL_VARIANT}`, toolCell: 64 },
};

/** O caminho (dentro de `assets/`) da peça `id` na pasta, ou `null` se a pasta não tem essa peça. */
export function layerPath(folder: string, id: string): string | null {
  const file = CHARACTER_LAYER_FILES[folder]?.[id];
  return file ? `${folder}/${file}` : null;
}

/** Olhos: a cor escolhida; se a pasta não tem (puxar o peixe só tem os olhos apertados), a 1ª que ela tiver no mesmo traço. */
function eyesPath(folder: string, look: PlayerAppearance): string | null {
  const exact = layerPath(folder, `eyes/${look.eyeStyle}/${look.eyes}`);
  if (exact) return exact;
  const any = Object.keys(CHARACTER_LAYER_FILES[folder] ?? {}).find((id) => id.startsWith(`eyes/${look.eyeStyle}/`));
  return any ? layerPath(folder, any) : null;
}

/** As camadas do CORPO de uma folha (quadros de 32), de baixo pra cima: pele, olhos, roupa, cabelo, acessório, orelha élfica, barba (no Aseprite, a orelha e a barba ficam acima dos chapéus). */
export function bodyLayers(sheet: CharacterSheetDef, look: PlayerAppearance): string[] {
  const { folder } = sheet;
  const ids = [
    `skins/${look.skin}`,
    null, // olhos (com o reserva)
    `clothes/farm/${look.clothes}`,
    `hair/${look.hair}/${look.hairColor}`,
    look.accessory !== 'none' ? `acc/${look.accessory}` : null,
    look.ears === 'elf' ? `acc/elf/${look.skin}` : null,
    look.beard !== 'none' ? `acc/beard/${look.beard}` : null,
  ];
  const paths: string[] = [];
  ids.forEach((id, index) => {
    const path = index === 1 ? eyesPath(folder, look) : id ? layerPath(folder, id) : null;
    if (path) paths.push(path);
  });
  return paths;
}

/** As camadas do RETRATO (folha 320x192), de baixo pra cima — a ordem do Aseprite do retrato: pele, cabelo, olhos, roupa, barba, acessório, orelha. */
export function portraitLayers(look: PlayerAppearance): string[] {
  const body = look.eyeStyle === 'female' ? 'female' : 'male';
  const ids = [
    `skins/${body}/${look.skin}`,
    `hair/${look.hair}/${look.hairColor}`,
    `eyes/${look.eyes}`,
    `clothes/${body}/${look.clothes}`,
    look.beard !== 'none' ? `acc/beard/${look.beard}` : null,
    look.accessory !== 'none' ? `acc/${look.accessory}` : null,
    `skins/ears/${look.ears}/${look.skin}`,
  ];
  return ids.flatMap((id) => {
    const path = id ? layerPath(PORTRAIT, id) : null;
    return path ? [path] : [];
  });
}

/** Chave da textura montada da folha `id` desta aparência (a mesma aparência sempre dá a mesma chave). */
export function characterSheetKey(look: PlayerAppearance, id: CharacterSheetId): string {
  return `pc-${appearanceSignature(look)}-${id}`;
}

/** Chave do retrato montado desta aparência. */
export function characterPortraitKey(look: PlayerAppearance): string {
  return `pc-${appearanceSignature(look)}-portrait`;
}
