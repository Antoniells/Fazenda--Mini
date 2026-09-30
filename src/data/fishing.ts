import type { ResourceDefinition } from './resources';

/**
 * PESCA (Fase 11, etapa 1): só DADOS — os peixes de cada lugar, as raridades (o que muda no minijogo), a Vara de Pescar e os
 * recortes de arte do minijogo. A regra (sortear o peixe, o minijogo de timing, entregar o peixe) está em `systems/fishing.ts` e
 * `systems/fishingSession.ts`; os pontos de pesca (água da margem) em `systems/fishingSpots.ts`.
 *
 * Ícones: `Icons/Fish/<River|Sea>/<Nome>.png` — cada folha tem 4 quadros de 16x16 (o peixe, o peixe com contorno, a silhueta
 * vermelha e a branca, conferidos pixel a pixel); o ícone é o quadro 0.
 */

/** Onde se pesca: a Praia (mar), o lago da Floresta e o lago do santuário (andar 100 das Cavernas). */
export type FishingLocation = 'beach' | 'forestLake' | 'sanctuary';

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'golden';

export interface FishDefinition {
  /** Id do recurso na Bolsa (`RESOURCES`). */
  id: string;
  name: string;
  /** Caminho do ícone (folha 64x16, quadro 0) a partir de `assets/`. */
  iconPath: string;
  rarity: FishRarity;
  /** Onde ele morde. */
  locations: FishingLocation[];
  /** Venda na Caixa de Remessas (moedas por unidade). */
  sellPrice: number;
}

/**
 * Cada raridade no minijogo: chance relativa de morder (`weight`), quantos acertos seguidos pede (`hits`), quanto tempo o marcador
 * leva pra atravessar a barra (`sweepMs` — menor = mais rápido) e a largura da faixa verde (`zone`, fração da barra).
 */
export const FISH_RARITY: Record<FishRarity, { label: string; weight: number; hits: number; sweepMs: number; zone: number }> = {
  common: { label: 'Comum', weight: 60, hits: 1, sweepMs: 1500, zone: 0.3 },
  uncommon: { label: 'Incomum', weight: 26, hits: 2, sweepMs: 1250, zone: 0.24 },
  rare: { label: 'Raro', weight: 11, hits: 2, sweepMs: 1000, zone: 0.19 },
  legendary: { label: 'Lendário', weight: 3, hits: 3, sweepMs: 850, zone: 0.15 },
  golden: { label: 'Único', weight: 1, hits: 3, sweepMs: 780, zone: 0.14 },
};

const SEA = 'Icons/Fish/Sea';
const RIVER = 'Icons/Fish/River';

export const FISH: FishDefinition[] = [
  // ---- Praia (mar) ----
  { id: 'fish-sardine', name: 'Sardinha', iconPath: `${SEA}/Sardine.png`, rarity: 'common', locations: ['beach'], sellPrice: 10 },
  { id: 'fish-anchovy', name: 'Anchova', iconPath: `${SEA}/Anchovy.png`, rarity: 'common', locations: ['beach'], sellPrice: 12 },
  { id: 'fish-herring', name: 'Arenque', iconPath: `${SEA}/Herring.png`, rarity: 'common', locations: ['beach'], sellPrice: 14 },
  { id: 'fish-flounder', name: 'Linguado', iconPath: `${SEA}/Flounder.png`, rarity: 'uncommon', locations: ['beach'], sellPrice: 30 },
  { id: 'fish-salmon', name: 'Salmão', iconPath: `${SEA}/Salmon.png`, rarity: 'uncommon', locations: ['beach'], sellPrice: 35 },
  { id: 'fish-red-snapper', name: 'Pargo', iconPath: `${SEA}/Red Snapper.png`, rarity: 'uncommon', locations: ['beach'], sellPrice: 40 },
  { id: 'fish-clownfish', name: 'Peixe-palhaço', iconPath: `${SEA}/Clownfish.png`, rarity: 'rare', locations: ['beach'], sellPrice: 60 },
  { id: 'fish-tuna', name: 'Atum', iconPath: `${SEA}/Tuna.png`, rarity: 'rare', locations: ['beach'], sellPrice: 70 },
  { id: 'fish-lionfish', name: 'Peixe-leão', iconPath: `${SEA}/LionFish.png`, rarity: 'rare', locations: ['beach'], sellPrice: 85 },
  { id: 'fish-anglerfish', name: 'Peixe-diabo', iconPath: `${SEA}/Anglerfish.png`, rarity: 'legendary', locations: ['beach'], sellPrice: 150 },

  // ---- Lago da Floresta (rio) ----
  { id: 'fish-carp', name: 'Carpa', iconPath: `${RIVER}/Carp.png`, rarity: 'common', locations: ['forestLake'], sellPrice: 10 },
  { id: 'fish-perch', name: 'Perca', iconPath: `${RIVER}/Perch.png`, rarity: 'common', locations: ['forestLake'], sellPrice: 12 },
  { id: 'fish-sunfish', name: 'Peixe-sol', iconPath: `${RIVER}/Sunfish.png`, rarity: 'common', locations: ['forestLake'], sellPrice: 12 },
  { id: 'fish-catfish', name: 'Bagre', iconPath: `${RIVER}/Bullhead Catfish.png`, rarity: 'uncommon', locations: ['forestLake'], sellPrice: 30 },
  { id: 'fish-bass', name: 'Robalo', iconPath: `${RIVER}/Large Mouth Bass.png`, rarity: 'uncommon', locations: ['forestLake'], sellPrice: 35 },
  { id: 'fish-tiger-trout', name: 'Truta-tigre', iconPath: `${RIVER}/Tiger Trout.png`, rarity: 'rare', locations: ['forestLake'], sellPrice: 60 },
  { id: 'fish-pike', name: 'Lúcio', iconPath: `${RIVER}/Pike Fish.png`, rarity: 'rare', locations: ['forestLake'], sellPrice: 65 },
  { id: 'fish-sturgeon', name: 'Esturjão', iconPath: `${RIVER}/Sturgeon.png`, rarity: 'rare', locations: ['forestLake'], sellPrice: 90 },
  { id: 'fish-ghost-catfish', name: 'Bagre-fantasma', iconPath: `${RIVER}/Ghost Catfish.png`, rarity: 'legendary', locations: ['forestLake', 'sanctuary'], sellPrice: 140 },
  { id: 'fish-faerie', name: 'Peixe-fada', iconPath: `${RIVER}/Faeries Fish.png`, rarity: 'legendary', locations: ['forestLake', 'sanctuary'], sellPrice: 160 },

  // ---- Lago do santuário (andar 100) ----
  // O 2º pilar da profecia (`data/story.ts`, marco `goldenFish`): enquanto ele não é pescado, é o único que morde ali.
  { id: 'fish-golden', name: 'Peixe Dourado', iconPath: `${RIVER}/Golden Fish.png`, rarity: 'golden', locations: ['sanctuary'], sellPrice: 0 },
];

