import Phaser from 'phaser';
import {
  PLAYER_IDLE_KEY,
  PLAYER_WALK_KEY,
  PLAYER_ANIM_FRAMES,
  PLAYER_MOVE_DURATION_MS,
  PLAYER_ACTIONS,
  PlayerActionKey,
} from '../data/player';
import { GridPoint } from '../systems/pathfinding';
import { createGroundShadow } from '../systems/shadow';

type Facing = 'down' | 'up' | 'side';

/**
 * Entidade do personagem jogável: dono do sprite, da posição lógica em grid
 * e da movimentação (um passo por vez entre células adjacentes,
 * interpolado suavemente). Tanto o teclado (`tryStep`) quanto o seguimento
 * de rota do pathfinding (`setPath`) terminam usando `beginStep`, então a
 * lógica de mover não é duplicada. Ações agrícolas (`performAction`) usam a
 * mesma direção/flip da movimentação — não há lógica de orientação separada
 * por animação.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  col: number;
  row: number;

  private readonly tilePx: number;
  private facing: Facing = 'down';
  /** Espelha o sprite de lado (o frame base de "side" olha para a esquerda). */
  private flipSide = false;
  private moving = false;
  private busy = false;
  private moveElapsed = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private path: GridPoint[] = [];
  private receivedInputThisFrame = false;
  private lastDCol = 0;
  private lastDRow = 0;
  private lastIsWalkable: ((col: number, row: number) => boolean) | null = null;

  constructor(scene: Phaser.Scene, col: number, row: number, tilePx: number) {
    this.col = col;
    this.row = row;
    this.tilePx = tilePx;

    const { x, y } = this.cellAnchor(col, row);
this.sprite = scene.add.sprite(x, y, PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES.idleDown.start);
    this.sprite.setOrigin(0.5, 1);

    // ADICIONE ISSO: Inicializa a profundidade do jogador
    this.sprite.setDepth(this.sprite.y);

    // Sombra de chão: mesma técnica reaproveitada em objetos estáticos
    // (árvores, Caixa de Remessas, Loja), só que acompanhando o Y do
    // personagem a cada frame (ver `update`), já que ele se move.
    const shadowScale = this.tilePx / 16;
    this.shadow = createGroundShadow(scene, x, y-13, shadowScale * 1.1, shadowScale * 0.5);
    this.shadow.setDepth(y - 0.1);

    this.playIdle();
  }

  private cellAnchor(col: number, row: number): { x: number; y: number } {
    return { x: col * this.tilePx + this.tilePx / 2, y: (row + 1) * this.tilePx };
  }

  isMoving(): boolean {
    return this.moving;
  }

  /** Está executando uma ação agrícola (animação de ferramenta em andamento)? */
  isBusy(): boolean {
    return this.busy;
  }

  /**
   * Substitui a rota atual pela informada e começa a segui-la imediatamente
   * (célula a célula) se o personagem não estiver em movimento.
   */
  setPath(path: GridPoint[]): void {
    this.path = [...path];
    if (!this.moving) {
      const next = this.path.shift();
      if (next) this.beginStep(next.col, next.row, next.col - this.col, next.row - this.row);
    }
  }

  /** Interrompe qualquer rota pendente (usado quando o teclado assume o controle). */
  clearPath(): void {
    this.path = [];
  }

  /** Tenta mover uma célula na direção informada, se não estiver em movimento nem ocupado com uma ação. */
tryStep(dCol: number, dRow: number, isWalkable: (col: number, row: number) => boolean): void {
    if (this.busy) return;
    
    this.receivedInputThisFrame = true;
    this.lastDCol = dCol;
    this.lastDRow = dRow;
    this.lastIsWalkable = isWalkable;
    
    // ESTA É A TRAVA DE SEGURANÇA! Ela impede o teletransporte.
    if (this.moving) return; 

    const col = this.col + dCol;
    const row = this.row + dRow;
    if (!isWalkable(col, row)) return;
    
    this.beginStep(col, row, dCol, dRow);
  }

  /**
   * Executa uma ação agrícola (arar, plantar, regar, colher) parado no
   * lugar: toca a animação da ferramenta uma vez e, quando ela termina,
   * chama `onApply` (que efetivamente altera o estado do terreno/plantação)
   * e volta para idle. A animação só representa a ação visualmente — quem
   * decide o efeito é sempre `onApply`, nunca a animação em si.
   */
  performAction(action: PlayerActionKey, onApply: () => void): void {
    if (this.moving || this.busy) return;

    this.facing = 'down';
    this.flipSide = false;
    this.sprite.setFlipX(false);
    this.busy = true;

    const spec = PLAYER_ACTIONS[action];
    // Algumas folhas de animação têm mais margem vazia abaixo do
    // personagem que o padrão (`Idle.png`) — como a origem é o canto
    // inferior do frame, não os pés de verdade, isso faz o personagem
    // "flutuar" acima do chão. `yOffset` compensa deslocando o sprite pra
    // baixo enquanto ela toca (ver doc de `ActionAnimSpec.yOffset`).
    const yOffset = spec.yOffset ?? 0;
    this.sprite.y += yOffset;

    const key = `${spec.key}-${this.facing}`;
    this.sprite.play(key);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.y -= yOffset;
      onApply();
      this.busy = false;
      this.playIdle();
    });
  }

  /**
   * Vira o personagem para encarar uma direção sem se mover (usado ao
   * chegar perto de um objeto sólido, ex.: a Caixa de Remessas, para
   * interagir de frente em vez de na direção em que o último passo
   * aconteceu por acaso). Reaproveita a mesma lógica de direção/flip do
   * movimento — não há orientação especial só para isso.
   */
  faceDirection(dCol: number, dRow: number): void {
    this.updateFacing(dCol, dRow);
    this.playIdle();
  }

  private beginStep(col: number, row: number, dCol: number, dRow: number): void {
    const from = this.cellAnchor(this.col, this.row);
    const to = this.cellAnchor(col, row);
    this.fromX = from.x;
    this.fromY = from.y;
    this.toX = to.x;
    this.toY = to.y;
    this.col = col;
    this.row = row;
    this.moving = true;
    this.moveElapsed = 0;

    this.updateFacing(dCol, dRow);
    this.playWalk();
  }

  private updateFacing(dCol: number, dRow: number): void {
    if (dRow < 0) this.facing = 'up';
    else if (dRow > 0) this.facing = 'down';
    else if (dCol !== 0) {
      this.facing = 'side';
      this.flipSide = dCol < 0; // Alterado de dCol > 0 para dCol < 0
    }
    this.sprite.setFlipX(this.facing === 'side' && this.flipSide);
  }

