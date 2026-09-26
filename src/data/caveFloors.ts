import { CaveEnemyKind, MYCONID_COLORS, SLIME_COLORS, SPROUT_COLORS } from './caveEnemies';

/**
 * Os ANDARES da Caverna (`scenes/CaveFloorScene.ts`): do 1 ao `CAVE_MAX_FLOOR`, cada um mais difícil que o anterior. Só DADOS + as fórmulas de dificuldade — o layout de cada
 * andar sai de `systems/caveGenerator.ts` (mesma semente = mesmo andar) e os bichos de `systems/caveEnemies.ts`. Ajustar o equilíbrio é mexer só aqui e em
 * `CAVE_ENEMY_STATS` (`data/caveEnemies.ts`).
 *
 * - **Mais inimigos:** `enemyCount` sobe devagar (4 no andar 1, 18 no 100).
 * - **Mais fortes:** vida e dano multiplicam por andar (`hpMult`/`dmgMult`); o de moedas também (`coinMult`).
 * - **Mais variados:** cada tipo só aparece a partir do seu andar (`ROSTER`); o peso dele cresce com a profundidade, e as CORES (do Slime, do Cogumelo, do Broto) mudam a cada zona de 10 andares.
 * - **Guardião** a cada 10 andares: um Slime Guardião gigante (vida enorme, recompensa grande) junto do grupo do andar.
 * - **Atalho:** a cada `CAVE_CHECKPOINT_EVERY` andares o jogador ganha um atalho na entrada (o mais fundo já visitado).
 */
export const CAVE_MAX_FLOOR = 100;
export const CAVE_CHECKPOINT_EVERY = 5;
export const CAVE_GUARDIAN_EVERY = 10;
/** Quantos andares formam uma "zona" (mesma cor de bichos e mesmo tom do cenário). */
export const CAVE_ZONE_FLOORS = 10;

/** Em que andar cada tipo passa a aparecer e o peso-base dele no sorteio. */
const ROSTER: Array<{ kind: Exclude<CaveEnemyKind, 'guardian'>; minFloor: number; weight: number }> = [
  { kind: 'slime', minFloor: 1, weight: 10 },
  { kind: 'sprout', minFloor: 3, weight: 6 },
  { kind: 'myconid', minFloor: 8, weight: 7 },
  { kind: 'spear', minFloor: 15, weight: 7 },
  { kind: 'archer', minFloor: 25, weight: 6 },
  { kind: 'spike', minFloor: 35, weight: 6 },
  { kind: 'bloom', minFloor: 45, weight: 5 },
];

/** Tom (multiplicativo) do chão/parede por zona — o mesmo desenho, um clima diferente a cada 10 andares. */
const ZONE_TINTS = [0xffffff, 0xb8d0ff, 0xd8b8ff, 0xffc0b0, 0xb8ffd0, 0xffe8a8, 0xa8b0c8, 0xffb8e0, 0xa0e8e8, 0xc8a0a0];

export interface CaveFloorConfig {
  floor: number;
  cols: number;
  rows: number;
  /** 0-9: qual bloco de 10 andares. */
  zone: number;
  tint: number;
  /** Quantos inimigos comuns nascem (fora o guardião). */
  enemyCount: number;
  /** Tipos sorteáveis neste andar, com o peso já ajustado pela profundidade. */
  roster: Array<{ kind: Exclude<CaveEnemyKind, 'guardian'>; weight: number }>;
  hpMult: number;
  dmgMult: number;
  coinMult: number;
  guardian: boolean;
  /** Quanta parede interna (0-1) — cresce com a profundidade: andares mais fundos são mais apertados. */
  wallDensity: number;
  slimeColor: string;
  myconidColor: string;
  sproutColor: string;
}

export function caveZone(floor: number): number {
  return Math.min(9, Math.floor((floor - 1) / CAVE_ZONE_FLOORS));
}

export function caveFloorConfig(floor: number): CaveFloorConfig {
  const f = Math.max(1, Math.min(CAVE_MAX_FLOOR, Math.floor(floor)));
  const zone = caveZone(f);
  return {
    floor: f,
    cols: Math.min(35, 25 + Math.floor(f / 8)),
    rows: Math.min(25, 19 + Math.floor(f / 12)),
    zone,
    tint: ZONE_TINTS[zone],
    enemyCount: Math.min(18, 4 + Math.floor(f * 0.14)),
    roster: ROSTER.filter((entry) => f >= entry.minFloor).map((entry) => ({ kind: entry.kind, weight: entry.weight * (1 + Math.min(1.5, (f - entry.minFloor) / 30)) })),
    hpMult: 1 + 0.07 * (f - 1),
    dmgMult: 1 + 0.02 * (f - 1),
    coinMult: 1 + 0.04 * (f - 1),
    guardian: f % CAVE_GUARDIAN_EVERY === 0,
    wallDensity: Math.min(0.2, 0.06 + f * 0.0015),
    slimeColor: SLIME_COLORS[zone % SLIME_COLORS.length],
    myconidColor: MYCONID_COLORS[zone % MYCONID_COLORS.length],
    sproutColor: SPROUT_COLORS[zone % SPROUT_COLORS.length],
  };
}

/** Os andares de atalho já alcançados (1 e cada múltiplo de `CAVE_CHECKPOINT_EVERY` até o mais fundo). */
export function unlockedCheckpoints(deepest: number): number[] {
  const list = [1];
  for (let floor = CAVE_CHECKPOINT_EVERY; floor <= Math.min(deepest, CAVE_MAX_FLOOR); floor += CAVE_CHECKPOINT_EVERY) list.push(floor);
  return list;
}