export const GOLDEN_FISH_ID = 'fish-golden';

export function fishTextureKey(fish: FishDefinition): string {
  return `icon-${fish.id}`;
}

/** Os peixes como recursos da Bolsa (vendáveis na Caixa de Remessas; o Peixe Dourado não se vende). */
export const FISH_RESOURCES: ResourceDefinition[] = FISH.map((fish) => ({
  id: fish.id,
  name: fish.name,
  textureKey: fishTextureKey(fish),
  frameName: 0,
  ...(fish.sellPrice > 0 ? { sellPrice: fish.sellPrice } : {}),
}));

export const FISH_BY_ID: Record<string, FishDefinition> = Object.fromEntries(FISH.map((fish) => [fish.id, fish]));

// --- Vara de Pescar ----------------------------------------------------------------------------------------------------------

/** Vendida pelo Ferreiro (compra única, como o Martelo). */
export const FISHING_ROD_PRICE = 200;

// --- Ritmo da pescaria (ms) ------------------------------------------------------------------------------------------------------

/** Espera até o peixe morder (sorteada entre os dois). */
export const BITE_WAIT_MIN_MS = 1800;
export const BITE_WAIT_MAX_MS = 4800;
/** Tempo pra fisgar depois do "!" (Espaço ou clique). */
export const HOOK_WINDOW_MS = 1300;
/** Sem acertar a faixa por tanto tempo, o peixe escapa. */
export const REEL_TIMEOUT_MS = 8000;
/** Erros na barra que o peixe tolera (o seguinte o solta). */
export const REEL_MISSES_ALLOWED = 1;
/** Cada ponto de Sorte do Pescador (`getFishingLuck`): faixa verde X% mais larga e peixes raros X% mais frequentes. */
export const LUCK_ZONE_BONUS = 0.03;
export const LUCK_RARITY_BONUS = 0.1;

// --- Arte do minijogo --------------------------------------------------------------------------------------------------------

/**
 * `UI/Bars.png` (192x160, a mesma folha dos corações — chave `ui-bars`): a barra vazia com a caixinha na ponta (147,118 42x7, o
 * miolo escuro vai de x=149 a x=177 e de y=120 a y=122) é a trilha; uma coluna de 1px da linha verde (x=57, y=104-106: claro/escuro/claro)
 * esticada é a faixa de acerto; um
 * pedaço de 2px da linha vermelha (54,88) é o marcador; as estrelinhas azuis cheia/apagada (51,36 / 83,36 — 10x9) contam os acertos.
 * O peixe fisgado aparece na caixinha da ponta.
 */
export const FISHING_UI = {
  barsKey: 'ui-bars',
  barsPath: 'UI/Bars.png',
  track: { name: 'fishing-track', rect: { x: 147, y: 118, width: 42, height: 7 } },
  /** Miolo da trilha, relativo ao recorte `track` (onde a faixa e o marcador andam). */
  trackInner: { x: 2, y: 2, width: 29, height: 3 },
  /** Centro da caixinha da ponta, relativo ao recorte `track`. */
  trackBox: { x: 36, y: 3.5 },
  zone: { name: 'fishing-zone', rect: { x: 57, y: 104, width: 1, height: 3 } },
  marker: { name: 'fishing-marker', rect: { x: 54, y: 88, width: 2, height: 3 } },
  starFull: { name: 'fishing-star-full', rect: { x: 51, y: 36, width: 10, height: 9 } },
  starEmpty: { name: 'fishing-star-empty', rect: { x: 83, y: 36, width: 10, height: 9 } },
  /** Escala da barra no mundo (px de tela por px da arte). */
  scale: 3,
} as const;
