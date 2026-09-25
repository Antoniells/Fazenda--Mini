import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_PATH,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_PATH,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
  MENU_BACKGROUND_KEY,
  MENU_BACKGROUND_PATH,
} from '../data/ui';
import { PROFILE_NAME_MAX_LENGTH } from '../systems/gameState';
import { CHARACTER_IDS, DEFAULT_CHARACTER_ID, getPlayerAssets } from '../data/player';
import { preloadCharacterPreviews, ensureCharacterPreviewAnimation } from '../systems/playerSprites';
import { PET_IDS, DEFAULT_PET_ID, getPetDefinition, getPetTextureKey } from '../data/pets';
import { preloadPetPreviews, ensurePetAnimations, petAnimKey } from '../systems/petSprites';
import { startNewGame, save } from '../systems/saveManager';

export const CHARACTER_CREATION_SCENE_KEY = 'CharacterCreationScene';
const MAIN_MENU_SCENE_KEY = 'MainMenuScene';
const MAIN_SCENE_KEY = 'MainScene';

export interface CharacterCreationData {
  /** Slot Vazio escolhido no Menu Principal — a partida nova nasce e é salva nele. */
  slot: number;
}

const TEXT_FONT = '"Courier New", Courier, monospace';
/** Texto sobre o painel bege: escuro (o cream do `Banner.png` não combina com o creme claro usado nos textos sobre fundo escuro). */
const INK = '#3b2a14';
const INK_SOFT = '#8a7654';
const INK_ERROR = '#a8321f';

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 584;
/** Preview do personagem (32x32 do sprite ampliado) + setas < > pra trocar. */
const PREVIEW_SCALE = 4;
const ARROW_OFFSET_X = 110;
/** Preview do pet (a arte dele é bem menor que a do personagem, então o zoom também). */
const PET_PREVIEW_SCALE = 3;
const ARROW_WIDTH = 46;
const FIELD_WIDTH = 400;
const FIELD_HEIGHT = 38;
const FIELD_PADDING_X = 14;
const FIELD_UNFOCUSED_ALPHA = 0.7;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 36;
const FADE_MS = 350;
const CARET_BLINK_MS = 500;

