import Phaser from 'phaser';
import { Farmland, Plot } from './farmland';
import { CROPS } from '../data/crops';
import { SOIL_TILESET_KEY, SOIL_DRY_AUTOTILE, SOIL_WET_AUTOTILE, SoilAutotileSet } from '../data/tiles';
import { SPLASH_KEY, SPLASH_ANIM_KEY, SPLASH_FRAMES } from '../data/effects';
import { DISPLAY_SCALE } from './mapBuilder';
import { createGroundShadow } from './shadow';
import { pushPlant, registerSway } from './foliageSway';
import { FarmMapData } from '../data/maps/farmMap';

/** Os 4 vizinhos ortogonais de uma célula — usado tanto para escolher a borda do autotile quanto para saber quem re-renderizar depois de arar/limpar. */
const NEIGHBOR_OFFSETS: ReadonlyArray<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/**
 * Decide qual peça usar a partir de quais dos 4 vizinhos ortogonais TAMBÉM
 * estão arados — mesmo estilo de bitmask já usado em `systems/dirtPaths.ts`
 * (`pickDirtBlobTile`) para o caminho de terra: cada `missing*` é "esse
 * lado NÃO está arado, precisa da borda ali".
 *
 * Três casos distintos, checados nesta ordem:
 * 1. Isolada dos 4 lados -> `isolated` (monte redondo).
 * 2. Faixa de 1 célula de LARGURA (sem vizinho à esquerda nem à direita,
 *    mas com vizinho em cima OU embaixo) -> cápsula vertical
 *    (`verticalTop`/`verticalMiddle`/`verticalBottom`) — o 9-slice normal
 *    pressupõe pelo menos 2 células de largura, então não se aplica aqui.
 * 3. Faixa de 1 célula de ALTURA (análogo, cápsula horizontal).
 * 4. Qualquer outra forma (largura e altura >= 2): canto/borda/preenchimento normal.
 */
function pickSoilAutotileKey(
  missingTop: boolean,
  missingBottom: boolean,
  missingLeft: boolean,
  missingRight: boolean,
): keyof SoilAutotileSet {
  if (missingTop && missingBottom && missingLeft && missingRight) return 'isolated';

  if (missingLeft && missingRight) {
    if (missingTop) return 'verticalTop';
    if (missingBottom) return 'verticalBottom';
    return 'verticalMiddle';
  }

  if (missingTop && missingBottom) {
    if (missingLeft) return 'horizontalLeft';
    if (missingRight) return 'horizontalRight';
    return 'horizontalMiddle';
  }

  if (missingTop && missingLeft) return 'topLeft';
  if (missingTop && missingRight) return 'topRight';
  if (missingBottom && missingLeft) return 'bottomLeft';
  if (missingBottom && missingRight) return 'bottomRight';
  if (missingTop) return 'top';
  if (missingBottom) return 'bottom';
  if (missingLeft) return 'left';
  if (missingRight) return 'right';
  return 'center';
}

/** Tingimento aplicado à plantação morta — reaproveita o frame existente, sem novo sprite. */
const DEAD_TINT = 0x8a6d4a;
/** Tingimento marrom-terra aplicado à mancha de sombra para virar "poeira" ao arar — mesmo asset, só a cor muda. */
const DUST_TINT = 0x8a5a2e;
/**
 * Tingimento aplicado ao mesmo frame do solo seco (`SOIL_DRY_AUTOTILE`) para
 * representar solo molhado — ver `renderSoil`. O spritesheet
 * "Tilled Soil and wet soil.png" só tem duas famílias de cor (laranja/seco
 * e azul/"wet"); a variante azul destoava do resto da paleta terrosa do
 * jogo, por isso a troca por um tingimento mais escuro sobre o mesmo asset,
 * em vez de usar o frame azul do spritesheet.
 */
