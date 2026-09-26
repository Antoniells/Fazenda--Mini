import Phaser from 'phaser';
import type { OreKind } from '../data/ores';

/** `weed` = o mato colhível com a Foice (só na Fazenda, `systems/wildGrass.ts`); `ore` = veio de minério da Pedreira (`data/ores.ts`, `systems/oreInteraction.ts`). */
export type ResourceNodeKind = 'tree' | 'smallRock' | 'bigRock' | 'weed' | 'ore';
/** Só relevante para `kind: 'tree'` — pedras não crescem, nascem sempre prontas pra quebrar. */
export type TreeStage = 'sprout' | 'young' | 'mature';
/** Espécie da árvore (só `kind: 'tree'`): ausente = pinheiro. A bétula só existe adulta (sem broto/muda) e nunca é sorteada pelo respawn selvagem. */
export type TreeSpecies = 'pine' | 'birch';

export interface ResourceNode {
  col: number;
  row: number;
  kind: ResourceNodeKind;
  stage: TreeStage;
  species?: TreeSpecies;
  /** Qual minério (só `kind: 'ore'`). */
  ore?: OreKind;
  /** Dano já acumulado (em "golpes de madeira") numa árvore/pedra ainda de pé — sobrevive a trocar de cena, à virada do dia e ao save (antes voltava a zero). */
  hits?: number;
}

export interface ResourceCaps {
  maxTrees: number;
  maxRocks: number;
  /** Quantos brotos novos nascem por virada de dia ([mín, máx], sorteado). Padrão [1, 3] — a Fazenda usa menos. */
  newTreesPerDay?: [number, number];
  /** Quantas pedras novas nascem por virada de dia ([mín, máx], sorteado). Padrão [1, 2]. */
  newRocksPerDay?: [number, number];
  /** Mato: teto simultâneo e quantos nascem por virada de dia ([mín, máx]). Ausente = a cena não tem mato (só a Fazenda tem). */
  maxWeeds?: number;
  newWeedsPerDay?: [number, number];
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
  /** Os nós originais de cada cena (de `data/maps/*.ts`) — pra uma partida nova/um save antigo voltarem ao mundo do começo (`resetToInitial`). */
  private readonly initial = new Map<string, ResourceNode[]>();

  ensureInitialized(sceneKey: string, initialNodes: ResourceNode[], caps: ResourceCaps): void {
    if (this.scenes.has(sceneKey)) return;

    this.initial.set(sceneKey, initialNodes.map((node) => ({ ...node })));
    this.scenes.set(sceneKey, new Map(initialNodes.map((node) => [nodeKey(node.col, node.row), { ...node }])));
    this.caps.set(sceneKey, caps);
  }

  /** Volta TODAS as cenas aos nós originais do mapa — partida nova, ou save anterior aos recursos persistentes (senão o mundo da partida anterior vazaria pra esta). */
  resetToInitial(): void {
    for (const [sceneKey, nodes] of this.initial) {
      this.scenes.set(sceneKey, new Map(nodes.map((node) => [nodeKey(node.col, node.row), { ...node }])));
    }
  }

  /** Estado atual de todas as cenas, pro save (`SaveManager`): o que já foi cortado/quebrado e o que nasceu/cresceu continua assim ao carregar. */
  serialize(): Record<string, ResourceNode[]> {
    const data: Record<string, ResourceNode[]> = {};
    for (const [sceneKey, nodes] of this.scenes) data[sceneKey] = Array.from(nodes.values()).map((node) => ({ ...node }));
    return data;
  }

  /** Restaura de `serialize()`. Cenas que o save não conhece ficam como estão (nos originais, depois de `resetToInitial`). */
  restore(data: Record<string, ResourceNode[]>): void {
    for (const [sceneKey, nodes] of Object.entries(data)) {
      if (!this.scenes.has(sceneKey) || !Array.isArray(nodes)) continue;
      const restored = new Map(nodes.map((node) => [nodeKey(node.col, node.row), { ...node }] as const));
      // Save anterior à mineração (os veios eram só decoração): a cena não guardou nenhum veio, então nasce com os originais.
      if (![...restored.values()].some((node) => node.kind === 'ore')) {
        for (const node of this.initial.get(sceneKey) ?? []) if (node.kind === 'ore') restored.set(nodeKey(node.col, node.row), { ...node });
      }
      this.scenes.set(sceneKey, restored);
    }
  }

