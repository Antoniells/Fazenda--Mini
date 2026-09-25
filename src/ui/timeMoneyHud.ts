import Phaser from 'phaser';
import {
  CLOCK_MONEY_HUD_KEY,
  CLOCK_PLAQUE_FRAME_NAME,
  CLOCK_PLAQUE_RECT,
  CLOCK_PLAQUE_TOP_INSET,
  CLOCK_PLAQUE_BOTTOM_INSET,
  COIN_PLAQUE_FRAME_NAME,
  COIN_PLAQUE_RECT,
  COIN_PLAQUE_DIGIT_COUNT,
  COIN_PLAQUE_DIGIT_FIRST_CENTER_X,
  COIN_PLAQUE_DIGIT_PITCH,
  COIN_PLAQUE_DIGIT_CENTER_Y,
} from '../data/ui';

const SCALE = 2.6;
const MARGIN_TOP = 20;
const MARGIN_RIGHT = 20;
/** Espaço entre as duas placas empilhadas — pequeno o bastante pra lerem como uma peça só. */
const PLAQUE_GAP = 2;

/** Mesma fonte/estilo retrô (negrito + contorno) já usado na antiga CoinBar/ClockBar — pedido explícito pra manter a identidade visual. */
const TEXT_FONT = '"Courier New", Courier, monospace';
const TEXT_COLOR = '#ffe9b3';
const TEXT_STROKE = '#2b1d0e';

/**
 * HUD combinado de Relógio + Dinheiro, canto superior direito (substitui a
 * antiga `ClockBar` — que ficava no canto oposto — e a antiga `CoinBar`,
 * com seu retângulo preto e moeda giratória). Duas "placas de madeira"
 * empilhadas, ambas recortadas de `UI/Clock/Extras.png`:
 *
 * - Placa de cima: dia ("DIA N") na janelinha de cima, hora ("HH:MM") na de
 *   baixo — texto sobreposto às duas janelinhas creme já desenhadas na arte.
 * - Placa de baixo: pilha de moedas (arte pronta) + o saldo escrito um
 *   dígito por "janelinha", alinhado à direita — exatamente o layout que o
 *   asset já propõe (7 janelinhas; sobrando à esquerda ficam em branco).
 *
 * Puramente visual: `refreshTime`/`refreshCoins` só espelham o que
 * `GameClock`/`Inventory` já calculam, nunca decidem nada sozinhas.
 */
export class TimeMoneyHud {
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly digitTexts: Phaser.GameObjects.Text[] = [];
  private readonly scene: Phaser.Scene;
  private lastDayLabel: string | null = null;
  private lastTimeLabel: string | null = null;
  private lastCoins: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const texture = scene.textures.get(CLOCK_MONEY_HUD_KEY);
    if (!texture.has(CLOCK_PLAQUE_FRAME_NAME)) {
      texture.add(
        CLOCK_PLAQUE_FRAME_NAME,
        0,
        CLOCK_PLAQUE_RECT.x,
        CLOCK_PLAQUE_RECT.y,
        CLOCK_PLAQUE_RECT.width,
        CLOCK_PLAQUE_RECT.height,
      );
    }
    if (!texture.has(COIN_PLAQUE_FRAME_NAME)) {
      texture.add(
        COIN_PLAQUE_FRAME_NAME,
        0,
        COIN_PLAQUE_RECT.x,
        COIN_PLAQUE_RECT.y,
        COIN_PLAQUE_RECT.width,
        COIN_PLAQUE_RECT.height,
      );
    }

    const rightX = scene.scale.width - MARGIN_RIGHT;
    const clockTopY = MARGIN_TOP;
    const clockHeight = CLOCK_PLAQUE_RECT.height * SCALE;
    const coinTopY = clockTopY + clockHeight + PLAQUE_GAP;

    const clockPlaque = scene.add.image(rightX, clockTopY, CLOCK_MONEY_HUD_KEY, CLOCK_PLAQUE_FRAME_NAME);
    clockPlaque.setOrigin(1, 0);
    clockPlaque.setScale(SCALE);
    clockPlaque.setScrollFactor(0);
    clockPlaque.setDepth(1000);

    const coinPlaque = scene.add.image(rightX, coinTopY, CLOCK_MONEY_HUD_KEY, COIN_PLAQUE_FRAME_NAME);
    coinPlaque.setOrigin(1, 0);
    coinPlaque.setScale(SCALE);
    coinPlaque.setScrollFactor(0);
    coinPlaque.setDepth(1000);

