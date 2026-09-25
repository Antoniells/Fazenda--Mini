// Gerado pelo MapEditorScene (tecla P) — arquivo COMPLETO e pronto pra uso.
// Arraste pra dentro de src/data/maps/, substituindo farmMap.ts.
export type ExpansionDirection = 'north' | 'south' | 'east' | 'west';

export type BiomeId = 'core' | 'mining' | 'lumber' | 'beach' | 'cave' | 'village';

/** Nome exibido de cada bioma — usado nos logs/textos da placa de compra. */
export const BIOME_LABELS: Record<BiomeId, string> = {
  core: 'Fazenda',
  mining: 'Mineração',
  lumber: 'Madeireira',
  beach: 'Praia',
  cave: 'Cavernas',
  village: 'Vilarejo',
};

export interface ExpansionChunk {
  direction: ExpansionDirection;
  biome: BiomeId;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
  price: number;
  signPosition: [number, number];
  /** Já nasce aberto (sem parede nem placa de compra) — o Vilarejo a leste. */
  startsUnlocked?: boolean;
}

export interface BridgeRequirement {
  coins?: number;
  items?: Array<{ itemId: string; amount: number; label: string }>;
}

export interface BridgeDefinition {
  direction: ExpansionDirection;
  col: number;
  row: number;
  destinationName: string;
  destinationSceneKey: string;
  requirement: BridgeRequirement;
}