const WET_SOIL_TINT = 0x7a5233;

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
      const soil = scene.add.image(col * this.tilePx, row * this.tilePx, SOIL_TILESET_KEY, SOIL_DRY_AUTOTILE.isolated);
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

    // Autotile (melhoria visual): olha os 4 vizinhos ortogonais — os que
    // NÃO estão arados (`!farmland.isTilled`, célula fora da lavoura conta
    // como não arada) precisam da borda daquele lado. Ver `pickSoilAutotileKey`
    // e o aviso em `data/tiles.ts` sobre os índices ainda serem provisórios.
    const missingTop = !farmland.isTilled(plot.col, plot.row - 1);
    const missingBottom = !farmland.isTilled(plot.col, plot.row + 1);
    const missingLeft = !farmland.isTilled(plot.col - 1, plot.row);
    const missingRight = !farmland.isTilled(plot.col + 1, plot.row);
    const variant = pickSoilAutotileKey(missingTop, missingBottom, missingLeft, missingRight);

    // `Farmland.isWatered` reflete "foi regada hoje" (Fase 9) — fica molhada
    // o dia inteiro depois de uma rega, só seca de novo na virada do dia
    // seguinte (`Farmland.onNewDay`), mesma condição que rege o crescimento
    // e a sobrevivência da plantação. Solo arado e vazio também fica molhado
    // quando a flag está ligada: só acontece ao colher em dia de chuva
    // (`Farmland.harvest`) — o solo não "seca" com a chuva caindo.
    const isWatered = ((plot.state === 'growing' && !!plot.cropId) || plot.state === 'tilled') && farmland.isWatered(plot);
    const autotile = isWatered ? SOIL_WET_AUTOTILE : SOIL_DRY_AUTOTILE;
    soil.setFrame(autotile[variant]);

    if (isWatered) soil.setTint(WET_SOIL_TINT);
    else soil.clearTint();
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
    
