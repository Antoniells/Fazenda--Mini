/**
 * Áudio do jogo (efeitos + música de fundo). Só DADOS: nomes de arquivo,
 * volumes e parâmetros de ajuste — quem toca é `systems/soundEffects.ts`
 * (efeitos curtos, via Phaser) e `systems/dayMusic.ts` (música, streaming).
 * Trocar/adicionar um som = colocar o arquivo em `assets/Sounds/...` e
 * registrá-lo aqui; nenhuma lógica muda.
 */

export interface SoundEffectDef {
  /** Chave no cache de áudio do Phaser. */
  key: string;
  /** Caminho a partir de `assets/` (a pasta pública do Vite). */
  path: string;
  /** 0-1. Os WAVs atuais têm pico baixo (0,13-0,24 de 1,0), então tudo toca no volume máximo do arquivo. */
  volume: number;
  /** Segundos pulados no começo do arquivo ao tocar (ver `CLICK_SOUND`). */
  seek?: number;
}

const EFFECTS_DIR = 'Sounds/Effects';

/** Três variações de passo na grama (0,1 s cada, sem silêncio no começo) — uma é sorteada a cada passo, sem repetir a anterior (ver `attachFootstepSounds`). */
export const STEP_GRASS_SOUNDS: SoundEffectDef[] = [
  { key: 'sfx-step-grass-1', path: `${EFFECTS_DIR}/Passos de grama 1.wav`, volume: 1 },
  { key: 'sfx-step-grass-2', path: `${EFFECTS_DIR}/Passos de grama 2.wav`, volume: 1 },
  { key: 'sfx-step-grass-3', path: `${EFFECTS_DIR}/Passos de grama 3.wav`, volume: 1 },
];
/** Farfalhar da copa quando o personagem passa pelas folhas (`systems/treeSway.ts`): os mesmos passos na grama, mais baixos (já carregados). */
export const TREE_RUSTLE_SOUNDS: SoundEffectDef[] = STEP_GRASS_SOUNDS.map((sound) => ({ ...sound, volume: 0.45 }));
export const STEP_BRIDGE_SOUND: SoundEffectDef = { key: 'sfx-step-bridge', path: `${EFFECTS_DIR}/Passos ponte.wav`, volume: 1 };
export const HURT_SOUND: SoundEffectDef = { key: 'sfx-hurt', path: `${EFFECTS_DIR}/Dano.wav`, volume: 1 };
export const PICKUP_SOUND: SoundEffectDef = { key: 'sfx-pickup', path: `${EFFECTS_DIR}/Coletor de itens.wav`, volume: 1 };
/** Golpe de espada acertando um Slime (`EnemyStats.hitSound`, ver `data/enemies.ts`). */
export const SLIME_HIT_SOUND: SoundEffectDef = { key: 'sfx-slime-hit', path: `${EFFECTS_DIR}/Dano Slime.wav`, volume: 1 };
/**
 * Clique de botão de interface. `Clique.mp3` (1,06 s) tem ~0,14 s de silêncio
 * ANTES do estalo (0,14-0,28 s) e ~0,8 s depois — sem `seek` o clique sairia
 * atrasado em relação ao toque. Pico 0,71, bem acima dos demais efeitos
 * (0,13-0,29), então o volume base é baixo pra ele não se sobrepor a tudo.
 */
export const CLICK_SOUND: SoundEffectDef = { key: 'sfx-click', path: `${EFFECTS_DIR}/Clique.mp3`, volume: 0.35, seek: 0.13 };
/**
 * `Regar.mp3` (3,8 s): jato forte logo no começo (pico 0,62 em 0,33 s), um
 * segundo jato mais fraco em ~1,2-1,7 s e cauda. Toca no INÍCIO da animação
 * de regar (não no impacto): o pico do som cai em ~0,33 s, que é justamente
 * o frame de impacto do regador (frame 4 a 10 fps = 0,4 s). Pico alto,
 * volume base menor.
 */
export const WATER_SOUND: SoundEffectDef = { key: 'sfx-water', path: `${EFFECTS_DIR}/Regar.mp3`, volume: 0.5 };
/** `Comer.mp3` (0,63 s, mono): mordidas nos primeiros ~0,3 s, pico 0,94 — volume base baixo. */
export const EAT_SOUND: SoundEffectDef = { key: 'sfx-eat', path: `${EFFECTS_DIR}/Comer.mp3`, volume: 0.4 };
/** `Gastar dinheiro.mp3` (2,3 s): ~0,14 s de silêncio antes das moedas (0,14-1,3 s) — pula o silêncio. Pico 0,44. */
export const SPEND_MONEY_SOUND: SoundEffectDef = { key: 'sfx-spend-money', path: `${EFFECTS_DIR}/Gastar dinheiro.mp3`, volume: 0.5, seek: 0.12 };
/** Duas variações da enxada — uma é sorteada a cada golpe pra não soar repetitivo. */
export const HOE_SOUNDS: SoundEffectDef[] = [
  { key: 'sfx-hoe-1', path: `${EFFECTS_DIR}/Arar.wav`, volume: 1 },
  { key: 'sfx-hoe-2', path: `${EFFECTS_DIR}/Arar 2.wav`, volume: 1 },
];

