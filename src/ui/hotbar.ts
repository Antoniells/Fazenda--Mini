import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import { Inventory, HOTBAR_SIZE } from '../systems/inventory';
import { resolveSlotVisual } from '../data/items';
import { WATERING_CAN_TOOL } from '../data/tools';
import { INVENTORY_UI_KEY, HOTBAR_BAR_FRAME_NAME, HOTBAR_BAR_RECT, HOTBAR_BAR_SLOT_PITCH } from '../data/ui';
import { computeFitScale } from './slotIcon';
import { Tooltip } from './tooltip';

const BAR_SCALE = 2.0;
/** Fração da célula (16px nativos) que um ícone "normal" (16x16) preenche. */
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * BAR_SCALE * ICON_FILL_RATIO;
const SELECTED_ICON_FACTOR = 1.3;
const UNSELECTED_ICON_FACTOR = 0.9;
const MARGIN_BOTTOM = 40;
/** Alfa do fundo da barra (1 = opaco): leve transparência pra a barra não pesar sobre o mundo. Só a imagem de fundo — ícones e contadores seguem opacos. */
const BAR_ALPHA = 0.8;

/**
 * Centro horizontal e TOPO (px de tela) da barra — pra quem precisa mostrar algo "em cima da Hotbar" sem depender de uma
 * instância (ex.: o aviso de Regador Vazio, `systems/farmlandInteraction.ts`, que roda antes/fora da `UIScene` dona da Hotbar).
 * Mesmas constantes/contas do construtor abaixo — fonte única.
 */
export function hotbarTopCenter(scene: Phaser.Scene): { x: number; y: number } {
  const barHeight = HOTBAR_BAR_RECT.height * BAR_SCALE;
  return { x: scene.scale.width / 2, y: scene.scale.height - MARGIN_BOTTOM - barHeight };
}

interface HotbarSlotView {
  icon: Phaser.GameObjects.Image;
  countText: Phaser.GameObjects.Text;
  baseY: number;
  /** Escala "normal" (não selecionada/não destacada) que encaixa o ícone atual na célula — recalculada a cada `refresh` a partir do frame real (ver `computeFitScale`), já que ícones de origens diferentes (ferramenta, semente, decoração) têm tamanhos nativos bem diferentes. */
  baseScale: number;
  /** Nome do item no slot (balão do `Tooltip`); `''` = vazio. Atualizado a cada `refresh`. */
  name: string;
  /** Textura+frame que o ícone mostra agora — quando muda (item novo no slot), a escala é refeita (ver `refresh`). */
  visualKey: string;
}

/**
 * Hotbar (Fase 8): substitui a `SeedBar` — 8 slots sempre visíveis na parte
 * de baixo da tela, mostrando o que estiver em `Inventory.getSlot(0..7)`
 * (ferramentas, sementes ou decorações, ver `data/items.ts`), não só
 * sementes.
 *
 * O fundo é a barra pronta de 8 compartimentos de `Slots.png`
 * (`HOTBAR_BAR_FRAME_NAME`) — uma única imagem, não 8 molduras ladrilhadas
 * — pedido explícito do usuário. Por ser uma imagem só, o destaque do slot
 * selecionado (escala/altura/brilho) é aplicado apenas ao ÍCONE de cada
 * slot, nunca ao fundo.
 *
 * Puramente visual e de clique: quem decide o que está em cada slot e qual
 * está selecionado é sempre `Inventory`; esta classe só lê (`refresh`) e
 * pede pra trocar a seleção (`onSelect`), nunca decide sozinha.
 */
export class Hotbar {
  private readonly slots: HotbarSlotView[] = [];
  private readonly scene: Phaser.Scene;
  private lastSelected = -1;
  /** Slot sob o ponteiro (balão do `Tooltip` com o nome do item), `null` = nenhum. */
  private hoveredIndex: number | null = null;
  private readonly tooltip: Tooltip;

