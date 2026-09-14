import Phaser from 'phaser';
import { BridgeDefinition, FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { buildBridge, buildConstructionSign } from './mapBuilder';
import { LockedMessage } from '../ui/lockedMessage';

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
 * Sistema de Cenas — pontes: cada uma das 4 pontes (`farmMap.bridges`) é um
 * objeto sólido (célula sempre bloqueada, já que fica sobre a própria
 * parede do núcleo — ver `systems/grid.ts`) com interação adjacente, mesmo
 * mecanismo já usado pela Loja/Caixa de Remessas/placas de expansão
 * (`PlayerController.handleBlockedClick`): o jogador anda até a célula
 * andável mais próxima e interage de frente, sem precisar "pisar" na ponte.
 *
 * Bloqueada, mostra os requisitos numa mensagem na tela (`LockedMessage`).
 * Destravada (ou se o jogador acabou de pagar o requisito), troca de cena
 * de verdade via `scene.scene.start(...)` — um hard cut real do Phaser, não
 * uma câmera contínua — passando `returnSpawn`: a célula andável logo
 * DENTRO do núcleo, ao lado da ponte, pra onde o jogador deve reaparecer
 * se um dia voltar da cena de destino (ver `MainScene.init`).
 */
export class BridgeSystem {
  private readonly unlocked = new Set<string>();
  private readonly lockSigns = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: FarmMapData,
    private readonly inventory: Inventory,
    interactions: InteractionRegistry,
    private readonly lockedMessage: LockedMessage,
  ) {
    for (const bridge of map.bridges) {
      buildBridge(scene, map.tileSize, bridge);

      if (DEBUG_BRIDGES_START_UNLOCKED) {
        this.unlocked.add(this.key(bridge));
      } else {
        // Placa de "obra em andamento" por cima — mesmo indicador visual já
        // usado pelas expansões de propriedade, reaproveitado aqui pra não
        // precisar de um asset novo só pra "isto está bloqueado".
        this.lockSigns.set(this.key(bridge), buildConstructionSign(scene, map.tileSize, bridge.col, bridge.row));
      }

      interactions.set(bridge.col, bridge.row, new BridgeInteractable(this, bridge));
    }
  }

  private key(bridge: BridgeDefinition): string {
    return `${bridge.col},${bridge.row}`;
  }

  isUnlocked(bridge: BridgeDefinition): boolean {
    return this.unlocked.has(this.key(bridge));
  }

  /** Chamado pela ponte (`BridgeInteractable`) ao interagir — bloqueada ou não. */
  tryCross(bridge: BridgeDefinition): void {
    if (this.isUnlocked(bridge)) {
      this.crossInto(bridge);
      return;
    }

    if (this.tryPayRequirement(bridge)) {
      this.unlocked.add(this.key(bridge));
      this.lockSigns.get(this.key(bridge))?.destroy();
      this.lockSigns.delete(this.key(bridge));
      console.log(`Ponte para ${bridge.destinationName} desbloqueada!`);
      this.crossInto(bridge);
      return;
    }

    this.lockedMessage.show(`Bloqueado: ${bridge.destinationName}`, this.describeRequirement(bridge));
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
    this.scene.scene.start(bridge.destinationSceneKey, {
      areaName: bridge.destinationName,
      returnSceneKey: MAIN_SCENE_KEY,
      returnSpawn: this.computeReturnSpawn(bridge),
    });
  }
}
