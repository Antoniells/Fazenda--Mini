import { gameState } from './gameState';
import { save } from './saveManager';
import { TUTORIAL_STEPS, TUTORIAL_START_SLOT, TutorialAction, TutorialItem, TutorialStep } from '../data/tutorial';

/** Comandos do jogador que o tutorial pode travar — quem recebe o comando (controlador, Hotbar, menus) pergunta `tutorial.allows(...)` antes de agir. */
export type TutorialCommand =
  | { kind: 'move' }
  | { kind: 'interact'; col: number; row: number }
  | { kind: 'hotbar'; index: number }
  | { kind: 'attack' }
  | { kind: 'eat' }
  | { kind: 'menu' };

/** Coisas que o jogo avisa ao tutorial (`notify`) — só as que algum passo pode exigir. */
export type TutorialEvent =
  | { kind: 'move' }
  | { kind: 'select' }
  | { kind: 'act'; action: TutorialAction };

type Listener = () => void;

/**
 * Gerenciador do tutorial passo a passo (só lógica, sem Phaser): sabe em que passo o jogador está (`gameState.tutorialStep`,
 * dados em `data/tutorial.ts`), avança quando o jogo avisa que a ação exigida aconteceu (`notify`) e TRAVA os comandos que o
 * passo atual não pede (`allows`) — assim o jogador não se perde nem estraga a ordem. O painel (`ui/tutorialPanel.ts`) só
 * desenha o passo e o botão dos passos "info"; quem decide tudo é este módulo.
 *
 * Ao terminar o último passo — ou ao pular (`skip`, botão do painel) — grava `gameState.tutorialCompleted` no Save Game (`saveManager`): partida nova começa com ele
 * `false`; save antigo (sem o campo) carrega como `true` — quem já jogava não vê o tutorial — e, uma vez concluído, ele nunca mais
 * aparece. O ANDAMENTO (`tutorialStep`) não é salvo: sair no meio recomeça o tutorial do primeiro passo.
 */
class TutorialManager {
  private readonly listeners = new Set<Listener>();
  /** Só depois de `begin()` (a Fazenda abriu) o tutorial trava comandos — nenhuma outra tela fica presa por ele. */
  private running = false;

  /** Começa (ou retoma, se a cena reabriu no meio) o tutorial — no-op se já foi concluído. */
  begin(): void {
    if (gameState.tutorialCompleted) return;
    this.running = true;
    // No primeiro passo começa com um slot vazio na mão, pra o passo "pegar a Enxada" não nascer cumprido (vale também numa partida nova depois de abandonar outra).
    if (gameState.tutorialStep === 0 && gameState.tutorialProgress === 0) gameState.inventory.selectHotbarSlot(TUTORIAL_START_SLOT);
    this.emit();
  }

  /** O tutorial está rodando (travando comandos e mostrando o painel)? */
  isRunning(): boolean {
    return this.running && !gameState.tutorialCompleted;
  }

  getStep(): TutorialStep | null {
    return this.isRunning() ? TUTORIAL_STEPS[gameState.tutorialStep] ?? null : null;
  }

  /** "Passo 3 de 9" — número (1-based) e total, pro painel. */
  getPosition(): { index: number; total: number } {
    return { index: gameState.tutorialStep + 1, total: TUTORIAL_STEPS.length };
  }

  /** Progresso do passo atual quando ele conta algo (ex.: passos dados) — `null` nos demais. */
  getProgressLabel(): string | null {
    const goal = this.getStep()?.goal;
    return goal?.kind === 'move' ? `${Math.min(gameState.tutorialProgress, goal.steps)}/${goal.steps}` : null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Este comando é permitido no passo atual? (Sem tutorial rodando, tudo é.) */
  allows(command: TutorialCommand): boolean {
    const goal = this.getStep()?.goal;
    if (!goal) return true;

    switch (command.kind) {
      case 'move':
        return goal.kind !== 'info';
      case 'hotbar':
        return (goal.kind === 'select' || goal.kind === 'act') && this.slotHolds(command.index, goal.item);
      case 'interact':
        return goal.kind === 'act' && gameState.farmland.isCultivable(command.col, command.row);
      case 'attack':
      case 'eat':
      case 'menu':
        return false;
    }
  }

  /** O jogo avisa que algo aconteceu; avança se era o que o passo atual pedia. */
  notify(event: TutorialEvent): void {
    const goal = this.getStep()?.goal;
    if (!goal) return;

    if (event.kind === 'move' && goal.kind === 'move') {
      gameState.tutorialProgress += 1;
      if (gameState.tutorialProgress >= goal.steps) this.advance();
      else this.emit();
    } else if (event.kind === 'select' && goal.kind === 'select' && this.isSelected(goal.item)) {
      this.advance();
    } else if (event.kind === 'act' && goal.kind === 'act' && event.action === goal.action) {
      this.advance();
    }
  }

  /** Botão dos passos "info" (Começar / Concluir). */
  confirm(): void {
    if (this.getStep()?.goal.kind === 'info') this.advance();
  }

  /** Botão "Pular tutorial": encerra em qualquer passo e conta como concluído (grava no save — não volta a aparecer). */
  skip(): void {
    if (this.isRunning()) this.complete();
  }

  private advance(): void {
    gameState.tutorialStep += 1;
    gameState.tutorialProgress = 0;

    if (gameState.tutorialStep >= TUTORIAL_STEPS.length) {
      this.complete();
      return;
    }
    // Um passo de "selecionar" cujo item já está na mão vale por cumprido (nunca trava o jogador).
    const next = TUTORIAL_STEPS[gameState.tutorialStep].goal;
    if (next.kind === 'select' && this.isSelected(next.item)) {
      this.advance();
      return;
    }
    this.emit();
  }

  /** Acabou: grava no Save Game que o tutorial foi concluído e libera tudo. */
  private complete(): void {
    gameState.tutorialCompleted = true;
    gameState.tutorialStep = 0;
    gameState.tutorialProgress = 0;
    this.running = false;
    save();
    this.emit();
  }

  private isSelected(item: TutorialItem): boolean {
    const selected = gameState.inventory.getSelectedSlot();
    return selected?.category === item.category && selected.id === item.id;
  }

  private slotHolds(index: number, item: TutorialItem): boolean {
    const slot = gameState.inventory.getSlot(index);
    return slot?.category === item.category && slot.id === item.id;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const tutorial = new TutorialManager();
