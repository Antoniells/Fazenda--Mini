import Phaser from 'phaser';
import { DecorationDefinition } from '../data/decorations';
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
import { gameState } from './gameState';
import { AXE, PICKAXE, IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE } from '../data/tools';

/** Nome do evento global (Fase 8 — Crafting) disparado ao interagir com a Bancada de Trabalho — ouvido pela `UIScene`, que é quem realmente sabe abrir o `CraftingMenu` (ver `scenes/UIScene.ts`). Um evento em `scene.game.events` (não `scene.events`) evita este módulo (`systems/`) precisar importar de `scenes/`, na direção errada da arquitetura. */
export const OPEN_CRAFTING_MENU_EVENT = 'open-crafting-menu';

/** Ferramentas (qualquer tier — ver `data/tools.ts`) que ainda removem a Bancada em vez de abrir a Bancada — mesma ideia de Machado/Picareta já servirem pra "desfazer" recursos do mundo (árvore, pedra). */
const WORKBENCH_REMOVAL_TOOL_IDS = new Set<string>([AXE.id, PICKAXE.id, IRON_AXE.id, GOLD_AXE.id, IRON_PICKAXE.id, GOLD_PICKAXE.id]);

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950; // Acima do mundo, abaixo dos HUDs (1000+) — mesma faixa do TileCursor.
const PLACED_SHADOW_DEPTH = -0.4; // Mesma faixa das sombras estáticas de mapBuilder.ts.

/**
 * Uma decoração já posicionada, quando clicada: por padrão remove-se e
 * devolve 1 unidade ao estoque — mesmo padrão dos outros `Interactable`
 * (Caixa de Remessas, Loja), objeto sólido com interação adjacente já
 * cuidada pelo `PlayerController`. O Poço é a exceção: tem uma utilidade
 * própria (encher o regador, ver `DecorationPlacementSystem.refillWateringCan`),
 * então clicar nele usa em vez de remover.
 *
 * `col`/`row` aqui são sempre a célula-âncora (canto superior-esquerdo do
 * footprint) — a MESMA instância é registrada em todas as células que a
 * construção ocupa (Fase 9, multi-tile), então não importa em qual célula
 * da base o jogador clicou: a ação sempre se refere à construção inteira.
 */
class PlacedDecorationInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly system: DecorationPlacementSystem,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
    private readonly decorationId: string, // <-- ADICIONADO AQUI
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    // Se o objeto clicado for o poço, toca a animação de buscar água (própria, ver PLAYER_ACTIONS.well) e NÃO remove!
    if (this.decorationId === 'well') {
      this.player.performAction('well', () => {
        this.system.refillWateringCan(this.col, this.row);
      });
      return; // <-- O return impede que o poço seja destruído
    }

    // Bancada de Trabalho (Fase 8 — Crafting, pedido explícito do usuário):
    // mesma exceção do Poço, mas com uma saída a mais pra não travar o
    // jogador — sem isso, uma vez posicionada ela nunca mais sairia da
    // fazenda (igual o Poço hoje). Machado/Picareta (qualquer tier)
    // continuam removendo-a normalmente; qualquer outra seleção (ou nenhuma)
    // abre o Crafting.
    if (this.decorationId === 'workbench') {
      const selected = gameState.inventory.getSelectedSlot();
      const isRemovalTool = selected?.category === 'tool' && WORKBENCH_REMOVAL_TOOL_IDS.has(selected.id);
      if (isRemovalTool) {
        this.system.removeAt(this.col, this.row);
        return;
      }
      this.scene.game.events.emit(OPEN_CRAFTING_MENU_EVENT);
      return;
    }

    // Se for outra decoração qualquer, ela é removida e volta pro estoque
    this.system.removeAt(this.col, this.row);
  }
}

/** Uma decoração posicionada: além do que já existia, guarda o `footprint` usado no momento da colocação — necessário pra `removeAt` desbloquear/desregistrar exatamente as mesmas células (a definição em `data/decorations.ts` poderia teoricamente mudar depois). */
interface PlacedDecoration {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  decorationId: string;
  footprint: { width: number; height: number };
}

/**
 * Modo de posicionamento livre de decorações (Fase 6): o jogador entra no
 * modo (`start`) com uma decoração do estoque, um preview semitransparente
 * segue o mouse (verde se o local for válido, vermelho se não), e o clique
 * confirma — reaproveitando o `PointerInputInterceptor` do
 * `PlayerController` para "roubar" esse clique do fluxo normal de
 * movimento/interação enquanto o modo estiver ativo.
 *
 * Uma decoração posicionada bloqueia todas as células do seu `footprint`
 * (Fase 9 — Construções Multi-tile) no `WalkableGrid` (dinâmico,
 * `block`/`unblock`) e se registra no `InteractionRegistry` em cada uma
 * delas, para poder ser clicada/removida a partir de qualquer ponto da sua
 * base — não só na célula onde o clique de colocação caiu.
 */
