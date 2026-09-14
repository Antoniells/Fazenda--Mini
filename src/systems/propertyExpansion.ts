import Phaser from 'phaser';
import { BIOME_LABELS, ExpansionChunk, ExpansionDirection, FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { WalkableGrid } from './grid';
import { buildGroundChunk, buildExpansionChunkFence, buildFenceSide, buildConstructionSign, BIOME_TINTS } from './mapBuilder';

/** Placa de um trecho: ao interagir, tenta comprar aquele trecho específico (ver `PropertyExpansionSystem.tryBuy`). */
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
 * núcleo (`farmMap.expansions` — um por direção) tem sua própria placa
 * física, colocada encostada na parede desse lado. O jogador anda até lá e
 * interage (mesma interação adjacente já usada na Loja/Caixa de Remessas)
 * para comprar aquele trecho específico — sem menu abstrato envolvido.
 *
 * Cada trecho já nasce com grama e o perímetro externo definitivo
 * desenhados (a câmera já pode alcançá-lo — ver `MainScene.create`), mas
 * fica isolado pela parede do núcleo naquele lado até a compra, quando ela
 * é removida (visual e do grid) junto com a placa.
 */
export class PropertyExpansionSystem {
  private readonly wallImages = new Map<ExpansionDirection, Phaser.GameObjects.Image[]>();
  private readonly signImages = new Map<ExpansionDirection, Phaser.GameObjects.Image>();
  private readonly purchased = new Set<ExpansionDirection>();

  constructor(
    scene: Phaser.Scene,
    private readonly map: FarmMapData,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
  ) {
    for (const chunk of map.expansions) {
      buildGroundChunk(scene, map.tileSize, chunk.col0, chunk.row0, chunk.cols, chunk.rows, undefined, BIOME_TINTS[chunk.biome]);
      buildExpansionChunkFence(scene, map.tileSize, chunk);

      this.wallImages.set(chunk.direction, buildFenceSide(scene, map, chunk.direction));

      const [signCol, signRow] = chunk.signPosition;
      const sign = buildConstructionSign(scene, map.tileSize, signCol, signRow);
      this.signImages.set(chunk.direction, sign);
      grid.block(signCol, signRow);
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

    for (const image of this.wallImages.get(chunk.direction) ?? []) image.destroy();
    this.wallImages.delete(chunk.direction);
    this.unblockCoreWall(chunk.direction);

    const [signCol, signRow] = chunk.signPosition;
    this.signImages.get(chunk.direction)?.destroy();
    this.signImages.delete(chunk.direction);
    this.grid.unblock(signCol, signRow);
    this.interactions.remove(signCol, signRow);

    console.log(`${biomeLabel} desbloqueada! (saldo: ${this.inventory.getCoins()}).`);
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
    const bridgeCoordsOnThisWall = new Set(
      this.map.bridges.filter((bridge) => bridge.direction === direction).map((bridge) => bridge[bridgeCoord]),
    );

    if (direction === 'north') {
      for (let col = 1; col < cols - 1; col++) if (!bridgeCoordsOnThisWall.has(col)) this.grid.unblock(col, 0);
    } else if (direction === 'south') {
      for (let col = 1; col < cols - 1; col++) if (!bridgeCoordsOnThisWall.has(col)) this.grid.unblock(col, rows - 1);
    } else if (direction === 'west') {
      for (let row = 1; row < rows - 1; row++) if (!bridgeCoordsOnThisWall.has(row)) this.grid.unblock(0, row);
    } else {
      for (let row = 1; row < rows - 1; row++) if (!bridgeCoordsOnThisWall.has(row)) this.grid.unblock(cols - 1, row);
    }
  }
}
