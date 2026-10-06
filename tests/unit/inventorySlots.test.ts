import { describe, expect, it } from 'vitest';
import { HOTBAR_SIZE, INVENTORY_SIZE, Inventory, STORAGE_SIZE } from '../../src/systems/inventory';

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