  constructor(scene: Phaser.Scene, onSelect: (index: number) => void, tooltip: Tooltip) {
    this.scene = scene;
    this.tooltip = tooltip;

    const texture = scene.textures.get(INVENTORY_UI_KEY);
    if (!texture.has(HOTBAR_BAR_FRAME_NAME)) {
      texture.add(
        HOTBAR_BAR_FRAME_NAME,
        0,
        HOTBAR_BAR_RECT.x,
        HOTBAR_BAR_RECT.y,
        HOTBAR_BAR_RECT.width,
        HOTBAR_BAR_RECT.height,
      );
    }

    const barHeight = HOTBAR_BAR_RECT.height * BAR_SCALE;
    const centerX = scene.scale.width / 2;
    const baseY = scene.scale.height - MARGIN_BOTTOM - barHeight / 2;
    const pitch = HOTBAR_BAR_SLOT_PITCH * BAR_SCALE;

    const bar = scene.add.image(centerX, baseY, INVENTORY_UI_KEY, HOTBAR_BAR_FRAME_NAME);
    bar.setOrigin(0.5, 0.5);
    bar.setScale(BAR_SCALE);
    bar.setAlpha(BAR_ALPHA);
    bar.setScrollFactor(0);
    bar.setDepth(1000);

    for (let index = 0; index < HOTBAR_SIZE; index++) {
      const x = centerX + (index - (HOTBAR_SIZE - 1) / 2) * pitch;

      // Zona invisível do tamanho de uma célula: como o fundo é uma imagem
      // única, não há uma moldura por slot pra tornar interativa.
      const hitZone = scene.add.zone(x, baseY, pitch, barHeight);
      hitZone.setScrollFactor(0);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        playClick(scene);
        onSelect(index);
      });
      hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        this.hoveredIndex = index;
        this.updateTooltip(pointer);
      });
      hitZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (this.tooltip.isVisible()) this.tooltip.follow(pointer);
      });
      hitZone.on('pointerout', () => {
        if (this.hoveredIndex === index) this.hoveredIndex = null;
        this.tooltip.hide();
      });

      const icon = scene.add.image(x, baseY, INVENTORY_UI_KEY, HOTBAR_BAR_FRAME_NAME);
      icon.setOrigin(0.5, 0.5);
      icon.setScale(0);
      icon.setScrollFactor(0);
      icon.setDepth(1001);
      icon.setVisible(false);

      const countText = scene.add.text(x + pitch / 2 - 2, baseY + barHeight / 2 - 2, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#2b1d0e',
        strokeThickness: 3,
      });
      countText.setOrigin(1, 1);
      countText.setScrollFactor(0);
      countText.setDepth(1002);

      this.slots.push({ icon, countText, baseY, baseScale: ICON_FILL_RATIO, name: '', visualKey: '' });
    }
  }

  /**
   * Atualiza os 8 slots a partir do `Inventory`: ícone/nome (via
   * `resolveSlotVisual`), quantidade (sementes/decorações — ferramentas não
   * mostram número) e o destaque do slot selecionado. Chamado a cada frame
   * por `MainScene`, como a `CoinBar`; cada peça só redesenha quando o
   * valor relevante muda de fato.
   */
  refresh(inventory: Inventory): void {
    const selectedIndex = inventory.getSelectedHotbarIndex();

    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      const ref = inventory.getSlot(index);
      const visual = ref ? resolveSlotVisual(ref) : null;
      slot.name = visual?.name ?? '';

      if (visual) {
        slot.icon.setTexture(visual.textureKey, visual.iconFrame);
        slot.icon.setVisible(true);
        // Recalculado a cada frame a partir do frame real: ferramentas/
        // sementes (16x16) e decorações (tamanhos variados, ex. o Poço a
        // 28x38) precisam de escalas bem diferentes pra caber na mesma célula.
        slot.baseScale = computeFitScale(slot.icon, ICON_TARGET_PX);

        // Item NOVO num slot que já mostrava outro (ex.: o aspersor comprado num slot que tinha uma ferramenta de 16px): o ícone
        // guardava a escala do item anterior — enorme pra um frame maior. Refaz a escala pelo tamanho real e reaplica o destaque.
        const visualKey = `${visual.textureKey}#${visual.iconFrame}`;
        if (slot.visualKey !== visualKey) {
          const alreadyShown = slot.icon.scale !== 0; // Na entrada inicial (escala 0) quem cuida é o pop-in; um slot vazio já "estourado" guarda a escala de um ícone padrão.
          slot.visualKey = visualKey;
          if (alreadyShown) {
            this.scene.tweens.killTweensOf(slot.icon);
            slot.icon.setScale(slot.baseScale * (index === selectedIndex ? SELECTED_ICON_FACTOR : UNSELECTED_ICON_FACTOR));
            this.lastSelected = -1; // Força o destaque (alpha/posição) a ser reaplicado no fim do `refresh`.
          }
        }

        if (ref!.category === 'seed') {
          slot.countText.setText(String(inventory.getSeedCount(ref!.id)));
        } else if (ref!.category === 'decoration') {
          slot.countText.setText(String(inventory.getDecorationCount(ref!.id)));
        } else if (ref!.category === 'resource') {
          // Fase 7 — Coleta de Recursos (madeira/pedra/bolota).
          slot.countText.setText(String(inventory.getResourceCount(ref!.id)));
        } else if (ref!.category === 'crop') {
          // Bug corrigido (item 3): fruto colhido, estoque atual (não o total histórico da aba Descobertas).
          slot.countText.setText(String(inventory.getCount(ref!.id)));
        } else if (ref!.category === 'tool' && ref!.id === WATERING_CAN_TOOL.id) {
          // Regador: não tem "quantidade" (é uma ferramenta permanente),
          // mas mostra as cargas de água restantes — pedido explícito pra
          // substituir a antiga `WaterBar` separada (removida).
          slot.countText.setText(String(inventory.getWateringCanCharges()));
        } else {
          slot.countText.setText(''); // Outra ferramenta: não tem quantidade nem contador.
        }
      } else {
        slot.icon.setVisible(false);
        slot.countText.setText('');
        slot.visualKey = '';
      }

      // Garante que o ícone tenha "estourado" ao entrar mesmo se o
      // conteúdo do slot só apareceu depois da entrada inicial (ex.:
      // comprar algo novo) — sem isso ficaria preso em escala 0.
      if (visual && slot.icon.scale === 0 && !this.scene.tweens.isTweening(slot.icon)) {
        const isSelected = index === selectedIndex;
        slot.icon.setScale(slot.baseScale * (isSelected ? SELECTED_ICON_FACTOR : UNSELECTED_ICON_FACTOR));
      }
    }

    // O slot sob o mouse pode ter mudado de conteúdo (compra, troca de slot) sem o mouse se mexer.
    if (this.hoveredIndex !== null) this.updateTooltip(this.scene.input.activePointer);

    if (selectedIndex === this.lastSelected) return;
    this.lastSelected = selectedIndex;
    this.applyHighlight(selectedIndex);
  }

  /** Mostra o nome do item do slot sob o ponteiro; slot vazio não mostra balão. */
  private updateTooltip(pointer: Phaser.Input.Pointer): void {
    const name = this.hoveredIndex !== null ? this.slots[this.hoveredIndex].name : '';
    if (name) this.tooltip.show(name, pointer);
    else this.tooltip.hide();
  }

  private applyHighlight(selectedIndex: number): void {
    this.slots.forEach((slot, index) => {
      const isSelected = index === selectedIndex;

      const targetScale = slot.baseScale * (isSelected ? SELECTED_ICON_FACTOR : UNSELECTED_ICON_FACTOR);
      const targetAlpha = isSelected ? 1 : 0.5;
      const targetY = isSelected ? slot.baseY - 8 : slot.baseY;

      this.scene.tweens.killTweensOf(slot.icon);

      this.scene.tweens.add({
        targets: slot.icon,
        scale: targetScale,
        alpha: targetAlpha,
        y: targetY,
        duration: isSelected ? 250 : 150,
        ease: isSelected ? 'Back.easeOut' : 'Power2',
      });
    });
  }
}
