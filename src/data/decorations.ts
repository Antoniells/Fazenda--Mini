import { COPPER_BAR, GOLD_BAR, IRON, STONE } from './resources';

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
  /** Recursos gastos ALÉM das moedas na compra (os aspersores): id de `data/resources.ts` e quantidade. A loja mostra o que o jogador tem e só compra com tudo. */
  materials?: Array<{ resourceId: string; amount: number }>;
  /** Texto curto da Loja (painel de detalhe do item selecionado). */
  description: string;
  /**
   * Quantas células do `WalkableGrid` a construção ocupa (Fase 9 —
   * Construções Multi-tile), a partir da célula onde foi colocada (canto
   * superior-esquerdo do footprint, expandindo pra direita/baixo:
   * `col..col+width-1`, `row..row+height-1`). Objetos 1x1 (a maioria)
   * simplesmente usam `{ width: 1, height: 1 }`, igual ao comportamento de
   * antes desta fase.
   */
  footprint: { width: number; height: number };
  /**
   * Animação da construção posicionada (ex.: o aspersor jorrando): frames do MESMO spritesheet, na ordem, trocados a cada
   * `animationFrameMs`. O 1º é o quadro de REPOUSO da construção posicionada (o `frameName`/`frameRect` continua sendo só o
   * ÍCONE estático da Loja/Bolsa — pode ser um recorte mais justo). Em loop, ou UMA vez por manhã (`animatesEachMorning`).
   * Ausente = imagem parada.
   */
  animationFrames?: Array<{ name: string; rect: { x: number; y: number; width: number; height: number } }>;
  animationFrameMs?: number;
  /** Ponto de apoio vertical (0-1) dos quadros de animação — onde fica o "pé" da construção dentro do quadro. Padrão 1 (base do quadro). */
  animationOriginY?: number;
  /** A animação toca uma única vez por dia, de manhã (`MORNING_ANIMATION_HOURS`), em vez de girar em loop o tempo todo — ver `DecorationPlacementSystem.playMorningAnimations`. */
  animatesEachMorning?: boolean;
  /**
   * Só aspersores: quais terras ele rega toda manhã, a partir da borda do `footprint` (ver `sprinklerReachCells` em `systems/sprinklers.ts`).
   * `'cross'` = só as terras coladas nos 4 lados (cima, baixo, esquerda, direita); `'square'` = todas as do quadrado em volta. `radius` = quantas
   * células pra fora da borda. Num aspersor 1x1: cross/1 = 4 terras, square/1 = 8, square/2 = 24. Ausente = não rega.
   */
  waterReach?: { radius: number; shape: 'cross' | 'square' };
  /**
   * Onde pode ser posicionada: `'outsideFarmland'` (padrão — Poço, Fornalha: nunca no meio do canteiro),
   * `'farmland'` (só em terreno de plantio AINDA NÃO ARADO — o aspersor) ou `'house'` (MÓVEL: só dentro da casa, na
   * `HouseScene`, por `systems/furniturePlacement.ts` — na Fazenda nunca). Ver `DecorationPlacementSystem.canPlaceAt`.
   */
  placement?: 'outsideFarmland' | 'farmland' | 'house';
  /** Móvel (`placement: 'house'`) que TAMBÉM pode ser posicionado fora de casa, na Fazenda (fora da lavoura) — o Baú, pedido explícito. Lá o `DecorationPlacementSystem` cuida dele. */
  outdoor?: boolean;
  /**
   * Dá pra SENTAR nele (Cadeira, Sofá — `systems/furniturePlacement.ts`, pose `Sitting` do personagem): interagir sem a Picareta senta o
   * jogador. `x`/`y` = onde ficam os pés dele, em px de mundo, a partir do MEIO DA BASE da célula do assento (x>0 direita, y>0 baixo) — o
   * ajuste fino da posição de cada móvel.
   */
  seat?: { x: number; y: number };
  /** Não é vendida na Loja (chega ao jogador por outro meio — ex.: a caminha do pet, dada ao liberar o bichinho). */
  notForSale?: boolean;
  /** O terreno de plantio sob ela fica travado pra enxada (`Farmland.setTillLocked`) enquanto ela estiver posicionada — só faz sentido com `placement: 'farmland'`. */
  locksTilling?: boolean;
  /** Só o Galinheiro: abriga galinhas (`data/animals.ts`, `systems/animals.ts`) — interagir recolhe os ovos em vez de recolher a construção; a Picareta só o quebra vazio de galinhas. */
  isCoop?: boolean;
  /** Só o Baú: guarda itens (`systems/chestStorage.ts`, `ui/chestMenu.ts`) — interagir abre a tela do baú em vez de recolher o móvel. */
  isChest?: boolean;
  /** Estrutura grande construída pelo Marceneiro: a loja dele NÃO entrega pra Bolsa — o jogador escolhe o local na Fazenda e o Tomás constrói no dia seguinte (`data/construction.ts`). */
  carpenterBuilt?: boolean;
  /** Quanto tempo (horas do relógio do jogo) o Tomás leva pra construir — só com `carpenterBuilt`; padrão `DEFAULT_BUILD_HOURS`. */
  buildHours?: number;
  /** A animação (do 2º quadro em diante, em loop) toca só ENQUANTO a construção está em uso — a Fornalha acesa (`DecorationPlacementSystem.lightUsedStructures`); parada, fica no 1º quadro (o de repouso). */
  animatesWhenUsed?: boolean;
  /** Multiplica a escala de exibição padrão (`DISPLAY_SCALE`) — pra arte cujo frame é maior que o tile (o aspersor tem 48px num tile de 16). Padrão 1. */
  displayScaleMultiplier?: number;
}