update(_time: number, delta: number): void {
    if (!this.moving) {
      this.receivedInputThisFrame = false;
      return;
    }

    this.moveElapsed += delta;
    const t = Math.min(1, this.moveElapsed / PLAYER_MOVE_DURATION_MS);

    this.sprite.x = Phaser.Math.Linear(this.fromX, this.toX, t);
    this.sprite.y = Phaser.Math.Linear(this.fromY, this.toY, t);
    
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 13);
    this.shadow.setDepth(this.sprite.y - 0.1);

    if (t >= 1) {
      this.moving = false;
      const next = this.path.shift();
      
      if (next) {
        const dCol = next.col - this.col;
        const dRow = next.row - this.row;
        this.beginStep(next.col, next.row, dCol, dRow);
      } else if (this.receivedInputThisFrame && this.lastIsWalkable && this.lastIsWalkable(this.col + this.lastDCol, this.row + this.lastDRow)) {
        // Continua andando instantaneamente se a tecla continuar pressionada
        const col = this.col + this.lastDCol;
        const row = this.row + this.lastDRow;
        this.beginStep(col, row, this.lastDCol, this.lastDRow);
      } else {
        this.playIdle();
      }
    }

    // A flag é limpa apenas no final de tudo!
    this.receivedInputThisFrame = false;
  }

  private playIdle(): void {
    const key = `player-idle-${this.facing}`;
    this.sprite.play(key, true);
  }

  private playWalk(): void {
    const key = `player-walk-${this.facing}`;
    // Só inicia a animação se ela já não estiver rodando
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  /** Cria as animações de idle/caminhada/ações agrícolas nas 3 direções do rig (baixo/cima/lado). */
  static createAnimations(scene: Phaser.Scene): void {
    const { anims } = scene;

    anims.create({
      key: 'player-idle-down',
      frames: anims.generateFrameNumbers(PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES.idleDown),
      frameRate: 4,
      repeat: -1,
    });
    anims.create({
      key: 'player-idle-up',
      frames: anims.generateFrameNumbers(PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES.idleUp),
      frameRate: 4,
      repeat: -1,
    });
    anims.create({
      key: 'player-idle-side',
      frames: anims.generateFrameNumbers(PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES.idleSide),
      frameRate: 4,
      repeat: -1,
    });

    anims.create({
      key: 'player-walk-down',
      frames: anims.generateFrameNumbers(PLAYER_WALK_KEY, PLAYER_ANIM_FRAMES.walkDown),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-up',
      frames: anims.generateFrameNumbers(PLAYER_WALK_KEY, PLAYER_ANIM_FRAMES.walkUp),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-side',
      frames: anims.generateFrameNumbers(PLAYER_WALK_KEY, PLAYER_ANIM_FRAMES.walkSide),
      frameRate: 10,
      repeat: -1,
    });

    for (const spec of Object.values(PLAYER_ACTIONS)) {
      anims.create({
        key: `${spec.key}-down`,
        frames: anims.generateFrameNumbers(spec.key, spec.down),
        frameRate: spec.frameRate,
        repeat: 0,
      });
      anims.create({
        key: `${spec.key}-up`,
        frames: anims.generateFrameNumbers(spec.key, spec.up),
        frameRate: spec.frameRate,
        repeat: 0,
      });
      anims.create({
        key: `${spec.key}-side`,
        frames: anims.generateFrameNumbers(spec.key, spec.side),
        frameRate: spec.frameRate,
        repeat: 0,
      });
    }
  }
}
