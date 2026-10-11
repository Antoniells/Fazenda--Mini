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
  /** Onde a fonte fica (px nativos, relativos à BASE dela: x = centro, y = pé) e o quanto a luz sobe do chão. */
  glowOffsetY: number;
  /** Raio (em células) da luz (iluminação nativa do Phaser 4 — `systems/lightSources.ts`). */
  glowRadiusCells: number;
  /** Cor da luz. */
  glowColor: number;
  /** Intensidade da luz acesa (multiplicador do Phaser: soma à luz ambiente na cor de quem ela toca). */
  lightIntensity: number;
  /** Oscilação rápida da chama: fração da opacidade que varia (0 = luz firme). */
  flicker: number;
  /** "Respiração" da luz: ciclo lento (ms) em que o brilho aumenta e diminui; a opacidade oscila em `breatheAlpha` (fração) e o tamanho em `breatheScale`. */
  breatheMs: number;
  breatheAlpha: number;
  breatheScale: number;
}

export const LIGHT_SOURCES: Record<LightSourceType, LightSourceDefinition> = {
  lampPost: { glowOffsetY: -30, glowRadiusCells: 4.5, glowColor: 0xffdcaa, lightIntensity: 1.6, flicker: 0.03, breatheMs: 6500, breatheAlpha: 0.4, breatheScale: 0.1 },
  torch: { glowOffsetY: -22, glowRadiusCells: 3.2, glowColor: 0xffb070, lightIntensity: 1.4, flicker: 0.14, breatheMs: 5000, breatheAlpha: 0.15, breatheScale: 0.05 },
};

/**
 * O POSTE DE RUA (`Objects/Exterior/Street Lamp.png`, 64x48): dois quadros de 32x48 do mesmo poste de ferro de dois braços — o 0
 * apagado (vidros cinza) e o 1 aceso (vidros amarelos). O desenho ocupa 25x37 a partir de (4, 1) em cada quadro: o pé fica na linha 37.
 */
export const STREET_LAMP_KEY = 'light-street-lamp';
export const STREET_LAMP_PATH = 'Objects/Exterior/Street Lamp.png';
export const STREET_LAMP_FRAME_WIDTH = 32;
export const STREET_LAMP_FRAME_HEIGHT = 48;
export const STREET_LAMP_OFF_FRAME = 0;
export const STREET_LAMP_LIT_FRAMES = [1];
/** Origem Y (0-1) do quadro: o pé do poste (linha 37 de 48) fica no ponto de colocação. */
export const STREET_LAMP_ORIGIN_Y = 38 / 48;
/** Opacidade da cópia "brilhante" (ADD, por cima da escuridão) do poste/tocha aceso: os vidros e a chama ficam iluminados mesmo no escuro. */
export const EMISSIVE_ALPHA = 0.85;

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
  { type: 'lampPost', col: 13, row: 10 },
  { type: 'lampPost', col: 16, row: 10 },
];

/**
 * CAVERNAS — ILUMINAÇÃO NATIVA DO PHASER 4 (`systems/caveLighting.ts`; estudo em docs/studies/ILUMINACAO_PHASER4.md): a cor de tudo é
 * multiplicada pela luz AMBIENTE (mais escura a cada andar — penumbra, não breu) somada às luzes de verdade: a quente que segue o
 * personagem e as das escadas (a de subida com a luz que vem de cima, a de descida num azul frio). Raio e intensidade em px de tela /
 * multiplicador do Phaser. O santuário não tem essa luz (fica claro).
 */
export const CAVE_AMBIENT_TOP = 0x5e5a74;
export const CAVE_AMBIENT_BOTTOM = 0x2c283e;
export const CAVE_PLAYER_LIGHT = { radius: 230, color: 0xffd9a0, intensity: 1.6, flicker: 0.06, offsetY: -16 };
export const CAVE_STAIRS_UP_LIGHT = { radius: 110, color: 0xfff0c4, intensity: 1.2 };
export const CAVE_STAIRS_DOWN_LIGHT = { radius: 100, color: 0x9cc0ff, intensity: 1.2 };
