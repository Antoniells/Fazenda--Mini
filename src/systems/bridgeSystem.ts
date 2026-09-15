import Phaser from 'phaser';
import { BridgeDefinition, FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { WalkableGrid } from './grid';
import { buildBridge, buildConstructionSign, bridgeRailingCells } from './mapBuilder';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from './gameState';

/**
 * DEBUG (Sistema de Cenas): `false` — pedido explícito do usuário pra
 * voltar a nascer com a placa de bloqueio de verdade em cada ponte, em vez
 * do atalho usado só pra testar a troca de cena (`scene.start`). Trocar
 * pra `true` de novo se precisar pular o requisito durante algum teste.
 */
export const DEBUG_BRIDGES_START_UNLOCKED = false;

/** Chave (`scene.start`) da cena principal — usada para calcular por onde o jogador reaparece nela ao voltar de uma ponte (ver `crossInto`). */
const MAIN_SCENE_KEY = 'MainScene';

/** Ao interagir com a ponte (bloqueada ou não) — ver `BridgeSystem.tryCross`. */
class BridgeInteractable implements Interactable {
  constructor(
    private readonly system: BridgeSystem,
    private readonly bridge: BridgeDefinition,
  ) {}

  interact(): void {
    this.system.tryCross(this.bridge);
  }
}

/**
 * Sistema de Cenas — pontes: cada uma das 4 pontes (`farmMap.bridges`) nasce
 * BLOQUEADA (célula sólida sobre a própria parede do núcleo — ver
 * `systems/grid.ts`), com interação adjacente igual à Loja/Caixa de
 * Remessas/placas de expansão (`PlayerController.handleBlockedClick`): o
 * jogador anda até a célula andável mais próxima e interage de frente,
 * mostrando o requisito (`LockedMessage`) ou pagando na hora.
 *
 * Depois de destravada (`unlockBridge`), a célula da ponte é liberada no
 * grid e a interação de clique é removida — pedido explícito do usuário:
 * a troca de cena não acontece mais no instante do pagamento/clique, só
 * quando o jogador efetivamente ATRAVESSA a ponte a pé (`handlePlayerStep`,
 * escutando o mesmo evento `player-stepped` que já dispara a cada passo,
 * tanto por clique quanto por teclado). `scene.scene.start(...)` continua
 * sendo um hard cut real do Phaser, não uma câmera contínua, passando
 * `returnSpawn`: a célula andável logo DENTRO do núcleo, ao lado da ponte,
 * pra onde o jogador deve reaparecer se um dia voltar da cena de destino
 * (ver `MainScene.init`).
 */
export class BridgeSystem {
  private readonly lockSigns = new Map<string, Phaser.GameObjects.Image>();
  /** Trava contra reentrância (bug relatado pelo usuário): sem isso, pisar na célula da ponte várias vezes durante os 300ms de `fadeOut` disparava `crossInto`/`scene.start` mais de uma vez, travando a troca de cena. */
  private isTransitioning = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: FarmMapData,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    private readonly lockedMessage: LockedMessage,
  ) {
    for (const bridge of map.bridges) {
      buildBridge(scene, map.tileSize, bridge);

      // Colisão dos corrimões laterais (pedido explícito do usuário): a
      // arte da ponte é sempre desenhada aqui em cima, destravada ou não
      // (só a placa de bloqueio muda) — então essas 2 células ficam
      // bloqueadas incondicionalmente, pra sempre, criando o "túnel"
      // invisível por cima do qual o corrimão nunca é pisável.
      for (const [col, row] of bridgeRailingCells(bridge)) this.grid.block(col, row);

      // NOVA LÓGICA: Verifica se a ponte já está no gameState global!
      if (DEBUG_BRIDGES_START_UNLOCKED || gameState.unlockedBridges.has(this.key(bridge))) {
        this.unlockBridge(bridge);
      } else {
        this.lockSigns.set(this.key(bridge), buildConstructionSign(scene, map.tileSize, bridge.col, bridge.row));
        interactions.set(bridge.col, bridge.row, new BridgeInteractable(this, bridge));
      }
    }
    // ... resto do construtor

    // Mesmo evento que `FarmlandRenderer.rustleCrop`/fechar a Loja já usam
    // (emitido por `PlayerController.update` a cada célula nova) — é o
    // único jeito de saber que o jogador REALMENTE chegou na célula da
    // ponte, não importa se foi por clique ou pelas setas/WASD.
    scene.events.on('player-stepped', (col: number, row: number) => this.handlePlayerStep(col, row));
  }

  private key(bridge: BridgeDefinition): string {
    return `${bridge.col},${bridge.row}`;
  }

  isUnlocked(bridge: BridgeDefinition): boolean {
    return gameState.unlockedBridges.has(this.key(bridge));
  }

  /** Chamado pela ponte (`BridgeInteractable`) ao interagir — só acontece enquanto ela ainda está bloqueada (depois de destravada, a própria interação é removida, ver `unlockBridge`). */
  tryCross(bridge: BridgeDefinition): void {
    if (this.tryPayRequirement(bridge)) {
      this.unlockBridge(bridge);
      console.log(`Ponte para ${bridge.destinationName} desbloqueada! Atravesse a ponte para entrar.`);
      return;
    }

    this.lockedMessage.show(`Bloqueado: ${bridge.destinationName}`, this.describeRequirement(bridge));
  }

  /** Libera a célula da ponte no grid e tira a placa/interação de bloqueio — a travessia em si só acontece de verdade quando o jogador pisar nela (`handlePlayerStep`). */
  private unlockBridge(bridge: BridgeDefinition): void {
    gameState.unlockedBridges.add(this.key(bridge));
    this.lockSigns.get(this.key(bridge))?.destroy();
    this.lockSigns.delete(this.key(bridge));
    this.grid.unblock(bridge.col, bridge.row);
    this.interactions.remove(bridge.col, bridge.row);
  }

  /** Pedido explícito do usuário: a troca de cena só dispara quando o jogador pisa de fato na célula de uma ponte já destravada. */
  private handlePlayerStep(col: number, row: number): void {
    const bridge = this.map.bridges.find((b) => b.col === col && b.row === row);
    if (bridge && this.isUnlocked(bridge) && !this.isTransitioning) this.crossInto(bridge);
  }

  /** Tenta pagar o requisito (moedas hoje — itens específicos ainda não têm estoque real pra checar, ver `BridgeRequirement`). `false` sem gastar nada se faltar algo. */
  private tryPayRequirement(bridge: BridgeDefinition): boolean {
    const { coins } = bridge.requirement;
    if (coins && !this.inventory.spendCoins(coins)) return false;
    return true;
  }

  private describeRequirement(bridge: BridgeDefinition): string {
    const parts: string[] = [];
    if (bridge.requirement.coins) {
      parts.push(`${bridge.requirement.coins} moedas (você tem ${this.inventory.getCoins()})`);
    }
    for (const item of bridge.requirement.items ?? []) {
      parts.push(`${item.amount}x ${item.label}`);
    }
    return parts.length > 0 ? `Requisito: ${parts.join(' + ')}` : 'Ainda não disponível.';
  }

  /** Célula andável logo dentro do núcleo, ao lado da parede desta ponte — ver doc da classe. */
  private computeReturnSpawn(bridge: BridgeDefinition): { col: number; row: number } {
    const { cols, rows } = this.map;
    if (bridge.direction === 'north') return { col: bridge.col, row: 1 };
    if (bridge.direction === 'south') return { col: bridge.col, row: rows - 2 };
    if (bridge.direction === 'west') return { col: 1, row: bridge.row };
    return { col: cols - 2, row: bridge.row };
  }

private crossInto(bridge: BridgeDefinition): void {
    this.isTransitioning = true;

    // Inicia o fade out (escurece a tela em 300 milissegundos)
    this.scene.cameras.main.fadeOut(300, 0, 0, 0);
    
    // Aguarda o fade out terminar para trocar de cena
    this.scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.scene.start(bridge.destinationSceneKey, {
        areaName: bridge.destinationName,
        returnSceneKey: MAIN_SCENE_KEY,
        returnSpawn: this.computeReturnSpawn(bridge),
      });
    });
  }
}