// 1. Calculamos o X e Y base
    const x = plot.col * this.tilePx + this.tilePx / 2;
    let y = (plot.row + 1) * this.tilePx;

    // 2. O Ajuste:
    if (plot.stage > 0) {
      y -= 8; // Sobe as plantas que já cresceram
    } else {
      // É uma semente (stage === 0)
      // Ajuste fino exclusivo para as sementes que desenham muito para baixo
      if (plot.cropId === 'potato' || plot.cropId === 'onion') {
        y -= 5; // Tente 4 ou 6 para centralizar certinho com a da cenoura
      }
    }

    if (!image) {
// ... resto do código continua igual
      image = this.scene.add.image(x, y, crop.textureKey, frame);
      image.setOrigin(0.5, 1);
      image.setScale(DISPLAY_SCALE);
      this.cropImages.set(key, image);
      registerSway(image, 'crop');
    } else {
      // 3. Atualizamos a posição caso ela já exista (para ela subir quando passar do stage 0 para o 1)
      image.setPosition(x, y);
    }
    
    image.setFrame(frame);

    if (plot.state === 'dead') image.setTint(DEAD_TINT);
    else image.clearTint();

    if (plot.stage === 0 || plot.state === 'dead') {
      image.setDepth(-0.25);
    } else {
      image.setDepth(image.y + 1);
    }
  }

  renderPlot(farmland: Farmland, plot: Plot): void {
    this.renderSoil(farmland, plot);
    this.renderCrop(plot);
  }

  /**
   * Igual a `renderPlot`, mas também re-renderiza os 4 vizinhos ortogonais
   * — necessário depois de arar (ou limpar) uma célula, já que a borda do
   * autotile deles depende de `plot` ter passado a contar como "arada"
   * (`Farmland.isTilled`). Vizinhos fora da lavoura (`getPlot` retorna
   * `undefined`) são ignorados silenciosamente. Chamar só quando a célula
   * pode ter mudado de "arada"/"não arada" — as demais ações
   * (plantar/regar/colher) não mudam essa condição, `renderPlot` sozinho já
   * basta.
   */
  renderPlotAndNeighbors(farmland: Farmland, plot: Plot): void {
    this.renderPlot(farmland, plot);
    for (const [dCol, dRow] of NEIGHBOR_OFFSETS) {
      const neighbor = farmland.getPlot(plot.col + dCol, plot.row + dRow);
      if (neighbor) this.renderPlot(farmland, neighbor);
    }
  }

  renderAll(farmland: Farmland): void {
    for (const plot of farmland.getAllPlots()) {
      this.renderPlot(farmland, plot);
    }
  }

  /** Faz a plantinha balançar (efeito puramente visual) quando o jogador passa por perto. */
  rustleCrop(col: number, row: number, direction = 1): void {
    const image = this.cropImages.get(this.key(col, row));
    if (image) pushPlant(image, direction); // Pende pro lado em que o personagem anda (`systems/foliageSway.ts`).
  }

  /**
   * Poeira temporária ao arar: reaproveita a mesma mancha de
   * `systems/shadow.ts`, só que tingida de marrom e com um "pulo e some"
   * em vez de ficar parada — nenhum sprite novo, só transformações sobre o
   * já existente.
   */
  spawnHoeDust(col: number, row: number): void {
    const x = col * this.tilePx + this.tilePx / 2;
    const y = (row + 1) * this.tilePx;

    const dust = createGroundShadow(this.scene, x, y, DISPLAY_SCALE * 0.85, DISPLAY_SCALE * 0.45);
    dust.setTint(DUST_TINT);
    dust.setAlpha(0.55);
    dust.setDepth(y + 0.5);

    this.scene.tweens.add({
      targets: dust,
      scaleX: dust.scaleX * 1.7,
      scaleY: dust.scaleY * 1.7,
      y: y - 6,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => dust.destroy(),
    });
  }

  private ensureSplashAnim(): void {
    if (this.scene.anims.exists(SPLASH_ANIM_KEY)) return;
    this.scene.anims.create({
      key: SPLASH_ANIM_KEY,
      frames: this.scene.anims.generateFrameNumbers(SPLASH_KEY, SPLASH_FRAMES),
      frameRate: 12,
      repeat: 0,
    });
  }

  /** Centro da célula, em coordenadas de mundo — onde a colheita "cai" (ver `systems/lootDrops.ts`). */
  getCellCenter(col: number, row: number): { x: number; y: number } {
    return { x: col * this.tilePx + this.tilePx / 2, y: row * this.tilePx + this.tilePx * 0.75 };
  }

  /** Respingo d'água temporário ao regar (`Objects/Props/Sprash.png`, já azul — sem precisar de tingimento). */
  spawnWaterSplash(col: number, row: number): void {
    this.ensureSplashAnim();

    const x = col * this.tilePx + this.tilePx / 2;
    const y = (row + 1) * this.tilePx - this.tilePx / 2;

    const splash = this.scene.add.sprite(x, y, SPLASH_KEY, 0);
    splash.setScale(DISPLAY_SCALE);
    splash.setDepth(y + 0.5);
    splash.play(SPLASH_ANIM_KEY);
    splash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => splash.destroy());
  }

  /** Retira a imagem da plantação do controle do renderer (pra poder animá-la sozinha) e devolve, se houver. */
  private detachCropImage(col: number, row: number): Phaser.GameObjects.Image | undefined {
    const key = this.key(col, row);
    const image = this.cropImages.get(key);
    this.cropImages.delete(key);
    return image;
  }

  /**
   * Pulo elástico + desaparecimento da plantação ao colher. Chamar antes
   * de `renderPlot`/`renderAll` re-desenhar a célula (já vazia) — como a
   * imagem já foi retirada do controle do renderer, ele não tenta destruí-
   * la de novo por cima da animação. Puramente visual: o resultado da
   * colheita já foi decidido antes disso, por `Farmland.harvest`.
   */
  playHarvestPop(col: number, row: number): void {
    const image = this.detachCropImage(col, row);
    if (!image) return;

    this.scene.tweens.add({
      targets: image,
      scale: image.scale * 1.4,
      y: image.y - 12,
      alpha: 0,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => image.destroy(),
    });
  }
}