  getNodes(sceneKey: string): ResourceNode[] {
    return Array.from(this.scenes.get(sceneKey)?.values() ?? []);
  }

  getNode(sceneKey: string, col: number, row: number): ResourceNode | undefined {
    return this.scenes.get(sceneKey)?.get(nodeKey(col, row));
  }

  /** Grava o dano acumulado do nó (árvore/pedra ainda de pé) — ver `ResourceNode.hits`. */
  setHits(sceneKey: string, col: number, row: number, hits: number): void {
    const node = this.scenes.get(sceneKey)?.get(nodeKey(col, row));
    if (node) node.hits = hits;
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

  /** Devolve, com `chance` por veio, os nós ORIGINAIS de `kind` que já foram quebrados e cujo lugar continua livre — os veios de minério voltam ao lugar de origem (o `advanceDay` só semeia em lugares sorteados). */
  respawnInitial(sceneKey: string, kind: ResourceNodeKind, chance: number): void {
    const nodes = this.scenes.get(sceneKey);
    if (!nodes) return;
    for (const node of this.initial.get(sceneKey) ?? []) {
      if (node.kind !== kind || nodes.has(nodeKey(node.col, node.row))) continue;
      if (Phaser.Math.FloatBetween(0, 1) < chance) nodes.set(nodeKey(node.col, node.row), { ...node, hits: undefined });
    }
  }

  /** Espalha `count` nós novos (de `template`) em células livres sorteadas — usado pra semear o mato do começo da Fazenda (sem esperar a virada de dia). Devolve quantos nasceram. */
  scatter(sceneKey: string, template: Omit<ResourceNode, 'col' | 'row'>, count: number, cols: number, rows: number, isCellFree: (col: number, row: number) => boolean): number {
    const nodes = this.scenes.get(sceneKey);
    if (!nodes) return 0;
    let placed = 0;
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const col = Phaser.Math.Between(1, cols - 2);
        const row = Phaser.Math.Between(1, rows - 2);
        if (nodes.has(nodeKey(col, row)) || !isCellFree(col, row)) continue;
        nodes.set(nodeKey(col, row), { ...template, col, row });
        placed += 1;
        break;
      }
    }
    return placed;
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

    // O teto de árvores conta só os pinheiros (as bétulas fixas do mapa não entram na conta do respawn).
    const countOf = (kind: ResourceNodeKind | 'rock'): number =>
      Array.from(nodes.values()).filter((n) => (kind === 'rock' ? n.kind === 'smallRock' || n.kind === 'bigRock' : n.kind === kind && n.species !== 'birch')).length;

    const findFreeCell = (): { col: number; row: number } | null => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const col = Phaser.Math.Between(1, cols - 2);
        const row = Phaser.Math.Between(1, rows - 2);
        if (!nodes.has(nodeKey(col, row)) && isCellFree(col, row)) return { col, row };
      }
      return null;
    };

    const [minTrees, maxTrees] = caps.newTreesPerDay ?? [1, 3];
    const newTrees = Phaser.Math.Between(minTrees, maxTrees);
    for (let i = 0; i < newTrees && countOf('tree') < caps.maxTrees; i++) {
      const cell = findFreeCell();
      if (!cell) break;
      nodes.set(nodeKey(cell.col, cell.row), { col: cell.col, row: cell.row, kind: 'tree', stage: 'sprout' });
    }

    const [minRocks, maxRocks] = caps.newRocksPerDay ?? [1, 2];
    const newRocks = Phaser.Math.Between(minRocks, maxRocks);
    for (let i = 0; i < newRocks && countOf('rock') < caps.maxRocks; i++) {
      const cell = findFreeCell();
      if (!cell) break;
      nodes.set(nodeKey(cell.col, cell.row), { col: cell.col, row: cell.row, kind: 'smallRock', stage: 'mature' });
    }

    const maxWeeds = caps.maxWeeds ?? 0;
    const [minWeeds, maxNewWeeds] = caps.newWeedsPerDay ?? [0, 0];
    const newWeeds = Phaser.Math.Between(minWeeds, maxNewWeeds);
    for (let i = 0; i < newWeeds && countOf('weed') < maxWeeds; i++) {
      const cell = findFreeCell();
      if (!cell) break;
      nodes.set(nodeKey(cell.col, cell.row), { col: cell.col, row: cell.row, kind: 'weed', stage: 'mature' });
    }
  }
}

export const resourceNodeRegistry = new ResourceNodeRegistry();
