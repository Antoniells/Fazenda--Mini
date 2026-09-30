import { gameState } from './gameState';
import { getFishingLuck } from './skills';
import { hasMilestone, reachMilestone } from './story';
import { FISH, FISH_RARITY, FishDefinition, FishingLocation, GOLDEN_FISH_ID, LUCK_RARITY_BONUS, LUCK_ZONE_BONUS } from '../data/fishing';
import { FISHING_ROD } from '../data/tools';

/**
 * Regras da PESCA, sem nada de cena (quem mostra é `systems/fishingSession.ts`): qual peixe morde, o desafio do minijogo e a
 * entrega do peixe à Bolsa.
 */

/** O jogador está com a Vara de Pescar na mão (slot da Hotbar)? */
export function isRodSelected(): boolean {
  const selected = gameState.inventory.getSelectedSlot();
  return selected?.category === 'tool' && selected.id === FISHING_ROD.id;
}

/** Os peixes que podem morder num lugar. No santuário, o Peixe Dourado é o único até ser pescado (é único: depois, não volta). */
export function fishPool(location: FishingLocation): FishDefinition[] {
  const here = FISH.filter((fish) => fish.locations.includes(location));
  const goldenCaught = hasMilestone('goldenFish');
  if (location === 'sanctuary' && !goldenCaught) return here.filter((fish) => fish.id === GOLDEN_FISH_ID);
  return here.filter((fish) => fish.id !== GOLDEN_FISH_ID);
}

/** Sorteia o peixe que mordeu, pelo peso da raridade; a Sorte do Pescador favorece os raros e lendários. */
export function pickFish(location: FishingLocation, random: () => number = Math.random): FishDefinition | null {
  const pool = fishPool(location);
  if (pool.length === 0) return null;
  const luck = getFishingLuck();
  const weightOf = (fish: FishDefinition): number => {
    const base = FISH_RARITY[fish.rarity].weight;
    return fish.rarity === 'rare' || fish.rarity === 'legendary' ? base * (1 + luck * LUCK_RARITY_BONUS) : base;
  };
  const total = pool.reduce((sum, fish) => sum + weightOf(fish), 0);
  let roll = random() * total;
  for (const fish of pool) {
    roll -= weightOf(fish);
    if (roll < 0) return fish;
  }
  return pool[pool.length - 1];
}

/** O desafio do minijogo pra este peixe: acertos pedidos, tempo pra o marcador atravessar a barra e largura da faixa verde (com a sorte). */
export interface ReelChallenge {
  hits: number;
  sweepMs: number;
  zone: number;
}

export function reelChallenge(fish: FishDefinition): ReelChallenge {
  const rarity = FISH_RARITY[fish.rarity];
  return { hits: rarity.hits, sweepMs: rarity.sweepMs, zone: Math.min(0.6, rarity.zone * (1 + getFishingLuck() * LUCK_ZONE_BONUS)) };
}

/** Cabe mais este peixe na Bolsa? */
export function hasRoomForFish(fish: FishDefinition): boolean {
  return gameState.inventory.hasRoomFor({ category: 'resource', id: fish.id });
}

/** O peixe foi pescado: vai pra Bolsa. O Peixe Dourado é o 2º pilar da profecia (`data/story.ts`). */
export function landFish(fish: FishDefinition): void {
  gameState.inventory.addResources(fish.id, 1);
  if (fish.id === GOLDEN_FISH_ID) reachMilestone('goldenFish');
}
