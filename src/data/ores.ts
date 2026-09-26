import { ORE_COAL_FRAME, ORE_COPPER_FRAME, ORE_GOLD_FRAME, ORE_IRON_FRAME } from './tiles';
import { COAL, COPPER_ORE, GOLD_ORE, IRON_ORE } from './resources';
import { quarryMap } from './maps/quarryMap';

/**
 * Veios de minério da Pedreira (`QuarryScene`), minerados com a Picareta (`systems/oreInteraction.ts`). Cada veio é um nó do registro de recursos (`kind: 'ore'`, `data/maps/quarryMap.ts`
 * dá as posições): quebrado, some, e volta ao mesmo lugar com o passar dos dias (`ORE_RESPAWN_CHANCE`). Os metais mais nobres exigem picareta melhor
 * (`minToolTier`, o tier de `data/toolProgression.ts`): Cobre e Carvão com qualquer uma, Ferro com a de Cobre, Ouro com a de Ferro.
 */
export type OreKind = 'copper' | 'coal' | 'iron' | 'gold';

export interface OreDefinition {
  kind: OreKind;
  name: string;
  /** Recorte do veio desenhado no mundo (`ORE_KEY`, `data/tiles.ts`). */
  frame: { name: string; rect: { x: number; y: number; width: number; height: number } };
  /** O que cai (`data/resources.ts`) e quantas unidades ([mín, máx]). */
  dropId: string;
  drop: [number, number];
  /** Tier mínimo da Picareta (0 = Madeira … 3 = Ouro). */
  minToolTier: number;
}

export const ORES: Record<OreKind, OreDefinition> = {
  copper: { kind: 'copper', name: 'Veio de Cobre', frame: ORE_COPPER_FRAME, dropId: COPPER_ORE.id, drop: [2, 4], minToolTier: 0 },
  coal: { kind: 'coal', name: 'Veio de Carvão', frame: ORE_COAL_FRAME, dropId: COAL.id, drop: [2, 4], minToolTier: 0 },
  iron: { kind: 'iron', name: 'Veio de Ferro', frame: ORE_IRON_FRAME, dropId: IRON_ORE.id, drop: [2, 4], minToolTier: 1 },
  gold: { kind: 'gold', name: 'Veio de Ouro', frame: ORE_GOLD_FRAME, dropId: GOLD_ORE.id, drop: [1, 3], minToolTier: 2 },
};

/** Multiplica a escala de exibição dos veios (o recorte da pedra com minério é só 11x10 — pequeno perto do tile de 16). */
export const ORE_DISPLAY_SCALE_MULT = 1.6;

/** "Golpes de madeira" até um veio quebrar (como `HITS_TO_BREAK_ROCK` da pedra, mas mais duro): Picareta de Madeira 6 golpes; tiers maiores batem mais forte (`TOOL_TIER_POWER`). */
export const HITS_TO_BREAK_ORE = 6;

/** Chance, por veio já quebrado, de ele voltar a cada virada de dia (`QuarryScene.advanceQuarryDay`). */
export const ORE_RESPAWN_CHANCE = 0.5;

/**
 * Onde ficam os veios da Pedreira: os de FERRO e CARVÃO que já existiam (`quarryMap`, autorados no editor de mapas) mais os que a mineração acrescentou (o COBRE, mais
 * carvão/ferro e o OURO) — estes ficam aqui, não no `quarryMap`, porque o editor de mapas regrava aquele arquivo por inteiro e os perderia.
 */
const EXTRA_VEINS: Record<OreKind, Array<[number, number]>> = {
  copper: [[9, 7], [14, 10], [24, 7], [30, 11], [9, 19], [20, 20], [26, 13], [33, 16], [4, 17], [36, 23]],
  coal: [[10, 12], [23, 21], [31, 25], [14, 26]],
  iron: [[16, 20], [27, 19], [7, 25]],
  gold: [[13, 4], [25, 11], [34, 21], [3, 27], [30, 27]],
};

export interface VeinPlacement {
  kind: OreKind;
  col: number;
  row: number;
}

/** Todos os veios da Pedreira, na ordem em que nascem no começo do jogo. */
export function getQuarryVeins(): VeinPlacement[] {
  const fromMap: Record<OreKind, Array<[number, number]>> = { copper: [], coal: quarryMap.coalOrePositions, iron: quarryMap.ironOrePositions, gold: [] };
  return (Object.keys(ORES) as OreKind[]).flatMap((kind) => [...fromMap[kind], ...EXTRA_VEINS[kind]].map(([col, row]): VeinPlacement => ({ kind, col, row })));
}
