import { SLIME_HIT_SOUND, SWORD_SWING_SOUND, SoundEffectDef } from './audio';

/**
 * Os inimigos da CAVERNA (`scenes/CaveFloorScene.ts`, `data/caveFloors.ts`), todos com arte que já vinha em `assets/Enemy`. Só DADOS: as folhas de cada
 * bicho, os quadros de cada animação e os atributos-base (vida/dano/velocidade no ANDAR 1 — `caveFloors.ts` multiplica por andar). O comportamento de cada um
 * está em `entities/cave/*` (e o do Slime em `entities/Slime.ts`).
 *
 * Folhas "de 4 direções": quadros de 32x32 (o Broto: 16x32), uma LINHA por direção — baixo, cima, direita, esquerda (`DIRECTION_ROW`) — e uma COLUNA por quadro.
 */
export type CaveEnemyKind = 'slime' | 'sprout' | 'myconid' | 'spear' | 'archer' | 'spike' | 'bloom' | 'guardian';

export type Direction = 'down' | 'up' | 'right' | 'left';
export const DIRECTION_ROW: Record<Direction, number> = { down: 0, up: 1, right: 2, left: 3 };

/** Uma folha de animação carregada como spritesheet. */
export interface SheetDef {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  /** Quantos quadros por linha (= por direção). */
  frames: number;
}

const dirSheet = (key: string, path: string, frames: number, frameWidth = 32): SheetDef => ({ key, path: `Enemy/${path}`, frameWidth, frameHeight: 32, frames });

/** Cores (e pastas) dos cogumelos e dos slimes, na ordem em que aparecem com a profundidade. */
export const MYCONID_COLORS = ['Green', 'Blue', 'Pink', 'Purple', 'Red'] as const;
export const SLIME_COLORS = ['Green', 'Blue', 'Pink', 'Pupple', 'Black', 'Golden'] as const;
export const SPROUT_COLORS = ['Blue', 'Pink', 'Purple'] as const;

/** Os conjuntos de folhas de um bicho de 4 direções. `attack` some nos que só encostam (Broto). */
export interface WalkerSheets {
  idle: SheetDef;
  walk: SheetDef;
  attack?: SheetDef;
  dead?: SheetDef;
}

export function myconidSheets(color: string): WalkerSheets {
  const base = `Myconid/${color}`;
  return {
    idle: dirSheet(`cave-myconid-${color}-idle`, `${base}/Idle.png`, 4),
    walk: dirSheet(`cave-myconid-${color}-walk`, `${base}/Walk.png`, 6),
    attack: dirSheet(`cave-myconid-${color}-attack`, `${base}/Attack.png`, 6),
    dead: dirSheet(`cave-myconid-${color}-dead`, `${base}/Dead.png`, 5),
  };
}

export function spearSheets(): WalkerSheets {
  const base = 'Goblins/Spear Goblin';
  return {
    idle: dirSheet('cave-spear-idle', `${base}/Idle.png`, 4),
    walk: dirSheet('cave-spear-walk', `${base}/Walk.png`, 6),
    attack: dirSheet('cave-spear-attack', `${base}/Spear.png`, 6),
    dead: dirSheet('cave-spear-dead', `${base}/Dead.png`, 4),
  };
}

export function archerSheets(): WalkerSheets {
  const base = 'Goblins/Archer Goblin';
  return {
    idle: dirSheet('cave-archer-idle', `${base}/Idle.png`, 4),
    walk: dirSheet('cave-archer-walk', `${base}/Walk.png`, 6),
    attack: dirSheet('cave-archer-attack', `${base}/Bow.png`, 7),
    dead: dirSheet('cave-archer-dead', `${base}/Dead.png`, 4),
  };
}

/** O Broto (Sprout Slime): quadros de 16x32, sem folha de ataque (ele só encosta). */
export function sproutSheets(color: string): WalkerSheets {
  const base = `Sprout Slime/${color}`;
  return {
    idle: dirSheet(`cave-sprout-${color}-idle`, `${base}/Idle.png`, 2, 16),
    walk: dirSheet(`cave-sprout-${color}-walk`, `${base}/Walk.png`, 4, 16),
  };
}

