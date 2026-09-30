import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { enchant, enchantBlocker, enchantMultiplier, getPlayerDefense, swordDamage } from '../../src/systems/enchanting';
import { hasMilestone, reachMilestone } from '../../src/systems/story';
import { ENCHANTS, ENCHANT_BAR_ID } from '../../src/data/enchanting';
import { getSmeltingRecipe, smeltingInputs } from '../../src/data/smelting';
import { GOLD_BAR } from '../../src/data/resources';
import { WEAPONS } from '../../src/data/weapons';

describe('encantamentos', () => {
  beforeEach(freshGame);

  it('a Mesa fica trancada até o Mago confiar no jogador', () => {
    expect(enchantBlocker('pickaxe')).toBe('locked');
  });

  it('pede Barras de Azurita e moedas, e cobra só ao encantar', () => {
    reachMilestone('wizardTrust');
    expect(enchantBlocker('pickaxe')).toBe('noBars');
    gameState.inventory.addResources(ENCHANT_BAR_ID, ENCHANTS.pickaxe.bars);
    gameState.inventory.spendCoins(gameState.inventory.getCoins());
    expect(enchantBlocker('pickaxe')).toBe('poor');
    gameState.inventory.addCoins(ENCHANTS.pickaxe.coins);
    expect(enchant('pickaxe')).toBe('done');
    expect(gameState.inventory.getResourceCount(ENCHANT_BAR_ID)).toBe(0);
    expect(gameState.inventory.getCoins()).toBe(0);
    expect(hasMilestone('enchantedPickaxe')).toBe(true);
    expect(enchant('pickaxe')).toBe('already');
  });

  it('aplica os bônus pedidos', () => {
    const baseSword = swordDamage('sword-iron');
    expect(baseSword).toBe(WEAPONS['sword-iron'].damage);
    gameState.enchants.push('pickaxe', 'axe', 'sword', 'armor');
    expect(enchantMultiplier('pickaxe')).toBeCloseTo(1.2);
    expect(enchantMultiplier('axe')).toBeCloseTo(1.2);
    expect(swordDamage('sword-iron')).toBeCloseTo(baseSword * 1.35);
    expect(getPlayerDefense()).toBeCloseTo(gameState.inventory.getDefense() * 1.15);
  });

  it('a Barra de Azurita funde com Barra de Ouro; as outras, com carvão', () => {
    expect(smeltingInputs(getSmeltingRecipe('smelt-azurite')!).fuelId).toBe(GOLD_BAR.id);
    expect(smeltingInputs(getSmeltingRecipe('smelt-iron')!).fuelId).toBe('coal');
  });
});
