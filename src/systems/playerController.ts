import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { findPath, GridPoint } from './pathfinding';
import { InteractionRegistry } from './interaction';
import { gameState } from './gameState';
import { WEAPONS } from '../data/weapons';
import { resolveSwordAttack } from './combat';
import { Enemy } from '../entities/Enemy';
import { startEating, isEdibleCropSelected } from './eating';
import { tutorial } from './tutorial';
import { playEffect } from './soundEffects';
import { SWORD_SWING_SOUND } from '../data/audio';

/**
 * Alvo pendente de interação: `standCol/standRow` é a célula andável para
 * onde o personagem está indo, `targetCol/targetRow` é a célula onde a
 * interação de fato está registrada. Para uma célula andável e interativa
 * (ex.: um canteiro), as duas são a mesma célula — o jogador para em cima
 * dela. Para uma célula sólida (ex.: a Caixa de Remessas), `standCol/Row`
 * é a célula andável mais próxima do alvo, e o jogador vira de frente para
 * `targetCol/Row` ao chegar, antes de interagir (ver `handleBlockedClick`).
 */
interface PendingInteraction {
  standCol: number;
  standRow: number;
  targetCol: number;
  targetRow: number;
}

/**
 * Permite outro sistema "roubar" o clique do mundo enquanto estiver ativo
 * (ex.: `DecorationPlacementSystem` durante o modo de posicionamento, Fase
 * 6) — sem isso, um clique nesse modo tanto tentaria mover/interagir com
 * o mundo (`PlayerController`) quanto posicionar a decoração, os dois ao
 * mesmo tempo. Quando não há nenhum interceptor ativo, o comportamento é
 * idêntico ao de antes desta mudança.
 */
export interface PointerInputInterceptor {
  isActive(): boolean;
  handleClick(x: number, y: number): void;
}

/**
 * Liga o input do jogador (teclado e clique no mapa) à entidade `Player`.
 * Teclado move uma célula por vez e cancela qualquer rota em andamento;
 * clique calcula uma rota com A* e entrega ao Player para seguir (isso não
 * muda). Se a célula clicada tiver algo registrado em `InteractionRegistry`
 * (terreno, plantação, etc.), a interação é disparada assim que o
 * personagem chegar lá — ou imediatamente, se ele já estiver na célula.
 *
 * Células sólidas (não andáveis, ex.: a Caixa de Remessas) também podem ter
 * uma interação: nesse caso o personagem não pode pisar nelas, então o
 * clique leva até a célula andável mais próxima entre as 4 vizinhas da
 * célula clicada, e a interação só dispara depois que ele chega lá e vira
 * de frente para o alvo (ver `handleBlockedClick`).
 *
 * Também liga o golpe de espada (Fase 8 — Combate, pedido explícito do
 * usuário: ataque global, não preso à Floresta): como esta classe já é
 * instanciada por QUALQUER cena (`MainScene` e todas as `ExternalMapScene`
 * — Floresta/Pedreira/Caverna/Praia), é o lugar certo pra escutar a tecla
 * de ataque uma única vez em vez de cada cena reimplementar o mesmo
 * `keydown-SPACE`. Só a Floresta tem inimigos por ora — `setEnemyProvider`
 * deixa qualquer cena plugar de onde vêm os inimigos vivos; sem isso, o
 * golpe ainda balança a espada no ar normalmente, só não acerta ninguém
 * (lista vazia por padrão).
 */
export class PlayerController {
  private readonly player: Player;
  private readonly grid: WalkableGrid;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: any;
  private readonly tilePx: number;
  private readonly interactions: InteractionRegistry;
  private pendingInteraction: PendingInteraction | null = null;
  private readonly scene: Phaser.Scene;
  private lastCol: number;
  private lastRow: number;

  /** Vários sistemas podem "roubar" o clique (Fase 6: posicionar decoração; Fase 8: tela de Inventário) — o primeiro que estiver `isActive()` vence. */
  private readonly inputInterceptors: PointerInputInterceptor[] = [];

