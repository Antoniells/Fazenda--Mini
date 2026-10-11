import type { VillageStructureRole } from './maps/villageLayout';
import { ALL_CROPS_ICONS_KEY, ALL_CROPS_ICONS_PATH } from './crops';
import { WOOD_KEY, WOOD_PATH } from './tiles';

/**
 * PLACAS DAS LOJAS do Vilarejo: de longe, o jogador sabe o que cada casa vende. Nenhuma arte nova — é a composição de duas que já
 * existem: o quadro de avisos EM BRANCO de `Objects/Exterior/Notice Boards.png` (o de cima à esquerda, sem papéis) com o ícone de
 * 16x16 da loja pregado no meio do painel, os dois na mesma escala (1 px de arte = 1 px de arte). A casa do Ferreiro não precisa:
 * a placa da bigorna já vem na arte dela. Só DADOS — o desenho e a colisão estão em `systems/villageSigns.ts`.
 */

export interface SignIcon {
  key: string;
  path: string;
  frame: { name: string; rect: { x: number; y: number; width: number; height: number } };
}

/** O quadro em branco (32x32 de recorte; o desenho ocupa x 1..30, y 5..31, com as pernas na fileira de baixo). */
export const SHOP_SIGN_BOARD: SignIcon = {
  key: 'shop-sign-boards',
  path: 'Objects/Exterior/Notice Boards.png',
  frame: { name: 'shop-sign-board', rect: { x: 0, y: 0, width: 32, height: 32 } },
};

/** Canto superior-esquerdo do ícone (16x16) dentro do quadro: centrado no painel liso (x 3..28, y 12..25). */
export const SHOP_SIGN_ICON_OFFSET = { x: 8, y: 11 };

/**
 * TOLDOS das lojas (`Objects/Exterior/Houses/Door, windows, and chimney/Door awning.png`, 288x32: 9 toldos listrados lado a lado, um
 * por quadro de 32x32, o desenho em x 6-25 e y 5-11 de cada um): só as portas das LOJAS têm toldo — a casa do jogador não (pedido
 * explícito). Onde ele fica em cada arte de casa: `VillageAsset.awningAt` (`data/maps/villageMap.ts`).
 */
export const SHOP_AWNING_SHEET = { key: 'shop-awnings', path: 'Objects/Exterior/Houses/Door, windows, and chimney/Door awning.png' };
/** Recorte do toldo `index` (0 vermelho, 1 rosa, 2 magenta, 3 roxo, 4 turquesa, 5 azul-claro, 6 azul, 7 verde, 8 laranja). */
export function shopAwningFrame(index: number): { name: string; rect: { x: number; y: number; width: number; height: number } } {
  return { name: `shop-awning-${index}`, rect: { x: index * 32 + 6, y: 5, width: 20, height: 7 } };
}

export interface ShopSignDefinition {
  /** De quem é a loja (a casa com esse `role` no layout do Vilarejo — a placa acompanha a casa se ela mudar de lugar no editor). */
  role: VillageStructureRole;
  icon: SignIcon;
  /**
   * Onde fica a perna ESQUERDA da placa, relativa à célula da rua em frente à porta (`structureDoorCell`). A placa ocupa 2x2 células
   * e só a fileira de baixo (as pernas) bloqueia.
   */
  offset: { dx: number; dy: number };
  /** A cor do toldo sobre a porta (`shopAwningFrame`). */
  awning: number;
}

export const SHOP_SIGNS: ShopSignDefinition[] = [
  // Lia (insumos da Fazenda: sementes, móveis, animais): a cenoura colhida de `Crops/All Crops.png` (linha 6, coluna 2).
  {
    role: 'supplier',
    icon: { key: ALL_CROPS_ICONS_KEY, path: ALL_CROPS_ICONS_PATH, frame: { name: 'shop-sign-carrot', rect: { x: 32, y: 96, width: 16, height: 16 } } },
    offset: { dx: 2, dy: 0 },
    awning: 7, // Verde, da horta.
  },
  // Tomás (marceneiro: materiais e construções): a pilha de toras de `Icons/RPG icons/Extras/Wood.png`.
  {
    role: 'carpenter',
    icon: { key: WOOD_KEY, path: WOOD_PATH, frame: { name: 'shop-sign-wood', rect: { x: 0, y: 0, width: 16, height: 16 } } },
    offset: { dx: 2, dy: 0 },
    awning: 8, // Laranja, da madeira.
  },
  // Alberto (padeiro): o pão de `Icons/Food Icons/Bread .png` (o primeiro quadro).
  {
    role: 'banker',
    icon: { key: 'shop-sign-bread', path: 'Icons/Food Icons/Bread .png', frame: { name: 'shop-sign-bread', rect: { x: 0, y: 0, width: 16, height: 16 } } },
    offset: { dx: 2, dy: 0 },
    awning: 0, // Vermelho, de padaria.
  },
];

/**
 * O MURAL DO VILAREJO (`systems/villageNoticeBoard.ts`): o quadro de avisos COM PAPÉIS da mesma folha (`Notice Boards.png`, o de baixo à
 * esquerda — o mesmo desenho do quadro em branco, 32 px abaixo), no gramado à direita do poço da praça. Ocupa 2x2 células: a de cima é o
 * painel e só a fileira de baixo (as pernas, `legs` e a da direita) bloqueia. Clicar abre o calendário e os acontecimentos (`ui/noticeBoardPanel.ts`).
 */
export const VILLAGE_NOTICE_BOARD = {
  frame: { name: 'village-notice-board', rect: { x: 0, y: 32, width: 32, height: 32 } },
  legs: { col: 10, row: 16 },
};