/** Janela da manhã (horas do relógio do jogo, [de, até)) em que as construções com `animatesEachMorning` tocam a animação do dia. */
export const MORNING_ANIMATION_HOURS = { from: 6, to: 12 };

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
  description: 'Encha o regador aqui. Interaja com o poço pra reabastecer a água.',
  footprint: { width: 2, height: 1 },
  carpenterBuilt: true,
  buildHours: 2,
};

/**
 * Fornalha (Ferreiro/mineração — substitui a antiga Bancada de Trabalho): `Objects/Work Benches/Furnace.png` (160x32) traz 5 quadros de 32x32 da mesma fornalha de tijolos —
 * o 1º apagada (o de repouso) e os 4 seguintes com o fogo aceso. O conteúdo de cada quadro (varredura pixel a pixel) é 18x28 em (6 + 32*n, 2): cabe numa célula. O jogador a encomenda
 * ao Marceneiro (`carpenterBuilt`) e, ao interagir, abre a tela de fundição (`ui/furnaceMenu.ts`, `data/smelting.ts`): 5 minérios brutos + 3 Carvões = 1 barra. A cada fundição
 * o fogo acende por alguns segundos (`animatesWhenUsed`).
 */
const FURNACE_FRAME_COUNT = 5;
const furnaceFrame = (index: number) => ({ name: `decor-furnace-${index}`, rect: { x: 6 + 32 * index, y: 2, width: 18, height: 28 } });

export const FURNACE: DecorationDefinition = {
  id: 'furnace',
  name: 'Fornalha',
  textureKey: 'decor-furnace',
  texturePath: 'Objects/Work Benches/Furnace.png',
  frameName: 'decor-furnace-icon',
  frameRect: { x: 6, y: 2, width: 18, height: 28 },
  price: 250,
  description: 'Funde minério em barras: 5 minérios brutos + 3 Carvões = 1 barra. Interaja com ela pra fundir.',
  footprint: { width: 1, height: 1 },
  carpenterBuilt: true,
  buildHours: 3,
  animationFrames: Array.from({ length: FURNACE_FRAME_COUNT }, (_unused, index) => furnaceFrame(index)),
  animationFrameMs: 130,
  animatesWhenUsed: true,
};

