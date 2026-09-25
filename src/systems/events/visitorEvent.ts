import Phaser from 'phaser';
import { Npc } from '../../entities/Npc';
import { NPCS, NpcDefinition } from '../../data/npcs';
import {
  VISITOR_EVENT_ID,
  VISITOR_DAY,
  VISITOR_FROM_HOUR,
  VISITOR_NPC_ID,
  VISITOR_ARRIVAL_CELL,
  VISITOR_STAND_CELL,
  VISITOR_DIALOGUE_PAGES,
  INTERACT_BUBBLE_KEY,
  INTERACT_BUBBLE_PATH,
  INTERACT_BUBBLE_FRAME,
} from '../../data/events';
import { OPEN_DIALOGUE_EVENT, DialoguePayload } from '../../ui/dialoguePanel';
import { preloadNpcs } from '../npcSystem';
import { gameState } from '../gameState';
import { Interactable } from '../interaction';
import { save as saveGame } from '../saveManager';
import { WorldEventContext, WorldEventDefinition, WorldEventRuntime, isEventCompleted, markEventCompleted } from '../eventManager';

const BUBBLE_SCALE = 2;
/** Quanto acima dos pés fica a base do balão (a cabeça do morador, de 32px nativos, termina a ~50px). */
const BUBBLE_ABOVE_FEET_PX = 54;
const BUBBLE_BOB_PX = 4;

type VisitorState = 'arriving' | 'waiting' | 'leaving' | 'gone';

/** O visitante conversável: só a conversa — quem o move e mostra é o `VisitorRuntime`. */
class VisitorInteractable implements Interactable {
  /** Responde à tecla F (`PlayerController.handleInteractKey`), além do clique — mesmo padrão da Loja/Caixa/Porta/Correio. */
  readonly keyInteractable = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: NpcDefinition,
    private readonly isPlayerBusy: () => boolean,
    private readonly onFinish: () => void,
  ) {}

  interact(): void {
    if (this.isPlayerBusy()) return;
    const payload: DialoguePayload = {
      speaker: this.def.name,
      subtitle: this.def.title,
      portrait: { key: this.def.portrait.key, frame: this.def.portrait.frame },
      text: VISITOR_DIALOGUE_PAGES[0],
      pages: VISITOR_DIALOGUE_PAGES,
      actions: [],
      onFinish: this.onFinish,
    };
    this.scene.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
  }
}

/**
 * O Visitante do Dia 8 (pedido explícito): de manhã o Capitão Salgado (arte já existente, `data/npcs.ts`) entra na Fazenda pela ponte
 * leste, anda por rota A* até a frente da casa e espera com um balão "!" em cima. Interagir (clique ou F) abre a fala em 3 páginas;
 * ao terminar de ler ele vai embora andando pelo mesmo caminho, sem mais explicações, e o evento fica registrado como concluído
 * (`gameState.events`) — não repete. Se o dia 8 passar sem o jogador falar com ele, ele simplesmente some.
 */
class VisitorRuntime implements WorldEventRuntime {
  private readonly def: NpcDefinition;
  private readonly npc: Npc;
  private readonly bubble: Phaser.GameObjects.Image;
  private state: VisitorState = 'arriving';
  private bubbleBob: Phaser.Tweens.Tween | null = null;

  constructor(private readonly context: WorldEventContext) {
    const { scene, grid, tilePx } = context;
    // Mesma arte do morador do Vilarejo, mas sem casa/rotina: nasce na ponte e só anda quando o evento manda.
    this.def = { ...NPCS[VISITOR_NPC_ID], home: undefined, stationary: VISITOR_ARRIVAL_CELL };
    this.npc = new Npc(scene, this.def, grid, tilePx, null);
    this.npc.snapTo({ kind: 'spot', col: VISITOR_ARRIVAL_CELL.col, row: VISITOR_ARRIVAL_CELL.row, facing: 'left' });

    const texture = scene.textures.get(INTERACT_BUBBLE_KEY);
    if (!texture.has(INTERACT_BUBBLE_FRAME.name)) {
      const { x, y, width, height } = INTERACT_BUBBLE_FRAME.rect;
      texture.add(INTERACT_BUBBLE_FRAME.name, 0, x, y, width, height);
    }
    this.bubble = scene.add.image(0, 0, INTERACT_BUBBLE_KEY, INTERACT_BUBBLE_FRAME.name);
    this.bubble.setOrigin(0.5, 1).setScale(BUBBLE_SCALE).setVisible(false);
  }

