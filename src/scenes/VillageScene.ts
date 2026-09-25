import Phaser from 'phaser';
import { ExternalMapScene } from './ExternalMapScene';
import { VILLAGE_COLS, VILLAGE_ROWS, villageBlockedCells, villageDirtZone } from '../data/maps/villageMap';
import { villageLayout } from '../data/maps/villageLayout';
import { buildVillage, preloadVillage } from '../systems/villageBuilder';
import { createVillageShop, preloadVillageShop, getVillageShopPost } from '../systems/villageShop';
import { NpcSystem, preloadNpcs } from '../systems/npcSystem';
import { VILLAGE_SHOP_HOURS_TEXT } from '../data/villageShop';
import { VILLAGE_NPC_IDS } from '../data/npcs';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { onPlayerStepped } from '../systems/sceneEvents';
import { gameState } from '../systems/gameState';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';
import { ShopMenu } from '../ui/shopMenu';

export const VILLAGE_SCENE_KEY = 'VillageScene';

/**
 * Vilarejo: a cidadezinha além da Fazenda, alcançada pela ponte LESTE (estrada aberta desde o começo, sem requisito). Antes era um
 * trecho colado à Fazenda; agora é uma cena própria, longe dela — a viagem tem transição e o dia/noite corre aqui como em qualquer
 * mapa (`ExternalMapScene` faz o relógio e o véu da noite). A ponte de volta fica na parede OESTE, de frente pra rua principal.
 * O layout (casas, praça, ruas) e as colisões vêm de `data/maps/villageMap.ts`; a loja do Ferreiro, de `systems/villageShop.ts`.
 */
export class VillageScene extends ExternalMapScene {
  private trees: Phaser.GameObjects.Image[] = [];
  private shopMenu!: ShopMenu;
  private npcs!: NpcSystem;

  constructor() {
    super(VILLAGE_SCENE_KEY, {
      cols: VILLAGE_COLS,
      rows: VILLAGE_ROWS,
      areaName: 'Vilarejo',
      // F2 abre o editor do Vilarejo (`MapEditorScene`, `mapType: 'village'`) — o layout editável vem de `data/maps/villageLayout.ts`.
      mapType: 'village',
      // Chão autorado no editor (tiles pintados) quando existir; sem ele, grama procedural + ruas de terra (`dirtZone`, só vale sem `ground`).
      ground: villageLayout.ground,
      backgroundColor: villageLayout.backgroundColor,
      dirtZone: villageDirtZone,
      // A Fazenda a alcança pela ponte LESTE, então a de volta fica a OESTE.
      returnDirection: 'west',
      obstacleCells: villageBlockedCells(),
    });
  }

  protected loadMapAssets(): void {
    preloadVillage(this);
    preloadVillageShop(this);
    preloadNpcs(this, VILLAGE_NPC_IDS);
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const { interactions, player } = ctx;

    // O Phaser reaproveita esta instância entre `scene.start`: recomeça a lista de árvores a cada entrada.
    this.trees = buildVillage(this).trees;

    // Loja do Ferreiro: painel próprio, aberto pelo balcão da casa de madeira — só atende com ele lá (a rotina dele decide o horário).
    this.shopMenu = createVillageShop(
      this,
      gameState.inventory,
      player,
      interactions,
      () => this.npcs.isShopOpen(),
      () => this.lockedMessage.show('LOJA FECHADA', VILLAGE_SHOP_HOURS_TEXT),
    );

    // Moradores: cada um na sua rotina do dia (`data/npcs.ts`); clicar num deles conversa.
    this.npcs = new NpcSystem(this, ctx.grid, player, this.controller, ctx.tilePx, {
      ids: VILLAGE_NPC_IDS,
      posts: { blacksmith: getVillageShopPost() },
      openShop: () => this.shopMenu.open(),
    });

    // Andar, Esc ou E fecham a loja (mesma regra da loja da Fazenda).
    onPlayerStepped(this, () => this.closeShop());
    this.input.keyboard!.on('keydown-ESC', () => this.closeShop());
    this.input.keyboard!.on('keydown-E', () => this.closeShop());
  }

  private closeShop(): void {
    if (this.shopMenu.isOpen()) this.shopMenu.close();
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.npcs.update(time, delta);
    // Sem o Ferreiro no balcão a loja não fica aberta (ex.: ele saiu pro almoço com o painel aberto).
    if (this.shopMenu.isOpen() && !this.npcs.isShopOpen()) this.shopMenu.close();
    updateTreeOverlap(this.player, this.trees);
    if (this.shopMenu.isOpen()) this.shopMenu.refresh(gameState.inventory.getCoins());
  }
}