/** Área retangular (canto superior-esquerdo + tamanho, em células) de uma estrutura estática do mapa. */
export interface RectArea {
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

export interface FarmMapData {
  tileSize: number;
  cols: number;
  rows: number;
  ground?: number[][];
  backgroundColor?: string;
  blockedArea?: Array<[number, number]>;
  expansions: ExpansionChunk[];
  treePositions: Array<[number, number]>;
  farmlandArea: Array<[number, number]>;
  shippingBinPosition: [number, number];
  shopPosition: [number, number];
  housePosition: RectArea;
  houseDoorPosition: [number, number];
  rockPositions: Array<[number, number]>;
  orePositions: Array<[number, number]>;
  bridges: BridgeDefinition[];
  foliagePositions: Array<[number, number]>;
  props?: Array<[number, number, string]>;
}

export const farmMap: FarmMapData = {
  tileSize: 16,
  cols: 56,
  rows: 42,
  ground: [
    [69, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 539, 57, 57, 69, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 69, 57, 69, 57, 57, 69, 69, 69, 57, 57, 510, 491, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 69, 69, 57],
    [57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 69, 57, 57, 57, 57, 57, 57, 539, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 69, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 69, 57, 69, 57, 57, 57, 539, 57, 57, 57, 57, 488, 490, 490, 509, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 69, 57],
    [57, 57, 69, 69, 57, 69, 57, 69, 57, 69, 57, 57, 57, 57, 69, 57, 57, 69, 69, 57, 57, 69, 57, 69, 57, 69, 57, 57, 69, 57, 57, 510, 490, 491, 441, 488, 509, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57],
    [69, 69, 69, 69, 57, 57, 69, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 69, 57, 510, 490, 509, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 69, 57, 69, 57, 69, 57, 57, 57, 57, 57],
    [69, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 69, 57, 69, 69, 69, 69, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57],
    [57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 192, 57, 57, 57, 57, 57, 200, 203, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 69, 57, 57, 57, 57, 69, 69, 69, 57, 57, 69, 57, 57, 57, 57, 200, 201, 202, 202, 202, 202, 202, 221, 222, 202, 202, 202, 202, 202, 202, 202, 202, 203, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57],
    [202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 298, 298, 221, 246, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 245, 249, 251, 57, 57, 69, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57],
    [273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 273, 245, 251, 57, 69, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 224, 249, 251, 57, 69, 57, 57, 57, 57, 69, 57, 69, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 69, 57],
    [69, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 69, 57, 272, 275, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 224, 249, 251, 57, 57, 57, 296, 299, 57, 57, 69, 69, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57],
    [57, 69, 57, 69, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 69, 69, 57, 57, 57, 57, 57, 57, 224, 249, 251, 57, 69, 57, 368, 371, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57],
    [57, 57, 57, 57, 69, 57, 69, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 224, 249, 251, 69, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [69, 57, 57, 69, 69, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 224, 249, 251, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 224, 249, 251, 57, 57, 57, 69, 57, 57, 69, 57, 57, 69, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 224, 249, 251, 57, 69, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [69, 57, 57, 57, 57, 69, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 224, 249, 251, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57],
    [57, 57, 200, 202, 202, 202, 203, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 224, 249, 222, 202, 202, 203, 57, 69, 57, 57, 57, 69, 69, 69, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57],
    [57, 57, 224, 249, 249, 249, 251, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 69, 57, 57, 57, 57, 200, 203, 57, 57, 57, 224, 249, 249, 249, 249, 227, 266, 266, 266, 266, 266, 266, 266, 266, 266, 266, 266, 266, 266, 266, 197, 202, 202, 202],
    [57, 69, 272, 273, 273, 273, 343, 57, 69, 57, 69, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 272, 343, 57, 57, 57, 272, 370, 273, 273, 273, 275, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 224, 249, 249, 249],
    [69, 57, 57, 57, 57, 57, 216, 69, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 57, 57, 312, 57, 57, 57, 57, 216, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 272, 273, 273, 273],
    [69, 57, 57, 57, 57, 57, 216, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 69, 69, 57, 69, 312, 57, 57, 69, 57, 312, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 69, 57, 69, 69, 216, 69, 57, 69, 57, 69, 69, 69, 69, 69, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 312, 57, 57, 57, 57, 216, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 216, 57, 57, 57, 57, 69, 57, 57, 57, 57, 200, 203, 69, 57, 57, 57, 69, 69, 69, 57, 69, 57, 312, 57, 57, 57, 57, 312, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 241, 266, 266, 266, 266, 266, 266, 266, 266, 266, 248, 227, 362, 362, 362, 362, 362, 362, 362, 362, 362, 362, 371, 69, 57, 69, 69, 312, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 272, 275, 57, 69, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 193, 362, 362, 371, 441, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 69, 57, 69, 69, 57, 69, 57, 57, 69, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 312, 69, 441, 441, 441, 57, 57, 57, 57, 57, 57, 69, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 69, 57, 69, 69, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 312, 57, 57, 441, 57, 57, 57, 57, 69, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 312, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 312, 57, 57, 57, 57, 69, 57, 57, 69, 57, 69, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 69, 69, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 216, 57, 57, 69, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 69, 69, 69, 69, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 69, 57, 57, 216, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57],
    [57, 69, 57, 69, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 69, 57, 216, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57],
    [57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 69, 57, 216, 57, 69, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 69, 69, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 216, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 216, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 69, 69, 69, 57, 57, 57, 216, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 69, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 216, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57],
    [57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 216, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 57, 69, 57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 69, 69, 57],
    [57, 57, 69, 57, 57, 57, 69, 57, 57, 57, 57, 57, 57, 57, 57, 69, 57, 57, 57, 57, 69, 57, 69, 57, 57, 57, 57, 57, 69, 69, 216, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 69, 69, 57, 57],
  ],
  backgroundColor: '#7ec433',
  expansions: [{"direction":"west","biome":"mining","col0":-12,"row0":0,"cols":12,"rows":42,"price":120,"signPosition":[1,21]},{"direction":"north","biome":"cave","col0":0,"row0":-8,"cols":56,"rows":8,"price":100,"signPosition":[28,1]},{"direction":"south","biome":"beach","col0":0,"row0":42,"cols":56,"rows":8,"price":100,"signPosition":[28,40]}],
  bridges: [{"direction":"east","col":55,"row":21,"destinationName":"Vilarejo","destinationSceneKey":"VillageScene","requirement":{}},{"direction":"north","col":10,"row":0,"destinationName":"Cavernas","destinationSceneKey":"CaveScene","requirement":{"coins":200}},{"direction":"south","col":30,"row":41,"destinationName":"Praia","destinationSceneKey":"BeachScene","requirement":{"coins":300}},{"direction":"west","col":0,"row":10,"destinationName":"Pedreira","destinationSceneKey":"QuarryScene","requirement":{"coins":250}},{"direction":"west","col":0,"row":20,"destinationName":"Floresta","destinationSceneKey":"ForestScene","requirement":{"coins":250}}],
  treePositions: [
    [3, 3],
    [3, 26],
    [36, 26],
    [12, 4],
    [27, 4],
    [33, 3],
    [46, 4],
    [51, 9],
    [44, 19],
    [52, 25],
    [48, 33],
    [40, 38],
    [28, 36],
    [18, 38],
    [8, 35],
    [53, 38],
  ],
  farmlandArea: buildRectangle(14, 13, 12, 8),
  shippingBinPosition: [19, 11],
  shopPosition: [25, 7],
  // Casa não tem ferramenta no editor (fora do escopo pedido) — valor atual preservado.
  housePosition: { col0: 16, row0: 2, cols: 8, rows: 7 },
  houseDoorPosition: [18, 8],
  rockPositions: [
    [8, 8],
    [5, 13],
    [9, 17],
    [8, 23],
    [17, 23],
    [26, 23],
    [32, 7],
    [4, 7],
    [44, 10],
    [50, 15],
    [46, 25],
    [53, 30],
    [36, 34],
    [24, 37],
    [14, 34],
    [6, 39],
    [42, 40],
  ],
  orePositions: [],
  foliagePositions: [
    [10, 12],
    [15, 8],
  ],
  blockedArea: [
    [32, 4],
    [32, 3],
    [33, 4],
    [34, 4],
    [31, 1],
    [35, 4],
    [36, 4],
    [36, 3],
    [37, 3],
    [38, 3],
    [32, 2],
    [31, 0],
    [30, 0],
    [30, 1],
    [31, 2],
    [31, 3],
    [31, 4],
    [33, 5],
    [34, 5],
    [35, 5],
    [39, 3],
  ],
  props: [
    [36, 1, 'prop-flower-pink'],
    [32, 0, 'prop-flower-pink'],
    [38, 1, 'prop-tuft-teal'],
    [29, 7, 'prop-tuft-teal'],
    [38, 10, 'prop-tuft-teal'],
    [28, 15, 'prop-tuft-teal'],
    [26, 0, 'prop-tuft-teal'],
    [15, 1, 'prop-tuft-teal'],
    [37, 11, 'prop-rock-boulder-brown'],
    [45, 7, 'prop-flower-white-cluster'],
    [49, 12, 'prop-tuft-teal'],
    [52, 18, 'prop-flower-blue-1'],
    [43, 23, 'prop-mushroom-tan'],
    [50, 29, 'prop-flower-pink'],
    [38, 36, 'prop-tuft-teal'],
    [22, 34, 'prop-flower-white-small'],
    [12, 38, 'prop-mushroom-orange'],
    [4, 34, 'prop-flower-blue-2'],
    [47, 36, 'prop-rock-boulder-brown'],
  ],
};

// "Cerca" pintada no editor — isto NÃO é um campo de FarmMapData: o jogo
// desenha a cerca sozinho a partir de farmlandArea/limites do núcleo (ver
// getFarmlandFenceLayout abaixo). Guia visual apenas, já com a variante
// (orientação) exata escolhida pra cada célula:
// [{"col":13,"row":12,"variantId":"topLeft"},{"col":26,"row":12,"variantId":"topRight"},{"col":13,"row":21,"variantId":"bottomLeft"},{"col":26,"row":21,"variantId":"bottomRight"},{"col":14,"row":12,"variantId":"horizontal"},{"col":14,"row":21,"variantId":"horizontal"},{"col":15,"row":12,"variantId":"horizontal"},{"col":15,"row":21,"variantId":"horizontal"},{"col":16,"row":12,"variantId":"horizontal"},{"col":16,"row":21,"variantId":"horizontal"},{"col":17,"row":21,"variantId":"horizontal"},{"col":18,"row":21,"variantId":"horizontal"},{"col":19,"row":12,"variantId":"horizontal"},{"col":19,"row":21,"variantId":"horizontal"},{"col":20,"row":12,"variantId":"horizontal"},{"col":20,"row":21,"variantId":"horizontal"},{"col":21,"row":12,"variantId":"horizontal"},{"col":21,"row":21,"variantId":"horizontal"},{"col":22,"row":12,"variantId":"horizontal"},{"col":22,"row":21,"variantId":"horizontal"},{"col":23,"row":12,"variantId":"horizontal"},{"col":23,"row":21,"variantId":"horizontal"},{"col":24,"row":12,"variantId":"horizontal"},{"col":24,"row":21,"variantId":"horizontal"},{"col":25,"row":12,"variantId":"horizontal"},{"col":25,"row":21,"variantId":"horizontal"},{"col":13,"row":13,"variantId":"vertical"},{"col":26,"row":13,"variantId":"vertical"},{"col":13,"row":14,"variantId":"vertical"},{"col":26,"row":14,"variantId":"vertical"},{"col":13,"row":15,"variantId":"vertical"},{"col":26,"row":15,"variantId":"vertical"},{"col":13,"row":16,"variantId":"vertical"},{"col":26,"row":16,"variantId":"vertical"},{"col":13,"row":17,"variantId":"vertical"},{"col":26,"row":17,"variantId":"vertical"},{"col":13,"row":18,"variantId":"vertical"},{"col":26,"row":18,"variantId":"vertical"},{"col":13,"row":19,"variantId":"vertical"},{"col":26,"row":19,"variantId":"vertical"},{"col":13,"row":20,"variantId":"vertical"},{"col":26,"row":20,"variantId":"vertical"}]

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
    gate: [map.houseDoorPosition[0], row0],
  };
}

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