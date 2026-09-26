import Phaser from 'phaser';
import { gameState } from '../systems/gameState';
import { SKILLS, type SkillDefinition, type SkillIcon, type SkillId } from '../data/skills';
import { getNextSkillCost, getSkillMaxRank, getSkillRank, purchaseSkill } from '../systems/skills';
import { playClick, playEffect } from '../systems/soundEffects';
import { SPEND_MONEY_SOUND } from '../data/audio';
import { popText } from '../systems/floatingText';
import {
  EXTRAS_UI_KEY,
  GLOBAL_CURSOR_CORNER_NAMES,
  INVENTORY_LARGE_PANEL_BORDER,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_PANEL_BORDER,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';

type CornerKey = keyof typeof GLOBAL_CURSOR_CORNER_NAMES;

/** Onde as duas páginas do Livro ficam na tela (px) — calculado pelo `InventoryScreen`, que é dono do Livro. */
export interface SkillPanelLayout {
  leftX: number;
  leftWidth: number;
  rightX: number;
  rightWidth: number;
  top: number;
  height: number;
}

const DEPTH = 3001;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#6b5a4a';
const TEXT_GOOD = '#2f6f2f';
const TEXT_WARN = '#8a4a1f';

const ROW_HEIGHT = 40;
const ROW_SLOT_SCALE = 1.7;
const ROW_ICON_PX = 22;
const ROW_PADDING_X = 8;
const HEADER_HEIGHT = 50;

const DETAIL_ICON_PANEL = 64;
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 26;
const BUTTON_ENABLED_TINT = 0xffffff;
const BUTTON_DISABLED_TINT = 0x8f8f8f;
const SELECTOR_SCALE = 1.2;

interface SkillRow {
  skill: SkillDefinition;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  rank: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  centerY: number;
}

/** Registra o quadro do ícone (uma folha existente, recortada) uma vez só. */
function ensureIconFrame(scene: Phaser.Scene, icon: SkillIcon): void {
  const texture = scene.textures.get(icon.key);
  if (!texture.has(icon.frame.name)) {
    const { x, y, width, height } = icon.frame.rect;
    texture.add(icon.frame.name, 0, x, y, width, height);
  }
}

/**
 * Página da aba "Habilidades" do Inventário (Progressão e RPG): à esquerda o XP e a lista de nós (uma linha por habilidade, com o nível
 * comprado); à direita o detalhe da habilidade escolhida — descrição, bônus atual e do próximo nível, custo em XP e o botão de comprar.
 * Comprar desconta o XP (`purchaseSkill`) e o bônus já vale no mesmo instante (cada sistema lê o valor atual: ver `systems/skills.ts`).
 *
 * Só desenha e lê; o `InventoryScreen` decide quando aparece (`setVisible`) e chama `refresh` a cada quadro enquanto aberta. Reaproveita a
 * moldura de slot, o painel ornamentado (NineSlice), os cantinhos de seleção e os ícones das folhas de `Icons/RPG icons` — nada desenhado
 * por código.
 */
export class SkillTreePanel {
  private readonly scene: Phaser.Scene;
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private readonly rows: SkillRow[] = [];
  private readonly rowSelector: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly totalText: Phaser.GameObjects.Text;

  private readonly detailPanel: Phaser.GameObjects.NineSlice;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailDescription: Phaser.GameObjects.Text;
  private readonly detailRank: Phaser.GameObjects.Text;
  private readonly detailCurrent: Phaser.GameObjects.Text;
  private readonly detailNext: Phaser.GameObjects.Text;
  private readonly detailNote: Phaser.GameObjects.Text;
  private readonly buyButton: Phaser.GameObjects.NineSlice;
  private readonly buyLabel: Phaser.GameObjects.Text;

  private selected: SkillId = SKILLS[0].id;
  private visible = false;
  /** Último texto de cada campo — só reescreve quando muda (o `refresh` roda todo quadro). */
  private readonly lastText = new Map<Phaser.GameObjects.Text, string>();

  constructor(scene: Phaser.Scene, layout: SkillPanelLayout) {
    this.scene = scene;

    // Quadros dos ícones (recortes das folhas carregadas pela `UIScene`) — idempotente. O painel, a moldura de slot e os cantinhos já vêm registrados pelo Inventário.
    for (const skill of SKILLS) ensureIconFrame(scene, skill.icon);

    const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.all.push(object);
      return object;
    };
    const text = (x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle, originX = 0.5, originY = 0.5): Phaser.GameObjects.Text => {
      const t = track(scene.add.text(x, y, '', { fontFamily: FONT, color: TEXT_INK, ...style }));
      t.setOrigin(originX, originY).setScrollFactor(0).setDepth(DEPTH + 1);
      return t;
    };

    // --- Página esquerda: título, XP e a lista de nós -----------------------------------------------------------------------
    const leftCenter = layout.leftX + layout.leftWidth / 2;
    this.titleText = text(leftCenter, layout.top + 14, { fontSize: '15px', fontStyle: 'bold' });
    this.titleText.setText('Habilidades');
    this.xpText = text(leftCenter, layout.top + 30, { fontSize: '12px', fontStyle: 'bold', color: TEXT_GOOD });
    this.totalText = text(leftCenter, layout.top + 43, { fontSize: '9px', color: TEXT_SOFT });

    const rowWidth = layout.leftWidth - ROW_PADDING_X * 2;
    SKILLS.forEach((skill, index) => {
      const centerY = layout.top + HEADER_HEIGHT + ROW_HEIGHT / 2 + index * ROW_HEIGHT;
      const frameX = layout.leftX + ROW_PADDING_X + (18 * ROW_SLOT_SCALE) / 2;

      const frame = track(scene.add.image(frameX, centerY, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME));
      frame.setScale(ROW_SLOT_SCALE).setScrollFactor(0).setDepth(DEPTH);

      const icon = track(scene.add.image(frameX, centerY, skill.icon.key, skill.icon.frame.name));
      icon.setScale(computeFitScale(icon, ROW_ICON_PX)).setScrollFactor(0).setDepth(DEPTH + 1);

      const textX = frameX + (18 * ROW_SLOT_SCALE) / 2 + 8;
      const name = text(textX, centerY - 8, { fontSize: '12px', fontStyle: 'bold' }, 0, 0.5);
      const rank = text(textX, centerY + 8, { fontSize: '10px', color: TEXT_SOFT }, 0, 0.5);

      const zone = track(scene.add.zone(layout.leftX + layout.leftWidth / 2, centerY, rowWidth, ROW_HEIGHT - 2));
      zone.setScrollFactor(0).setDepth(DEPTH + 3);
      zone.setInteractive({ useHandCursor: true });
      zone.disableInteractive();
      zone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        if (!this.visible) return;
        event.stopPropagation();
        if (this.selected !== skill.id) playClick(scene);
        this.selected = skill.id;
        this.refresh();
      });

      this.rows.push({ skill, frame, icon, name, rank, zone, centerY });
    });

    // Cantinhos de seleção ao redor da linha escolhida (mesmos do Inventário).
    const makeCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = track(scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]));
      corner.setOrigin(originX, originY).setScale(SELECTOR_SCALE).setScrollFactor(0).setDepth(DEPTH + 2);
      return corner;
    };
    this.rowSelector = {
      topLeft: makeCorner('topLeft', 0, 0),
      topRight: makeCorner('topRight', 1, 0),
      bottomLeft: makeCorner('bottomLeft', 0, 1),
      bottomRight: makeCorner('bottomRight', 1, 1),
    };

    // --- Página direita: detalhe da habilidade escolhida ----------------------------------------------------------------------
    const rightCenter = layout.rightX + layout.rightWidth / 2;
    const textWidth = layout.rightWidth - 16;

    this.detailPanel = track(
      scene.add.nineslice(
        rightCenter,
        layout.top + 8 + DETAIL_ICON_PANEL / 2,
        INVENTORY_LARGE_PANEL_KEY,
        INVENTORY_LARGE_PANEL_FRAME_NAME,
        DETAIL_ICON_PANEL,
        DETAIL_ICON_PANEL,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
      ),
    );
    this.detailPanel.setScrollFactor(0).setDepth(DEPTH);

    this.detailIcon = track(scene.add.image(rightCenter, layout.top + 8 + DETAIL_ICON_PANEL / 2, SKILLS[0].icon.key, SKILLS[0].icon.frame.name));
    this.detailIcon.setScrollFactor(0).setDepth(DEPTH + 1);

    let y = layout.top + 8 + DETAIL_ICON_PANEL + 14;
    this.detailName = text(rightCenter, y, { fontSize: '13px', fontStyle: 'bold' });
    y += 10;
    this.detailDescription = text(rightCenter, y, { fontSize: '10px', color: TEXT_SOFT, align: 'center', wordWrap: { width: textWidth } }, 0.5, 0);
    y += 44;
    this.detailRank = text(layout.rightX + 8, y, { fontSize: '10px', fontStyle: 'bold' }, 0, 0);
    y += 14;
    this.detailCurrent = text(layout.rightX + 8, y, { fontSize: '10px', wordWrap: { width: textWidth } }, 0, 0);
    y += 26;
    this.detailNext = text(layout.rightX + 8, y, { fontSize: '10px', color: TEXT_GOOD, wordWrap: { width: textWidth } }, 0, 0);
    y += 26;
    this.detailNote = text(layout.rightX + 8, y, { fontSize: '9px', color: TEXT_WARN, wordWrap: { width: textWidth } }, 0, 0);

    const buttonY = layout.top + layout.height - BUTTON_HEIGHT / 2 - 4;
    this.buyButton = track(
      scene.add.nineslice(
        rightCenter,
        buttonY,
        INVENTORY_PANEL_KEY,
        INVENTORY_PANEL_FRAME_NAME,
        BUTTON_WIDTH,
        BUTTON_HEIGHT,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
      ),
    );
    this.buyButton.setScrollFactor(0).setDepth(DEPTH);
    this.buyButton.setInteractive({ useHandCursor: true });
    this.buyButton.disableInteractive();
    this.buyButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      if (!this.visible) return;
      event.stopPropagation();
      this.buySelected();
    });
    this.buyLabel = text(rightCenter, buttonY, { fontSize: '12px', fontStyle: 'bold' });

    this.setVisible(false);
  }

  /** Mostra/esconde a página inteira (e liga/desliga os cliques dela). */
  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const object of this.all) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    for (const row of this.rows) {
      if (visible) row.zone.setInteractive();
      else row.zone.disableInteractive();
    }
    if (visible) this.buyButton.setInteractive();
    else this.buyButton.disableInteractive();
    if (visible) this.refresh();
  }

  private setText(label: Phaser.GameObjects.Text, value: string, color?: string): void {
    if (this.lastText.get(label) !== value) {
      label.setText(value);
      this.lastText.set(label, value);
    }
    if (color) label.setColor(color);
  }

  private selectedSkill(): SkillDefinition {
    return SKILLS.find((skill) => skill.id === this.selected) ?? SKILLS[0];
  }

  private buySelected(): void {
    const skill = this.selectedSkill();
    const result = purchaseSkill(skill.id);
    if (result !== 'bought') return;

    playEffect(this.scene, SPEND_MONEY_SOUND);
    this.scene.tweens.add({ targets: [this.buyButton, this.buyLabel], scale: 0.94, duration: 60, yoyo: true });
    popText(this.scene, this.buyButton.x, this.buyButton.y - 20, `${skill.name} Nv ${getSkillRank(skill.id)}!`, {
      color: '#9fe8ff',
      fontSize: 14,
      screenFixed: true,
      rise: 30,
    });
    this.refresh();
  }

  /** Reflete o estado atual (XP, níveis, seleção e botão) — chamado a cada quadro pelo Inventário enquanto a aba está aberta. */
  refresh(): void {
    if (!this.visible) return;
    const { xp, totalXp } = gameState.skills;
    this.setText(this.xpText, `XP disponível: ${xp}`);
    this.setText(this.totalText, `Total ganho: ${totalXp}`);

    for (const row of this.rows) {
      const rank = getSkillRank(row.skill.id);
      const max = getSkillMaxRank(row.skill.id);
      const cost = getNextSkillCost(row.skill.id);
      this.setText(row.name, row.skill.name);
      const rankText = cost === null ? `Nv ${rank}/${max} (máx.)` : `Nv ${rank}/${max}  •  ${cost} XP`;
      this.setText(row.rank, rankText, cost !== null && xp >= cost ? TEXT_GOOD : TEXT_SOFT);
      row.icon.setAlpha(rank > 0 ? 1 : 0.75);
    }

    const row = this.rows.find((candidate) => candidate.skill.id === this.selected) ?? this.rows[0];
    const half = row.zone.width / 2;
    const left = row.zone.x - half;
    const right = row.zone.x + half;
    const top = row.centerY - row.zone.height / 2;
    const bottom = row.centerY + row.zone.height / 2;
    this.rowSelector.topLeft.setPosition(left, top);
    this.rowSelector.topRight.setPosition(right, top);
    this.rowSelector.bottomLeft.setPosition(left, bottom);
    this.rowSelector.bottomRight.setPosition(right, bottom);

    const skill = row.skill;
    const rank = getSkillRank(skill.id);
    const max = getSkillMaxRank(skill.id);
    const cost = getNextSkillCost(skill.id);
    this.detailIcon.setTexture(skill.icon.key, skill.icon.frame.name);
    this.detailIcon.setScale(computeFitScale(this.detailIcon, DETAIL_ICON_PANEL * 0.55));
    this.setText(this.detailName, skill.name);
    this.setText(this.detailDescription, skill.description);
    this.setText(this.detailRank, `Nível ${rank}/${max}`);
    this.setText(this.detailCurrent, rank > 0 ? `Atual: ${skill.effectText(rank)}` : 'Atual: sem bônus');
    this.setText(this.detailNext, cost === null ? 'Nível máximo alcançado!' : `Próximo: ${skill.effectText(rank + 1)}`);
    this.setText(this.detailNote, skill.pendingNote ?? '');

    let label: string;
    let enabled = false;
    if (cost === null) label = 'Nível máximo';
    else if (xp < cost) label = `Faltam ${cost - xp} XP`;
    else {
      label = `Comprar (${cost} XP)`;
      enabled = true;
    }
    this.setText(this.buyLabel, label);
    this.buyButton.setTint(enabled ? BUTTON_ENABLED_TINT : BUTTON_DISABLED_TINT);
    this.buyLabel.setAlpha(enabled ? 1 : 0.7);
  }
}
