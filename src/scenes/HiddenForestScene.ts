import Phaser from 'phaser';
import { ExternalMapScene, computeWallBridgeCell } from './ExternalMapScene';
import { BIRCH_TREE_KEY, BIRCH_TREE_PATH, PINE_TREE_KEY, PINE_TREE_PATH, TILE_SIZE } from '../data/tiles';
import { ENCHANT_TABLE, HIDDEN_FOREST, HIDDEN_FOREST_NAME, HIDDEN_FOREST_SCENE_KEY, ROOT_PORTAL, WIZARD, WIZARD_TOWER, hiddenForestTrees } from '../data/hiddenForest';
import { buildExternalTree } from '../systems/externalMapBuilder';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { createGroundShadow } from '../systems/shadow';
import { WalkableGrid } from '../systems/grid';
import { Interactable, InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';
import { onMilestoneReached, reachMilestone } from '../systems/story';
import { isEnchantTableUnlocked } from '../systems/enchanting';
import { openEnchantTable, talkToWizard } from '../systems/wizard';
import { updateTreeOverlap } from '../systems/treeOverlap';

/** Clicar no Mago (ou F de frente): conversa. */
class WizardInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.GameObjects.Sprite,
  ) {}

  interact(): void {
    talkToWizard(this.scene, { x: this.sprite.x, y: this.sprite.y - 70 });
  }
}

/** Clicar na Mesa (ou F de frente): encantar — selada até o Mago confiar no jogador. */
class EnchantTableInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.GameObjects.Image,
  ) {}

  interact(): void {
    this.sprite.setFrame(isEnchantTableUnlocked() ? ENCHANT_TABLE.openFrame : ENCHANT_TABLE.closedFrame);
    openEnchantTable(this.scene, { x: this.sprite.x, y: this.sprite.y - 60 });
  }
}

/**
 * A FLORESTA OCULTA (Fase 11, `data/hiddenForest.ts`): uma clareira silenciosa com a torre do Mago, o próprio Mago e a Mesa de
 * Encantamentos. Chega-se pelo arco de árvores que o Mapa Misterioso revela na Floresta; a volta é o arco na parede sul (a mesma célula
 * de volta das outras áreas, sem a arte da ponte), que leva de novo à Floresta.
 */
export class HiddenForestScene extends ExternalMapScene {
  private readonly treeVisuals: Phaser.GameObjects.Image[] = [];

  constructor() {
    super(HIDDEN_FOREST_SCENE_KEY, {
      cols: HIDDEN_FOREST.cols,
      rows: HIDDEN_FOREST.rows,
      areaName: HIDDEN_FOREST_NAME,
      groundTint: HIDDEN_FOREST.groundTint,
      returnDirection: 'south',
      hideReturnBridge: true,
      returnHint: 'Passe pelo arco de árvores para voltar à Floresta.',
      obstacleCells: [
        ...hiddenForestTrees().map(({ col, row }): [number, number] => [col, row]),
        ...towerCells(),
        ...ENCHANT_TABLE.cells.map(({ col, row }): [number, number] => [col, row]),
        [WIZARD.cell.col, WIZARD.cell.row],
        ...exitArchCells(),
      ],
    });
  }

