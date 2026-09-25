import Phaser from 'phaser';
import { BridgeDefinition, FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { WalkableGrid } from './grid';
import { buildBridge, buildConstructionSign, bridgeRailingCells } from './mapBuilder';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from './gameState';
import { onPlayerStepped } from './sceneEvents';
import { playEffect } from './soundEffects';
import { SPEND_MONEY_SOUND } from '../data/audio';
import { OPEN_DIALOGUE_EVENT, DialoguePayload } from '../ui/dialoguePanel';
import { isDialogueOpen } from '../scenes/UIScene';

/**
 * DEBUG (Sistema de Cenas): `false` — pedido explícito do usuário pra
 * voltar a nascer com a placa de bloqueio de verdade em cada ponte, em vez
 * do atalho usado só pra testar a troca de cena (`scene.start`). Trocar
 * pra `true` de novo se precisar pular o requisito durante algum teste.
 */
export const DEBUG_BRIDGES_START_UNLOCKED = false;

/** Chave (`scene.start`) da cena principal — usada para calcular por onde o jogador reaparece nela ao voltar de uma ponte (ver `crossInto`). */
const MAIN_SCENE_KEY = 'MainScene';

/** A que distância (em células, de qualquer lado) de uma ponte bloqueada o card de compra abre sozinho. */
const OFFER_RANGE_CELLS = 3;

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
  /** Pontes bloqueadas cujo card de compra já foi oferecido nesta aproximação (`handlePlayerStep`). */
  private readonly offered = new Set<string>();

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
      if (DEBUG_BRIDGES_START_UNLOCKED || gameState.unlockedBridges.has(this.key(bridge)) || this.isFree(bridge)) {
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
    onPlayerStepped(scene, (col, row) => this.handlePlayerStep(col, row));
  }

  private key(bridge: BridgeDefinition): string {
    return `${bridge.col},${bridge.row}`;
  }

  /** Ponte SEM requisito (moedas/itens): é uma estrada, não uma obra — nasce aberta, sem placa nem interação (o Vilarejo). */
  private isFree(bridge: BridgeDefinition): boolean {
    return !bridge.requirement.coins && (bridge.requirement.items ?? []).length === 0;
  }

  isUnlocked(bridge: BridgeDefinition): boolean {
    return gameState.unlockedBridges.has(this.key(bridge));
  }

  /** Chamado pela ponte (`BridgeInteractable`) ao interagir — só acontece enquanto ela ainda está bloqueada (depois de destravada, a própria interação é removida, ver `unlockBridge`). Abre o card de compra. */
  tryCross(bridge: BridgeDefinition): void {
    this.offerPurchase(bridge);
  }

  /**
   * Card de compra da ponte (pedido explícito — a placa na borda do mapa era difícil de clicar, ex.: a da Praia fica por baixo da Hotbar): o
   * mesmo painel de conversa (`ui/dialoguePanel.ts`), com o preço, quanto o jogador tem e os botões "Comprar" (apagado se faltar moeda) e
   * "Fechar". Abre sozinho ao chegar perto (`handlePlayerStep`) e também ao clicar na placa. Comprar paga e libera a ponte na hora.
   */
  private offerPurchase(bridge: BridgeDefinition): void {
    if (isDialogueOpen() || this.isUnlocked(bridge)) return;

    const price = bridge.requirement.coins ?? 0;
    const have = this.inventory.getCoins();
    const lines = [`Preço: ${price} moedas`, `Você tem: ${have} moedas`];
    for (const item of bridge.requirement.items ?? []) lines.push(`${item.amount}x ${item.label}`);
    if (have < price) lines.push(`Faltam ${price - have} moedas.`);

    const payload: DialoguePayload = {
      speaker: `Ponte para ${bridge.destinationName}`,
      subtitle: 'Passagem bloqueada',
      text: `Esta passagem leva a ${bridge.destinationName}, mas a ponte ainda não foi construída. Quer pagar pela obra agora?`,
      details: lines,
      actions: [{ label: `Comprar (${price})`, enabled: have >= price, onSelect: () => this.buy(bridge) }],
    };
    this.scene.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
  }

  /** Paga (o painel já fechou) e libera a ponte; a travessia em si só acontece ao pisar nela. */
  private buy(bridge: BridgeDefinition): void {
    if (!this.tryPayRequirement(bridge)) {
      this.offerPurchase(bridge); // O saldo mudou desde que o card abriu: reabre com o real.
      return;
    }
    this.unlockBridge(bridge);
    playEffect(this.scene, SPEND_MONEY_SOUND); // Mesmo som das compras na Loja.
    this.lockedMessage.show(`Ponte liberada: ${bridge.destinationName}`, 'Atravesse a ponte para entrar.');
    console.log(`Ponte para ${bridge.destinationName} desbloqueada! Atravesse a ponte para entrar.`);
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
    if (bridge && this.isUnlocked(bridge) && !this.isTransitioning) {
      this.crossInto(bridge);
      return;
    }

    // Chegou perto de uma ponte ainda bloqueada: oferece a compra UMA vez (se fechar o card, só volta a oferecer depois de se afastar e voltar).
    for (const locked of this.map.bridges) {
      if (this.isUnlocked(locked)) continue;
      const key = this.key(locked);
      const distance = Math.max(Math.abs(col - locked.col), Math.abs(row - locked.row));
      if (distance <= OFFER_RANGE_CELLS) {
        if (!this.offered.has(key)) {
          this.offered.add(key);
          this.offerPurchase(locked);
        }
      } else if (distance > OFFER_RANGE_CELLS + 1) {
        this.offered.delete(key);
      }
    }
  }

  /** Tenta pagar o requisito (moedas hoje — itens específicos ainda não têm estoque real pra checar, ver `BridgeRequirement`). `false` sem gastar nada se faltar algo. */
  private tryPayRequirement(bridge: BridgeDefinition): boolean {
    const { coins } = bridge.requirement;
    if (coins && !this.inventory.spendCoins(coins)) return false;
    return true;
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
