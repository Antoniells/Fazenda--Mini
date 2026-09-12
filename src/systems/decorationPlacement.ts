import Phaser from 'phaser';
import { DecorationDefinition, WELL } from '../data/decorations';
import { FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { PointerInputInterceptor } from './playerController';
import { DISPLAY_SCALE } from './mapBuilder';
import { createGroundShadow } from './shadow';
import { coverageRatio } from './treeOverlap';
import { FarmlandRenderer } from './farmlandRenderer';

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950; // Acima do mundo, abaixo dos HUDs (1000+) — mesma faixa do TileCursor.
const PLACED_SHADOW_DEPTH = -0.4; // Mesma faixa das sombras estáticas de mapBuilder.ts.
/** Opacidade mínima do personagem quando está totalmente na frente de uma decoração, escondendo-a por completo. */
const MIN_PLAYER_ALPHA = 0.4;

/**
 * Uma decoração já posicionada, quando clicada: por padrão remove-se e
 * devolve 1 unidade ao estoque — mesmo padrão dos outros `Interactable`
 * (Caixa de Remessas, Loja), objeto sólido com interação adjacente já
 * cuidada pelo `PlayerController`. O Poço é a exceção: tem uma utilidade
 * própria (encher o regador, ver `DecorationPlacementSystem.useWell`), então
 * clicar nele usa em vez de remover.
 */
class PlacedDecorationInteractable implements Interactable {
  constructor(
    private readonly system: DecorationPlacementSystem,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
    private readonly decorationId: string,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    if (this.decorationId === WELL.id) this.system.useWell(this.col, this.row);
    else this.system.removeAt(this.col, this.row);
  }
}

/**
 * Modo de posicionamento livre de decorações (Fase 6): o jogador entra no
 * modo (`start`) com uma decoração do estoque, um preview semitransparente
 * segue o mouse (verde se o local for válido, vermelho se não), e o clique
 * confirma — reaproveitando o `PointerInputInterceptor` do
 * `PlayerController` para "roubar" esse clique do fluxo normal de
 * movimento/interação enquanto o modo estiver ativo.
 *
 * Uma decoração posicionada é só mais um objeto sólido do mundo: bloqueia
 * a célula no `WalkableGrid` (dinâmico agora, `block`/`unblock`) e se
 * registra no `InteractionRegistry` para poder ser removida depois.
 */
export class DecorationPlacementSystem implements PointerInputInterceptor {
  private readonly placed = new Map<
    string,
    { image: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; decorationId: string }
  >();
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly farmlandCells: Set<string>;
  private activeDecoration: DecorationDefinition | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    map: FarmMapData,
    private readonly tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
    private readonly farmlandRenderer: FarmlandRenderer,
    firstDecoration: DecorationDefinition,
  ) {
    this.farmlandCells = new Set(map.farmlandArea.map(([col, row]) => `${col},${row}`));

    this.ghost = scene.add.image(0, 0, firstDecoration.textureKey, firstDecoration.frameName);
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setScale(DISPLAY_SCALE);
    this.ghost.setDepth(GHOST_DEPTH);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setVisible(false);

    // worldX/worldY — com a câmera podendo rolar (Fase 6, Expansão), x/y
    // são coordenadas de tela, não do mundo.
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer.worldX, pointer.worldY));
  }

  isActive(): boolean {
    return this.activeDecoration !== null;
  }

  /** Alterna o modo de posicionamento da decoração informada. Sem estoque, não entra no modo (só avisa no console). */
  toggle(decoration: DecorationDefinition): void {
    if (this.activeDecoration) {
      this.cancel();
      return;
    }

    if (this.inventory.getDecorationCount(decoration.id) <= 0) {
      console.log(`Sem ${decoration.name} no estoque — compre na loja.`);
      return;
    }

    this.activeDecoration = decoration;
    this.ghost.setTexture(decoration.textureKey, decoration.frameName);
    this.ghost.setVisible(true);
  }

  /** Sai do modo de posicionamento sem colocar nada. */
  cancel(): void {
    this.activeDecoration = null;
    this.ghost.setVisible(false);
  }

  private handlePointerMove(x: number, y: number): void {
    if (!this.activeDecoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    this.ghost.setPosition(col * this.tilePx + this.tilePx / 2, (row + 1) * this.tilePx);
    this.ghost.setTint(this.canPlaceAt(col, row) ? GHOST_VALID_TINT : GHOST_INVALID_TINT);
  }

  private canPlaceAt(col: number, row: number): boolean {
    return this.grid.isWalkable(col, row) && !this.farmlandCells.has(`${col},${row}`);
  }

  /** Chamado pelo `PlayerController` enquanto este sistema está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    const decoration = this.activeDecoration;
    if (!decoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlaceAt(col, row)) return;
    if (!this.inventory.useDecoration(decoration.id)) return;

    this.placeAt(decoration, col, row);

    // Sem mais estoque, sai do modo — não tem sentido continuar "segurando"
    // uma decoração que o jogador não tem mais.
    if (this.inventory.getDecorationCount(decoration.id) <= 0) this.cancel();
  }

  private placeAt(decoration: DecorationDefinition, col: number, row: number): void {
    const x = col * this.tilePx + this.tilePx / 2;
    const y = (row + 1) * this.tilePx;

    const shadow = createGroundShadow(this.scene, x, y, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    shadow.setDepth(PLACED_SHADOW_DEPTH);

    const image = this.scene.add.image(x, y, decoration.textureKey, decoration.frameName);
    image.setOrigin(0.5, 1);
    image.setScale(DISPLAY_SCALE);
    image.setDepth(y);

    this.grid.block(col, row);
    this.interactions.set(col, row, new PlacedDecorationInteractable(this, this.player, col, row, decoration.id));
    this.placed.set(`${col},${row}`, { image, shadow, decorationId: decoration.id });
  }

  /** Remove a decoração da célula e devolve 1 unidade ao estoque. Chamado por `PlacedDecorationInteractable`. */
  removeAt(col: number, row: number): void {
    const key = `${col},${row}`;
    const entry = this.placed.get(key);
    if (!entry) return;

    entry.image.destroy();
    entry.shadow.destroy();
    this.placed.delete(key);
    this.grid.unblock(col, row);
    this.interactions.remove(col, row);
    this.inventory.addDecorations(entry.decorationId, 1);
    console.log(`Removido: 1 ${entry.decorationId} (estoque: ${this.inventory.getDecorationCount(entry.decorationId)}).`);
  }

  /**
   * Usa o Poço posicionado: toca a mesma animação de regar já usada na
   * lavoura (`Player.performAction('water', ...)`) e, ao terminar, o mesmo
   * respingo d'água (`FarmlandRenderer.spawnWaterSplash`) — sem sprite novo,
   * só reaproveitando o efeito que já existe. O jogo ainda não controla
   * "cargas" de água no regador (regar hoje não tem custo nenhum, ver
   * `Farmland.water`), então não há um estado de "regador cheio/vazio" para
   * de fato mudar aqui — o Poço dá o feedback de reabastecer mesmo assim,
   * pra deixar de ser só um objeto decorativo sem função.
   */
  useWell(col: number, row: number): void {
    this.player.performAction('water', () => {
      this.farmlandRenderer.spawnWaterSplash(col, row);
      console.log('Regador reabastecido no Poço.');
    });
  }

  /**
   * Uma decoração posicionada (ex.: o Poço) costuma ser visualmente mais
   * alta que 1 tile, mas ocupa só a célula onde foi colocada — então,
   * quando o personagem se aproxima por baixo (mesma coluna, uma linha
   * abaixo), a ordenação por Y o coloca na frente e ele acaba encobrindo
   * quase toda a decoração, que parece "sumir" bem na hora em que o
   * jogador mais precisa vê-la (para interagir/remover). Diferente da
   * árvore (`systems/treeOverlap.ts`, que se torna semitransparente para
   * não esconder o personagem), aqui é o personagem que fica
   * semitransparente — a decoração precisa continuar visível, não o
   * contrário. Chamado a cada frame por `MainScene.update`.
   */
  updateOcclusion(): void {
    const sprite = this.player.sprite;
    const playerBounds = sprite.getBounds();

    let maxCoverage = 0;
    for (const { image } of this.placed.values()) {
      if (sprite.depth <= image.depth) continue; // Decoração já na frente — nada a revelar aqui.
      const coverage = coverageRatio(image.getBounds(), playerBounds);
      if (coverage > maxCoverage) maxCoverage = coverage;
    }

    // A decoração é mais alta que a célula que ocupa, então mesmo encostado
    // nela (o mais perto que dá, já que a célula é sólida) a sobreposição
    // real nunca chega perto de 1 — um fator empírico amplia esse valor
    // para o efeito ficar perceptível assim que o personagem encosta, sem
    // esperar uma cobertura "completa" que nunca acontece de fato.
    const boostedCoverage = Phaser.Math.Clamp(maxCoverage * 2, 0, 1);
    sprite.setAlpha(Phaser.Math.Linear(1, MIN_PLAYER_ALPHA, boostedCoverage));
  }
}
