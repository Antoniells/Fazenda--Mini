import { describe, expect, it } from 'vitest';
import { Hunger, satietyOf } from '../../src/systems/hunger';
import { ACTION_SATIETY_COST, CROP_SATIETY, HUNGRY_THRESHOLD, MAX_SATIETY, REGEN_INTERVAL_MS, REGEN_SATIETY_COST, REGEN_SATIETY_THRESHOLD, STARVE_INTERVAL_MS, TIRING_ACTIONS } from '../../src/data/hunger';

describe('fome', () => {
  it('só as ações que cansam gastam: atacar, arar, regar, machado e picareta (plantar, colher e comer não)', () => {
    expect([...TIRING_ACTIONS].sort()).toEqual(['axe', 'hoe', 'pickaxe', 'sword', 'water']);
    const hunger = new Hunger();
    hunger.spendFor('plant');
    hunger.spendFor('harvest');
    hunger.spendFor('eat');
    expect(hunger.getSatiety()).toBe(MAX_SATIETY);
    hunger.spendFor('hoe');
    expect(hunger.getSatiety()).toBe(MAX_SATIETY - ACTION_SATIETY_COST);
  });

  it('avisa uma vez só ao cruzar pra "com fome", e nunca passa de 0', () => {
    const hunger = Hunger.deserialize(HUNGRY_THRESHOLD);
    expect(hunger.spendFor('axe')).toBe(true);
    expect(hunger.spendFor('axe')).toBe(false);
    for (let index = 0; index < 200; index++) hunger.spendFor('pickaxe');
    expect(hunger.getSatiety()).toBe(0);
    expect(hunger.isStarving()).toBe(true);
  });

  it('com a barra vazia, um dano de fome a cada STARVE_INTERVAL_MS de jogo; comer para o relógio', () => {
    const hunger = Hunger.deserialize(0);
    expect(hunger.tick(STARVE_INTERVAL_MS - 1)).toBe(false);
    expect(hunger.tick(1)).toBe(true);
    expect(hunger.tick(STARVE_INTERVAL_MS / 2)).toBe(false);
    hunger.eat(CROP_SATIETY);
    expect(hunger.isStarving()).toBe(false);
    expect(hunger.tick(STARVE_INTERVAL_MS * 3)).toBe(false);
  });

  it('comer enche sem passar do máximo; colheita enche mais que a frutinha; acordar do desmaio garante um mínimo; save fora da faixa é corrigido', () => {
    const hunger = Hunger.deserialize(MAX_SATIETY - 5);
    hunger.eat(CROP_SATIETY);
    expect(hunger.isFull()).toBe(true);
    expect(satietyOf({ category: 'crop', id: 'carrot' })).toBe(CROP_SATIETY);
    expect(satietyOf({ category: 'resource', id: 'wild-berry' })).toBeLessThan(CROP_SATIETY);
    const starving = Hunger.deserialize(0);
    starving.restoreAtLeast(40);
    expect(starving.getSatiety()).toBe(40);
    expect(Hunger.deserialize(undefined).getSatiety()).toBe(MAX_SATIETY); // Save de antes da fome: barra cheia.
    expect(Hunger.deserialize(999).getSatiety()).toBe(MAX_SATIETY);
    expect(Hunger.deserialize(-5).getSatiety()).toBe(0);
  });

  it('acima da metade da barra a vida volta aos poucos e a barra cai junto, até a metade; sem ferimento, nada acontece', () => {
    expect(REGEN_SATIETY_THRESHOLD).toBe(MAX_SATIETY / 2);
    const hunger = new Hunger();
    expect(hunger.tickRegen(REGEN_INTERVAL_MS * 5, false)).toBe(false); // Vida cheia: não gasta nada.
    expect(hunger.getSatiety()).toBe(MAX_SATIETY);
    expect(hunger.tickRegen(REGEN_INTERVAL_MS - 1, true)).toBe(false);
    expect(hunger.tickRegen(1, true)).toBe(true);
    expect(hunger.getSatiety()).toBe(MAX_SATIETY - REGEN_SATIETY_COST);

    let heals = 0;
    for (let index = 0; index < 500; index++) if (hunger.tickRegen(REGEN_INTERVAL_MS, true)) heals++;
    expect(hunger.getSatiety()).toBe(REGEN_SATIETY_THRESHOLD); // Para na metade.
    expect(heals + 1).toBe((MAX_SATIETY - REGEN_SATIETY_THRESHOLD) / REGEN_SATIETY_COST);
    expect(Hunger.deserialize(REGEN_SATIETY_THRESHOLD).tickRegen(REGEN_INTERVAL_MS, true)).toBe(false); // Exatamente na metade: não cura.
  });
});