/**
 * SFX gerados com o motor do sfxr.me (jsfxr) — definições e script em `docs/sfx/` (dá pra reabrir cada uma em https://sfxr.me e
 * ajustar). Impacto (madeira, pedra, minério/metal, quebra de objeto) e ações que antes não tinham áudio. Já normalizados (pico 0,3-0,5).
 */
const sfx = (key: string, file: string, volume = 1): SoundEffectDef => ({ key: `sfx-${key}`, path: `${EFFECTS_DIR}/${file}.wav`, volume });
/** Golpe na árvore (e na cerca): duas variações, sorteadas a cada batida. */
export const AXE_HIT_SOUNDS: SoundEffectDef[] = [
  { key: 'sfx-axe-hit-1', path: `${EFFECTS_DIR}/Impacto madeira 1.mp3`, volume: 0.9 },
  { key: 'sfx-axe-hit-2', path: `${EFFECTS_DIR}/Impacto madeira 2.wav`, volume: 0.9 },
];
/** Último golpe: a árvore cai. */
export const TREE_FALL_SOUND: SoundEffectDef = { key: 'sfx-tree-fall', path: `${EFFECTS_DIR}/Arvore caindo.mp3`, volume: 0.9 };
/** Golpe da picareta na pedra: duas variações, sorteadas a cada batida. */
export const ROCK_HIT_SOUNDS: SoundEffectDef[] = [
  { key: 'sfx-rock-hit-1', path: `${EFFECTS_DIR}/Impacto da pedra 1.mp3`, volume: 0.9 },
  { key: 'sfx-rock-hit-2', path: `${EFFECTS_DIR}/Impacto da pedra 2.mp3`, volume: 0.9 },
];
/** Vozes do pet (bem baixinhas): o gato mia, o cachorro late — no carinho, ao morder e de vez em quando sozinhos. */
export const PET_CAT_SOUNDS: SoundEffectDef[] = [1, 2, 3].map((n) => ({ key: `sfx-cat-${n}`, path: `${EFFECTS_DIR}/Gato ${n}.mp3`, volume: 0.12 }));
export const PET_DOG_SOUNDS: SoundEffectDef[] = [1, 2].map((n) => ({ key: `sfx-dog-${n}`, path: `${EFFECTS_DIR}/Cachorro ${n}.mp3`, volume: 0.12 }));
/** Último golpe: a pedra quebra. */
export const ROCK_BREAK_SOUND: SoundEffectDef = { key: 'sfx-rock-break', path: `${EFFECTS_DIR}/Pedra quebrada.mp3`, volume: 0.9 };
/** Tinido de metal (sorteia 1 de 2): hoje só o do aspersor ao ser posicionado. */
export const ORE_HIT_SOUNDS: SoundEffectDef[] = [sfx('ore-hit-1', 'Picareta minerio 1', 0.9), sfx('ore-hit-2', 'Picareta minerio 2', 0.9)];
/** Móvel/aspersor/cerca destruídos (madeira e peças soltas) e a marretada do conserto. */
export const OBJECT_BREAK_SOUND = sfx('object-break', 'Objeto quebrando');
export const HAMMER_SOUND = sfx('hammer', 'Martelo');
export const SWORD_SWING_SOUND = sfx('sword-swing', 'Espada golpe');
/** Som da Foice (cortar o mato, limpar plantação morta): por enquanto o mesmo da espada — quando a foice ganhar um som próprio, é só trocar aqui. */
export const SICKLE_SOUND = SWORD_SWING_SOUND;
export const PLANT_SOUND = sfx('plant', 'Plantar');
export const HARVEST_SOUND = sfx('harvest', 'Colher');
/** Posicionar uma decoração, um móvel ou uma muda. */
export const PLACE_SOUND = sfx('place', 'Posicionar objeto');
/** Porta abrindo: toda vez que alguém passa por uma porta (a casa do jogador, e os moradores do Vilarejo quando entram/saem perto dele). */
export const DOOR_SOUND: SoundEffectDef = { key: 'sfx-door-open', path: `${EFFECTS_DIR}/Porta abrindo.wav`, volume: 0.6 };
/** Batida na porta: o aviso de que alguém chegou (a caixa do pet, na manhã depois do 3º sono). */
export const DOOR_KNOCK_SOUND: SoundEffectDef = { key: 'sfx-door-knock', path: `${EFFECTS_DIR}/Batida na porta.wav`, volume: 0.8 };
export const SLEEP_SOUND = sfx('sleep', 'Dormir', 0.8);
export const CHEST_SOUND = sfx('chest', 'Bau abrindo');
export const CRAFT_SOUND = sfx('craft', 'Fabricar');
export const SELL_SOUND = sfx('sell', 'Vender');
/** Ponte/expansão desbloqueada. */
export const UNLOCK_SOUND = sfx('unlock', 'Desbloquear');
export const ENEMY_DEFEATED_SOUND = sfx('enemy-defeated', 'Inimigo derrotado');
export const HORDE_ALERT_SOUND = sfx('horde-alert', 'Alerta horda', 0.7);
export const VICTORY_SOUND = sfx('victory', 'Vitoria', 0.8);
/** Canto do galo: uma vez por dia, bem baixinho, ao amanhecer (`ROOSTER_HOURS`, ver `MainScene.playRoosterMorning`). */
export const ROOSTER_SOUND: SoundEffectDef = { key: 'sfx-rooster', path: `${EFFECTS_DIR}/Galo.wav`, volume: 0.12 };
/** Janela (horas do `GameClock`) em que o canto do galo pode tocar — mesmo início do dia usado pela música (`MUSIC_DAY_START_HOUR`), só até um pouco depois pra não perder o instante se o frame atrasar. */
export const ROOSTER_HOURS = { from: 6, to: 6.5 };

