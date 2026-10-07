import { describe, expect, it } from 'vitest';
import { BASE_UNLOCKED_SLOTS, HOTBAR_SIZE, INVENTORY_SIZE, Inventory, LOCKED_BAG_SLOTS, STORAGE_SIZE } from '../../src/systems/inventory';

const slotIds = (inventory: Inventory): string[] =>
  Array.from({ length: INVENTORY_SIZE }, (_, index) => inventory.getSlot(index)).flatMap((slot) => (slot ? [`${slot.category}:${slot.id}`] : []));

describe('Bolsa: Hotbar e estoque do caderno', () => {
  it('são 8 slots de Hotbar + uma página cheia do caderno (6x5)', () => {
    expect(HOTBAR_SIZE).toBe(8);
    expect(STORAGE_SIZE).toBe(30);
    expect(INVENTORY_SIZE).toBe(38);
  });

  it('equipar/guardar troca os slots: o item nunca fica nos dois lugares', () => {
    const inventory = new Inventory();
    inventory.addResources('stone', 5);
    const stoneSlot = Array.from({ length: INVENTORY_SIZE }, (_, index) => index).find((index) => inventory.getSlot(index)?.id === 'stone')!;
    inventory.swapSlots(0, HOTBAR_SIZE + 3); // A ferramenta do 1º slot da Hotbar vai pro caderno.
    inventory.swapSlots(stoneSlot === 0 ? HOTBAR_SIZE + 3 : stoneSlot, 0); // E a pedra vai pra Hotbar.
    expect(inventory.getSlot(0)?.id).toBe('stone');
    const ids = slotIds(inventory);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('save de quando a Bolsa tinha 24 slots carrega (os novos começam vazios) e acha lugar pros órfãos', () => {
    const old = new Inventory().serialize();
    old.slots = old.slots.slice(0, 24);
    old.resources = { ...old.resources, wood: 7 };
    const loaded = Inventory.deserialize(old);
    expect(loaded.getSlot(0)?.id).toBe(new Inventory().getSlot(0)?.id);
    expect(slotIds(loaded)).toContain('resource:wood');
    expect(loaded.serialize().slots.length).toBe(INVENTORY_SIZE);
  });
});

describe('aviso de item que não coube na Hotbar', () => {
  it('item novo com a Hotbar cheia avisa que foi pro caderno; com a Bolsa toda cheia, que não coube', () => {
    const inventory = new Inventory();
    inventory.takeSlotNotices();
    // Enche o que sobrou da Hotbar: dentro dela, nada a avisar.
    for (let index = 0; index < HOTBAR_SIZE; index++) if (!inventory.getSlot(index)) inventory.addResources(`hotbar-${index}`, 1);
    expect(inventory.takeSlotNotices()).toEqual([]);

    inventory.addSeeds('potato', 10);
    expect(inventory.takeSlotNotices()).toEqual([{ ref: { category: 'seed', id: 'potato' }, where: 'notebook' }]);
    inventory.addSeeds('potato', 5); // Já tem slot: sem aviso de novo.
    expect(inventory.takeSlotNotices()).toEqual([]);

    for (let index = 0; index < INVENTORY_SIZE; index++) if (!inventory.getSlot(index)) inventory.addResources(`fill-${index}`, 1);
    inventory.takeSlotNotices();
    inventory.addSeeds('onion', 3);
    expect(inventory.takeSlotNotices()).toEqual([{ ref: { category: 'seed', id: 'onion' }, where: 'full' }]);
  });
});

describe('slots trancados da Bolsa (melhoria "Bolsa maior")', () => {
  const fillAll = (inventory: Inventory): void => {
    for (let index = 0; inventory.hasFreeSlot(); index++) inventory.addResources(`fill-${index}`, 1);
  };

  it('começa com os 2 últimos andares do caderno (12 slots) trancados: nada novo entra neles', () => {
    const inventory = new Inventory();
    expect(LOCKED_BAG_SLOTS).toBe(12);
    expect(inventory.getUnlockedSlotCount()).toBe(BASE_UNLOCKED_SLOTS);
    fillAll(inventory);
    for (let index = BASE_UNLOCKED_SLOTS; index < INVENTORY_SIZE; index++) expect(inventory.isSlotLocked(index) && inventory.getSlot(index)).toBe(null);
    expect(inventory.hasFreeSlot()).toBe(false);
    expect(inventory.hasRoomFor({ category: 'resource', id: 'novo' })).toBe(false);
  });

  it('arrastar um item pra um slot trancado não vale; tirar de lá (save antigo) pra um livre vale', () => {
    const inventory = new Inventory();
    inventory.addResources('stone', 5);
    const stone = Array.from({ length: INVENTORY_SIZE }, (_, index) => index).find((index) => inventory.getSlot(index)?.id === 'stone')!;
    inventory.swapSlots(stone, INVENTORY_SIZE - 1);
    expect(inventory.getSlot(stone)?.id).toBe('stone');
    expect(inventory.canSwapSlots(stone, INVENTORY_SIZE - 1)).toBe(false);

    const old = inventory.serialize();
    old.slots[INVENTORY_SIZE - 1] = { category: 'resource', id: 'stone' };
    old.slots[stone] = null;
    const loaded = Inventory.deserialize(old);
    const free = Array.from({ length: BASE_UNLOCKED_SLOTS }, (_, index) => index).find((index) => !loaded.getSlot(index))!;
    expect(loaded.canSwapSlots(INVENTORY_SIZE - 1, free)).toBe(true);
  });

  it('ao aplicar a trava, item parado num slot trancado vai pra um slot livre; destrancar libera os 12 e dá slot aos órfãos', () => {
    const old = new Inventory().serialize();
    old.slots[INVENTORY_SIZE - 2] = { category: 'resource', id: 'wood' };
    old.resources = { ...old.resources, wood: 3 };
    const loaded = Inventory.deserialize(old);
    loaded.setUnlockedSlotCount(BASE_UNLOCKED_SLOTS);
    expect(loaded.getSlot(INVENTORY_SIZE - 2)).toBe(null);
    expect(slotIds(loaded)).toContain('resource:wood');

    fillAll(loaded);
    loaded.addResources('orphan', 2); // Bolsa cheia: fica sem slot.
    expect(slotIds(loaded)).not.toContain('resource:orphan');
    loaded.setUnlockedSlotCount(INVENTORY_SIZE);
    expect(loaded.isSlotLocked(INVENTORY_SIZE - 1)).toBe(false);
    expect(slotIds(loaded)).toContain('resource:orphan');
    expect(loaded.hasFreeSlot()).toBe(true);
  });
});
