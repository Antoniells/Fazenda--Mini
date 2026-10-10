/**
 * Onde a Hotbar fica (`ui/hotbar.ts`): embaixo, como sempre — a não ser que o personagem desça até a faixa da tela que ela cobre. Aí ela
 * sobe pro topo, pra o jogador enxergar e clicar no chão ali embaixo; quando ele volta pra cima, ela desce de novo. Sem Phaser (testável).
 */

/** O personagem (pés, px de tela) a menos disto acima do topo da barra (embaixo) faz a barra subir — cobre as células logo à volta dele. */
export const HOTBAR_DOCK_TOP_ZONE_PX = 80;
/** Folga pra descer de volta (histerese): sem ela a barra ficaria pulando com o personagem andando bem na divisa. */
export const HOTBAR_DOCK_RETURN_MARGIN_PX = 48;

/**
 * A barra deve ficar no TOPO? `playerScreenY` = pés do personagem em px de tela (`null` = sem personagem na tela, ex.: menu), `barTopY` =
 * topo da barra quando está embaixo, `atTop` = onde ela está agora.
 */
export function shouldDockHotbarTop(atTop: boolean, playerScreenY: number | null, barTopY: number): boolean {
  if (playerScreenY === null) return false;
  const threshold = barTopY - HOTBAR_DOCK_TOP_ZONE_PX;
  return atTop ? playerScreenY > threshold - HOTBAR_DOCK_RETURN_MARGIN_PX : playerScreenY > threshold;
}
