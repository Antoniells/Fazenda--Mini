import Phaser from 'phaser';
import {
  PLAYER_ANIM_FRAMES,
  PLAYER_MOVE_DURATION_MS,
  PlayerActionKey,
  PlayerAssets,
  CharacterId,
  getPlayerAssets,
} from '../data/player';
import { gameState } from '../systems/gameState';
import { GridPoint } from '../systems/pathfinding';
import { createGroundShadow } from '../systems/shadow';
import { playEffect } from '../systems/soundEffects';
import { HURT_SOUND } from '../data/audio';
import { getMoveSpeedMultiplier } from '../systems/skills';

type Facing = 'down' | 'up' | 'side';

/** Tempo máximo (ms) que uma ação (golpe, rega, comer…) pode segurar o jogador ocupado (busy): bem acima da mais longa (~1 s); só age se a animação nunca terminar. */
const ACTION_FAILSAFE_MS = 4000;

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
  /** Chaves de textura/animação do personagem escolhido (`gameState.profile.characterId`) — as texturas já foram carregadas no `preload` da cena (ver `systems/playerSprites.ts`). */
  private readonly assets: PlayerAssets;
  private facing: Facing = 'down';
  /** Espelha o sprite de lado (o frame base de "side" olha para a esquerda). */
  private flipSide = false;
  private moving = false;
  private busy = false;
  private sitting = false;
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
    this.assets = getPlayerAssets(gameState.profile.characterId);

    const { x, y } = this.cellAnchor(col, row);
    this.sprite = scene.add.sprite(x, y, this.assets.idleKey, PLAYER_ANIM_FRAMES.idleDown.start);
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
   * Sentado num móvel (`sitAt`)? NÃO conta como `isBusy`: o `PlayerController` ignora clique e teclas de quem está ocupado, e é justamente
   * o clique/tecla que precisa chegar pra levantar (`standUp`). Ações (`performAction`) e passos (`tryStep`) já checam isto por conta própria.
   */
  isSitting(): boolean {
    return this.sitting;
  }

  /**
   * Senta (pedido explícito): o sprite vai pro ponto (`x`,`y`, os "pés" na altura do assento) do móvel, virado pra frente, na pose da
   * folha `Sitting` (a mesma da ação de comer, `PLAYER_ACTIONS.eat`, 1 quadro por direção) e fica assim até `standUp`. A célula lógica
   * (`col`/`row`) NÃO muda — é a de onde ele veio, e é pra onde volta ao levantar. `depth` = profundidade do sprite (acima do móvel).
   */
  sitAt(x: number, y: number, depth: number): void {
    if (this.moving || this.busy || this.sitting) return;
    this.clearPath();
    this.updateFacing(0, 1);
    this.sitting = true;

    const spec = this.assets.actions.eat;
    this.sprite.setPosition(x, y + (spec.yOffset ?? 0));
    this.sprite.setDepth(depth);
    this.shadow.setPosition(x, y - 13);
    this.shadow.setDepth(depth - 0.1);
    this.sprite.play(`${spec.key}-down`);
  }

  /** Levanta e volta pra célula de onde sentou. */
  standUp(): void {
    if (!this.sitting) return;
    this.sitting = false;
    const { x, y } = this.cellAnchor(this.col, this.row);
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(y);
    this.shadow.setPosition(x, y - 13);
    this.shadow.setDepth(y - 0.1);
    this.playIdle();
  }

  /**
   * Substitui a rota atual pela informada e começa a segui-la imediatamente
   * (célula a célula) se o personagem não estiver em movimento.
   */
// Adicione esta variável:
  private pathIsWalkable: ((col: number, row: number) => boolean) | null = null;

  // Substitua o setPath atual por este:
  setPath(path: GridPoint[], isWalkable?: (col: number, row: number) => boolean): void {
    this.path = [...path];
    this.pathIsWalkable = isWalkable ?? null;

    if (!this.moving) {
      this.tryNextPathStep();
    }
  }

  // Adicione esta nova função logo abaixo do setPath:
  private tryNextPathStep(): boolean {
    if (this.path.length === 0) return false;

    const next = this.path[0];
    
    // Se o próximo passo do caminho de repente foi bloqueado (ex: slime entrou na frente), cancela a rota!
    if (this.pathIsWalkable && !this.pathIsWalkable(next.col, next.row)) {
      this.clearPath();
      return false;
    }

    this.path.shift();
    const dCol = next.col - this.col;
    const dRow = next.row - this.row;
    this.beginStep(next.col, next.row, dCol, dRow);
    return true;
  }

  /** Interrompe qualquer rota pendente (usado quando o teclado assume o controle). */
  clearPath(): void {
    this.path = [];
  }

  /** Tenta mover uma célula na direção informada, se não estiver em movimento nem ocupado com uma ação. */