/** Letras (com acento), números, espaço, hífen e apóstrofo — o suficiente pra "Zé", "Sítio do Vovô", "D'Ávila" sem deixar entrar símbolos estranhos no arquivo de save. */
const ALLOWED_CHARACTER = /^[\p{L}\p{N} '-]$/u;

interface NameField {
  key: 'playerName' | 'farmName';
  label: string;
  placeholder: string;
  value: string;
  box: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.Text;
}

/**
 * Criação de Personagem (Fase 10 — Parte 4, pedido explícito): cena
 * intermediária entre escolher um Slot Vazio no Menu Principal e a
 * `MainScene`. O jogador digita o Nome do personagem e o Nome da fazenda;
 * ao confirmar, a partida nova nasce com esse perfil (`startNewGame`) e já é
 * gravada no slot (`save`), pra os nomes não se perderem se a aba fechar
 * antes do primeiro sono.
 *
 * Escolha de personagem: setas `<` `>` (ou ← →) trocam entre Alex, Josh,
 * Lyria, Manu e Tori, com o sprite de cada um (idle de frente) no centro; o
 * escolhido vai pro perfil (`characterId`) e pro save.
 *
 * Escolha de pet: uma segunda linha `<` `>` (ou Shift + ← →) troca entre os
 * gatos e cachorros de `data/pets.ts`; o escolhido vai pro perfil (`petId`) e
 * pro save e acompanha o jogador em todas as cenas (`systems/petCompanion.ts`).
 *
 * Sem `<input>` HTML (regra do projeto: nada de UI feita em HTML/CSS): o
 * teclado é lido direto do Phaser e o texto desenhado num `Phaser.Text` sobre
 * um campo de arte real (NineSlice de `UI/Inventory`). Enter avança de campo
 * (e confirma no último), Tab/setas alternam, Esc volta pros Slots.
 */
export class CharacterCreationScene extends Phaser.Scene {
  private slot = 0;
  private fields: NameField[] = [];
  private focusedIndex = 0;
  private caretVisible = true;
  private errorText!: Phaser.GameObjects.Text;
  private transitioning = false;
  private characterIndex = Math.max(0, CHARACTER_IDS.indexOf(DEFAULT_CHARACTER_ID));
  private previewSprite!: Phaser.GameObjects.Sprite;
  private petIndex = Math.max(0, PET_IDS.indexOf(DEFAULT_PET_ID));
  private petSprite!: Phaser.GameObjects.Sprite;
  private petLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(CHARACTER_CREATION_SCENE_KEY);
  }

  init(data: CharacterCreationData): void {
    this.slot = data?.slot ?? 0;
  }

  preload(): void {
    // Auto-suficiente, igual `MainMenuScene`: `load.image` ignora keys que já estão no cache.
    this.load.image(MENU_BACKGROUND_KEY, encodeURI(`/${MENU_BACKGROUND_PATH}`));
    this.load.image(INVENTORY_PANEL_KEY, encodeURI(`/${INVENTORY_PANEL_PATH}`));
    this.load.image(INVENTORY_LARGE_PANEL_KEY, encodeURI(`/${INVENTORY_LARGE_PANEL_PATH}`));
    // Idle de cada personagem, pro preview (o resto das folhas só carrega na `MainScene`, do personagem escolhido).
    preloadCharacterPreviews(this);
    preloadPetPreviews(this);
  }

  create(): void {
    // A cena é reiniciada a cada visita mas os campos da classe não.
    this.fields = [];
    this.focusedIndex = 0;
    this.caretVisible = true;
    this.transitioning = false;
    this.characterIndex = Math.max(0, CHARACTER_IDS.indexOf(DEFAULT_CHARACTER_ID));
    this.petIndex = Math.max(0, PET_IDS.indexOf(DEFAULT_PET_ID));

    this.addFrame(INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT);
    this.addFrame(INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_FRAME_NAME, INVENTORY_LARGE_PANEL_RECT);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.buildBackground(centerX, centerY);

    const panel = this.add.nineslice(
      centerX,
      centerY,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    panel.setDepth(1);

    const top = centerY - PANEL_HEIGHT / 2;
    this.addText(centerX, top + 40, `NOVA PARTIDA — SLOT ${this.slot + 1}`, 18, INK, 'bold');

    // Seleção de personagem: preview no centro, setas dos lados, nome embaixo.
    const previewY = top + 108;
    this.previewSprite = this.add.sprite(centerX, previewY, getPlayerAssets(CHARACTER_IDS[this.characterIndex]).idleKey, 0);
    this.previewSprite.setScale(PREVIEW_SCALE);
    this.previewSprite.setDepth(3);
    this.addText(centerX, top + 198, '< >  ou  ← →: trocar de personagem', 11, INK_SOFT);
    this.createButton(centerX - ARROW_OFFSET_X, previewY, '<', () => this.selectCharacter(-1), ARROW_WIDTH);
    this.createButton(centerX + ARROW_OFFSET_X, previewY, '>', () => this.selectCharacter(1), ARROW_WIDTH);
    this.refreshPreview(false);

    // Seleção de pet: mesma ideia, uma linha abaixo (sprite no centro, setas dos lados, nome embaixo).
    const petY = top + 254;
    this.petSprite = this.add.sprite(centerX, petY, getPetTextureKey(PET_IDS[this.petIndex]), 0);
    this.petSprite.setScale(PET_PREVIEW_SCALE);
    this.petSprite.setDepth(3);
    this.petLabel = this.addText(centerX, top + 304, '', 14, INK, 'bold');
    this.addText(centerX, top + 322, '< >  ou  Shift + ← →: trocar de pet', 11, INK_SOFT);
    this.createButton(centerX - ARROW_OFFSET_X, petY, '<', () => this.selectPet(-1), ARROW_WIDTH);
    this.createButton(centerX + ARROW_OFFSET_X, petY, '>', () => this.selectPet(1), ARROW_WIDTH);
    this.refreshPetPreview(false);

    this.createField('playerName', 'Nome do personagem', 'Como você se chama?', centerX, top + 378);
    this.createField('farmName', 'Nome da fazenda', 'Como se chama sua fazenda?', centerX, top + 450);

    this.errorText = this.addText(centerX, top + 496, '', 12, INK_ERROR, 'bold');
    this.addText(centerX, top + 516, 'ENTER: avançar / confirmar   TAB: trocar de campo', 11, INK_SOFT);

    this.createButton(centerX - 90, top + PANEL_HEIGHT - 44, 'VOLTAR', () => this.leave(() => this.scene.start(MAIN_MENU_SCENE_KEY, { showSlots: true })));
    this.createButton(centerX + 90, top + PANEL_HEIGHT - 44, 'COMEÇAR', () => this.confirm());

    this.focusField(0);

    this.time.addEvent({
      delay: CARET_BLINK_MS,
      loop: true,
      callback: () => {
        this.caretVisible = !this.caretVisible;
        this.refreshFields();
      },
    });

    // `KeyboardPlugin` remove os listeners sozinho quando a cena encerra.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.onKeyDown(event));

    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  /** Passa pro personagem anterior/seguinte (circular) e atualiza o preview. */
  private selectCharacter(delta: number): void {
    const count = CHARACTER_IDS.length;
    this.characterIndex = (this.characterIndex + delta + count) % count;
    playClick(this);
    this.refreshPreview(true);
  }

  /** Mostra o sprite do personagem escolhido (idle de frente, animado); `pop` dá um pulinho de escala ao trocar. */
  private refreshPreview(pop: boolean): void {
    const id = CHARACTER_IDS[this.characterIndex];
    this.previewSprite.setTexture(getPlayerAssets(id).idleKey);
    this.previewSprite.play(ensureCharacterPreviewAnimation(this, id));

    if (pop) {
      this.tweens.killTweensOf(this.previewSprite);
      this.previewSprite.setScale(PREVIEW_SCALE * 1.18);
      this.tweens.add({ targets: this.previewSprite, scale: PREVIEW_SCALE, duration: 200, ease: 'Back.easeOut' });
    }
  }

  /** Passa pro pet anterior/seguinte (circular) e atualiza o preview. */
  private selectPet(delta: number): void {
    const count = PET_IDS.length;
    this.petIndex = (this.petIndex + delta + count) % count;
    playClick(this);
    this.refreshPetPreview(true);
  }

  /** Mostra o pet escolhido (sentado de frente, feliz, animado); `pop` dá um pulinho de escala ao trocar. */
  private refreshPetPreview(pop: boolean): void {
    const id = PET_IDS[this.petIndex];
    ensurePetAnimations(this, id);
    this.petSprite.play(petAnimKey(id, 'happy'));
    this.petLabel.setText(getPetDefinition(id).name.toUpperCase());

    if (pop) {
      this.tweens.killTweensOf(this.petSprite);
      this.petSprite.setScale(PET_PREVIEW_SCALE * 1.18);
      this.tweens.add({ targets: this.petSprite, scale: PET_PREVIEW_SCALE, duration: 200, ease: 'Back.easeOut' });
    }
  }

  private addFrame(key: string, name: string, rect: { x: number; y: number; width: number; height: number }): void {
    const texture = this.textures.get(key);
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
  }

  /** Mesma fazenda do menu, escurecida (mesmo tratamento da tela de Slots) pra o painel destacar. */
  private buildBackground(centerX: number, centerY: number): void {
    const background = this.add.image(centerX, centerY, MENU_BACKGROUND_KEY);
    background.setScale(Math.max(this.scale.width / background.width, this.scale.height / background.height));
    background.setDepth(0);

    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.45);
    dim.setOrigin(0, 0);
    dim.setDepth(0.5);
  }

  private addText(x: number, y: number, content: string, size: number, color: string, style = 'normal'): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, content, { fontFamily: TEXT_FONT, fontSize: `${size}px`, fontStyle: style, color });
    text.setOrigin(0.5, 0.5);
    text.setDepth(2);
    return text;
  }

  // --- Campos de texto -----------------------------------------------------

  private createField(key: NameField['key'], label: string, placeholder: string, centerX: number, y: number): void {
    const index = this.fields.length;

    const labelText = this.addText(centerX - FIELD_WIDTH / 2, y - 26, label, 13, INK, 'bold');
    labelText.setOrigin(0, 0.5);

    const box = this.add.nineslice(
      centerX,
      y + FIELD_HEIGHT / 2 - 8,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      FIELD_WIDTH,
      FIELD_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    box.setDepth(2);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => {
      playClick(this);
      this.focusField(index);
    });

    const text = this.add.text(centerX - FIELD_WIDTH / 2 + FIELD_PADDING_X, box.y, '', { fontFamily: TEXT_FONT, fontSize: '16px', fontStyle: 'bold', color: INK });
    text.setOrigin(0, 0.5);
    text.setDepth(3);

    this.fields.push({ key, label, placeholder, value: '', box, text });
  }

  private focusField(index: number): void {
    this.focusedIndex = index;
    this.caretVisible = true;
    this.refreshFields();
  }

  private refreshFields(): void {
    this.fields.forEach((field, index) => {
      const focused = index === this.focusedIndex;
      field.box.setAlpha(focused ? 1 : FIELD_UNFOCUSED_ALPHA);

      if (focused) {
        field.text.setColor(INK);
        field.text.setText(field.value + (this.caretVisible ? '|' : ''));
      } else if (field.value === '') {
        field.text.setColor(INK_SOFT);
        field.text.setText(field.placeholder);
      } else {
        field.text.setColor(INK);
        field.text.setText(field.value);
      }
    });
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.transitioning) return;
    const field = this.fields[this.focusedIndex];
    const count = this.fields.length;

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        this.focusField((this.focusedIndex + (event.shiftKey ? count - 1 : 1)) % count);
        return;
      case 'ArrowDown':
        this.focusField((this.focusedIndex + 1) % count);
        return;
      case 'ArrowUp':
        this.focusField((this.focusedIndex + count - 1) % count);
        return;
      case 'ArrowLeft':
        if (event.shiftKey) this.selectPet(-1);
        else this.selectCharacter(-1);
        return;
      case 'ArrowRight':
        if (event.shiftKey) this.selectPet(1);
        else this.selectCharacter(1);
        return;
      case 'Enter':
        event.preventDefault();
        if (this.focusedIndex < count - 1) this.focusField(this.focusedIndex + 1);
        else this.confirm();
        return;
      case 'Escape':
        this.leave(() => this.scene.start(MAIN_MENU_SCENE_KEY, { showSlots: true }));
        return;
      case 'Backspace':
        event.preventDefault();
        field.value = field.value.slice(0, -1);
        this.onEdited();
        return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 || !ALLOWED_CHARACTER.test(event.key)) return;
    if (event.key === ' ') event.preventDefault(); // Espaço rolaria a página.
    if (field.value.length >= PROFILE_NAME_MAX_LENGTH) return;
    // Sem espaço no começo nem espaços duplos: o nome salvo nunca precisa de limpeza depois.
    if (event.key === ' ' && (field.value === '' || field.value.endsWith(' '))) return;

    field.value += event.key;
    this.onEdited();
  }

  private onEdited(): void {
    this.errorText.setText('');
    this.caretVisible = true;
    this.refreshFields();
  }

  // --- Botões e saída ------------------------------------------------------

  private createButton(x: number, y: number, label: string, onClick: () => void, width = BUTTON_WIDTH): void {
    const panel = this.add.nineslice(
      x,
      y,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      width,
      BUTTON_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    panel.setDepth(2);
    panel.setAlpha(FIELD_UNFOCUSED_ALPHA);
    panel.setInteractive({ useHandCursor: true });
    panel.on('pointerover', () => panel.setAlpha(1));
    panel.on('pointerout', () => panel.setAlpha(FIELD_UNFOCUSED_ALPHA));
    panel.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.transitioning) return;
      playClick(this);
      onClick();
    });

    const text = this.add.text(x, y, label, {
      fontFamily: TEXT_FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color: INK,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(3);
  }

  private confirm(): void {
    const names = this.fields.map((field) => field.value.trim());
    const firstEmpty = names.findIndex((name) => name === '');
    if (firstEmpty !== -1) {
      this.errorText.setText('Preencha o nome do personagem e o da fazenda.');
      this.focusField(firstEmpty);
      return;
    }

    const [playerName, farmName] = names;
    const characterId = CHARACTER_IDS[this.characterIndex];
    const petId = PET_IDS[this.petIndex];
    this.leave(() => {
      // Perfil (nomes + personagem + pet) vira o `gameState` da partida nova e é gravado já no slot — a `MainScene` carrega o sprite do personagem e do pet no preload.
      startNewGame(this.slot, { playerName, farmName, characterId, petId });
      save(this.slot);
      this.scene.start(MAIN_SCENE_KEY);
    });
  }

  /** Fade out e só então executa a saída (troca de cena) — trava teclado/cliques durante o fade. */
  private leave(action: () => void): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const camera = this.cameras.main;
    camera.fadeOut(FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, action);
  }
}
