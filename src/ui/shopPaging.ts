/**
 * PÁGINAS DA LOJA (`ui/shopMenu.ts`): a página esquerda do livro tem um grid fixo de itens; uma aba com mais itens que isso (as sementes
 * da Lia, depois dos cultivos do pacote) vira várias páginas, com setas embaixo do grid. Lógica pura.
 */

/** Quantas páginas uma lista de `count` itens ocupa (sempre pelo menos 1, mesmo vazia). */
export function shopPageCount(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / perPage));
}

/** A página `page` (0 = a primeira; fora da faixa, a mais próxima) da lista. */
export function shopPageItems<T>(items: readonly T[], page: number, perPage: number): T[] {
  const last = shopPageCount(items.length, perPage) - 1;
  const index = Math.min(Math.max(0, page), last);
  return items.slice(index * perPage, (index + 1) * perPage);
}

/** A página depois de virar `delta` (presa entre a primeira e a última). */
export function turnShopPage(page: number, delta: number, count: number, perPage: number): number {
  return Math.min(Math.max(0, page + delta), shopPageCount(count, perPage) - 1);
}
