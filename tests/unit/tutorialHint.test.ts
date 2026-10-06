import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { tutorial } from '../../src/systems/tutorial';

describe('dica do regador vazio', () => {
  beforeEach(() => {
    freshGame();
    gameState.tutorialCompleted = true;
    gameState.waterHintSeen = false;
    tutorial.setHintAllowed(true);
  });

  it('fora da Fazenda (ou na horda) ela espera: não aparece nem trava o movimento; de volta à Fazenda, volta', () => {
    tutorial.notifyWaterEmpty();
    expect(tutorial.isHint()).toBe(true);
    expect(tutorial.allows({ kind: 'move' })).toBe(false); // Na Fazenda ela é um aviso "info" e segura o jogador até o "Entendi".

    tutorial.setHintAllowed(false); // Foi pras Cavernas.
    expect(tutorial.isHint()).toBe(false);
    expect(tutorial.getStep()).toBeNull();
    expect(tutorial.allows({ kind: 'move' })).toBe(true);
    tutorial.confirm(); // O botão não existe fora dali: nada muda.
    expect(gameState.waterHintSeen).toBe(false);

    tutorial.setHintAllowed(true); // Voltou à Fazenda.
    expect(tutorial.isHint()).toBe(true);
    tutorial.confirm();
    expect(tutorial.isHint()).toBe(false);
    expect(gameState.waterHintSeen).toBe(true);
  });
});
