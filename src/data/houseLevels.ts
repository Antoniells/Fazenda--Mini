import { PLAYER_HOUSE_KEY, PLAYER_HOUSE_PATH } from './tiles';

/**
 * Os 3 estados da CASA do jogador (`data/upgrades.ts`, linha `house`): o nível 0 é o do começo do jogo (a casinha laranja), o 1 é a casa de sempre (`Houses/3.png`) e o 2, a última melhoria, é a casa
 * grande do meio de `Houses/Upgrade House.png`.
 * Cada um traz a arte da Fazenda (a porta sempre fica em `farmMap.houseDoorPosition`; a arte é posicionada a partir dela), a máscara de colisão e o tamanho do cômodo por dentro
 * (`houseMap`, `scenes/HouseScene.ts`). Quem aplica o nível ao mundo é `systems/farmUpgrades.ts`.
 *
 * Medidas (varredura pixel a pixel da ocupação de cada célula 16x16):
 * - nível 0, `Houses/10.png` (80x112 = 5x7 células): a casinha laranja. Paredes nas fileiras 4-5; a porta é a 4ª coluna e a célula da frente (a "porta" que se pisa) a fileira 6.
 * - nível 2 (o último), o recorte da casa do MEIO de `Houses/Upgrade House.png` (608x208; a folha traz três casas, a do meio é a limpa): 169x161 px em (212, 32) = 11x11 células (a 1ª fileira, só
 *   a pontinha da cumeeira, fica de fora). A arte é alta demais pra a porta ficar na fileira 8 de sempre (o telhado sairia do mapa), então a porta é a da varanda (célula (5, 9) da arte, a
 *   fileira da porta em si) e o jogador entra pisando nela, vindo da fileira de baixo — `doorRow` desse nível é a 9 da Fazenda: a casa termina antes do caminho de terra (fileiras 10-11), que fica livre.
 * - nível 1, `Houses/3.png` (128x112 = 8x7 células): a casa de sempre, com o mesmo ajuste de pixels de antes.
 */
export interface HouseLevel {
  name: string;
  /** Textura (carregada pela `MainScene`) e, se for um recorte de folha, o quadro. */
  textureKey: string;
  texturePath: string;
  frame?: { name: string; rect: { x: number; y: number; width: number; height: number } };
  /** Tamanho da arte em células. */
  cols: number;
  rows: number;
  /** A célula da porta DENTRO da arte (o gatilho de entrar) — vira `farmMap.houseDoorPosition`. */
  door: { dx: number; dy: number };
  /** Fileira da Fazenda onde fica a porta. */
  doorRow: number;
  /** Ajuste fino da arte em pixels de tela (positivo = direita/baixo). */
  offset: { x: number; y: number };
  /** Máscara de colisão, uma string por fileira da arte (`#` bloqueia). A célula da porta nunca bloqueia. */
  solid: string[];
  /** O cômodo por dentro, com as paredes (`cols` x `rows`). A saída fica na parede de baixo, no meio. */
  interior: { cols: number; rows: number };
}

export const HOUSE_LEVELS: HouseLevel[] = [
  {
    name: 'Casinha',
    textureKey: 'player-house-small',
    texturePath: 'Objects/Exterior/Houses/10.png',
    cols: 5,
    rows: 7,
    door: { dx: 3, dy: 6 },
    doorRow: 8,
    offset: { x: 0, y: 0 },
    solid: ['.....', '.....', '.....', '.....', '#####', '#####', '.....'],
    interior: { cols: 8, rows: 8 },
  },
  {
    name: 'Casa',
    textureKey: PLAYER_HOUSE_KEY,
    texturePath: PLAYER_HOUSE_PATH,
    cols: 8,
    rows: 7,
    door: { dx: 2, dy: 6 },
    doorRow: 8,
    offset: { x: -18, y: -6 },
    solid: ['........', '........', '........', '#######.', '#######.', '#######.', '........'],
    interior: { cols: 10, rows: 9 },
  },
  {
    name: 'Casa grande',
    textureKey: 'player-house-mid',
    texturePath: 'Objects/Exterior/Houses/Upgrade House.png',
    frame: { name: 'player-house-mid-frame', rect: { x: 212, y: 32, width: 169, height: 161 } },
    cols: 11,
    rows: 11,
    door: { dx: 5, dy: 9 },
    doorRow: 9,
    offset: { x: 0, y: 0 },
    solid: ['...........', '...........', '...........', '...........', '...........', '...........', '##########.', '.########..', '...####....', '...##.##...', '...........'],
    interior: { cols: 12, rows: 10 },
  },
];

/** Coluna da porta da Fazenda (a mesma em todos os níveis — o portão da cerca da lavoura fica na frente dela). */
export const HOUSE_DOOR_COL = 18;
