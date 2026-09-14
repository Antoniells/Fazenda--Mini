import { TILE_SIZE, PLAYER_HOUSE_TILE_COLS, PLAYER_HOUSE_TILE_ROWS, PLAYER_HOUSE_DOOR_OFFSET } from '../tiles';

export type ExpansionDirection = 'north' | 'south' | 'east' | 'west';

/**
 * Identidade temática de cada região do mundo (Fase 6.1 — Biomas): o núcleo
 * original e os 4 trechos de expansão ao redor, cada um inspirado num bioma
 * do Forager. Só descreve "o que é" cada região — as mecânicas de cada
 * bioma (minerar pedra, pescar, combater na caverna) são de fases futuras;
 * por ora isso só orienta a tintagem do chão (`systems/mapBuilder.ts`) e o
 * texto das placas de compra (`systems/propertyExpansion.ts`).
 */
export type BiomeId = 'core' | 'mining' | 'lumber' | 'beach' | 'cave';

/** Nome exibido de cada bioma — usado nos logs/textos da placa de compra. */
export const BIOME_LABELS: Record<BiomeId, string> = {
  core: 'Fazenda',
  mining: 'Mineração',
  lumber: 'Madeireira',
  beach: 'Praia',
  cave: 'Cavernas',
};

/**
 * Um trecho de terra bloqueado ao redor da propriedade original (o
 * "núcleo", `cols` x `rows`), comprável individualmente — inspirado no
 * Forager: vários trechos ao redor, cada um com sua própria placa física,
 * em vez de uma única expansão genérica. `col0/row0/cols/rows` são
 * absolutos (podem ser negativos, para norte/oeste) — a grama e a câmera já
 * alcançam esse retângulo desde o início (ver `MainScene.create`), mas ele
 * fica isolado pela parede do núcleo nesse lado até a compra.
 */
export interface ExpansionChunk {
  direction: ExpansionDirection;
  /** Bioma temático deste trecho (ver `BiomeId`) — norte=cavernas, sul=praia, leste=madeireira, oeste=mineração. */
  biome: BiomeId;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
  price: number;
  /** Célula (col, row) DENTRO do núcleo, encostada na parede desse lado — onde fica a placa de compra. */
  signPosition: [number, number];
}

/**
 * Requisito para atravessar uma ponte (Sistema de Cenas) — ver `BridgeDefinition`.
 * `items` reaproveita `Inventory.getCount` (estoque de colheita por id, a
 * única contagem "genérica por id" que já existe): fica pronto pra quando
 * houver recursos coletáveis de outras áreas (madeira, pedra — Fase 7,
 * ainda pendente), mas nenhuma ponte usa isso ainda porque esses itens
 * não existem de verdade no jogo hoje.
 */
export interface BridgeRequirement {
  /** Moedas necessárias para atravessar (ausente/0 = sem custo em moedas). */
  coins?: number;
  items?: Array<{ itemId: string; amount: number; label: string }>;
}

/**
 * Uma ponte de transição de CENA (não confundir com `ExpansionChunk`, que
 * expande a MESMA cena): cada lado do núcleo tem uma, ligando a
 * `MainScene` a uma cena de destino totalmente separada (Fase "Sistema de
 * Cenas") — troca real de `Phaser.Scene` (hard cut), não câmera contínua.
 *
 * `col`/`row` ficam sobre a própria parede do núcleo (a mesma linha onde a
 * cerca é desenhada) — célula sempre bloqueada no `WalkableGrid` (o anel
 * externo do núcleo já é bloqueado incondicionalmente, ver
 * `systems/grid.ts`), então nunca colide com a posição da placa de compra
 * de expansão daquele lado (que fica UMA célula pra dentro, não na própria
 * parede). Ver `systems/bridgeSystem.ts` para a interação/travessia.
 */
export interface BridgeDefinition {
  direction: ExpansionDirection;
  col: number;
  row: number;
  /** Nome de exibição do destino (ex.: "Floresta") — mostrado na placa/mensagem de bloqueio. */
  destinationName: string;
  /**
   * Chave da cena Phaser de destino (string solta de propósito — `data/`
   * não deve importar de `scenes/`, ver CLAUDE.md regra 6). Precisa bater
   * com a chave registrada em `scenes/ExternalAreaScene.ts` e na lista de
   * cenas de `config/gameConfig.ts`.
   */
  destinationSceneKey: string;
  requirement: BridgeRequirement;
}