    const clockLeft = rightX - CLOCK_PLAQUE_RECT.width * SCALE;
    const coinLeft = rightX - COIN_PLAQUE_RECT.width * SCALE;

    const insetCenter = (inset: typeof CLOCK_PLAQUE_TOP_INSET): { x: number; y: number } => ({
      x: clockLeft + (inset.x + inset.width / 2) * SCALE,
      y: clockTopY + (inset.y + inset.height / 2) * SCALE,
    });

    const dayCenter = insetCenter(CLOCK_PLAQUE_TOP_INSET);
    const timeCenter = insetCenter(CLOCK_PLAQUE_BOTTOM_INSET);

    this.dayText = scene.add.text(dayCenter.x, dayCenter.y, '', {
      fontFamily: TEXT_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
    });
    this.dayText.setOrigin(0.5, 0.5);
    this.dayText.setScrollFactor(0);
    this.dayText.setDepth(1001);

    this.timeText = scene.add.text(timeCenter.x, timeCenter.y, '', {
      fontFamily: TEXT_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
    });
    this.timeText.setOrigin(0.5, 0.5);
    this.timeText.setScrollFactor(0);
    this.timeText.setDepth(1001);

    for (let index = 0; index < COIN_PLAQUE_DIGIT_COUNT; index++) {
      const x = coinLeft + (COIN_PLAQUE_DIGIT_FIRST_CENTER_X + index * COIN_PLAQUE_DIGIT_PITCH) * SCALE;
      const y = coinTopY + COIN_PLAQUE_DIGIT_CENTER_Y * SCALE;

      const digitText = scene.add.text(x, y, '', {
        fontFamily: TEXT_FONT,
        fontSize: '10px',
        fontStyle: 'bold',
        color: TEXT_COLOR,
        stroke: TEXT_STROKE,
        strokeThickness: 2,
      });
      digitText.setOrigin(0.5, 0.5);
      digitText.setScrollFactor(0);
      digitText.setDepth(1001);
      this.digitTexts.push(digitText);
    }

    this.playEntrance([clockPlaque, coinPlaque], SCALE);
    this.playEntrance([this.dayText, this.timeText, ...this.digitTexts], 1);
  }

  /** Entrada elástica do HUD, mesma técnica já usada nos outros HUDs (Pit Stop de Polimento). */
  private playEntrance(targets: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>, finalScale: number): void {
    for (const target of targets) target.setScale(0);
    this.scene.tweens.add({
      targets,
      scale: finalScale,
      duration: 320,
      ease: 'Back.easeOut',
    });
  }

  /** Atualiza dia + hora ("DIA N" / "HH:MM"); só redesenha o texto que mudou de fato. */
  refreshTime(day: number, timeString: string): void {
    const dayLabel = `DIA ${day}`;
    if (dayLabel !== this.lastDayLabel) {
      this.lastDayLabel = dayLabel;
      this.dayText.setText(dayLabel);
    }
    if (timeString !== this.lastTimeLabel) {
      this.lastTimeLabel = timeString;
      this.timeText.setText(timeString);
    }
  }

  /** Atualiza o saldo, um dígito por janelinha (alinhado à direita — janelinhas sobrando à esquerda ficam em branco). */
  refreshCoins(coins: number): void {
    if (coins === this.lastCoins) return;
    const gained = this.lastCoins !== null && coins > this.lastCoins;
    this.lastCoins = coins;

    const digits = String(coins).split('');
    const slotCount = this.digitTexts.length;
    const visibleDigits = digits.slice(Math.max(0, digits.length - slotCount));
    const startIndex = slotCount - visibleDigits.length;

    for (let index = 0; index < slotCount; index++) {
      this.digitTexts[index].setText(index >= startIndex ? visibleDigits[index - startIndex] : '');
    }

    // Ganhou moedas: os dígitos dão um pulinho dourado (Stardew/Terraria — o dinheiro "brilha" ao entrar).
    if (gained) {
      for (const digit of this.digitTexts) {
        this.scene.tweens.killTweensOf(digit);
        digit.setScale(1.5);
        this.scene.tweens.add({ targets: digit, scale: 1, duration: 260, ease: 'Back.easeOut' });
      }
    }
  }
}
