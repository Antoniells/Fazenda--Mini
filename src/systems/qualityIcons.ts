import Phaser from 'phaser';
import { RESOURCES } from '../data/resources';
import { STAR_QUALITIES, StarQuality, QUALITY_STAR_RECTS, QUALITY_STAR_SHEET_KEY, qualityId } from '../data/quality';

/** Nome do quadro único de uma textura de canvas. */
export const QUALITY_ICON_FRAME = '__BASE';

/** Chave da textura do ícone de um item com a estrela da qualidade (`registerQualityIcons`). */
export const qualityIconKey = (baseId: string, quality: StarQuality): string => `quality-icon-${qualityId(baseId, quality)}`;

/**
 * Monta, uma vez, o ícone de cada item com qualidade (`ResourceDefinition.hasQuality`) em cada estrela: o ícone do item com a estrela de Prata/Ouro/Irídio
 * (7x6, de `Crops/All Crops.png`) no canto inferior direito — só junta duas artes reais já existentes, sem desenhar nada. Fica numa textura própria pra que
 * toda a interface (Hotbar, Bolsa, Caixa de Remessas, loot no chão) use o ícone como qualquer outro, sem saber de qualidade. Chamado pela `MainScene` logo
 * na abertura (as texturas são globais: as outras cenas as reaproveitam). Idempotente.
 */
export function registerQualityIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(QUALITY_STAR_SHEET_KEY)) return;
  const starSheet = scene.textures.get(QUALITY_STAR_SHEET_KEY).getSourceImage() as CanvasImageSource;

  for (const resource of Object.values(RESOURCES)) {
    if (!resource.hasQuality || !scene.textures.exists(resource.textureKey)) continue;
    const baseTexture = scene.textures.get(resource.textureKey);
    const baseFrame = baseTexture.get(resource.frameName);
    const baseImage = baseTexture.getSourceImage() as CanvasImageSource;
    const { cutX, cutY, cutWidth: width, cutHeight: height } = baseFrame;

    for (const quality of STAR_QUALITIES) {
      const key = qualityIconKey(resource.id, quality);
      if (scene.textures.exists(key)) continue;
      const canvas = scene.textures.createCanvas(key, width, height);
      if (!canvas) continue;
      const context = canvas.getContext();
      context.imageSmoothingEnabled = false;
      context.drawImage(baseImage, cutX, cutY, width, height, 0, 0, width, height);
      const star = QUALITY_STAR_RECTS[quality];
      context.drawImage(starSheet, star.x, star.y, star.width, star.height, width - star.width, height - star.height, star.width, star.height);
      canvas.refresh();
    }
  }
}