/**
 * Aspersores (pedido explícito — venda na Loja, rega sozinho toda manhã), em 3 tiers de raio crescente.
 * `Objects/Props/Sprinkler Tiers.png` (165x28, com alfa): 3 ícones estáticos lado a lado (madeira/ferro/ouro), recorte pixel a
 * pixel (mesmo processo do Poço) — sem grade uniforme. Ao contrário do aspersor antigo (`Sprinkler.webp`, ainda no repo mas
 * sem uso — a arte nova não trouxe quadros de água jorrando), estes não animam sozinhos: ficam parados, e quem mostra a rega
 * acontecendo é o respingo sobre a terra molhada (`FarmlandRenderer.spawnWaterSplash`, `data/effects.ts`).
 *
 * Todos os 3 têm o mesmo recorte (25x23) — por isso o mesmo `displayScaleMultiplier` (16/25, encolhe pro tamanho de 1
 * célula) serve pros três. Ocupam EXATAMENTE 1 tile e só podem ser posicionados em terreno de plantio ainda não arado
 * (`placement: 'farmland'`); enquanto estiverem ali, a enxada não age naquele bloco (`locksTilling`). Só saem do chão com um
 * golpe de Picareta (qualquer tier), que os derruba como item no chão (ver `PlacedDecorationInteractable`).
 *
 * O de madeira mantém o id `'sprinkler'` (o único que já existia) pra não quebrar saves com um já posicionado no mundo.
 * Preço do ferro/ouro é um ponto de partida — fácil de ajustar aqui embaixo.
 */
const SPRINKLER_ICON = { width: 25, height: 23 };
const SPRINKLER_DISPLAY_SCALE_MULTIPLIER = 16 / SPRINKLER_ICON.width;

export const SPRINKLER_WOOD: DecorationDefinition = {
  id: 'sprinkler',
  name: 'Aspersor de Cobre',
  textureKey: 'decor-sprinkler-tiers',
  texturePath: 'Objects/Props/Sprinkler Tiers.png',
  frameName: 'decor-sprinkler-wood-icon',
  frameRect: { x: 4, y: 4, ...SPRINKLER_ICON },
  price: 300,
  materials: [{ resourceId: COPPER_BAR.id, amount: 5 }, { resourceId: STONE.id, amount: 10 }],
  description: 'Rega as 4 terras coladas nele (em cruz) toda manhã. Só em terra não arada.',
  footprint: { width: 1, height: 1 },
  waterReach: { radius: 1, shape: 'cross' },
  placement: 'farmland',
  locksTilling: true,
  displayScaleMultiplier: SPRINKLER_DISPLAY_SCALE_MULTIPLIER,
};

export const SPRINKLER_IRON: DecorationDefinition = {
  id: 'sprinkler-iron',
  name: 'Aspersor de Ferro',
  textureKey: 'decor-sprinkler-tiers',
  texturePath: 'Objects/Props/Sprinkler Tiers.png',
  frameName: 'decor-sprinkler-iron-icon',
  frameRect: { x: 37, y: 4, ...SPRINKLER_ICON },
  price: 900,
  materials: [{ resourceId: IRON.id, amount: 5 }, { resourceId: STONE.id, amount: 10 }],
  description: 'Rega as 8 terras em volta (3x3) toda manhã. Só em terra não arada.',
  footprint: { width: 1, height: 1 },
  waterReach: { radius: 1, shape: 'square' },
  placement: 'farmland',
  locksTilling: true,
  displayScaleMultiplier: SPRINKLER_DISPLAY_SCALE_MULTIPLIER,
};

