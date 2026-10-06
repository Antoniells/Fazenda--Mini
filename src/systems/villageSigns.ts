import Phaser from 'phaser';
import { SHOP_AWNING_SHEET, SHOP_SIGNS, SHOP_SIGN_BOARD, SHOP_SIGN_ICON_OFFSET, ShopSignDefinition, shopAwningFrame } from '../data/villageSigns';
import { VILLAGE_ASSETS, VILLAGE_BANKER_HOUSE, VILLAGE_CARPENTER_HOUSE, VILLAGE_PIRATE_HOUSE, VILLAGE_SHOP_HOUSE, VILLAGE_SUPPLIER_HOUSE, VillageAsset, VillageStructure, structureBaseRow, structureDoorCell } from '../data/maps/villageMap';
import type { VillageStructureRole } from '../data/maps/villageLayout';
import { TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { createGroundShadow } from './shadow';

const HOUSE_BY_ROLE: Record<VillageStructureRole, VillageStructure> = {
  shop: VILLAGE_SHOP_HOUSE,
  banker: VILLAGE_BANKER_HOUSE,
  pirate: VILLAGE_PIRATE_HOUSE,
  supplier: VILLAGE_SUPPLIER_HOUSE,
  carpenter: VILLAGE_CARPENTER_HOUSE,
};

/** As duas células das pernas de uma placa (a da esquerda e a da direita), ou `null` se a casa dela não tem porta. */
export function shopSignBaseCells(sign: ShopSignDefinition): Array<[number, number]> | null {
  const front = structureDoorCell(HOUSE_BY_ROLE[sign.role]);
  if (!front) return null;
  const col = front.col + sign.offset.dx;
  const row = front.row + sign.offset.dy;
  return [
    [col, row],
    [col + 1, row],
  ];
}

/** Células que as placas bloqueiam (as pernas) — a cena as soma ao grid antes dos moradores andarem. */
export function shopSignBlockedCells(): Array<[number, number]> {
  return SHOP_SIGNS.flatMap((sign) => shopSignBaseCells(sign) ?? []);
}

/** O toldo sobre a porta da loja (`VillageAsset.awningAt`), colado na parede: logo acima da casa na ordem de desenho. */
function buildShopAwning(scene: Phaser.Scene, sign: ShopSignDefinition): void {
  const house = HOUSE_BY_ROLE[sign.role];
  const at = (VILLAGE_ASSETS[house.asset] as VillageAsset).awningAt;
  if (!at) return;
  const tile = TILE_SIZE * DISPLAY_SCALE;
  const frame = shopAwningFrame(sign.awning);
  registerFrame(scene, SHOP_AWNING_SHEET.key, frame);
  scene.add
    .image(house.col * tile + at.x * DISPLAY_SCALE, house.row * tile + at.y * DISPLAY_SCALE, SHOP_AWNING_SHEET.key, frame.name)
    .setOrigin(0, 0)
    .setScale(DISPLAY_SCALE)
    .setDepth((structureBaseRow(house) + 1) * tile + 0.01); // A casa desenha na base das paredes (`buildVillage`).
}

/** Carrega o quadro e os ícones que ainda não estão na memória (o da cenoura e o da madeira normalmente já vêm da Fazenda). */
export function preloadShopSigns(scene: Phaser.Scene): void {
  for (const asset of [SHOP_SIGN_BOARD, SHOP_AWNING_SHEET, ...SHOP_SIGNS.map((sign) => sign.icon)]) {
    if (!scene.textures.exists(asset.key)) scene.load.image(asset.key, encodeURI(`/${asset.path}`));
  }
}

/**
 * Desenha as placas: o quadro com a base nas pernas e o ícone pregado no painel, na mesma escala do resto do mapa. A profundidade é a
 * da base (como as casas): o jogador passa atrás quando está acima delas e na frente quando está abaixo.
 */
export function buildShopSigns(scene: Phaser.Scene): void {
  const tile = TILE_SIZE * DISPLAY_SCALE;
  registerFrame(scene, SHOP_SIGN_BOARD.key, SHOP_SIGN_BOARD.frame);
  for (const sign of SHOP_SIGNS) {
    buildShopAwning(scene, sign);
    const cells = shopSignBaseCells(sign);
    if (!cells) continue;
    const [col, row] = cells[0];
    const left = col * tile;
    const top = (row - 1) * tile; // 2x2 células: a de cima é o painel, a de baixo as pernas.
    const depth = (row + 1) * tile;

    // A mesma mancha de sombra da Caixa de Correio, sob as pernas (logo abaixo da placa, acima do chão).
    createGroundShadow(scene, left + tile, (row + 1) * tile - 3, DISPLAY_SCALE * 1.4, DISPLAY_SCALE * 0.45).setDepth(depth - 0.1);
    scene.add.image(left, top, SHOP_SIGN_BOARD.key, SHOP_SIGN_BOARD.frame.name).setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(depth);
    registerFrame(scene, sign.icon.key, sign.icon.frame);
    scene.add
      .image(left + SHOP_SIGN_ICON_OFFSET.x * DISPLAY_SCALE, top + SHOP_SIGN_ICON_OFFSET.y * DISPLAY_SCALE, sign.icon.key, sign.icon.frame.name)
      .setOrigin(0, 0)
      .setScale(DISPLAY_SCALE)
      .setDepth(depth + 0.01);
  }
}
