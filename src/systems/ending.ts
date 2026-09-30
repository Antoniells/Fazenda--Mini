import { gameState } from './gameState';
import { hasMilestone } from './story';
import { save as saveGame } from './saveManager';
import { PETS, getPetDefinition } from '../data/pets';
import type { PetId } from '../data/pets';

/**
 * DEPOIS DO FIM (Fase 11): pulados os créditos, o jogador volta ao mundo — sem o pet, que virou a Amizade Dourada — e uma caixa nova o
 * espera em frente à casa, com um filhote (outro bichinho da mesma espécie). Abrir a caixa mostra a carta do filhote e o registra
 * (`systems/petEvent.ts`, marco `newPet`). Só estado: quem troca de cena é a `EndingScene`.
 */
export function prepareWorldAfterEnding(): void {
  if (!hasMilestone('awakening')) return;
  // O mundo em paz: nenhuma horda fica pela metade nem marcada.
  gameState.horde.active = false;
  gameState.horde.drops = {};
  gameState.campaign.finalNightDay = null;
  if (!hasMilestone('newPet') && !gameState.petBoxPlaced) {
    gameState.profile.petId = pickNewPet(gameState.profile.petId);
    gameState.petUnlocked = false;
    gameState.petBoxPlaced = true;
  }
  saveGame();
}

/** Outro pet da mesma espécie do que partiu (se não houver, qualquer outro). */
function pickNewPet(previous: PetId): PetId {
  const species = getPetDefinition(previous).species;
  const others = PETS.filter((pet) => pet.id !== previous);
  const sameSpecies = others.filter((pet) => pet.species === species);
  const pool = sameSpecies.length > 0 ? sameSpecies : others;
  return (pool[Math.floor(Math.random() * pool.length)] ?? PETS[0]).id as PetId;
}
