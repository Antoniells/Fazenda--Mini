import Phaser from 'phaser';
import { gameState } from './gameState';
import { InteractionRegistry } from './interaction';
import { PlayerController } from './playerController';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';

/**
 * Gerenciador de eventos do mundo (pedido explícito): acontecimentos que dependem do DIA do jogo (a visita do dia 8, os gatos da
 * Amanda até o dia 10…). Cada evento (`WorldEventDefinition`) diz, por `isActive`, se deve estar rodando AGORA — a partir do dia/hora
 * do relógio (`gameState.gameClock`) e do estado salvo (`gameState.events`); o gerenciador o liga quando passa a valer e o desliga
 * quando deixa de valer. Só a Fazenda tem um (`MainScene`): os eventos vivem nela. Os dados de cada um estão em `data/events.ts` e a
 * lógica em `systems/events/`; uma cena nova de evento é só mais uma definição na lista.
 */

/** O que um evento precisa da cena pra existir nela. */
export interface WorldEventContext {
  scene: Phaser.Scene;
  grid: WalkableGrid;
  tilePx: number;
  player: Player;
  controller: PlayerController;
  interactions: InteractionRegistry;
}

/** Um evento em andamento. */
export interface WorldEventRuntime {
  update(time: number, delta: number): void;
  /** Limpa tudo. `immediate` = a cena está fechando (nada de fades/tweens); senão o evento acabou com a cena aberta e pode sair de cena com jeito. */
  destroy(immediate: boolean): void;
  /** Ainda não pode ser desligado (ex.: o visitante está indo embora)? Padrão: pode. */
  isBusy?(): boolean;
}

export interface WorldEventDefinition {
  id: string;
  /** Carrega a arte que o evento usa — chamado no `preload` da cena (cada evento só carrega se ainda houver chance de rodar). */
  preload?(scene: Phaser.Scene): void;
  /** Deve estar rodando agora? */
  isActive(): boolean;
  start(context: WorldEventContext): WorldEventRuntime;
}

export function isEventCompleted(id: string): boolean {
  return gameState.events.completed.includes(id);
}

export function markEventCompleted(id: string): void {
  if (!isEventCompleted(id)) gameState.events.completed.push(id);
}

export function preloadEvents(scene: Phaser.Scene, definitions: WorldEventDefinition[]): void {
  for (const definition of definitions) definition.preload?.(scene);
}

export class EventManager {
  private readonly running = new Map<string, WorldEventRuntime>();

  constructor(
    private readonly context: WorldEventContext,
    private readonly definitions: WorldEventDefinition[],
  ) {
    context.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Chamado todo frame pela cena (só as checagens de condição são feitas aqui; o trabalho de cada evento é dele). */
  update(time: number, delta: number): void {
    for (const definition of this.definitions) {
      const runtime = this.running.get(definition.id);
      const active = definition.isActive();

      if (active && !runtime) {
        this.running.set(definition.id, definition.start(this.context));
      } else if (!active && runtime && !runtime.isBusy?.()) {
        runtime.destroy(false);
        this.running.delete(definition.id);
      }
    }

    for (const runtime of this.running.values()) runtime.update(time, delta);
  }

  private destroy(): void {
    for (const runtime of this.running.values()) runtime.destroy(true);
    this.running.clear();
  }
}