  update(time: number, delta: number): void {
    const playerCell = { col: this.context.player.col, row: this.context.player.row };

    if (this.state === 'arriving') {
      if (this.npc.stepToward(time, delta, VISITOR_STAND_CELL, playerCell)) this.beginWaiting();
    } else if (this.state === 'leaving') {
      if (this.npc.stepToward(time, delta, VISITOR_ARRIVAL_CELL, playerCell)) {
        this.state = 'gone';
        this.npc.leave();
      }
    }
  }

  isBusy(): boolean {
    return this.state === 'leaving';
  }

  /** Chegou em frente à casa: fica parado (sólido, com a conversa no lugar) e mostra o balão. */
  private beginWaiting(): void {
    this.state = 'waiting';
    this.npc.standFacing('down');

    const { grid, interactions, scene } = this.context;
    grid.block(VISITOR_STAND_CELL.col, VISITOR_STAND_CELL.row);
    interactions.set(
      VISITOR_STAND_CELL.col,
      VISITOR_STAND_CELL.row,
      new VisitorInteractable(scene, this.def, () => this.context.player.isBusy(), () => this.finish()),
    );

    this.bubble.setPosition(this.npc.sprite.x, this.npc.sprite.y - BUBBLE_ABOVE_FEET_PX);
    this.bubble.setDepth(this.npc.sprite.depth + 1);
    this.bubble.setVisible(true);
    this.bubbleBob = scene.tweens.add({ targets: this.bubble, y: this.bubble.y - BUBBLE_BOB_PX, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Leu até o fim: registra o evento e ele vai embora. */
  private finish(): void {
    if (this.state !== 'waiting') return;
    markEventCompleted(VISITOR_EVENT_ID);
    saveGame();
    this.releaseCell();
    this.state = 'leaving';
  }

  /** Libera a célula onde ele estava e tira o balão. */
  private releaseCell(): void {
    const { grid, interactions } = this.context;
    grid.unblock(VISITOR_STAND_CELL.col, VISITOR_STAND_CELL.row);
    interactions.remove(VISITOR_STAND_CELL.col, VISITOR_STAND_CELL.row);
    this.bubbleBob?.remove();
    this.bubbleBob = null;
    this.bubble.setVisible(false);
  }

  destroy(immediate: boolean): void {
    if (this.state === 'waiting') this.releaseCell();
    this.bubbleBob?.remove();
    this.bubble.destroy();
    if (this.state !== 'gone') {
      if (immediate) this.npc.destroy();
      else this.npc.leave();
    }
    this.state = 'gone';
  }
}

/** A visita do dia 8: de 06h em diante, até ser atendida (ou o dia acabar). */
export const visitorEvent: WorldEventDefinition = {
  id: VISITOR_EVENT_ID,
  preload(scene) {
    // Só carrega a arte enquanto ainda dá pra acontecer (o dia 8 ainda não passou).
    if (isEventCompleted(VISITOR_EVENT_ID) || gameState.gameClock.getDay() > VISITOR_DAY) return;
    preloadNpcs(scene, [VISITOR_NPC_ID]);
    scene.load.image(INTERACT_BUBBLE_KEY, encodeURI(`/${INTERACT_BUBBLE_PATH}`));
  },
  isActive() {
    return !isEventCompleted(VISITOR_EVENT_ID) && gameState.gameClock.getDay() === VISITOR_DAY && gameState.gameClock.getHours() >= VISITOR_FROM_HOUR;
  },
  start: (context) => new VisitorRuntime(context),
};
