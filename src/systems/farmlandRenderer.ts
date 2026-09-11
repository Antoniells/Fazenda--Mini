import Phaser from 'phaser';
import { Farmland, Plot } from './farmland';
import { CROPS } from '../data/crops';
import { SOIL_TILESET_KEY, SOIL_DRY_INDEX, SOIL_WET_INDEX } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { FarmMapData } from '../data/maps/farmMap';

/** Tingimento aplicado à plantação morta — reaproveita o frame existente, sem novo sprite. */
const DEAD_TINT = 0x8a6d4a;

/**
 * Visual da agricultura: uma imagem de solo por célula cultivável (oculta
 * até ser arada; troca entre seca/molhada conforme a hidratação) e uma
 * imagem de plantação por célula plantada (troca de frame conforme o
 * estágio de crescimento; plantação morta usa o último frame com um tom
 * acastanhado). Não guarda estado próprio — apenas reflete `Farmland`.
 */
export class FarmlandRenderer {
  private readonly tilePx: number;
  private readonly soilImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly cropImages = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    map: FarmMapData,
  ) {
    this.tilePx = map.tileSize * DISPLAY_SCALE;

    for (const [col, row] of map.farmlandArea) {
      const soil = scene.add.image(col * this.tilePx, row * this.tilePx, SOIL_TILESET_KEY, SOIL_DRY_INDEX);
      soil.setOrigin(0, 0);
      soil.setScale(DISPLAY_SCALE);
      soil.setDepth(-0.5); // Acima do chão (-1), abaixo de tudo que é ordenado por Y.
      soil.setVisible(false);
      this.soilImages.set(this.key(col, row), soil);
    }
  }

  private key(col: number, row: number): string {
    return `${col},${row}`;
  }

  private renderSoil(farmland: Farmland, plot: Plot): void {
    const soil = this.soilImages.get(this.key(plot.col, plot.row));
    if (!soil) return;

    if (plot.state === 'untilled') {
      soil.setVisible(false);
      return;
    }

    soil.setVisible(true);

    if (plot.state !== 'growing' || !plot.cropId) {
      soil.setFrame(SOIL_DRY_INDEX);
      return;
    }

const crop = CROPS[plot.cropId];

// Só é considerada molhada se a última rega for DIFERENTE do tempo de plantio
// (ou seja, o jogador regou manualmente após plantar) e ainda não secou.
const recentlyWatered = !!crop && 
                        plot.lastWateredAt !== plot.plantedAt && 
                        farmland.timeSinceWatered(plot) < crop.maxTimeWithoutWaterMs / 2;

soil.setFrame(recentlyWatered ? SOIL_WET_INDEX : SOIL_DRY_INDEX);
  }

private renderCrop(plot: Plot): void {
    const key = this.key(plot.col, plot.row);
    const crop = plot.cropId ? CROPS[plot.cropId] : null;

    if ((plot.state !== 'growing' && plot.state !== 'dead') || !crop) {
      this.cropImages.get(key)?.destroy();
      this.cropImages.delete(key);
      return;
    }

    const frame = crop.growthFrames[Math.min(plot.stage, crop.growthFrames.length - 1)];
    let image = this.cropImages.get(key);
    
    if (!image) {
      image = this.scene.add.image(0, 0, crop.textureKey, frame);
      image.setOrigin(0.5, 1);
      image.setScale(DISPLAY_SCALE);
      image.setPosition(plot.col * this.tilePx + this.tilePx / 2, (plot.row + 1) * this.tilePx);
      this.cropImages.set(key, image);
    }
    
    image.setFrame(frame);

    if (plot.state === 'dead') image.setTint(DEAD_TINT);
    else image.clearTint();

    // ADICIONE ISTO AQUI NO FINAL:
    // Se for o estágio 0 (semente) ou estiver morta, fica colada no chão (-0.25 fica acima da terra que é -0.5)
    if (plot.stage === 0 || plot.state === 'dead') {
      image.setDepth(-0.25);
    } else {
      // Se já for uma plantinha crescendo, ganha profundidade para o personagem passar por trás/frente
      image.setDepth(image.y + 1);
    }
  }

  renderPlot(farmland: Farmland, plot: Plot): void {
    this.renderSoil(farmland, plot);
    this.renderCrop(plot);
  }

  renderAll(farmland: Farmland): void {
    for (const plot of farmland.getAllPlots()) {
      this.renderPlot(farmland, plot);
    }
  }

  /** Faz a plantinha balançar (efeito puramente visual) quando o jogador passa por perto. */
  rustleCrop(col: number, row: number): void {
    const key = this.key(col, row);
    const image = this.cropImages.get(key);

    if (!image || this.scene.tweens.isTweening(image)) return;

    this.scene.tweens.add({
      targets: image,
      angle: { from: 0, to: 8 },
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => image.setAngle(0),
    });
  }
}