  /** Objetos móveis do mundo que atendem ao clique (o pet, pra receber carinho) — o primeiro que devolver `true` consome o clique, que então NÃO vira "andar até aqui"/interação. */
  private readonly worldClickHandlers: Array<(x: number, y: number) => boolean> = [];

  /** De onde vêm os inimigos vivos desta cena (Fase 8 — Combate) — `null` (padrão) equivale a nenhum inimigo aqui, ver `setEnemyProvider`. */
  private enemyProvider: (() => Enemy[]) | null = null;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    grid: WalkableGrid,
    tilePx: number,
    interactions: InteractionRegistry,
  ) {
    this.scene = scene;
    this.player = player;
    this.grid = grid;
    this.tilePx = tilePx;
    this.interactions = interactions;
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.lastCol = player.col;
    this.lastRow = player.row;

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // worldX/worldY (não x/y) — com a câmera podendo rolar (Fase 6,
      // Expansão), x/y são coordenadas de TELA, não do mundo.
      this.handlePointerDown(pointer.worldX, pointer.worldY);
    });

    scene.input.keyboard!.on('keydown-SPACE', () => this.handleAttackKey());
    scene.input.keyboard!.on('keydown-F', () => this.handleInteractKey());
  }

  /**
   * F: interage com o que está registrado na célula que o personagem está ENCARANDO (Loja, Caixa de Remessas, porta de casa —
   * `Interactable.keyInteractable`, pedido explícito do usuário: tecla além do mouse) — mesmo alvo que o clique alcançaria
   * chegando adjacente e virando de frente, só que sem andar. Nada ali? Cai no comportamento antigo do F: comer a colheita
   * selecionada, se houver.
   */
  private handleInteractKey(): void {
    if (this.player.isBusy() || this.inputInterceptors.some((interceptor) => interceptor.isActive())) return;

    const { dx, dy } = this.player.getFacingVector();
    const col = this.player.col + dx;
    const row = this.player.row + dy;
    const interactable = this.canInteractWith(col, row) ? this.interactions.get(col, row) : undefined;
    if (interactable?.keyInteractable) {
      interactable.interact();
      return;
    }

    if (!tutorial.allows({ kind: 'eat' })) return;
    startEating(this.scene, this.player);
  }

  /** O tutorial (`systems/tutorial.ts`) deixa interagir com esta célula agora? Sem tutorial rodando, sempre. */
  private canInteractWith(col: number, row: number): boolean {
    return tutorial.allows({ kind: 'interact', col, row });
  }

  /** Registra um sistema que pode roubar o clique enquanto `isActive()` — ver `PointerInputInterceptor`. */
  addInputInterceptor(interceptor: PointerInputInterceptor): void {
    this.inputInterceptors.push(interceptor);
  }

  /** Registra um tratador de clique no mundo (coordenadas de mundo) — ver `worldClickHandlers`. Só roda com nenhum interceptor ativo (menus abertos etc.). */
  addWorldClickHandler(handler: (x: number, y: number) => boolean): void {
    this.worldClickHandlers.push(handler);
  }

  /** Plugado pela cena dona dos inimigos (só a Floresta, por ora — ver `ForestScene`) — ver doc da classe. */
  setEnemyProvider(provider: () => Enemy[]): void {
    this.enemyProvider = provider;
  }

  /**
   * Golpe de espada (Fase 8 — Combate, ataque global): precisa de uma
   * espada selecionada na Hotbar (mesmo padrão de checagem de ferramenta de
   * `farmlandInteraction.ts`/`resourceInteraction.ts`); bloqueado pelos
   * mesmos interceptores que já travam clique/movimento (Inventário aberto,
   * Dormir, Pausa, posicionar decoração — ver `inputInterceptors`), sem
   * precisar de um import novo pra isso. Toca a animação sempre — mesmo sem
   * nenhum inimigo por perto ("balançar a espada no ar", pedido explícito
   * do usuário) — e só então testa a hitbox contra `enemyProvider()` (vazio
   * se a cena não tiver registrado nenhum).
   */
  private handleAttackKey(): void {
    if (this.player.isBusy() || this.inputInterceptors.some((interceptor) => interceptor.isActive())) return;

    const selected = gameState.inventory.getSelectedSlot();
    const weapon = selected?.category === 'tool' ? WEAPONS[selected.id] : undefined;
    if (!weapon || !tutorial.allows({ kind: 'attack' })) return;

    // Captura a direção ANTES do `performAction` tocar a animação — ver
    // doc de `combat.computeAttackHitbox`.
    const facing = this.player.getFacingVector();
    this.player.performAction(
      'sword',
      () => {
        resolveSwordAttack(this.player, this.enemyProvider?.() ?? [], weapon.damage, facing);
      },
      () => playEffect(this.scene, SWORD_SWING_SOUND), // O "vush" sai no início do golpe, acerte ou não.
    );
  }

  private handlePointerDown(x: number, y: number): void {
    if (this.player.isBusy()) return;
    if (!tutorial.allows({ kind: 'move' })) return; // Tutorial: nos passos "info" nada do mundo responde ao clique.

    const activeInterceptor = this.inputInterceptors.find((interceptor) => interceptor.isActive());
    if (activeInterceptor) {
      activeInterceptor.handleClick(x, y);
      return;
    }

    if (this.worldClickHandlers.some((handler) => handler(x, y))) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);

    if (!this.grid.isWalkable(col, row) || this.interactions.get(col, row)?.interactFromAdjacent) {
      this.handleBlockedClick(col, row);
      return;
    }

    if (this.player.col === col && this.player.row === row) {
      this.pendingInteraction = null;
      const interactable = this.canInteractWith(col, row) ? this.interactions.get(col, row) : undefined;
      if (interactable) {
        interactable.interact();
      } else if (isEdibleCropSelected() && tutorial.allows({ kind: 'eat' })) {
        // Clicar no próprio personagem com uma colheita na mão = comer (só se não houver nada na célula pra interagir).
        startEating(this.scene, this.player);
      }
      return;
    }

    const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, { col, row });
    if (!path || path.length === 0) return;

    this.pendingInteraction = this.canInteractWith(col, row) && this.interactions.get(col, row)
      ? { standCol: col, standRow: row, targetCol: col, targetRow: row }
      : null;
    this.player.setPath(path, this.canWalkTo.bind(this));
  }

  /**
   * Clique numa célula sólida (não andável): só faz algo se houver uma
   * interação registrada ali (ex.: a Caixa de Remessas) — do contrário é só
   * um obstáculo comum (árvore, cerca) e o clique não tem efeito, igual a
   * antes. Havendo interação, encontra a célula andável mais próxima do
   * jogador entre as 4 vizinhas da célula clicada e vai até lá; virar de
   * frente para o alvo e disparar `interact()` acontece na chegada (`update`).
   */
  private handleBlockedClick(col: number, row: number): void {
    const interactable = this.canInteractWith(col, row) ? this.interactions.get(col, row) : undefined;
    if (!interactable) return;

    const hinted = interactable.approachCell;
    const stand = hinted && this.grid.isWalkable(hinted.col, hinted.row) ? hinted : this.findNearestWalkableNeighbor(col, row);
    if (!stand) return;

    if (this.player.col === stand.col && this.player.row === stand.row) {
      this.pendingInteraction = null;
      this.player.faceDirection(col - stand.col, row - stand.row);
      interactable.interact();
      return;
    }

    const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, stand);
    if (!path || path.length === 0) return;

    this.pendingInteraction = { standCol: stand.col, standRow: stand.row, targetCol: col, targetRow: row };
    this.player.setPath(path, this.canWalkTo.bind(this));
  }

  /**
   * Entre as células andáveis ao lado, em cima ou embaixo de (`col`, `row`),
   * devolve a mais próxima do jogador pela distância real de rota (não só
   * Manhattan) — o mapa é pequeno, então rodar o A* até 4 vezes aqui não
   * pesa (mesma lógica de "não precisa de estrutura otimizada" já usada em
   * `pathfinding.ts`). `null` se nenhuma vizinha for andável ou alcançável.
   */
  private findNearestWalkableNeighbor(col: number, row: number): GridPoint | null {
    const candidates: GridPoint[] = [
      { col, row: row - 1 },
      { col, row: row + 1 },
      { col: col - 1, row },
      { col: col + 1, row },
    ].filter((candidate) => this.grid.isWalkable(candidate.col, candidate.row));

    let best: GridPoint | null = null;
    let bestLength = Infinity;
    for (const candidate of candidates) {
      const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, candidate);
      if (!path) continue;
      if (path.length < bestLength) {
        bestLength = path.length;
        best = candidate;
      }
    }
    return best;
  }

  /** Verifica o Grid e também se a célula alvo é a mesma célula que um inimigo ocupa (grid 1x1 — Fase 9, pedido explícito do usuário). */
