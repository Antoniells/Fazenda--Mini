import Phaser from 'phaser';
import { CONSTRUCTION_SIGN_KEY } from '../data/tiles';
import { CONSTRUCTION_SITE_SIGN_FRAME, ConstructionOrder } from '../data/construction';
import { DECORATIONS } from '../data/decorations';
import { WalkableGrid } from './grid';
import { Interactable, InteractionRegistry } from './interaction';
import { DISPLAY_SCALE } from './mapBuilder';
import { popText } from './floatingText';
import { describeSchedule, getBuildStatus, getOrders } from './construction';
import { clearPlantsUnder } from './plantClearing';

/** Fração da opacidade com que a construção FUTURA aparece no local, em transparência (o "projeto" do Tomás). */
const PROJECT_ALPHA = 0.4;
/** A placa é maior que 1 tile: encolhe pra caber num poço (2 tiles) sem esconder a silhueta do projeto. */
const SIGN_SCALE_MULTIPLIER = 0.75;

/** Clicar no local da obra mostra em que pé ela está (a placa em si não faz mais nada). */
class SiteInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly order: ConstructionOrder,
    private readonly x: number,
    private readonly y: number,
  ) {}

  interact(): void {
    const name = DECORATIONS[this.order.decorationId]?.name ?? 'Construção';
    const status = getBuildStatus(this.order);
    const text = status === 'building' ? `${name}: o Tomás está construindo` : `${name}: obra ${describeSchedule(this.order)}`;
    popText(this.scene, this.x, this.y, text, { color: '#ffe9b3', fontSize: 14 });
  }
}

interface Site {
  project: Phaser.GameObjects.Image;
  sign: Phaser.GameObjects.Image;
  /** O que estava registrado em cada célula antes da obra (devolvido ao terminar/cancelar). */
  replaced: Map<string, Interactable | undefined>;
  cells: Array<{ col: number; row: number }>;
}

/**
 * Os locais de obra na Fazenda (uma `ConstructionOrder` pendente = um "canteiro"): a construção futura em transparência com a placa de
 * "Em obras" na frente; as células do footprint ficam bloqueadas (ninguém constrói nem anda em cima) e clicar mostra o andamento. Quem
 * termina a obra chama `remove` e depois coloca a construção de verdade (`DecorationPlacementSystem.placeBuilt`).
 */
export class ConstructionSiteSystem {
  private readonly sites = new Map<number, Site>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    private readonly tilePx: number,
  ) {}

  /** Recria o canteiro de cada encomenda pendente (a cena nasce vazia a cada `scene.start`). */
  restore(): void {
    for (const order of getOrders()) this.add(order);
  }

  add(order: ConstructionOrder): void {
    const decoration = DECORATIONS[order.decorationId];
    if (!decoration || this.sites.has(order.id)) return;
    const { width, height } = decoration.footprint;
    clearPlantsUnder(this.scene, order.col, order.row, width, height); // O local da obra é limpo das plantinhas.
    const centerX = order.col * this.tilePx + (width * this.tilePx) / 2;
    const bottom = (order.row + height) * this.tilePx;

    const texture = this.scene.textures.get(CONSTRUCTION_SIGN_KEY);
    if (!texture.has(CONSTRUCTION_SITE_SIGN_FRAME.name)) {
      const { x, y, width: w, height: h } = CONSTRUCTION_SITE_SIGN_FRAME.rect;
      texture.add(CONSTRUCTION_SITE_SIGN_FRAME.name, 0, x, y, w, h);
    }

    const frames = decoration.animationFrames;
    const project = this.scene.add.image(centerX, bottom, decoration.textureKey, frames?.[0]?.name ?? decoration.frameName);
    project.setOrigin(0.5, frames ? decoration.animationOriginY ?? 1 : 1);
    project.setScale(DISPLAY_SCALE * (decoration.displayScaleMultiplier ?? 1));
    project.setAlpha(PROJECT_ALPHA);
    project.setDepth(bottom);

    const sign = this.scene.add.image(centerX, bottom, CONSTRUCTION_SIGN_KEY, CONSTRUCTION_SITE_SIGN_FRAME.name);
    sign.setOrigin(0.5, 1);
    sign.setScale(DISPLAY_SCALE * SIGN_SCALE_MULTIPLIER);
    sign.setDepth(bottom + 0.5);

    const interactable = new SiteInteractable(this.scene, order, centerX, bottom - height * this.tilePx);
    const replaced = new Map<string, Interactable | undefined>();
    const cells: Array<{ col: number; row: number }> = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const col = order.col + dx;
        const row = order.row + dy;
        replaced.set(`${col},${row}`, this.interactions.get(col, row));
        this.grid.block(col, row);
        this.interactions.set(col, row, interactable);
        cells.push({ col, row });
      }
    }
    this.sites.set(order.id, { project, sign, replaced, cells });
  }

  /** Tira o canteiro (obra terminada ou encomenda cancelada/movida): libera as células e devolve o que havia nelas. */
  remove(orderId: number): void {
    const site = this.sites.get(orderId);
    if (!site) return;
    site.project.destroy();
    site.sign.destroy();
    for (const { col, row } of site.cells) {
      this.grid.unblock(col, row);
      const previous = site.replaced.get(`${col},${row}`);
      if (previous) this.interactions.set(col, row, previous);
      else this.interactions.remove(col, row);
    }
    this.sites.delete(orderId);
  }

  has(orderId: number): boolean {
    return this.sites.has(orderId);
  }
}
