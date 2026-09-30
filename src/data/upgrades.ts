import { COPPER_BAR, IRON, STONE, WOOD } from './resources';

/**
 * MELHORIAS vendidas pelo Marceneiro (aba "Melhorias" da loja dele, `systems/vendorShops.ts`): três linhas de evolução, cada uma com um nível atual (`UpgradesState`) e degraus
 * (`steps[n]` leva do nível n ao n+1) que custam moedas + materiais:
 *
 * - `house`: a CASA do jogador — 3 estados (`data/houseLevels.ts`): a casinha laranja do começo, a casa do meio e a casa final. Cada um troca a arte na Fazenda e amplia o interior.
 * - `plot`: o espaço do PLANTIO — a lavoura cresce em 3 etapas (`data/plotLevels.ts`), a cerca acompanhando.
 * - `fence`: o material da CERCA da lavoura — Madeira, Pedra e Ferro (`data/fenceSkins.ts`), cada um aguentando mais golpes da horda.
 *
 * Quem aplica os níveis ao mundo é `systems/farmUpgrades.ts`.
 */
export type UpgradeTrack = 'house' | 'plot' | 'fence';

export const UPGRADE_TRACK_IDS: UpgradeTrack[] = ['house', 'plot', 'fence'];

export interface UpgradeMaterial {
  /** Id de `data/resources.ts`. */
  resourceId: string;
  amount: number;
}

export interface UpgradeStep {
  /** Nome do que se compra ("Casa maior"). */
  name: string;
  description: string;
  price: number;
  materials: UpgradeMaterial[];
}

export interface UpgradeTrackDefinition {
  id: UpgradeTrack;
  /** Nome da linha ("Casa", "Plantio", "Cerca"). */
  name: string;
  /** `steps[n]` leva do nível `n` ao `n + 1`; o nível máximo é `steps.length`. */
  steps: UpgradeStep[];
}

export const UPGRADE_TRACKS: Record<UpgradeTrack, UpgradeTrackDefinition> = {
  house: {
    id: 'house',
    name: 'Casa',
    steps: [
      { name: 'Casa maior', description: 'Uma casa maior, com ala nos fundos e mais espaço por dentro.', price: 600, materials: [{ resourceId: WOOD.id, amount: 50 }, { resourceId: STONE.id, amount: 25 }] },
      { name: 'Casa grande', description: 'A casa final: dois andares, varanda e ainda mais espaço por dentro.', price: 1500, materials: [{ resourceId: WOOD.id, amount: 100 }, { resourceId: STONE.id, amount: 50 }, { resourceId: COPPER_BAR.id, amount: 5 }] },
    ],
  },
  plot: {
    id: 'plot',
    name: 'Plantio',
    steps: [
      { name: 'Plantio maior', description: 'Lavoura de 16x10, cerca junto. Tire o que estiver no caminho.', price: 400, materials: [{ resourceId: WOOD.id, amount: 30 }, { resourceId: STONE.id, amount: 10 }] },
      { name: 'Plantio grande', description: 'Lavoura de 20x12, cerca junto.', price: 900, materials: [{ resourceId: WOOD.id, amount: 60 }, { resourceId: STONE.id, amount: 25 }, { resourceId: COPPER_BAR.id, amount: 3 }] },
      { name: 'Plantio enorme', description: 'A lavoura final, de 22x13.', price: 2000, materials: [{ resourceId: WOOD.id, amount: 100 }, { resourceId: STONE.id, amount: 50 }, { resourceId: IRON.id, amount: 5 }] },
    ],
  },
  fence: {
    id: 'fence',
    name: 'Cerca',
    steps: [
      { name: 'Cerca de Madeira', description: 'Madeira reforçada: aguenta mais golpes da horda.', price: 300, materials: [{ resourceId: WOOD.id, amount: 40 }] },
      { name: 'Cerca de Pedra', description: 'Muro de pedra: bem mais resistente à horda.', price: 800, materials: [{ resourceId: STONE.id, amount: 60 }, { resourceId: WOOD.id, amount: 20 }] },
      { name: 'Cerca de Ferro', description: 'Grades de ferro: a cerca mais resistente.', price: 2000, materials: [{ resourceId: IRON.id, amount: 8 }, { resourceId: STONE.id, amount: 30 }] },
    ],
  },
};

/** Nível atual de cada linha (0 = o do começo). Vai pro save. */
export interface UpgradesState {
  house: number;
  plot: number;
  fence: number;
}

/** Partida nova: a casinha do começo, a lavoura e a cerca originais. */
export function createUpgradesState(): UpgradesState {
  return { house: 0, plot: 0, fence: 0 };
}

/** Save anterior às melhorias: o jogo já tinha a casa de sempre (nível 1 da casa), a lavoura e a cerca originais. */
export function createLegacyUpgradesState(): UpgradesState {
  return { house: 1, plot: 0, fence: 0 };
}

export function maxUpgradeLevel(track: UpgradeTrack): number {
  return UPGRADE_TRACKS[track].steps.length;
}