/** O Espinho (Spike): sai da terra (`leaving`, 6 quadros), ataca, volta pra terra (`entering`, 4) — 4 direções, 32x32. */
export const SPIKE_SHEETS = {
  idle: dirSheet('cave-spike-idle', 'Spike/idle.png', 4),
  entering: dirSheet('cave-spike-entering', 'Spike/entering.png', 4),
  leaving: dirSheet('cave-spike-leaving', 'Spike/leaving.png', 6),
  spitting: dirSheet('cave-spike-spitting', 'Spike/spitting.png', 5),
  dead: dirSheet('cave-spike-dead', 'Spike/dead.png', 5),
};

/** A Flor Venenosa (Venom Bloom): parada, quadros de 48x48 numa linha só. */
const bloomSheet = (key: string, file: string, frames: number): SheetDef => ({ key, path: `Enemy/Venom Bloom/Purple/${file}`, frameWidth: 48, frameHeight: 48, frames });
export const BLOOM_SHEETS = {
  idle: bloomSheet('cave-bloom-idle', 'Idle.png', 3),
  wake: bloomSheet('cave-bloom-wake', 'Wake up.png', 6),
  attack: bloomSheet('cave-bloom-attack', 'Attack.png', 4),
  damage: bloomSheet('cave-bloom-damage', 'Damage.png', 2),
  dead: bloomSheet('cave-bloom-dead', 'Dead.png', 5),
};

/** Folha do Slime (128x384, 4x12 quadros de 32x32 — ver `data/enemies.ts`): a normal e a "Big" (o guardião), por cor. */
export const slimeSheet = (color: string, big = false): SheetDef => ({
  key: `cave-slime-${color}${big ? '-big' : ''}`,
  path: `Enemy/Slimes/${color}/${big ? 'Big Slime' : 'Slime'}.png`,
  frameWidth: 32,
  frameHeight: 32,
  frames: 4,
});

/** Atributos-base no ANDAR 1 (`caveFloors.ts` os multiplica por andar). `coins` = [mín, máx] de moedas que ele solta. */
export interface CaveEnemyStats {
  name: string;
  hp: number;
  damage: number;
  speed: number;
  coins: [number, number];
  hitSound: SoundEffectDef;
}

export const CAVE_ENEMY_STATS: Record<CaveEnemyKind, CaveEnemyStats> = {
  slime: { name: 'Slime', hp: 25, damage: 5, speed: 40, coins: [1, 3], hitSound: SLIME_HIT_SOUND },
  sprout: { name: 'Broto', hp: 14, damage: 4, speed: 66, coins: [1, 2], hitSound: SLIME_HIT_SOUND },
  myconid: { name: 'Cogumelo', hp: 40, damage: 8, speed: 38, coins: [2, 4], hitSound: SLIME_HIT_SOUND },
  spear: { name: 'Goblin Lanceiro', hp: 55, damage: 10, speed: 50, coins: [3, 5], hitSound: SLIME_HIT_SOUND },
  archer: { name: 'Goblin Arqueiro', hp: 34, damage: 9, speed: 36, coins: [3, 5], hitSound: SLIME_HIT_SOUND },
  spike: { name: 'Espinho', hp: 60, damage: 12, speed: 30, coins: [3, 6], hitSound: SLIME_HIT_SOUND },
  bloom: { name: 'Flor Venenosa', hp: 90, damage: 10, speed: 0, coins: [4, 7], hitSound: SLIME_HIT_SOUND },
  guardian: { name: 'Slime Guardião', hp: 150, damage: 14, speed: 34, coins: [40, 60], hitSound: SLIME_HIT_SOUND },
};

/** O "vush" do golpe de quem ataca com arma (só a mesma trilha da espada, por enquanto). */
export const CAVE_SWING_SOUND = SWORD_SWING_SOUND;
