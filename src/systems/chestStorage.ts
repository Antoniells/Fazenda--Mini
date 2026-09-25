import { gameState } from './gameState';
import { Inventory } from './inventory';
import type { SlotRef } from '../data/items';

/** Uma pilha guardada no baú: o mesmo `categoria + id` do Inventário, com quantidade. Ferramentas/armaduras são pilhas de 1. */
export interface ChestSlot extends SlotRef {
  amount: number;
}

/** Quantas pilhas DIFERENTES cabem num baú (a mesma grade 8x3 da Bolsa). */
export const CHEST_SLOT_COUNT = 24;

/**
 * Baús da casa. O conteúdo vive em `gameState.chests` (vai pro save), indexado pelo id do baú — a célula-âncora
 * (`"col,row"`) do móvel na casa, então cada baú posicionado tem o seu estoque, independente da cena existir.
 * Só dados: quem desenha o baú é a `HouseScene` (`systems/furniturePlacement.ts`) e quem mostra a tela é `ui/chestMenu.ts`.
 */
/**
 * Id do baú posicionado na FAZENDA (`systems/decorationPlacement.ts`, pedido explícito — o baú também pode ficar fora da casa). Tem
 * prefixo pra nunca colidir com o de um baú da casa que esteja na mesma célula-âncora (`"col,row"`, sem prefixo — o formato antigo, que os
 * saves existentes já usam).
 */
export function farmChestId(col: number, row: number): string {
  return `farm:${col},${row}`;
}

export function getChestSlots(chestId: string): ChestSlot[] {
  let slots = gameState.chests[chestId];
  if (!slots) {
    slots = [];
    gameState.chests[chestId] = slots;
  }
  return slots;
}

export function isChestEmpty(chestId: string): boolean {
  return (gameState.chests[chestId]?.length ?? 0) === 0;
}

/** Descarta o estoque de um baú que foi recolhido (só acontece vazio — ver `ChestMenu`). */
export function discardChest(chestId: string): void {
  delete gameState.chests[chestId];
}

export type TransferResult = { moved: number; reason?: 'chest-full' | 'bag-full' | 'not-allowed' | 'nothing' };

/**
 * Bolsa → baú: tira até `amount` da Bolsa e guarda no baú. Só move o que o baú comporta (junta na pilha que já
 * existe ou usa uma vaga livre) — e só depois de tirar da Bolsa de verdade (`Inventory.removeStack`), então nada
 * duplica nem some. `moved` é quanto realmente passou.
 */
export function depositToChest(inventory: Inventory, chestId: string, ref: SlotRef, amount: number): TransferResult {
  const slots = getChestSlots(chestId);
  const existing = slots.find((slot) => slot.category === ref.category && slot.id === ref.id);
  if (!existing && slots.length >= CHEST_SLOT_COUNT) return { moved: 0, reason: 'chest-full' };

  const taken = inventory.removeStack(ref, amount);
  if (taken <= 0) return { moved: 0, reason: 'nothing' };

  if (existing) existing.amount += taken;
  else slots.push({ category: ref.category, id: ref.id, amount: taken });
  return { moved: taken };
}

/**
 * Baú → bolsa: devolve até `amount` à Bolsa. Antes de tirar do baú confere que a Bolsa aceita (tem vaga de slot ou
 * já tem a pilha — `Inventory.hasRoomFor`) e o que ela de fato aceitou (`addStack`; uma ferramenta que conflita com a
 * progressão do jogador, por exemplo, é recusada) — o baú só perde o que a Bolsa realmente recebeu.
 */
export function withdrawFromChest(inventory: Inventory, chestId: string, ref: SlotRef, amount: number): TransferResult {
  const slots = getChestSlots(chestId);
  const index = slots.findIndex((slot) => slot.category === ref.category && slot.id === ref.id);
  if (index === -1) return { moved: 0, reason: 'nothing' };

  if (!inventory.hasRoomFor(ref)) return { moved: 0, reason: 'bag-full' };
  const wanted = Math.min(amount, slots[index].amount);
  const received = inventory.addStack(ref, wanted);
  if (received <= 0) return { moved: 0, reason: 'not-allowed' };

  slots[index].amount -= received;
  if (slots[index].amount <= 0) slots.splice(index, 1);
  return { moved: received };
}