export class DecorationPlacementSystem implements PointerInputInterceptor {
  private readonly placed = new Map<string, PlacedDecoration>();
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
    const decoration = this.activeDecoration;
    if (!decoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    const { width, height } = decoration.footprint;

    // Fantasma centralizado no footprint inteiro (não só na célula sob o
    // mouse): o `col`/`row` sob o cursor é o canto superior-esquerdo do
    // footprint, que se estende `width` células pra direita e `height` pra
    // baixo — o mesmo cálculo de antes (origem inferior-central da imagem)
    // generalizado, que pra `width: 1, height: 1` dá exatamente o resultado
    // de antes desta fase.
    this.ghost.setPosition(col * this.tilePx + (width * this.tilePx) / 2, (row + height) * this.tilePx);
    this.ghost.setTint(this.canPlaceAt(col, row, decoration.footprint) ? GHOST_VALID_TINT : GHOST_INVALID_TINT);
  }

  /** Verdadeiro só se TODAS as células do footprint, a partir de (`col`,`row`), estiverem livres (andáveis e fora da lavoura). */
  private canPlaceAt(col: number, row: number, footprint: { width: number; height: number }): boolean {
    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) {
        const c = col + dx;
        const r = row + dy;
        if (!this.grid.isWalkable(c, r) || this.farmlandCells.has(`${c},${r}`)) return false;
      }
    }
    return true;
  }

  /** Chamado pelo `PlayerController` enquanto este sistema está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    const decoration = this.activeDecoration;
    if (!decoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlaceAt(col, row, decoration.footprint)) return;
    if (!this.inventory.useDecoration(decoration.id)) return;

    this.placeAt(decoration, col, row);

    // Sem mais estoque, sai do modo — não tem sentido continuar "segurando"
    // uma decoração que o jogador não tem mais.
    if (this.inventory.getDecorationCount(decoration.id) <= 0) this.cancel();
  }

  private placeAt(decoration: DecorationDefinition, col: number, row: number): void {
    const { width, height } = decoration.footprint;
    const x = col * this.tilePx + (width * this.tilePx) / 2;
    const y = (row + height) * this.tilePx;

    const shadow = createGroundShadow(this.scene, x, y, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    shadow.setDepth(PLACED_SHADOW_DEPTH);

    const image = this.scene.add.image(x, y, decoration.textureKey, decoration.frameName);
    image.setOrigin(0.5, 1);
    image.setScale(DISPLAY_SCALE);
    image.setDepth(y);

    const interactable = new PlacedDecorationInteractable(this.scene, this, this.player, col, row, decoration.id);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.grid.block(col + dx, row + dy);
        this.interactions.set(col + dx, row + dy, interactable);
      }
    }

    this.placed.set(`${col},${row}`, { image, shadow, decorationId: decoration.id, footprint: { width, height } });
  }

  /**
   * Remove a decoração da célula-âncora (`col`,`row` — canto superior-
   * esquerdo do footprint, o que `PlacedDecorationInteractable` sempre usa,
   * não importa em qual célula da base o jogador clicou) e devolve 1
   * unidade ao estoque. Desbloqueia e desregistra TODAS as células do
   * footprint original, não só a âncora.
   */
  removeAt(col: number, row: number): void {
    const key = `${col},${row}`;
    const entry = this.placed.get(key);
    if (!entry) return;

    entry.image.destroy();
    entry.shadow.destroy();
    this.placed.delete(key);

    const { width, height } = entry.footprint;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.grid.unblock(col + dx, row + dy);
        this.interactions.remove(col + dx, row + dy);
      }
    }

    this.inventory.addDecorations(entry.decorationId, 1);
    console.log(`Removido: 1 ${entry.decorationId} (estoque: ${this.inventory.getDecorationCount(entry.decorationId)}).`);
  }

  /**
   * Enche o regador de volta ao máximo (Fase 7 — barra de água) e toca o
   * mesmo respingo d'água já usado ao regar a lavoura
   * (`FarmlandRenderer.spawnWaterSplash`) — sem sprite novo. Chamado por
   * `PlacedDecorationInteractable` quando o Poço é interagido, já dentro da
   * animação de regar (`Player.performAction('water', ...)`).
   */
  refillWateringCan(col: number, row: number): void {
    this.inventory.refillWateringCan();
    this.farmlandRenderer.spawnWaterSplash(col, row);
    console.log(`Regador reabastecido no Poço (cargas: ${this.inventory.getWateringCanCharges()}).`);
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

    for (const { image } of this.placed.values()) {
      // Verifica se a decoração está na frente do personagem
      const decInFront = image.depth > sprite.depth;
      const coverage = decInFront ? coverageRatio(playerBounds, image.getBounds()) : 0;

      // Agora é a IMAGEM (poço) que fica transparente (até 50%), e não o personagem
      image.setAlpha(Phaser.Math.Linear(1, 0.5, coverage));
    }

    // Garante que o personagem sempre fique totalmente opaco
    sprite.setAlpha(1);
  }
}