tryStep(dCol: number, dRow: number, isWalkable: (col: number, row: number) => boolean): void {
    if (this.sitting) {
      this.standUp(); // Apertar uma tecla de andar levanta (o passo em si só vale a partir do próximo frame).
      return;
    }
    if (this.busy) return;
    
    this.receivedInputThisFrame = true;
    this.lastDCol = dCol;
    this.lastDRow = dRow;
    this.lastIsWalkable = isWalkable;
    
    // ESTA É A TRAVA DE SEGURANÇA! Ela impede o teletransporte.
    if (this.moving) return; 

const col = this.col + dCol;
    const row = this.row + dRow;

    // Se não puder andar (tem um slime, árvore ou parede), 
    // ele vira para a direção que você apertou e para.
    if (!isWalkable(col, row)) {
      this.faceDirection(dCol, dRow);
      return;
    }
    
    this.beginStep(col, row, dCol, dRow);
  }

  /**
   * Executa uma ação agrícola (arar, plantar, regar, colher) parado no
   * lugar: toca a animação da ferramenta uma vez e chama `onApply` (que
   * efetivamente altera o estado do terreno/plantação/inimigo) no "impact
   * frame" dela (Fase 9 — Game Feel, pedido explícito do usuário) — o
   * instante em que a ferramenta/espada visualmente toca o chão/alvo, não
   * só quando a animação inteira termina (ver `ActionAnimSpec.impactFrameOffset`).
   * A animação só representa a ação visualmente — quem decide o efeito é
   * sempre `onApply`, nunca a animação em si. `onStart` (opcional) roda uma
   * vez, no instante em que a animação COMEÇA (som/efeito de abertura).
   */
  performAction(action: PlayerActionKey, onApply: () => void, onStart?: () => void): void {
    if (this.moving || this.busy || this.sitting) return;

    // Pedido explícito do usuário: NÃO forçar `facing`/`flipX` pra baixo
    // aqui — a ferramenta/espada precisa tocar na direção em que o
    // personagem já está olhando (`updateFacing`, chamado pelo último
    // passo/`faceDirection`, já deixou `this.facing`/`sprite.flipX`
    // corretos; não há nada a reaplicar).
    this.busy = true;

    const spec = this.assets.actions[action];
    // Algumas folhas de animação têm mais margem vazia abaixo do
    // personagem que o padrão (`Idle.png`) — como a origem é o canto
    // inferior do frame, não os pés de verdade, isso faz o personagem
    // "flutuar" acima do chão. `yOffset` compensa deslocando o sprite pra
    // baixo enquanto ela toca (ver doc de `ActionAnimSpec.yOffset`).
    const yOffset = spec.yOffset ?? 0;
    this.sprite.y += yOffset;

    const key = `${spec.key}-${this.facing}`;
    this.sprite.play(key);
    // Só aqui a ação é certa (as recusas acima retornam antes): quem quer um som/efeito NO INÍCIO da animação (regar, comer) usa este gancho.
    onStart?.();

    // "Impact frame": `onApply` roda assim que o frame de impacto é
    // alcançado, não só ao final — golpe de espada acerta e enxada lavra
    // no instante visual do impacto, em vez de só depois do braço já ter
    // voltado pra posição de descanso. `impactApplied` garante uma única
    // chamada mesmo que `ANIMATION_UPDATE` dispare mais de uma vez sobre o
    // mesmo frame (o próprio Phaser avisa que isso pode acontecer sob
    // lag). `frame.index` é 1-based (primeiro frame = 1), por isso o `-1`
    // pra comparar com o offset 0-based de `impactFrameOffset`; `>=` em
    // vez de `===` porque sob lag o Phaser pode pular direto pro frame
    // seguinte sem passar exatamente pelo índice de impacto.
    const impactFrameOffset = spec.impactFrameOffset;
    let impactApplied = false;
    const applyImpactOnce = (): void => {
      if (impactApplied) return;
      impactApplied = true;
      onApply();
    };

    let handleAnimationUpdate: ((animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void) | null = null;
    if (impactFrameOffset !== undefined) {
      handleAnimationUpdate = (_animation, frame) => {
        if (frame.index - 1 >= impactFrameOffset) applyImpactOnce();
      };
      this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, handleAnimationUpdate);
    }

    // Fim da ação (uma única vez): normalmente pelo ANIMATION_COMPLETE; se a animação nunca terminar (chave inexistente pra essa
    // direção/personagem, animação interrompida por outra) o temporizador de segurança encerra do mesmo jeito — sem ele o jogador
    // ficava `busy` PRA SEMPRE: nem andava, nem agia, nem interagia (soft-lock).
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (handleAnimationUpdate) this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, handleAnimationUpdate);
      this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
      // Rede de segurança: ações sem `impactFrameOffset`, ou o raro caso do
      // frame de impacto nunca ter disparado, ainda aplicam aqui — nunca
      // termina a ação sem `onApply` ter rodado.
      applyImpactOnce();
      this.sprite.y -= yOffset;
      this.busy = false;
      this.playIdle();
    };
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
    this.sprite.scene.time.delayedCall(ACTION_FAILSAFE_MS, finish);
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

  /**
   * Vetor unitário (em células) da direção que o personagem está encarando
   * agora — usado pelo ataque de espada (Fase 8 — Combate) para posicionar
   * a hitbox na frente dele, mesma lógica de direção/flip usada em
   * `updateFacing`, só devolvida em vez de aplicada a um sprite.
   */
  getFacingVector(): { dx: number; dy: number } {
    if (this.facing === 'up') return { dx: 0, dy: -1 };
    if (this.facing === 'down') return { dx: 0, dy: 1 };
    return { dx: this.flipSide ? -1 : 1, dy: 0 };
  }

  /**
   * Feedback de dano (Fase 8 — Combate): flash vermelho no sprite + tremida
   * curta da câmera. Não empurra o personagem de propósito — ele se move
   * célula a célula por rota/teclado, e um empurrão em pixels brigaria com
   * isso. A invencibilidade em si é de `PlayerHealth`, não daqui.
   */
  playHurtFeedback(): void {
    const scene = this.sprite.scene;
    this.sprite.setTint(0xff5a5a);
    scene.time.delayedCall(160, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });
    scene.cameras.main.shake(130, 0.004);
    playEffect(scene, HURT_SOUND);
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
    // Habilidade Pés Ligeiros: passos mais curtos no tempo (multiplicador lido a cada quadro — vale na hora da compra).
    const t = Math.min(1, this.moveElapsed / (PLAYER_MOVE_DURATION_MS / getMoveSpeedMultiplier()));

    this.sprite.x = Phaser.Math.Linear(this.fromX, this.toX, t);
    this.sprite.y = Phaser.Math.Linear(this.fromY, this.toY, t);
    
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 13);
    this.shadow.setDepth(this.sprite.y - 0.1);

