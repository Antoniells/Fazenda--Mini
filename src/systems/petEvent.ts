import { gameState } from './gameState';
import { PET_BED } from '../data/decorations';

/** Quantas vezes o jogador precisa dormir na cama pra a caixa do pet aparecer. */
export const SLEEPS_TO_UNLOCK_PET = 3;

/** Onde a caixa aparece: do lado de fora, em frente à casa (a porta é (18, 8), o jogador sai em (18, 9) — a caixa fica duas células à direita). */
export const PET_BOX_CELL = { col: 20, row: 9 };

/**
 * Evento narrativo do pet: dormir na cama (`HouseScene.sleep`) conta (`gameState.sleepCount`); no `SLEEPS_TO_UNLOCK_PET`º sono
 * uma caixa aparece em frente à casa (`petBoxPlaced`); abrir a caixa mostra uma carta e, DEPOIS DE LIDA, o pet é
 * desbloqueado (`petUnlocked`) — só então ele passa a existir nas cenas (`systems/petCompanion.ts`). Só estado: a caixa em si é
 * `systems/petBox.ts` e a carta é `ui/letterPanel.ts`. O pet escolhido na Criação de Personagem (`profile.petId`) é o que chega.
 */

/** Registra um sono na cama. Devolve `true` se É ESSE sono que faz a caixa aparecer (pra a casa avisar ao acordar). */
export function recordSleepInBed(): boolean {
  gameState.sleepCount += 1;
  if (gameState.sleepCount >= SLEEPS_TO_UNLOCK_PET && !gameState.petUnlocked && !gameState.petBoxPlaced) {
    gameState.petBoxPlaced = true;
    return true;
  }
  return false;
}

/** A caixa está lá fora esperando ser aberta? */
export function isPetBoxPending(): boolean {
  return gameState.petBoxPlaced && !gameState.petUnlocked;
}

/** A carta que vem na caixa (o texto do evento, com o nome do jogador). O coração do fim é desenhado pela tela da carta (arte do HUD). */
export function getPetLetter(): { title: string; body: string } {
  const name = gameState.profile.playerName;
  return {
    title: 'Uma carta chegou',
    body:
      `Oi, ${name},\n\n` +
      'Encontramos este pobre animalzinho sozinho e perdido no meio da floresta. Ele parecia assustado e sem saber para onde ir... ' +
      'não tivemos coragem de deixá-lo para trás. Pensamos em você e em sua fazenda. Há tanto espaço por lá para ele correr, brincar ' +
      'e, quem sabe, finalmente encontrar um lar. Você poderia cuidar dele e dar a ele um cantinho para chamar de casa?',
  };
}

/** Carta lida: desbloqueia o pet e tira a caixa do mundo. */
export function unlockPet(): void {
  gameState.petUnlocked = true;
  gameState.petBoxPlaced = false;
  grantPetBed();
}

/**
 * Dá ao jogador a caminha do bichinho (UMA vez, `petBedGiven` vai pro save): ao liberar o pet e, pra quem já tinha o pet antes desta
 * novidade, na próxima vez que abrir a Fazenda. Devolve `true` se entregou agora (a cena avisa). Vai pra Bolsa; se estiver cheia, tenta de novo depois.
 */
export function grantPetBed(): boolean {
  if (!gameState.petUnlocked || gameState.petBedGiven) return false;
  if (!gameState.inventory.hasFreeSlot() && gameState.inventory.getDecorationCount(PET_BED.id) === 0) return false;
  gameState.inventory.addDecorations(PET_BED.id, 1);
  gameState.petBedGiven = true;
  return true;
}
