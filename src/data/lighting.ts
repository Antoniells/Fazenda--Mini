/**
 * Dados do ciclo de luz do dia e das fontes de luz (postes, tochas). Só descreve valores e onde estão os assets — a lógica fica em
 * `systems/ambientLight.ts` (cor do sol por hora) e `systems/lightSources.ts` (postes/tochas).
 */

/** Cor da luz ambiente numa hora do dia. O véu (`systems/dayNightOverlay.ts`) MULTIPLICA a cena por ela: branco = sem efeito. */
export interface AmbientKeyframe {
  hour: number;
  color: number;
}

const NIGHT_COLOR = 0x46507f;

/**
 * Chaves do sol ao longo das 24h (a cor entre duas chaves é interpolada; a primeira e a última repetem a noite pra virar o dia
 * sem salto): noite escura azulada → amanhecer (o jogador acorda às 06:00 com o dia clareando: azul-acinzentado escuro que vai
 * esquentando e clareando até o neutro, sem laranja) → tarde neutra → fim de tarde âmbar → entardecer alaranjado → crepúsculo roxo
 * → noite.
 */
export const AMBIENT_KEYFRAMES: AmbientKeyframe[] = [
  { hour: 0, color: NIGHT_COLOR },
  { hour: 5, color: NIGHT_COLOR },
  { hour: 5.5, color: 0x6a719f },
  { hour: 6, color: 0x8b91b8 },
  { hour: 7, color: 0xb3adb8 },
  { hour: 8.5, color: 0xe6dccb },
  { hour: 10, color: 0xfff8ec },
  { hour: 12, color: 0xffffff },
  { hour: 15, color: 0xffffff },
  { hour: 16.5, color: 0xffefd6 },
  { hour: 17.5, color: 0xffd0a0 },
  { hour: 18.5, color: 0xf8a878 },
  { hour: 19.5, color: 0x8a6f9f },
  { hour: 21, color: NIGHT_COLOR },
  { hour: 24, color: NIGHT_COLOR },
];

/**
 * Janelas (horas) em que as fontes de luz acendem e apagam — rampa de 0 a 1: acendem ao anoitecer (17:30-18:30, quando o céu já
 * está alaranjado) e apagam ao amanhecer (05:30-06:30, com o sol nascendo).
 */
export const LIGHTS_ON_START_HOUR = 17.5;
export const LIGHTS_ON_END_HOUR = 18.5;
export const LIGHTS_OFF_START_HOUR = 5.5;
export const LIGHTS_OFF_END_HOUR = 6.5;

/** Tipos de fonte de luz. */
export type LightSourceType = 'lampPost' | 'torch';

export interface LightSourceDefinition {
  /** Onde a fonte fica (px nativos, relativos à BASE dela: x = centro, y = pé) e o quanto o brilho sobe do chão. */
  glowOffsetY: number;
  /** Raio (em células) do brilho externo; os anéis de dentro são frações dele. */
  glowRadiusCells: number;
  /** Cor do brilho (somado à cena por cima da escuridão). */
  glowColor: number;
  /** Opacidade do brilho no centro, com o anel de dentro somando aos de fora. */
  glowAlpha: number;
  /** Oscilação rápida da chama: fração da opacidade que varia (0 = luz firme). */
  flicker: number;
  /** "Respiração" da luz: ciclo lento (ms) em que o brilho aumenta e diminui; a opacidade oscila em `breatheAlpha` (fração) e o tamanho em `breatheScale`. */
  breatheMs: number;
  breatheAlpha: number;
  breatheScale: number;
}

export const LIGHT_SOURCES: Record<LightSourceType, LightSourceDefinition> = {
  lampPost: { glowOffsetY: -22, glowRadiusCells: 4.5, glowColor: 0xffe066, glowAlpha: 0.22, flicker: 0.03, breatheMs: 6500, breatheAlpha: 0.4, breatheScale: 0.1 },
  torch: { glowOffsetY: -22, glowRadiusCells: 3.2, glowColor: 0xff9a4a, glowAlpha: 0.26, flicker: 0.14, breatheMs: 5000, breatheAlpha: 0.15, breatheScale: 0.05 },
};