if (t >= 1) {
      this.moving = false;
      
      // Tenta dar o próximo passo do caminho automático (clique)
      if (this.tryNextPathStep()) {
        // Já começou o próximo passo, não faz nada
      } else if (this.receivedInputThisFrame && this.lastIsWalkable && this.lastIsWalkable(this.col + this.lastDCol, this.row + this.lastDRow)) {
        // Continua andando instantaneamente se a tecla WASD continuar pressionada
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
    const key = `${this.assets.animPrefix}-idle-${this.facing}`;
    this.sprite.play(key, true);
  }

  private playWalk(): void {
    const key = `${this.assets.animPrefix}-walk-${this.facing}`;
    // Só inicia a animação se ela já não estiver rodando
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  /** Cria as animações de idle/caminhada/ações agrícolas nas 3 direções do rig (baixo/cima/lado). */
  static createAnimations(scene: Phaser.Scene, characterId: CharacterId): void {
    const assets = getPlayerAssets(characterId);
    // O gerenciador de animações do Phaser é GLOBAL (por `Game`, não por
    // cena) — sem essa checagem, toda troca de cena/`MainScene.create()`
    // tentava recriar as mesmas chaves de novo, gerando warnings no console
    // e trabalho repetido à toa (pedido explícito do usuário).
    if (scene.anims.exists(`${assets.animPrefix}-idle-down`)) return;

    const { anims } = scene;

    anims.create({
      key: `${assets.animPrefix}-idle-down`,
      frames: anims.generateFrameNumbers(assets.idleKey, PLAYER_ANIM_FRAMES.idleDown),
      frameRate: 4,
      repeat: -1,
    });
    anims.create({
      key: `${assets.animPrefix}-idle-up`,
      frames: anims.generateFrameNumbers(assets.idleKey, PLAYER_ANIM_FRAMES.idleUp),
      frameRate: 4,
      repeat: -1,
    });
    anims.create({
      key: `${assets.animPrefix}-idle-side`,
      frames: anims.generateFrameNumbers(assets.idleKey, PLAYER_ANIM_FRAMES.idleSide),
      frameRate: 4,
      repeat: -1,
    });

    anims.create({
      key: `${assets.animPrefix}-walk-down`,
      frames: anims.generateFrameNumbers(assets.walkKey, PLAYER_ANIM_FRAMES.walkDown),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: `${assets.animPrefix}-walk-up`,
      frames: anims.generateFrameNumbers(assets.walkKey, PLAYER_ANIM_FRAMES.walkUp),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: `${assets.animPrefix}-walk-side`,
      frames: anims.generateFrameNumbers(assets.walkKey, PLAYER_ANIM_FRAMES.walkSide),
      frameRate: 10,
      repeat: -1,
    });

    for (const spec of Object.values(assets.actions)) {
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