/** Área retangular (canto superior-esquerdo + tamanho, em células) de uma estrutura estática do mapa — ver `FarmMapData.housePosition`. */
export interface RectArea {
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

export interface FarmMapData {
  tileSize: number;
  /** Dimensões do núcleo original da propriedade — não mudam com expansões. */
  cols: number;
  rows: number;
  /** Trechos de terra ao redor do núcleo, um por direção, compráveis independentemente. */
  expansions: ExpansionChunk[];
  /** Posições (col, row) da base das árvores decorativas. */
  treePositions: Array<[number, number]>;
  /** Células (col, row) que podem ser cultivadas (aradas, plantadas). */
  farmlandArea: Array<[number, number]>;
  /**
   * Célula (col, row) onde a Caixa de Remessas (ponto de venda, Fase 5)
   * fica — um objeto sólido, bloqueado no grid (`systems/grid.ts`), não
   * uma célula andável. O jogador interage encostado nela, não em cima.
   */
  shippingBinPosition: [number, number];
  /**
   * Célula (col, row) onde a banca da Loja fica — também um objeto sólido,
   * bloqueado no grid, com interação adjacente (mesmo mecanismo da Caixa
   * de Remessas).
   */
  shopPosition: [number, number];
  /**
   * Área retangular ocupada pela Casa do jogador (Fase 9) — bloqueada por
   * inteiro no grid (`systems/grid.ts`), igual a um objeto sólido gigante.
   * Tamanho vem de `PLAYER_HOUSE_TILE_COLS/ROWS` (o asset já é exatamente
   * 8x7 tiles, sem sobra).
   */
  housePosition: RectArea;
  /**
   * Célula (col, row) da porta da casa — a única célula da casa com
   * interação própria (dormir, ver `systems/sleepInteraction.ts`); as
   * demais só bloqueiam passagem. Calculada a partir de `housePosition` +
   * `PLAYER_HOUSE_DOOR_OFFSET`.
   */
  houseDoorPosition: [number, number];
  /**
   * Posições (col, row) de pedras no bioma de Mineração — placeholder vazio
   * (Fase 6.1): a mecânica de quebrar pedra é de uma fase futura, isso só
   * reserva o campo em `FarmMapData` pra quando formos popular o bioma.
   */
  rockPositions: Array<[number, number]>;
  /** Posições (col, row) de veios de minério no bioma de Mineração — mesmo status de `rockPositions`, placeholder pra fase futura. */
  orePositions: Array<[number, number]>;
  /** As 4 pontes de transição de cena, uma por lado do núcleo (ver `BridgeDefinition`). */
  bridges: BridgeDefinition[];
  foliagePositions: Array<[number, number]>;
}

/**
 * Geometria da cerca (decorativa e colisora, Fase 9) ao redor do retângulo
 * que contém `farmlandArea`, uma célula fora dela — mais o "portão"
 * (a única abertura, sem cerca nem colisão), alinhado com a coluna da
 * porta de casa pra um caminho natural de entrada. Fonte única usada tanto
 * por `systems/mapBuilder.ts` (desenho) quanto por `systems/grid.ts`
 * (colisão), pra nunca desenhar cerca onde não há colisão ou vice-versa.
 */
export interface FarmlandFenceLayout {
  col0: number;
  row0: number;
  colEnd: number;
  rowEnd: number;
  gate: [number, number];
}

export function getFarmlandFenceLayout(map: FarmMapData): FarmlandFenceLayout {
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const [col, row] of map.farmlandArea) {
    minCol = Math.min(minCol, col);
    minRow = Math.min(minRow, row);
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
  }

  const row0 = minRow - 1;
  return {
    col0: minCol - 1,
    row0,
    colEnd: maxCol + 1,
    rowEnd: maxRow + 1,
    // Portão no topo da cerca, na mesma coluna da porta de casa — o
    // caminho mais natural entre a casa e a lavoura.
    gate: [map.houseDoorPosition[0], row0],
  };
}

/**
 * Definição do mapa da fazenda: dimensões, grid, árvores e a área
 * cultivável. É a única fonte de verdade para essas posições — tanto o
 * desenho do mapa (`mapBuilder`) quanto a grade de colisão (`systems/grid`)
 * e a agricultura (`systems/farmland`) leem daqui, em vez de duplicar as
 * coordenadas. Novos elementos (construções, etc.) serão adicionados aqui
 * nas próximas fases, sem precisar alterar cena ou sistemas.
 *
 * Fase 9 — Expansão de mapa: núcleo ampliado de 25x18 para 40x30 e a área
 * de plantio de 4x3 (12 canteiros) para 12x8 (96 canteiros), para o
 * jogador ter espaço real de lucrar. Casa nova, posicionada acima da
 * lavoura com espaço de sobra pra circular; `PLAYER_START`
 * (`data/player.ts`) nasce bem na porta dela.
 */
const HOUSE_COL0 = 16;
const HOUSE_ROW0 = 2;

const housePosition: RectArea = {
  col0: HOUSE_COL0,
  row0: HOUSE_ROW0,
  cols: PLAYER_HOUSE_TILE_COLS,
  rows: PLAYER_HOUSE_TILE_ROWS,
};

