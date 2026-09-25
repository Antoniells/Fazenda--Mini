import Phaser from 'phaser';
import { BIOME_LABELS, ExpansionChunk, ExpansionDirection, FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { playEffect } from './soundEffects';
import { UNLOCK_SOUND } from '../data/audio';
import { WalkableGrid } from './grid';
import { gameState } from './gameState';
import { buildGroundChunk, buildExpansionChunkFence, buildFenceSide, bridgeRailingCells, BIOME_TINTS } from './mapBuilder';

/** Ponto de compra de um trecho (célula bloqueada, sem placa visível — ver comentário da classe): ao interagir, tenta comprar aquele trecho específico (ver `PropertyExpansionSystem.tryBuy`). */
class ExpansionSignInteractable implements Interactable {
  constructor(
    private readonly system: PropertyExpansionSystem,
    private readonly chunk: ExpansionChunk,
  ) {}

  interact(): void {
    this.system.tryBuy(this.chunk);
  }
}

/**
 * Expansão de propriedade (Fase 6), inspirada no Forager: em vez de uma
 * única expansão genérica comprada num menu, cada trecho ao redor do
 * núcleo (`farmMap.expansions` — um por direção) tem seu próprio ponto de
 * compra, encostado na parede desse lado. O jogador anda até lá e interage
 * (mesma interação adjacente já usada na Loja/Caixa de Remessas) para
 * comprar aquele trecho específico — sem menu abstrato envolvido.
 *
 * A célula de compra é bloqueada (`grid.block`) mas SEM placa visível
 * (pedido explícito do usuário, Fase 9 — limpeza visual: a única placa de
 * "obra" que deve continuar aparecendo é a das pontes bloqueadas, ver
 * `systems/bridgeSystem.ts`). A compra ainda funciona normalmente, só sem
 * marcador no chão indicando onde clicar.
 *
 * Cada trecho já nasce com grama e o perímetro externo definitivo
 * desenhados (a câmera já pode alcançá-lo — ver `MainScene.create`), mas
 * fica isolado pela parede do núcleo naquele lado até a compra, quando ela
 * é removida (visual e do grid).
 */
export class PropertyExpansionSystem {
  private readonly wallImages = new Map<ExpansionDirection, Phaser.GameObjects.Image[]>();
  private readonly purchased = new Set<ExpansionDirection>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: FarmMapData,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    /** Chamado depois de um trecho ser comprado — a Fazenda amplia os limites da câmera (só mostra o que já está liberado). */
    private readonly onUnlocked: () => void = () => {},
  ) {
    for (const chunk of map.expansions) {
      buildGroundChunk(scene, map.tileSize, chunk.col0, chunk.row0, chunk.cols, chunk.rows, undefined, BIOME_TINTS[chunk.biome]);
      buildExpansionChunkFence(scene, map.tileSize, chunk);

      // Trecho que já nasce aberto (o Vilarejo): sem parede do núcleo, sem placa de compra — libera a passagem já na criação.
      if (chunk.startsUnlocked) {
        this.purchased.add(chunk.direction);
        this.unblockCoreWall(chunk.direction);
        continue;
      }

      // Já comprado numa sessão anterior (vai pro save): nasce aberto, sem parede nem placa.
      if (gameState.unlockedExpansions.has(chunk.direction)) {
        this.purchased.add(chunk.direction);
        this.unblockCoreWall(chunk.direction);
        continue;
      }

      this.wallImages.set(chunk.direction, buildFenceSide(scene, map, chunk.direction));

      // Placa de "obra" removida daqui por pedido explícito do usuário — a
      // única que deve continuar aparecendo é a da ponte bloqueada
      // (`BridgeSystem`). A célula continua bloqueada e clicável (a compra
      // do trecho ainda funciona, só sem marcador visual).
      const [signCol, signRow] = chunk.signPosition;
      interactions.set(signCol, signRow, new ExpansionSignInteractable(this, chunk));
    }

    this.fillDiagonalGaps(scene, map);
  }

  /**
   * Trechos são só "em cruz" (um por lado, sem cantos diagonais — ver
   * comentário em `farmMap.expansions`), mas os limites da câmera cobrem o
   * retângulo total (núcleo + todos os trechos, ver `MainScene.create`),
   * que inclui os 4 cantos diagonais entre um trecho horizontal e um
   * vertical. Sem grama ali, a câmera revelaria um buraco preto ao rolar
   * perto de um canto. Esses cantos já são inalcançáveis a pé (cercados
   * pelas paredes dos dois trechos vizinhos — ver `buildExpansionChunkFence`),
   * então só a grama é preenchida aqui, sem cerca nem bloqueio extra no grid.
   */
  private fillDiagonalGaps(scene: Phaser.Scene, map: FarmMapData): void {
    const horizontal = map.expansions.filter((c) => c.direction === 'east' || c.direction === 'west');
    const vertical = map.expansions.filter((c) => c.direction === 'north' || c.direction === 'south');

    for (const h of horizontal) {
      for (const v of vertical) {
        buildGroundChunk(scene, map.tileSize, h.col0, v.row0, h.cols, v.rows);
      }
    }
  }

  /** Chamado pela placa do trecho (`ExpansionSignInteractable`) ao interagir. */
  tryBuy(chunk: ExpansionChunk): void {
    const biomeLabel = BIOME_LABELS[chunk.biome];

    if (this.purchased.has(chunk.direction)) {
      console.log(`${biomeLabel} já desbloqueada.`);
      return;
    }

    if (!this.inventory.spendCoins(chunk.price)) {
      console.log(`Moedas insuficientes para desbloquear ${biomeLabel} (precisa de ${chunk.price} moedas).`);
      return;
    }

    this.purchased.add(chunk.direction);
    gameState.unlockedExpansions.add(chunk.direction);
    playEffect(this.scene, UNLOCK_SOUND);

    for (const image of this.wallImages.get(chunk.direction) ?? []) image.destroy();
    this.wallImages.delete(chunk.direction);
    this.unblockCoreWall(chunk.direction);

    const [signCol, signRow] = chunk.signPosition;
    this.interactions.remove(signCol, signRow);

    console.log(`${biomeLabel} desbloqueada! (saldo: ${this.inventory.getCoins()}).`);
    this.onUnlocked();
  }

  /**
   * Libera, no grid, a parede do núcleo naquele lado — os mesmos cantos que
   * ficam sempre bloqueados (ver `buildFenceCorners`). Pula as células de
   * `farmMap.bridges` que ficam nessa mesma parede (Sistema de Cenas): uma
   * ponte não é "mais um pedaço de terra que se abre" como as expansões —
   * ela sempre precisa continuar bloqueada pro clique disparar a interação
   * (`BridgeSystem`/`PlayerController.handleBlockedClick`), não virar uma
   * célula andável comum só porque o lado foi expandido.
   */
  private unblockCoreWall(direction: ExpansionDirection): void {
    const { cols, rows } = this.map;
    const bridgeCoord = (direction === 'north' || direction === 'south' ? 'col' : 'row') as 'col' | 'row';
    const bridgesOnThisWall = this.map.bridges.filter((bridge) => bridge.direction === direction);
    const bridgeCoordsOnThisWall = new Set(bridgesOnThisWall.map((bridge) => bridge[bridgeCoord]));
    // Os corrimões da ponte (células da própria parede, ao lado dela) também continuam sempre bloqueados (`BridgeSystem`) — abrir a
    // parede não pode devolvê-los ao jogador, senão dá pra contornar o "túnel" e entrar na ponte pelo lado.
    const railingCells = new Set(bridgesOnThisWall.flatMap((bridge) => bridgeRailingCells(bridge)).map(([col, row]) => `${col},${row}`));
    const isRailing = (col: number, row: number): boolean => railingCells.has(`${col},${row}`);

    if (direction === 'north') {
      for (let col = 1; col < cols - 1; col++) if (!bridgeCoordsOnThisWall.has(col) && !isRailing(col, 0)) this.grid.unblock(col, 0);
    } else if (direction === 'south') {
      for (let col = 1; col < cols - 1; col++) if (!bridgeCoordsOnThisWall.has(col) && !isRailing(col, rows - 1)) this.grid.unblock(col, rows - 1);
    } else if (direction === 'west') {
      for (let row = 1; row < rows - 1; row++) if (!bridgeCoordsOnThisWall.has(row) && !isRailing(0, row)) this.grid.unblock(0, row);
    } else {
      for (let row = 1; row < rows - 1; row++) if (!bridgeCoordsOnThisWall.has(row) && !isRailing(cols - 1, row)) this.grid.unblock(cols - 1, row);
    }
  }
}
