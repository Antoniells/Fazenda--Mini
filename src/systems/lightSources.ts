import Phaser from 'phaser';
import {
  EMISSIVE_ALPHA,
  LAMP_FRAME_MS,
  LAMP_LANTERN_BOTTOM_Y,
  LAMP_LANTERN_FRAME_SIZE,
  LAMP_LANTERN_KEY,
  LAMP_LANTERN_PATH,
  LAMP_LIT_FRAMES,
  LAMP_OFF_TINT,
  LAMP_POLE_FRAME,
  LAMP_POLE_KEY,
  LAMP_POLE_PATH,
  LIGHT_SOURCES,
  TORCH_FRAME_HEIGHT,
  TORCH_FRAME_MS,
  TORCH_FRAME_WIDTH,
  TORCH_KEY,
  TORCH_LIT_FRAMES,
  TORCH_OFF_FRAME,
  TORCH_ORIGIN_Y,
  TORCH_PATH,
  type LightSourceDefinition,
  type LightSourcePlacement,
} from '../data/lighting';
import { SHADOW_FRAME, SHADOW_FRAME_NAME, SHADOW_PATH } from '../data/effects';
import { TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { createGroundShadow } from './shadow';
import { lightIntensityAt } from './ambientLight';
import { POP_TEXT_DEPTH } from './floatingText';

/** Brilho das fontes de luz: acima do véu da luz ambiente (`DayNightOverlay`, `POP_TEXT_DEPTH + 1`) — é ele que "fura" a escuridão. */
export const LIGHT_GLOW_DEPTH = POP_TEXT_DEPTH + 2;

/**
 * Mesma folha `Tileset/Shadow.png` da sombra dos objetos (a mancha redonda), carregada uma 2ª vez com filtro LINEAR: ampliada ~20x,
 * a mancha vira um círculo de borda suave (com o filtro do jogo, "pixel art", viraria um disco de degraus enormes). O brilho é a
 * mancha em preenchimento sólido quente (`TintModes.FILL`: a mancha original é escura, o alfa dela vira a forma da luz) + blend ADD — nada desenhado por código.
 */
const GLOW_KEY = 'light-glow';
/** Anéis do brilho (fração do raio, fração da opacidade): somados em ADD, dão o centro mais forte e a borda fraca. */
const GLOW_RINGS: Array<[number, number]> = [
  [1, 0.7],
  [0.66, 0.9],
  [0.33, 1.2],
];
/** Abaixo desta intensidade a fonte conta como apagada (sprite apagado, sem brilho). */
const OFF_EPSILON = 0.02;

interface LightSource {
  col: number;
  row: number;
  definition: LightSourceDefinition;
  phase: number;
  glow: Phaser.GameObjects.Image[];
  /** Escala base de cada anel do brilho (a "respiração" multiplica por cima dela). */
  glowScales: number[];
  /** Peça que muda de quadro (lampião/tocha) e a cópia dela em ADD acima do véu — a parte acesa "brilha" no escuro. */
  lit: Phaser.GameObjects.Image;
  emissive: Phaser.GameObjects.Image;
  litFrames: number[];
  frameMs: number;
  offFrame: number;
  /** Tingimento de apagada (o lampião de dia fica escurecido); ausente = sem tingimento. */
  offTint?: number;
}

function ensureSpritesheet(scene: Phaser.Scene, key: string, path: string, frameWidth: number, frameHeight: number): void {
  if (!scene.textures.exists(key)) scene.load.spritesheet(key, encodeURI(`/${path}`), { frameWidth, frameHeight });
}

/** Carrega as artes de poste, tocha e brilho — chamado no `preload` da cena que usa `LightSourceSystem`. */
export function preloadLightSources(scene: Phaser.Scene): void {
  if (!scene.textures.exists(LAMP_POLE_KEY)) scene.load.image(LAMP_POLE_KEY, encodeURI(`/${LAMP_POLE_PATH}`));
  ensureSpritesheet(scene, LAMP_LANTERN_KEY, LAMP_LANTERN_PATH, LAMP_LANTERN_FRAME_SIZE, LAMP_LANTERN_FRAME_SIZE);
  ensureSpritesheet(scene, TORCH_KEY, TORCH_PATH, TORCH_FRAME_WIDTH, TORCH_FRAME_HEIGHT);
  if (!scene.textures.exists(GLOW_KEY)) scene.load.image(GLOW_KEY, encodeURI(`/${SHADOW_PATH}`));
}

/**
 * Fontes de luz do mapa (postes e tochas): cada uma é um sprite com dois estados — apagado (de dia) e aceso (à noite: chama/vidro
 * animados e um brilho quente por cima da escuridão). Ligam e desligam SOZINHAS pela hora do relógio (`lightIntensityAt`, janelas em
 * `data/lighting.ts`): acendem no anoitecer e apagam ao amanhecer, com uma rampa suave no brilho. A base de cada uma ocupa a célula
 * (`blockedCells` — a cena soma ao grid). Uma cena cria um sistema, `add`a as fontes (ou passa uma lista) e chama `update` a cada
 * quadro com a hora do dia.
 */
export class LightSourceSystem {
  private readonly sources: LightSource[] = [];
  private readonly tilePx = TILE_SIZE * DISPLAY_SCALE;

  constructor(
    private readonly scene: Phaser.Scene,
    placements: LightSourcePlacement[] = [],
  ) {
    const glowTexture = scene.textures.get(GLOW_KEY);
    glowTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const placement of placements) this.add(placement);
  }

  /** Coloca uma fonte de luz na célula (a base ocupa a célula: bloqueia a passagem — ver `blockedCells`). */
  add(placement: LightSourcePlacement): void {
    const { scene, tilePx } = this;
    const definition = LIGHT_SOURCES[placement.type];
    const x = placement.col * tilePx + tilePx / 2;
    const y = (placement.row + 1) * tilePx - 2;
    const phase = (placement.col * 7 + placement.row * 13) % 11;
    let lit: Phaser.GameObjects.Image;
    let extras: Pick<LightSource, 'litFrames' | 'frameMs' | 'offFrame' | 'offTint'>;

    createGroundShadow(scene, x, y - 3, DISPLAY_SCALE * 0.75, DISPLAY_SCALE * 0.3).setDepth(-0.4);

    if (placement.type === 'lampPost') {
      registerFrame(scene, LAMP_POLE_KEY, LAMP_POLE_FRAME);
      const pole = scene.add.image(x, y, LAMP_POLE_KEY, LAMP_POLE_FRAME.name);
      pole.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y);
      lit = scene.add.image(x, y + LAMP_LANTERN_BOTTOM_Y * DISPLAY_SCALE, LAMP_LANTERN_KEY, 0).setOrigin(0.5, 1).setDepth(y + 0.1);
      extras = { litFrames: LAMP_LIT_FRAMES, frameMs: LAMP_FRAME_MS, offFrame: 0, offTint: LAMP_OFF_TINT };
    } else {
      lit = scene.add.image(x, y, TORCH_KEY, TORCH_OFF_FRAME).setOrigin(0.5, TORCH_ORIGIN_Y).setDepth(y);
      extras = { litFrames: TORCH_LIT_FRAMES, frameMs: TORCH_FRAME_MS, offFrame: TORCH_OFF_FRAME };
    }
    lit.setScale(DISPLAY_SCALE);
    // Cópia em ADD acima do véu: só aparece acesa, e faz o vidro/a chama brilharem no escuro (o original fica escurecido pela luz ambiente).
    const emissive = scene.add.image(lit.x, lit.y, lit.texture.key, lit.frame.name);
    emissive.setOrigin(lit.originX, lit.originY).setScale(DISPLAY_SCALE).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_GLOW_DEPTH).setVisible(false);
    const source: LightSource = { col: placement.col, row: placement.row, definition, phase, glow: [], glowScales: [], lit, emissive, ...extras };

    const glowTexture = scene.textures.get(GLOW_KEY);
    if (!glowTexture.has(SHADOW_FRAME_NAME)) glowTexture.add(SHADOW_FRAME_NAME, 0, SHADOW_FRAME.x, SHADOW_FRAME.y, SHADOW_FRAME.width, SHADOW_FRAME.height);
    const radiusPx = definition.glowRadiusCells * tilePx;
    for (const [radiusFraction] of GLOW_RINGS) {
      const glow = scene.add.image(x, y + definition.glowOffsetY * DISPLAY_SCALE, GLOW_KEY, SHADOW_FRAME_NAME);
      const baseScale = (radiusPx * 2 * radiusFraction) / SHADOW_FRAME.width;
      glow.setScale(baseScale);
      source.glowScales.push(baseScale);
      glow.setTint(definition.glowColor).setTintMode(Phaser.TintModes.FILL).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_GLOW_DEPTH).setVisible(false);
      source.glow.push(glow);
    }

    this.sources.push(source);
  }

  /** Células ocupadas pela base das fontes de luz (a cena as soma ao grid de colisão). */
  blockedCells(): Array<[number, number]> {
    return this.sources.map((source) => [source.col, source.row]);
  }

  /** Atualiza estado (aceso/apagado), animação e brilho de todas as fontes: `hours` = `GameClock.getHours()`, `timeMs` = tempo da cena. */
  update(hours: number, timeMs: number): void {
    const intensity = lightIntensityAt(hours);
    const on = intensity > OFF_EPSILON;

    for (const source of this.sources) {
      const { definition, phase } = source;
      // Chama que dança: duas ondas fora de fase (uma lenta, uma rápida) — fica irregular sem parecer aleatório demais.
      const wave = 0.5 * Math.sin(timeMs / 210 + phase) + 0.5 * Math.sin(timeMs / 97 + phase * 2.3);
      const flicker = 1 - definition.flicker * (0.5 + 0.5 * wave);
      // Respiração lenta: 0 (luz no mínimo) a 1 (no máximo), uma onda só, bem devagar.
      const breath = 0.5 + 0.5 * Math.sin((timeMs / definition.breatheMs) * Math.PI * 2 + phase);
      const breatheAlpha = 1 - definition.breatheAlpha * (1 - breath);
      const breatheScale = 1 - definition.breatheScale * (1 - breath);

      const frame = on ? source.litFrames[Math.floor(timeMs / source.frameMs + phase) % source.litFrames.length] : source.offFrame;
      source.lit.setFrame(frame);
      if (source.offTint !== undefined) {
        if (on) source.lit.clearTint();
        else source.lit.setTint(source.offTint);
      }
      source.emissive.setFrame(frame).setVisible(on).setAlpha(EMISSIVE_ALPHA * intensity * flicker * (0.75 + 0.25 * breatheAlpha));

      source.glow.forEach((glow, index) => {
        glow.setVisible(on);
        glow.setAlpha(definition.glowAlpha * GLOW_RINGS[index][1] * intensity * flicker * breatheAlpha);
        glow.setScale(source.glowScales[index] * breatheScale);
      });
    }
  }
}
