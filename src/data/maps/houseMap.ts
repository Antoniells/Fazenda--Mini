/**
 * Interior da casa (`scenes/HouseScene.ts`): um cômodo fechado de 8x8
 * células — a borda inteira é parede (bloqueada), o miolo 6x6 é o chão.
 * Único caminho de saída: a célula da porta, na parede de baixo
 * (`exitPosition`) — pisar nela leva de volta à Fazenda, em frente à porta
 * de fora. A cama (`bedPosition`) ocupa `bedFootprint` células a partir do
 * canto de cima (cabeceira) pra baixo; interagir com ela dorme.
 *
 * Mesmo formato de dados dos outros `data/maps/*` (só posições em células);
 * a arte (chão de madeira, cama) fica em `HOUSE_ART` e é trocável sem mexer
 * na cena.
 */
export interface HouseMapData {
  cols: number;
  rows: number;
  /** Célula da porta de saída (na parede de baixo, andável — pisar nela sai). */
  exitPosition: [number, number];
  /** Onde o jogador aparece ao entrar (uma célula acima da porta). */
  spawnPosition: [number, number];
  /** Cabeceira da cama (célula de cima); a cama continua `bedFootprint.height - 1` células pra baixo. */
  bedPosition: [number, number];
  bedFootprint: { width: number; height: number };
}

export const houseMap: HouseMapData = {
  cols: 8,
  rows: 8,
  exitPosition: [4, 7],
  spawnPosition: [4, 6],
  bedPosition: [1, 1],
  bedFootprint: { width: 1, height: 2 },
};

/**
 * Arte do interior. Chão/paredes de madeira PLACEHOLDER: uma tábua de
 * `Tileset/Barn tileset.png` (folha de celeiro, tábuas marrom-avermelhadas
 * em y=64) ladrilhada célula a célula; as paredes usam a MESMA tábua,
 * escurecida (`WALL_TINT`). Cama: a primeira da linha de camas simples de
 * `Objects/Interior/Beds.png` (bounding box medido pelo alfa: x=7, y=2,
 * 18x34). Trocar por arte definitiva = trocar este bloco.
 */
export const HOUSE_ART = {
  floor: { key: 'house-floor-sheet', path: 'Tileset/Barn tileset.png', frame: { name: 'house-floor-plank', rect: { x: 0, y: 64, width: 16, height: 16 } } },
  bed: { key: 'house-beds-sheet', path: 'Objects/Interior/Beds.png', frame: { name: 'house-bed', rect: { x: 7, y: 2, width: 18, height: 34 } } },
  wallTint: 0x8a6a52,
  doorTint: 0xffe2a8,
};