private canWalkTo(col: number, row: number): boolean {
    if (!this.grid.isWalkable(col, row)) return false;

    const enemies = this.enemyProvider?.() ?? [];
    
    // Caixa exata do bloco que o jogador está tentando pisar
    const targetRect = new Phaser.Geom.Rectangle(col * this.tilePx, row * this.tilePx, this.tilePx, this.tilePx);

    for (const enemy of enemies) {
      // Caixa de 32x32 que acompanha o Slime perfeitamente
      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - (this.tilePx / 2), 
        enemy.y - 16 - (this.tilePx / 2), 
        this.tilePx, 
        this.tilePx
      );

      // Encolhemos a colisão do slime em 2 pixels de cada lado (margem de tolerância)
      // para o jogador não "travar" na quina do inimigo se passar raspando.
      enemyRect.x += 2;
      enemyRect.y += 2;
      enemyRect.width -= 4;
      enemyRect.height -= 4;

      // Se o bloco que o jogador quer pisar cruzar com a caixa do Slime, bloqueia o passo!
      if (Phaser.Geom.Intersects.RectangleToRectangle(targetRect, enemyRect)) return false;
    }

    return true;
  }

  update(time: number, delta: number): void {
if (!this.player.isBusy()) {
      
      // Verifica se o jogador apertou a setinha OU a respectiva tecla WASD
      const isLeft = this.cursors.left.isDown || this.wasd.left.isDown;
      const isRight = this.cursors.right.isDown || this.wasd.right.isDown;
      const isUp = this.cursors.up.isDown || this.wasd.up.isDown;
      const isDown = this.cursors.down.isDown || this.wasd.down.isDown;

      // Define a direção baseada no que foi apertado
      const dCol = isLeft ? -1 : isRight ? 1 : 0;
      const dRow = isUp ? -1 : isDown ? 1 : 0;
      if ((dCol !== 0 || dRow !== 0) && tutorial.allows({ kind: 'move' })) {
         {
          this.player.clearPath();
          this.pendingInteraction = null;
// Prioriza um eixo por vez (sem diagonais): vertical antes de horizontal.
          if (dRow !== 0) this.player.tryStep(0, dRow, this.canWalkTo.bind(this));
          else this.player.tryStep(dCol, 0, this.canWalkTo.bind(this));
        }
      }
    }

    this.player.update(time, delta);

    if (this.player.col !== this.lastCol || this.player.row !== this.lastRow) {
      this.lastCol = this.player.col;
      this.lastRow = this.player.row;
      // Avisa a cena que o jogador pisou em uma nova célula
      this.scene.events.emit('player-stepped', this.lastCol, this.lastRow);
    }
    if (
      !this.player.isBusy() &&
      this.pendingInteraction &&
      !this.player.isMoving() &&
      this.player.col === this.pendingInteraction.standCol &&
      this.player.row === this.pendingInteraction.standRow
    ) {
      const { standCol, standRow, targetCol, targetRow } = this.pendingInteraction;
      this.pendingInteraction = null;
      // Se o alvo é uma célula diferente de onde o jogador parou (caso da
      // célula sólida), vira de frente para ele antes de interagir. Quando
      // são a mesma célula (caso andável, ex.: canteiro), não há nada a
      // virar — mantém o comportamento de sempre.
      if (targetCol !== standCol || targetRow !== standRow) {
        this.player.faceDirection(targetCol - standCol, targetRow - standRow);
      }
      this.interactions.get(targetCol, targetRow)?.interact();
    }
  }
}

