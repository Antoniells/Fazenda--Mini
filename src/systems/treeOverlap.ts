import Phaser from 'phaser';
import { Player } from '../entities/Player';

/** Opacidade mínima da árvore quando o personagem está totalmente coberto por ela. */
const MIN_ALPHA = 0.5;

/**
 * Proporção (0-1) da caixa do personagem que está coberta pela caixa da
 * árvore. 0 = não se tocam; 1 = o personagem está inteiramente por baixo.
 */
function coverageRatio(playerBounds: Phaser.Geom.Rectangle, treeBounds: Phaser.Geom.Rectangle): number {
  const left = Math.max(playerBounds.left, treeBounds.left);
  const right = Math.min(playerBounds.right, treeBounds.right);
  const top = Math.max(playerBounds.top, treeBounds.top);
  const bottom = Math.min(playerBounds.bottom, treeBounds.bottom);

  if (right <= left || bottom <= top) return 0;

  const overlapArea = (right - left) * (bottom - top);
  const playerArea = playerBounds.width * playerBounds.height;
  return Phaser.Math.Clamp(overlapArea / playerArea, 0, 1);
}

/**
 * Dá ao personagem uma profundidade dinâmica igual ao seu Y (padrão comum de
 * ordenação top-down: quem está mais "para baixo" na tela desenha na
 * frente). Combinado com a profundidade fixa das árvores (também = seu Y),
 * isso faz o personagem passar visualmente por trás de uma árvore quando
 * está numa linha "atrás" dela.
 *
 * Como a árvore ficaria sobre o personagem nesse caso, e o esconderia por
 * completo, a opacidade da árvore acompanha, de forma gradual, o quanto o
 * personagem está coberto por ela (mais próximo/coberto = mais transparente),
 * em vez de alternar abruptamente entre opaco e semitransparente.
 */
export function updateTreeOverlap(player: Player, trees: Phaser.GameObjects.Image[]): void {
  const sprite = player.sprite;
  sprite.setDepth(sprite.y);

  const playerBounds = sprite.getBounds();

  for (const tree of trees) {
    const treeInFront = tree.depth > sprite.depth;
    const coverage = treeInFront ? coverageRatio(playerBounds, tree.getBounds()) : 0;
    tree.setAlpha(Phaser.Math.Linear(1, MIN_ALPHA, coverage));
  }
}