export const farmMap: FarmMapData = {
  tileSize: TILE_SIZE,
  cols: 40,
  rows: 30,
  // Um trecho por lado do núcleo (40x30) — leste/oeste com a mesma altura
  // do núcleo, norte/sul com a mesma largura, sem cantos diagonais (formato
  // "cruz", igual ao Forager: você vê a terra travada ao redor da ilha
  // atual, mas cada trecho só se conecta a UM lado do que já é seu).
  // Cada trecho carrega seu bioma (ver `BiomeId`), pedido explícito do
  // usuário: oeste=Mineração (pedra, cobre, ferro, ouro), leste=Madeireira
  // (árvores, arbustos, plantio de frutíferas), sul=Praia/Mar,
  // norte=Cavernas — a mecânica de cada um (minerar, cortar árvore, pescar)
  // vem em fases futuras, isso só define QUAL região é qual.
  expansions: [
    { direction: 'east', biome: 'lumber', col0: 40, row0: 0, cols: 12, rows: 30, price: 120, signPosition: [38, 15] },
    { direction: 'west', biome: 'mining', col0: -12, row0: 0, cols: 12, rows: 30, price: 120, signPosition: [1, 15] },
    { direction: 'north', biome: 'cave', col0: 0, row0: -8, cols: 40, rows: 8, price: 100, signPosition: [20, 1] },
    { direction: 'south', biome: 'beach', col0: 0, row0: 30, cols: 40, rows: 8, price: 100, signPosition: [20, 28] },
  ],
  // Pontes de transição de cena (ver `BridgeDefinition`) — uma por lado do
  // núcleo, sobre a própria parede (linha da cerca), em colunas/linhas
  // diferentes das placas de expansão (que ficam uma célula pra dentro),
  // então nunca colidem fisicamente. `destinationSceneKey` precisa bater
  // com a chave (`super(key)`) de cada cena concreta em `scenes/*.ts` — ver
  // `scenes/ExternalMapScene.ts`. `destinationName` foi renomeado por
  // pedido explícito do usuário: a cena além da ponte se chama "Floresta"/
  // "Pedreira", mesmo a faixa de expansão dentro da Fazenda continuando
  // "Madeireira"/"Mineração" (`BIOME_LABELS` acima) — são nomes de coisas
  // diferentes (a faixa expansível vs. o mapa depois da ponte), só
  // coincidem pro par Praia/Cavernas.
  bridges: [
    { direction: 'north', col: 10, row: 0, destinationName: 'Cavernas', destinationSceneKey: 'CaveScene', requirement: { coins: 200 } },
    { direction: 'south', col: 30, row: 29, destinationName: 'Praia', destinationSceneKey: 'BeachScene', requirement: { coins: 300 } },
    { direction: 'west', col: 0, row: 10, destinationName: 'Pedreira', destinationSceneKey: 'QuarryScene', requirement: { coins: 250 } },
    { direction: 'east', col: 39, row: 20, destinationName: 'Floresta', destinationSceneKey: 'ForestScene', requirement: { coins: 250 } },
  ],
  treePositions: [
    [3, 3],
    [36, 3],
    [3, 26],
    [36, 26],
    [12, 4],
    [27, 4],
  ],
  // 12x8 = 96 canteiros, centralizada logo abaixo da casa/loja, com espaço
  // de sobra pra circular entre elas (linhas 9-12 ficam livres).
  farmlandArea: buildRectangle(14, 13, 12, 8),
  // Do lado de FORA da cerca da lavoura, no quintal, colada ao portão —
  // perto o bastante da entrada pra ser conveniente logo depois de colher,
  // sem ficar em cima da própria cerca/portão (pedido explícito: não
  // dentro do vão do portão, uma célula acima dele, já na grama).
  shippingBinPosition: [19, 11],
  // Ao lado direito da Casa (não mais no caminho entre a porta e a
  // lavoura, onde atrapalhava a passagem) — perto o bastante da entrada
  // pra ser conveniente, sem ficar bloqueando o corredor principal.
  shopPosition: [25, 7],
  housePosition,
  houseDoorPosition: [HOUSE_COL0 + PLAYER_HOUSE_DOOR_OFFSET[0], HOUSE_ROW0 + PLAYER_HOUSE_DOOR_OFFSET[1]],
  // Vazios por ora — bioma de Mineração ainda não tem a mecânica de
  // quebrar pedra/minério (fases futuras), só a região reservada.
  rockPositions: [],
  orePositions: [],
  foliagePositions: [
    [10, 12], // Coloque aqui as colunas e linhas onde as plantinhas estão!
    [15, 8],
  ],
};

/** Gera a lista de células (col, row) de um retângulo de `w` x `h` a partir de (`col0`, `row0`). */
function buildRectangle(col0: number, row0: number, w: number, h: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = row0; row < row0 + h; row++) {
    for (let col = col0; col < col0 + w; col++) {
      cells.push([col, row]);
    }
  }
  return cells;
}
