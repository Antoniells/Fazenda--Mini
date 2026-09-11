import Phaser from 'phaser';
import { CropDefinition } from '../data/crops';
import { INVENTORY_UI_KEY, SLOT_FRAME_NAME, SLOT_FRAME_RECT } from '../data/ui';

// Parâmetros ajustados para um visual mais limpo e "juicy"
const SLOT_SCALE = 1.8; // Um pouco maior para melhor visibilidade
const SLOT_GAP = 5; // Mais respiro entre os slots
const MARGIN_BOTTOM = 24; // Descola mais do fundo da tela

interface Slot {
  cropId: string;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  stockText: Phaser.GameObjects.Text;
  baseY: number; // Guardamos o Y original para a animação de pulo
}

export class SeedBar {
  private readonly slots: Slot[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, crops: CropDefinition[], onSelect: (cropId: string) => void) {
    this.scene = scene;

    const texture = scene.textures.get(INVENTORY_UI_KEY);
    if (!texture.has(SLOT_FRAME_NAME)) {
      texture.add(
        SLOT_FRAME_NAME,
        0,
        SLOT_FRAME_RECT.x,
        SLOT_FRAME_RECT.y,
        SLOT_FRAME_RECT.width,
        SLOT_FRAME_RECT.height,
      );
    }

    const slotWidth = SLOT_FRAME_RECT.width * SLOT_SCALE;
    const slotHeight = SLOT_FRAME_RECT.height * SLOT_SCALE;

    // Calcula a largura total para centralizar a barra perfeitamente no meio da tela (estilo Stardew Valley)
    const totalWidth = crops.length * slotWidth + (crops.length - 1) * SLOT_GAP;
    const startX = (scene.scale.width - totalWidth) / 2 + slotWidth / 2;
    const baseY = scene.scale.height - MARGIN_BOTTOM - slotHeight / 2;

    crops.forEach((crop, index) => {
      const x = startX + index * (slotWidth + SLOT_GAP);

      // Usando setOrigin(0.5) para que o scale e as animações cresçam a partir do centro
      const frame = scene.add.image(x, baseY, INVENTORY_UI_KEY, SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5);
      frame.setScale(0); // Começa em 0 pra "estourar" ao entrar (ver tween logo abaixo)
      frame.setScrollFactor(0);
      frame.setDepth(1000);

      // Entrada elástica, com um pequeno atraso escalonado por slot — dá a
      // sensação da barra "nascendo" em sequência, não tudo de uma vez.
      scene.tweens.add({
        targets: frame,
        scale: SLOT_SCALE,
        delay: index * 60,
        duration: 320,
        ease: 'Back.easeOut',
      });

      // Clicável: seleciona a semente do slot. `event.stopPropagation()` impede
      // que o mesmo clique também chegue ao listener global do PlayerController
      // (que trataria o clique como "mover até aqui"/"interagir com o terreno").
      frame.setInteractive({ useHandCursor: true });
      frame.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onSelect(crop.id);
      });

      const icon = scene.add.image(x, baseY, crop.textureKey, crop.iconFrame);
      icon.setOrigin(0.5, 0.5);
      icon.setScale(0); // Idem: começa em 0, o primeiro refresh() (chamado logo após o construtor) já anima até o tamanho certo.
      icon.setScrollFactor(0);
      icon.setDepth(1001);

      // Quantas sementes dessa cultura o jogador tem — sem isso não haveria
      // como perceber por que plantar parou de funcionar ao esgotar o estoque.
      const stockText = scene.add.text(x + slotWidth / 2 - 2, baseY + slotHeight / 2 - 2, '0', {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#2b1d0e',
        strokeThickness: 3,
      });
      stockText.setOrigin(1, 1);
      stockText.setScrollFactor(0);
      stockText.setDepth(1002);

      this.slots.push({ cropId: crop.id, frame, icon, stockText, baseY });
    });
  }

  /** Atualiza só o número de sementes em estoque de cada slot (chamado sempre que o estoque pode ter mudado — comprar ou plantar). */
  refreshStock(getStock: (cropId: string) => number): void {
    for (const slot of this.slots) {
      slot.stockText.setText(String(getStock(slot.cropId)));
    }
  }

  /** Atualiza o destaque visual com animações suaves e elásticas. */
  refresh(selectedCropId: string): void {
    for (const slot of this.slots) {
      const isSelected = slot.cropId === selectedCropId;

      // Contraste: Escurece e deixa transparente se não estiver selecionada
      slot.frame.setTint(isSelected ? 0xffffff : 0x777777);
      slot.frame.setAlpha(isSelected ? 1 : 0.8);

      const targetScale = isSelected ? SLOT_SCALE * 1.3 : SLOT_SCALE * 0.9;
      const targetAlpha = isSelected ? 1 : 0.5;
      const targetY = isSelected ? slot.baseY - 12 : slot.baseY; // O slot selecionado levanta um pouco

      // Cancela animações anteriores para evitar conflitos se o jogador trocar muito rápido
      this.scene.tweens.killTweensOf(slot.icon);
      this.scene.tweens.killTweensOf(slot.frame);

      // Anima a caixa (frame) subindo ou descendo
      this.scene.tweens.add({
        targets: slot.frame,
        y: targetY,
        duration: 150,
        ease: 'Power2'
      });

      if (isSelected) {
        // Animação "Juicy" (com bounce/elástico) para o ícone selecionado
        this.scene.tweens.add({
          targets: slot.icon,
          scale: targetScale,
          alpha: targetAlpha,
          y: targetY,
          duration: 250,
          ease: 'Back.easeOut', 
        });
      } else {
        // Retorno suave quando perde a seleção
        this.scene.tweens.add({
          targets: slot.icon,
          scale: targetScale,
          alpha: targetAlpha,
          y: targetY,
          duration: 150,
          ease: 'Power2',
        });
      }
    }
  }
}