/** Tudo que o `preloadSoundEffects` carrega (uma vez, no boot — são poucos KB). */
export const ALL_SOUND_EFFECTS: SoundEffectDef[] = [
  ...STEP_GRASS_SOUNDS,
  STEP_BRIDGE_SOUND,
  HURT_SOUND,
  PICKUP_SOUND,
  SLIME_HIT_SOUND,
  CLICK_SOUND,
  WATER_SOUND,
  EAT_SOUND,
  SPEND_MONEY_SOUND,
  ...HOE_SOUNDS,
  ...AXE_HIT_SOUNDS,
  ...PET_CAT_SOUNDS,
  ...PET_DOG_SOUNDS,
  TREE_FALL_SOUND,
  ...ROCK_HIT_SOUNDS,
  ROCK_BREAK_SOUND,
  ...ORE_HIT_SOUNDS,
  OBJECT_BREAK_SOUND,
  HAMMER_SOUND,
  SWORD_SWING_SOUND,
  PLANT_SOUND,
  HARVEST_SOUND,
  PLACE_SOUND,
  DOOR_SOUND,
  DOOR_KNOCK_SOUND,
  SLEEP_SOUND,
  CHEST_SOUND,
  CRAFT_SOUND,
  SELL_SOUND,
  UNLOCK_SOUND,
  ENEMY_DEFEATED_SOUND,
  HORDE_ALERT_SOUND,
  VICTORY_SOUND,
  ROOSTER_SOUND,
];

export interface MusicTrackDef {
  id: string;
  path: string;
}

const MUSIC_DIR = 'Sounds/Music';

/** Abre cada dia (enquanto ainda é manhã, ver `MUSIC_MORNING_UNTIL_HOUR`). */
export const MORNING_TRACK: MusicTrackDef = { id: 'morning', path: `${MUSIC_DIR}/Inicio de manhã.mp3` };
/** Revezadas pelo resto do dia (quando uma termina, começa a próxima). */
export const DAYTIME_TRACKS: MusicTrackDef[] = [
  { id: 'dreaming', path: `${MUSIC_DIR}/Dreaming - Standard Quality.mp3` },
  { id: 'sleeping-willow', path: `${MUSIC_DIR}/The Sleeping Willow - Standard Quality.mp3` },
  { id: 'sunlight-through-leaves', path: `${MUSIC_DIR}/Sunlight Through Leaves.ogg` },
  { id: 'wind-over-the-trees', path: `${MUSIC_DIR}/Wind Over The Trees.ogg` },
  { id: 'chickens-in-the-meadow', path: `${MUSIC_DIR}/Chickens In The Meadow.ogg` },
  { id: 'forgotten-biomes', path: `${MUSIC_DIR}/Forgotten Biomes.ogg` },
  { id: 'what-clouds-are-made-of', path: `${MUSIC_DIR}/What Clouds Are Made Of.ogg` },
  { id: 'floating-dream', path: `${MUSIC_DIR}/Floating Dream.ogg` },
];

/** 0-1. Volume de cruzeiro da música (abaixo dos efeitos, que têm pico baixo mas são pontuais). */
export const MUSIC_VOLUME = 0.35;
export const MUSIC_FADE_IN_MS = 3000;
export const MUSIC_FADE_OUT_MS = 3000;

/**
 * Janela do dia com música (horas do `GameClock`, 0-24): o dia começa às
 * 06:00 (novo jogo / acordar) e a música sai com fade out quando anoitece
 * (19:00 — mesmo horário em que o véu noturno já está cheio, ver
 * `systems/gameClock.ts`). Dormir também encerra o dia com fade out.
 */
export const MUSIC_DAY_START_HOUR = 6;
export const MUSIC_DAY_END_HOUR = 19;
/** Até esta hora a primeira faixa do dia é a de manhã; depois (ex.: ao carregar um save à tarde) começa direto numa das outras. */
export const MUSIC_MORNING_UNTIL_HOUR = 10;