export const SPRINKLER_GOLD: DecorationDefinition = {
  id: 'sprinkler-gold',
  name: 'Aspersor de Ouro',
  textureKey: 'decor-sprinkler-tiers',
  texturePath: 'Objects/Props/Sprinkler Tiers.png',
  frameName: 'decor-sprinkler-gold-icon',
  frameRect: { x: 70, y: 4, ...SPRINKLER_ICON },
  price: 4000,
  materials: [{ resourceId: GOLD_BAR.id, amount: 5 }, { resourceId: IRON.id, amount: 5 }],
  description: 'Rega as 24 terras em volta (5x5) toda manhã. Só em terra não arada.',
  footprint: { width: 1, height: 1 },
  waterReach: { radius: 2, shape: 'square' },
  placement: 'farmland',
  locksTilling: true,
  displayScaleMultiplier: SPRINKLER_DISPLAY_SCALE_MULTIPLIER,
};

/**
 * MÓVEIS (objetos estáticos com colisão, só pra dentro da casa — `placement: 'house'`): comprados na Loja como
 * qualquer decoração (aba Construção) e posicionados na `HouseScene` (`systems/furniturePlacement.ts`), onde
 * bloqueiam as células do `footprint` no grid. Recortes pixel a pixel (bounds do alfa) de `Objects/Interior/*` e
 * `Objects/Exterior/chest.png` (32x16 por baú, o 2º — cantos dourados). Trocar a arte = trocar `texturePath`/`frameRect`.
 */
const INTERIOR_DIR = 'Objects/Interior';

export const CHEST: DecorationDefinition = {
  id: 'chest',
  name: 'Baú',
  textureKey: 'furniture-chest',
  texturePath: 'Objects/Exterior/chest.png',
  frameName: 'furniture-chest-icon',
  frameRect: { x: 40, y: 1, width: 15, height: 14 },
  price: 120,
  description: 'Guarde itens da sua bolsa. Interaja com o baú pra abrir. Fica na casa ou na Fazenda.',
  footprint: { width: 1, height: 1 },
  placement: 'house',
  outdoor: true,
  isChest: true,
};

export const CHAIR: DecorationDefinition = {
  id: 'chair',
  name: 'Cadeira',
  textureKey: 'furniture-chairs',
  texturePath: `${INTERIOR_DIR}/Chairs.png`,
  frameName: 'furniture-chair-icon',
  frameRect: { x: 130, y: 13, width: 11, height: 18 }, // 18 = até o fim das pernas (y=30); com 15 as pernas ficavam cortadas.
  price: 40,
  description: 'Uma cadeira de madeira. Móvel: só dentro de casa.',
  footprint: { width: 1, height: 1 },
  placement: 'house',
  seat: { x: 0, y: -1 },
};

export const TABLE: DecorationDefinition = {
  id: 'table',
  name: 'Mesa',
  textureKey: 'furniture-tables',
  texturePath: `${INTERIOR_DIR}/Tables and desks.png`,
  frameName: 'furniture-table-icon',
  frameRect: { x: 0, y: 8, width: 32, height: 19 },
  price: 90,
  description: 'Uma mesa de 2 blocos. Móvel: só dentro de casa.',
  footprint: { width: 2, height: 1 },
  placement: 'house',
};

export const SOFA: DecorationDefinition = {
  id: 'sofa',
  name: 'Sofá',
  textureKey: 'furniture-sofas',
  texturePath: `${INTERIOR_DIR}/Sofa and armchair.png`,
  frameName: 'furniture-sofa-icon',
  frameRect: { x: 162, y: 11, width: 29, height: 20 },
  price: 150,
  description: 'Um sofá verde de 2 blocos. Móvel: só dentro de casa.',
  footprint: { width: 2, height: 1 },
  placement: 'house',
  seat: { x: -8, y: -1 },
};

