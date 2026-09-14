import Phaser from 'phaser';

export type ResourceNodeKind = 'tree' | 'smallRock' | 'bigRock';
/** Só relevante para `kind: 'tree'` — pedras não crescem, nascem sempre prontas pra quebrar. */
export type TreeStage = 'sprout' | 'young' | 'mature';

export interface ResourceNode {
  col: number;
  row: number;
  kind: ResourceNodeKind;
  stage: TreeStage;
}

export interface ResourceCaps {
  maxTrees: number;
  maxRocks: number;
}

function nodeKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Estado dos recursos coletáveis (árvores/pedras) de cada cena externa,
 * guardado FORA de qualquer `Phaser.Scene` (Fase 7 — Coleta de Recursos):
 * uma cena (`ForestScene`/`QuarryScene`) só existe de verdade enquanto o
 * jogador está nela — sair destrói os game objects. Sem este registro
 * separado, cortar uma árvore, sair e voltar faria ela reaparecer (nunca
 * "lembraria" que foi cortada), e a virada de dia não teria como fazer
 * nada crescer numa cena fechada no momento.
 *
 * Cada cena chama `ensureInitialized` no próprio construtor (que já roda
 * no boot do jogo — Phaser instancia todas as cenas de `gameConfig.scene`
 * de uma vez, só não chama `create` até serem iniciadas) com os nós
 * originais de `data/maps/*.ts`; chamadas seguintes são no-op, preservando
 * o que já foi colhido/crescido. `advanceDay` é chamado pela `MainScene`
 * nos mesmos pontos que já disparam a virada de dia (`update`/`sleep`),
 * então funciona mesmo com a cena de destino fechada.
 */
class ResourceNodeRegistry {
  private readonly scenes = new Map<string, Map<string, ResourceNode>>();
  private readonly caps = new Map<string, ResourceCaps>();

  ensureInitialized(sceneKey: string, initialNodes: ResourceNode[], caps: ResourceCaps): void {
    if (this.scenes.has(sceneKey)) return;

    const nodes = new Map<string, ResourceNode>();
    for (const node of initialNodes) nodes.set(nodeKey(node.col, node.row), node);
    this.scenes.set(sceneKey, nodes);
    this.caps.set(sceneKey, caps);
  }

  getNodes(sceneKey: string): ResourceNode[] {
    return Array.from(this.scenes.get(sceneKey)?.values() ?? []);
  }

  hasNodeAt(sceneKey: string, col: number, row: number): boolean {
    return this.scenes.get(sceneKey)?.has(nodeKey(col, row)) ?? false;
  }

  /** Remove um nó colhido (árvore cortada / pedra quebrada) — ver `systems/resourceInteraction.ts`. */
  removeNode(sceneKey: string, col: number, row: number): void {
    this.scenes.get(sceneKey)?.delete(nodeKey(col, row));
  }

  /** Adiciona um nó manualmente (ex.: bolota plantada pelo jogador, ver `systems/treePlanting.ts`) — diferente do respawn selvagem de `advanceDay`, este não é sorteado, o próprio jogador escolheu a célula. */
  addNode(sceneKey: string, node: ResourceNode): void {
    this.scenes.get(sceneKey)?.set(nodeKey(node.col, node.row), node);
  }

  /**
   * "Gancho de virada de dia" (pedido explícito): avança o estágio de cada
   * árvore existente (broto → muda → adulta) e, se ainda houver espaço sob
   * o teto (`caps`), adiciona novos brotos/pedras em células aleatórias
   * livres. `isCellFree` é responsabilidade de quem chama (cada cena
   * conhece seus próprios obstáculos fixos — água, entrada de caverna,
   * ponte de volta) — este registro não sabe nada de geometria de mapa.
   *
   * Atenção (pedido explícito): árvores novas nascem SEMPRE como `sprout`
   * (broto), nunca adultas prontas pra corte.
   */
  advanceDay(sceneKey: string, cols: number, rows: number, isCellFree: (col: number, row: number) => boolean): void {
    const nodes = this.scenes.get(sceneKey);
    const caps = this.caps.get(sceneKey);
    if (!nodes || !caps) return;

    for (const [key, node] of nodes) {
      if (node.kind !== 'tree') continue;
      if (node.stage === 'sprout') nodes.set(key, { ...node, stage: 'young' });
      else if (node.stage === 'young') nodes.set(key, { ...node, stage: 'mature' });
    }

    const countOf = (kind: ResourceNodeKind | 'rock'): number =>
      Array.from(nodes.values()).filter((n) => (kind === 'rock' ? n.kind !== 'tree' : n.kind === kind)).length;

    const findFreeCell = (): { col: number; row: number } | null => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const col = Phaser.Math.Between(1, cols - 2);
        const row = Phaser.Math.Between(1, rows - 2);
        if (!nodes.has(nodeKey(col, row)) && isCellFree(col, row)) return { col, row };
      }
      return null;
    };

    const newTrees = Phaser.Math.Between(1, 3);
    for (let i = 0; i < newTrees && countOf('tree') < caps.maxTrees; i++) {
      const cell = findFreeCell();
      if (!cell) break;
      nodes.set(nodeKey(cell.col, cell.row), { col: cell.col, row: cell.row, kind: 'tree', stage: 'sprout' });
    }

    const newRocks = Phaser.Math.Between(1, 2);
    for (let i = 0; i < newRocks && countOf('rock') < caps.maxRocks; i++) {
      const cell = findFreeCell();
      if (!cell) break;
      nodes.set(nodeKey(cell.col, cell.row), { col: cell.col, row: cell.row, kind: 'smallRock', stage: 'mature' });
    }
  }
}

export const resourceNodeRegistry = new ResourceNodeRegistry();
