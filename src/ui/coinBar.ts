import Phaser from 'phaser';
import {
  COIN_ICON_KEY,
  COIN_SPIN_ANIM_KEY,
  COIN_SPIN_FRAMES,
} from '../data/ui';

const SCALE = 2;
const MARGIN_TOP = 16;
const MARGIN_RIGHT = 16;
const HUD_HEIGHT = 44;
const HUD_MIN_WIDTH = 110;

export class CoinBar {
  private readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly coin: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private lastCoins: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Cria a animação de girar a moeda se ainda não existir
    if (!scene.anims.exists(COIN_SPIN_ANIM_KEY)) {
      scene.anims.create({
        key: COIN_SPIN_ANIM_KEY,
        frames: scene.anims.generateFrameNumbers(COIN_ICON_KEY, COIN_SPIN_FRAMES),
        frameRate: 8,
        repeat: -1,
      });
    }

    const screenW = scene.scale.width;
    const rightX = screenW - MARGIN_RIGHT;
    const topY = MARGIN_TOP;

    // Fundo escuro e limpo (opacidade 50%) para dar contraste
    this.bg = scene.add.rectangle(rightX, topY, HUD_MIN_WIDTH, HUD_HEIGHT, 0x000000, 0.5);
    this.bg.setOrigin(1, 0); // Origem no topo-direita
    this.bg.setScrollFactor(0);
    this.bg.setDepth(1000);

    // Moeda girando alinhada à direita dentro do fundo
    this.coin = scene.add.sprite(rightX - 22, topY + HUD_HEIGHT / 2, COIN_ICON_KEY, 0);
    this.coin.setOrigin(0.5, 0.5);
    this.coin.setScale(SCALE);
    this.coin.setScrollFactor(0);
    this.coin.setDepth(1001);
    this.coin.play(COIN_SPIN_ANIM_KEY);

    // Texto do saldo: Fonte retrô, cor de ouro, borda marrom e sombra preta
    this.text = scene.add.text(this.coin.x - 24, this.coin.y, '0', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffdf70',
      stroke: '#4a2e15',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
    });
    this.text.setOrigin(1, 0.5);
    this.text.setScrollFactor(0);
    this.text.setDepth(1001);

    this.playEntrance();
  }

  /** Entrada elástica do HUD inteiro ao carregar a cena (Fase 9 antecipada — polimento). */
  private playEntrance(): void {
    this.bg.setScale(0);
    this.coin.setScale(0);
    this.text.setScale(0);

    const entranceTween = { duration: 320, ease: 'Back.easeOut' as const };
    this.scene.tweens.add({ targets: this.bg, scale: 1, ...entranceTween });
    this.scene.tweens.add({ targets: this.coin, scale: SCALE, ...entranceTween });
    this.scene.tweens.add({ targets: this.text, scale: 1, ...entranceTween });
  }

  /** Atualiza o saldo e aplica um efeito visual se o dinheiro aumentar. */
  refresh(coins: number): void {
    if (coins === this.lastCoins) return;
    
    // Verifica se o jogador ganhou dinheiro para tocar o efeito
    const isIncrease = this.lastCoins !== null && coins > this.lastCoins;
    this.lastCoins = coins;
    
    this.text.setText(String(coins));

    // Ajusta a largura do fundo dinamicamente se o jogador ficar muito rico
    const textWidth = this.text.width;
    this.bg.width = Math.max(HUD_MIN_WIDTH, textWidth + 64);

    if (isIncrease) {
      // Game Feel: A moeda dá uma leve "inchada" quando recebemos dinheiro
      this.scene.tweens.killTweensOf(this.coin);
      this.coin.setScale(SCALE); // Garante que partimos do tamanho original
      
      this.scene.tweens.add({
        targets: this.coin,
        scale: SCALE * 1.4,
        duration: 120,
        yoyo: true, // Volta ao tamanho original sozinho
        ease: 'Sine.easeInOut'
      });
    }
  }
}