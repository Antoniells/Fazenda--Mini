/**
 * Definições de objetos decorativos/construções posicionáveis (Fase 6).
 * Mesma filosofia de `data/crops.ts`: estrutura de dados separada da
 * lógica (`systems/decorationPlacement.ts`) — adicionar uma nova decoração
 * no futuro é só acrescentar uma entrada aqui.
 */
export interface DecorationDefinition {
  id: string;
  name: string;
  textureKey: string;
  texturePath: string;
  /** Nome do frame recortado manualmente (registrado uma vez em `MainScene`). */
  frameName: string;
  /** Retângulo do recorte no spritesheet original. */
  frameRect: { x: number; y: number; width: number; height: number };
  /** Preço (moedas) para comprar na Loja. */
  price: number;
  /**
   * Quantas células do `WalkableGrid` a construção ocupa (Fase 9 —
   * Construções Multi-tile), a partir da célula onde foi colocada (canto
   * superior-esquerdo do footprint, expandindo pra direita/baixo:
   * `col..col+width-1`, `row..row+height-1`). Objetos 1x1 (a maioria)
   * simplesmente usam `{ width: 1, height: 1 }`, igual ao comportamento de
   * antes desta fase.
   */
  footprint: { width: number; height: number };
}

/**
 * `Objects/Exterior/Well .png` (128x192, note o espaço no nome do arquivo):
 * uma folha com variações de poço decorativo. O primeiro ícone (canto
 * superior esquerdo) foi isolado varrendo os pixels não-transparentes um a
 * um (não estimado visualmente) — os poços vizinhos ficam colados lado a
 * lado sem uma grade limpa de 16px, então um recorte "no olho" cortaria a
 * arte errado, do mesmo jeito que já aconteceu antes com o cursor de
 * seleção.
 *
 * `footprint: { width: 2, height: 1 }` (Fase 9): o sprite (28px) renderiza
 * bem mais largo que 1 tile (16px nativos) — sem isso, dois poços cabiam
 * lado a lado se sobrepondo visualmente, já que o `WalkableGrid` só
 * bloqueava a célula onde o clique caiu.
 */
export const WELL: DecorationDefinition = {
  id: 'well',
  name: 'Poço',
  textureKey: 'decor-well',
  texturePath: 'Objects/Exterior/Well .png',
  frameName: 'decor-well-icon',
  frameRect: { x: 0, y: 10, width: 28, height: 38 },
  price: 40,
  footprint: { width: 2, height: 1 },
};

/**
 * `Objects/Work Benches/Workbench.png` (32x32, um único sprite de bancada
 * com machado e pano de trabalho): recorte pixel a pixel (mesmo processo do
 * Poço) achou o conteúdo real em `x:8, y:6, w:16, h:18` — cabe numa célula
 * (16px), só a base/pezinhos passam 2px do topo do tile de baixo, igual
 * várias outras decorações verticais já no jogo. Fase 8 — Crafting: onde o
 * jogador fabrica as Receitas (`data/recipes.ts`) compradas na Loja, usando
 * os recursos do `Inventory` — a interação/lógica da Bancada em si é um
 * passo futuro, isto aqui só a deixa comprável/posicionável como qualquer
 * outra decoração (mesmo fluxo do Poço).
 */
export const WORKBENCH: DecorationDefinition = {
  id: 'workbench',
  name: 'Bancada de Trabalho',
  textureKey: 'decor-workbench',
  texturePath: 'Objects/Work Benches/Workbench.png',
  frameName: 'decor-workbench-icon',
  frameRect: { x: 8, y: 6, width: 16, height: 18 },
  price: 60,
  footprint: { width: 1, height: 1 },
};

export const DECORATIONS: Record<string, DecorationDefinition> = {
  [WELL.id]: WELL,
  [WORKBENCH.id]: WORKBENCH,
};