export const DRESSER: DecorationDefinition = {
  id: 'dresser',
  name: 'Cômoda',
  textureKey: 'furniture-dressers',
  texturePath: `${INTERIOR_DIR}/Dressers.png`,
  frameName: 'furniture-dresser-icon',
  frameRect: { x: 64, y: 8, width: 16, height: 16 },
  price: 100,
  description: 'Uma cômoda de madeira. Móvel: só dentro de casa.',
  footprint: { width: 1, height: 1 },
  placement: 'house',
};

/** A caminha do bichinho (almofada rosa de `Interior/cats furniture.png`, 24x20): presente ao liberar o pet, não se compra. Móvel de 2 blocos, só dentro de casa. */
export const PET_BED: DecorationDefinition = {
  id: 'pet-bed',
  name: 'Caminha do Bichinho',
  textureKey: 'furniture-cat-furniture',
  texturePath: `${INTERIOR_DIR}/cats furniture.png`,
  frameName: 'furniture-pet-bed-icon',
  frameRect: { x: 99, y: 11, width: 24, height: 20 },
  price: 0,
  description: 'Uma caminha macia pro seu bichinho. Móvel: só dentro de casa.',
  footprint: { width: 2, height: 1 },
  placement: 'house',
  notForSale: true,
};

/**
 * Galinheiro (Fase 7 — Animais): a casinha de `Objects/Exterior/Houses/Farm Buildings/Chicken Coop/Chicken Coop.png` (480x224, um kit de peças) —
 * usada a montada da 1ª linha (telhado escuro, parede vermelha com coração e porta de madeira), recorte pixel a pixel pelo alfa (55x78). A arte é
 * alta (o telhado), então encolhe pra 80% (`displayScaleMultiplier`); só a base (3x2 células) bloqueia a passagem — o resto do telhado passa por cima de
 * quem anda atrás. Abriga 4 galinhas (`COOP_CAPACITY`); a porta fica no lado direito da base (por onde as galinhas saem, `systems/chickenFlock.ts`).
 */
export const CHICKEN_COOP: DecorationDefinition = {
  id: 'chicken-coop',
  name: 'Galinheiro',
  textureKey: 'decor-chicken-coop',
  texturePath: 'Objects/Exterior/Houses/Farm Buildings/Chicken Coop/Chicken Coop.png',
  frameName: 'decor-chicken-coop-icon',
  frameRect: { x: 13, y: 2, width: 55, height: 78 },
  price: 300,
  description: 'Abriga até 4 galinhas (compre-as na aba Animais). Toda manhã há ovos: clique no galinheiro pra recolher.',
  footprint: { width: 3, height: 2 },
  displayScaleMultiplier: 0.8,
  isCoop: true,
  carpenterBuilt: true,
  buildHours: 3,
};

export const DECORATIONS: Record<string, DecorationDefinition> = {
  [WELL.id]: WELL,
  [FURNACE.id]: FURNACE,
  [SPRINKLER_WOOD.id]: SPRINKLER_WOOD,
  [SPRINKLER_IRON.id]: SPRINKLER_IRON,
  [SPRINKLER_GOLD.id]: SPRINKLER_GOLD,
  [CHEST.id]: CHEST,
  [CHAIR.id]: CHAIR,
  [TABLE.id]: TABLE,
  [SOFA.id]: SOFA,
  [DRESSER.id]: DRESSER,
  [PET_BED.id]: PET_BED,
  [CHICKEN_COOP.id]: CHICKEN_COOP,
};

/** Decorações que saíram do jogo (id → o que custavam): um save antigo que ainda as tenha (no mundo, numa encomenda ou na Bolsa) as perde e recebe o valor de volta em moedas (`SaveManager`). */
export const REMOVED_DECORATIONS: Record<string, number> = {
  workbench: 60, // A Bancada de Trabalho (não há mais receitas): substituída pela Fornalha.
};

/** Só os móveis (`placement: 'house'`) — o que a `HouseScene` sabe posicionar. */
export const FURNITURE: DecorationDefinition[] = Object.values(DECORATIONS).filter((decoration) => decoration.placement === 'house');