  protected loadMapAssets(): void {
    const image = (key: string, path: string): void => {
      if (!this.textures.exists(key)) this.load.image(key, encodeURI(`/${path}`));
    };
    image(PINE_TREE_KEY, PINE_TREE_PATH);
    image(BIRCH_TREE_KEY, BIRCH_TREE_PATH);
    image(ROOT_PORTAL.key, ROOT_PORTAL.path);
    image(WIZARD_TOWER.key, WIZARD_TOWER.path);
    for (const frame of WIZARD.idleFrames) image(frame.key, frame.path);
    if (!this.textures.exists(ENCHANT_TABLE.key)) {
      this.load.spritesheet(ENCHANT_TABLE.key, encodeURI(`/${ENCHANT_TABLE.path}`), { frameWidth: ENCHANT_TABLE.frameSize, frameHeight: ENCHANT_TABLE.frameSize });
    }
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const { tilePx, interactions } = ctx;

    // Primeira vez aqui: o lugar do X vermelho do mapa.
    if (reachMilestone('hiddenForest')) {
      this.time.delayedCall(600, () => this.lockedMessage.show('A FLORESTA OCULTA', 'Um castelo engolido pelas árvores... alguém mora aqui.'));
    }

    for (const tree of hiddenForestTrees()) this.treeVisuals.push(buildExternalTree(this, TILE_SIZE, tree.col, tree.row, tree.species));

    // O arco de volta, na parede sul (a célula de volta é a do meio da base).
    const exit = computeWallBridgeCell('south', HIDDEN_FOREST.cols, HIDDEN_FOREST.rows);
    this.addFrame(ROOT_PORTAL.key, ROOT_PORTAL.hiddenFrame);
    const arch = this.add.image(exit.col * tilePx + tilePx / 2, (exit.row + 1) * tilePx, ROOT_PORTAL.key, ROOT_PORTAL.hiddenFrame.name);
    arch.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(arch.y);

    // A torre.
    this.addFrame(WIZARD_TOWER.key, WIZARD_TOWER.frame);
    const towerX = WIZARD_TOWER.baseCol * tilePx + tilePx / 2;
    const towerY = (WIZARD_TOWER.baseRow + 1) * tilePx;
    createGroundShadow(this, towerX, towerY - 8, DISPLAY_SCALE * 3.2, DISPLAY_SCALE * 0.9).setDepth(-0.4);
    const tower = this.add.image(towerX, towerY, WIZARD_TOWER.key, WIZARD_TOWER.frame.name);
    tower.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(tower.y);

    // O Mago, parado em frente à torre, respirando (os 4 quadros de repouso).
    if (!this.anims.exists('wizard-idle')) {
      this.anims.create({ key: 'wizard-idle', frames: WIZARD.idleFrames.map((frame) => ({ key: frame.key })), frameRate: 5, repeat: -1 });
    }
    const wizardX = WIZARD.cell.col * tilePx + tilePx / 2;
    const wizardY = (WIZARD.cell.row + 1) * tilePx + WIZARD.footMargin * WIZARD.scale - 4;
    createGroundShadow(this, wizardX, wizardY - 8, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.45).setDepth(wizardY - 1);
    const wizard = this.add.sprite(wizardX, wizardY, WIZARD.idleFrames[0].key).setOrigin(0.5, 1).setScale(WIZARD.scale).setDepth(wizardY);
    wizard.setFlipX(true); // Olha pra mesa, à esquerda.
    wizard.play('wizard-idle');
    interactions.set(WIZARD.cell.col, WIZARD.cell.row, new WizardInteractable(this, wizard));

    // A Mesa de Encantamentos: o livro fica fechado até o Mago confiar no jogador.
    const [left, right] = ENCHANT_TABLE.cells;
    const tableX = (left.col + right.col + 1) * (tilePx / 2);
    const tableY = (left.row + 1) * tilePx;
    createGroundShadow(this, tableX, tableY - 4, DISPLAY_SCALE * 1.6, DISPLAY_SCALE * 0.4).setDepth(tableY - 1);
    const table = this.add.image(tableX, tableY, ENCHANT_TABLE.key, isEnchantTableUnlocked() ? ENCHANT_TABLE.openFrame : ENCHANT_TABLE.closedFrame);
    table.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(tableY);
    for (const cell of ENCHANT_TABLE.cells) interactions.set(cell.col, cell.row, new EnchantTableInteractable(this, table));
    // O Mago passou a confiar no jogador (entregou os peixes): o livro da mesa se abre na hora.
    const stopListening = onMilestoneReached((id) => {
      if (id === 'wizardTrust') table.setFrame(ENCHANT_TABLE.openFrame);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopListening);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    updateTreeOverlap(this.player, this.treeVisuals);
  }

  private addFrame(key: string, frame: { name: string; rect: { x: number; y: number; width: number; height: number } }): void {
    const texture = this.textures.get(key);
    if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  }
}

function towerCells(): Array<[number, number]> {
  const { col0, col1, row0, row1 } = WIZARD_TOWER.solid;
  const cells: Array<[number, number]> = [];
  for (let row = row0; row <= row1; row += 1) for (let col = col0; col <= col1; col += 1) cells.push([col, row]);
  return cells;
}

/** Os troncos do arco de volta (as colunas dos lados; a do meio é a passagem). */
function exitArchCells(): Array<[number, number]> {
  const exit = computeWallBridgeCell('south', HIDDEN_FOREST.cols, HIDDEN_FOREST.rows);
  const cells: Array<[number, number]> = [];
  for (let row = exit.row - 2; row <= exit.row; row += 1) cells.push([exit.col - 1, row], [exit.col + 1, row]);
  return cells;
}
