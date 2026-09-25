import Phaser from 'phaser';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';

/**
 * DEBUG TEMPORÁRIO — pedido explícito do usuário pra visualizar a colisão
 * do grid 1x1 (Fase 9: alinhamento de árvores/inimigos ao grid). Remover
 * esta classe e as chamadas a ela (`MainScene`/`ExternalMapScene`/
 * `ForestScene`) quando o debug não for mais necessário.
 *
 * Desenha, a cada frame, só as células dentro da câmera (não o mapa
 * inteiro — o grid pode ser bem maior que a tela, ex.: as expansões da
 * Fazenda): contorno fraco em toda célula, vermelho translúcido nas
 * bloqueadas (`WalkableGrid.isWalkable` — cobre árvore/pedra/decoração/
 * cerca/casa/água, é a MESMA fonte usada pela colisão de movimento de
 * verdade, não uma aproximação), azul na célula do jogador e laranja na
 * célula de cada inimigo vivo (`enemyProvider`, opcional — só a Floresta
 * tem inimigos por ora).
 */
export class DebugGridOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private enemyProvider: (() => Enemy[]) | null = null;
  private isVisible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly player: Player,
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5000); // Acima do mundo/personagens, abaixo de qualquer HUD (que fica em telas/scrollFactor(0) à parte).
  scene.input.keyboard?.on('keydown-B', (event: KeyboardEvent) => {
      if (event.altKey) {
        this.isVisible = !this.isVisible;
        this.graphics.setVisible(this.isVisible);
        
        // Se desligou, limpa os desenhos que ficaram na tela
        if (!this.isVisible) {
          this.graphics.clear();
        }
      }
    });
  }

  /** Plugado pela cena dona dos inimigos (só a Floresta, por ora) — mesmo padrão de `PlayerController.setEnemyProvider`. */
  setEnemyProvider(provider: () => Enemy[]): void {
    this.enemyProvider = provider;
  }

update(): void {
    if (!this.isVisible) return; // <-- 3. ADICIONADO AQUI

    this.graphics.clear();

    const view = this.scene.cameras.main.worldView;
    const startCol = Math.floor(view.x / this.tilePx) - 1;
    const endCol = Math.ceil((view.x + view.width) / this.tilePx) + 1;
    const startRow = Math.floor(view.y / this.tilePx) - 1;
    const endRow = Math.ceil((view.y + view.height) / this.tilePx) + 1;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const x = col * this.tilePx;
        const y = row * this.tilePx;

        this.graphics.lineStyle(1, 0xffffff, 0.15);
        this.graphics.strokeRect(x, y, this.tilePx, this.tilePx);

        if (!this.grid.isWalkable(col, row)) {
          this.graphics.fillStyle(0xff0000, 0.35);
          this.graphics.fillRect(x, y, this.tilePx, this.tilePx);
        }
      }
    }

    this.graphics.fillStyle(0x3399ff, 0.45);
    this.graphics.fillRect(this.player.col * this.tilePx, this.player.row * this.tilePx, this.tilePx, this.tilePx);

for (const enemy of this.enemyProvider?.() ?? []) {
      this.graphics.fillStyle(0xffaa00, 0.45);
      
      // Desenha a caixa de 32x32 deslizando de forma contínua colada no corpo do Slime
      this.graphics.fillRect(
        enemy.x - (this.tilePx / 2), 
        enemy.y - 16 - (this.tilePx / 2), 
        this.tilePx, 
        this.tilePx
      );
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
