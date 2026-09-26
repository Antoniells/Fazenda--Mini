/**
 * Hordas: a cada `HORDE_INTERVAL_DAYS` dias (10, 20, 30…) uma noite de ataque na Fazenda. Só DADOS/números — o estado vive
 * em `gameState.horde` (`systems/horde.ts`), os inimigos são `entities/Raider.ts` e a cena os gerencia em
 * `systems/hordeDirector.ts`.
 */
export const HORDE_INTERVAL_DAYS = 10;
/** A horda começa às 19:00 do dia da horda (véu noturno já cheio) e o amanhecer que a encerra é às 06:00 — ver `GameClock`. */
export const HORDE_START_HOUR = 19;
export const HORDE_DAWN_HOUR = 6;

/** É dia de horda? (10, 20, 30…) */
export function isHordeDay(day: number): boolean {
  return day > 0 && day % HORDE_INTERVAL_DAYS === 0;
}

/** Número da horda de um dia de horda (dia 10 = 1, dia 20 = 2…). */
export function hordeNumberForDay(day: number): number {
  return Math.floor(day / HORDE_INTERVAL_DAYS);
}

/** Quantos inimigos tem a horda `number`: 8 na primeira, +2 a cada horda, no máximo 20. */
export function hordeSize(number: number): number {
  return Math.min(20, 8 + 2 * (number - 1));
}

/** Vida de cada inimigo da horda `number` (o Slime comum tem 25): +5 por horda. */
export function hordeEnemyHp(number: number): number {
  return 25 + 5 * (number - 1);
}

/** Recompensa BÔNUS de sobreviver à noite da horda `number` (além dos drops dos inimigos). */
export function hordeReward(number: number): { coins: number; wood: number; stone: number; ironOre: number } {
  return { coins: 150 * number, wood: 40 + 15 * number, stone: 25 + 10 * number, ironOre: 4 + 2 * number };
}

/** Ritmo da chegada: uma rajada inicial e depois de tantos em tantos ms, até completar o total da horda. */
export const HORDE_INITIAL_BURST = 3;
export const HORDE_SPAWN_BATCH = 2;
export const HORDE_SPAWN_INTERVAL_MS = 9000;
/** Nascem a pelo menos tantas células do jogador (não aparecem nas costas dele). */
export const HORDE_MIN_SPAWN_DISTANCE_TILES = 9;

/** Golpes (de 1 dano) que uma cerca aguenta antes de cair. */
export const FENCE_HP = 3;

/** IA dos Raiders (`entities/Raider.ts`). */
export const RAIDER_AI = {
  moveSpeed: 52,
  contactDamage: 5,
  /** Distância (px) em que o jogador vira o alvo prioritário (7 células). */
  playerAggroRadius: 224,
  /** Quanto "custa" atravessar uma cerca (quebrar) no caminho, em células andadas — quanto maior, mais eles preferem contornar pelo portão. */
  fenceBreakCost: 7,
  /** Intervalo (ms) entre reavaliações de alvo/rota. */
  thinkMs: 700,
  attackRange: 40,
  hitRange: 46,
  windupMs: 450,
  strikeMs: 170,
  recoverMs: 800,
  staggerMs: 600,
} as const;

/**
 * Estado da horda (vai pro save — `SaveData.horde`). Puro dado: quem move os inimigos é `systems/hordeDirector.ts` (cena).
 * Os drops dos inimigos abatidos NÃO caem no chão durante a horda: vão pro `drops` (pool) e são entregues no fim — na
 * vitória junto com o bônus, na derrota SÓ eles (é a regra do evento: o que já foi abatido o jogador leva).
 */
export interface HordeState {
  /** Uma noite de horda está em andamento. */
  active: boolean;
  /** Número da horda em andamento (1 = dia 10). */
  number: number;
  /** Inimigos desta horda e quantos já foram abatidos. */
  total: number;
  killed: number;
  /** Drops acumulados dos inimigos abatidos: id de recurso → quantidade. */
  drops: Record<string, number>;
  /** Dia (do calendário) em que a última horda COMEÇOU — pra não recomeçar no mesmo dia. */
  lastHordeDay: number;
}

export function createHordeState(): HordeState {
  return { active: false, number: 0, total: 0, killed: 0, drops: {}, lastHordeDay: 0 };
}