/**
 * `Objects/Exterior/Exterior.png` (512x176): o poste de madeira dos letreiros (linha de cima) sem a placa — recorte só da haste
 * (6x16, abaixo de onde a placa se prende, pixel a pixel). O lampião fica em cima dela (`LAMP_LANTERN_*`).
 */
export const LAMP_POLE_KEY = 'light-lamp-pole';
export const LAMP_POLE_PATH = 'Objects/Exterior/Exterior.png';
export const LAMP_POLE_FRAME = { name: 'light-lamp-pole-frame', rect: { x: 316, y: 14, width: 6, height: 16 } };

/**
 * `Objects/Exterior/Mine and Dungeon/Lamp .png` (48x16): 3 quadros de 16x16 de um lampião de ferro com o vidro aceso (a chama
 * oscila entre eles). Apagado é o mesmo quadro escurecido (`LAMP_OFF_TINT`).
 */
export const LAMP_LANTERN_KEY = 'light-lamp-lantern';
export const LAMP_LANTERN_PATH = 'Objects/Exterior/Mine and Dungeon/Lamp .png';
export const LAMP_LANTERN_FRAME_SIZE = 16;
export const LAMP_LIT_FRAMES = [0, 1, 2];
export const LAMP_FRAME_MS = 180;
export const LAMP_OFF_TINT = 0x5c6070;
/** Opacidade da cópia "brilhante" (ADD, por cima da escuridão) do lampião/tocha aceso: o vidro e a chama ficam iluminados mesmo no escuro. */
export const EMISSIVE_ALPHA = 0.85;
/** Quanto o fundo do lampião (px nativos) sobe em relação ao pé do poste: o vidro (linha 13 do quadro) encosta no topo da haste (16 px). */
export const LAMP_LANTERN_BOTTOM_Y = -12;

/**
 * `Objects/Exterior/Mine and Dungeon/Fire light.png` (144x48): tocha (vaso de ferro) em quadros de 16x48 — 0 e 7 apagada, 1-6 a
 * chama em loop (o 8º é só a mancha do vaso, não usado). A base do vaso fica ~4 px acima da borda de baixo do quadro.
 */
export const TORCH_KEY = 'light-torch';
export const TORCH_PATH = 'Objects/Exterior/Mine and Dungeon/Fire light.png';
export const TORCH_FRAME_WIDTH = 16;
export const TORCH_FRAME_HEIGHT = 48;
export const TORCH_OFF_FRAME = 0;
export const TORCH_LIT_FRAMES = [1, 2, 3, 4, 5, 6];
export const TORCH_FRAME_MS = 110;
/** Origem Y (0-1) do quadro da tocha: o pé do vaso (44/48) fica no ponto de colocação. */
export const TORCH_ORIGIN_Y = 44 / 48;

/** Uma fonte de luz colocada no mapa (célula onde ela está: a base ocupa a célula e bloqueia a passagem). */
export interface LightSourcePlacement {
  type: LightSourceType;
  col: number;
  row: number;
}

/** Os dois postes do Vilarejo: um de cada lado da avenida norte, na entrada da praça (a avenida ocupa as colunas 14-15). */
export const VILLAGE_LIGHT_SOURCES: LightSourcePlacement[] = [
  { type: 'lampPost', col: 13, row: 9 },
  { type: 'lampPost', col: 16, row: 9 },
];

/**
 * CAVERNAS EM PENUMBRA (`systems/caveLighting.ts`, pedido explícito: escuras, mas não breu): o véu (MULTIPLY) vai do tom do 1º andar ao
 * do último, e o personagem leva um halo quente que abre a escuridão em volta. As escadas brilham de leve: a de subida com a luz que
 * vem de cima, a de descida num azul frio — dá pra achá-las de longe. O santuário não tem véu.
 */
export const CAVE_PENUMBRA_TOP = 0xa8a4b8;
export const CAVE_PENUMBRA_BOTTOM = 0x67637f;
export const CAVE_PLAYER_LIGHT = { radiusCells: 3.5, color: 0xffcf8f, alpha: 0.13, flicker: 0.08, offsetY: -16 };
export const CAVE_STAIRS_UP_LIGHT = { radiusCells: 1.6, color: 0xfff0c4, alpha: 0.32 };
export const CAVE_STAIRS_DOWN_LIGHT = { radiusCells: 1.4, color: 0x9cc0ff, alpha: 0.24 };
