import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  INVENTORY_SLOT_DARK_FRAME_NAME,
  INVENTORY_SLOT_DARK_RECT,
} from '../data/ui';
import { VOLUME_LEVELS, getMusicLevel, setMusicLevel, getEffectsLevel, setEffectsLevel } from '../systems/audioSettings';
import { playClick } from '../systems/soundEffects';
import { isFullscreen, toggleFullscreen } from '../systems/displayMode';

const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 330;
const TEXT_FONT = '"Courier New", Courier, monospace';
const INK = '#3b2a14';

const SEGMENT_PITCH = 20;
const STEP_BUTTON_SIZE = 28;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 34;
const IDLE_ALPHA = 0.7;

interface VolumeRow {
  segments: Phaser.GameObjects.Image[];
  percent: Phaser.GameObjects.Text;
  getLevel: () => number;
  setLevel: (level: number) => void;
}

/**
 * Configurações (pedido explícito): ajuste do volume das MÚSICAS e dos
 * EFEITOS, cada um em `VOLUME_LEVELS` (10) níveis, e a TELA CHEIA (botão que
 * liga/desliga, ver `systems/displayMode.ts`). Um componente só, usado
 * pelo Menu Principal ("Configurações") e pelo Menu de Pausa ("Opções") — em
 * cada um, quem chama decide o que o ESC faz (`close()`), esta classe não lê
 * teclado.
 *
 * Só arte real (regra do projeto): os segmentos da barra são os quadradinhos
 * de slot do Inventário (escuro = volume ligado, claro = vazio) sobre o
 * painel bege; botões −/+/VOLTAR são o mesmo painel pequeno com texto. Clicar
 * num segmento vai direto pra aquele nível; clicar no primeiro quando ele já
 * é o único aceso zera (mudo). Cada clique toca o efeito de clique JÁ no
 * volume novo — é assim que se "ouve" o ajuste dos efeitos; a música muda ao
 * vivo (só há música durante o jogo, ver `systems/dayMusic.ts`).
 *
 * Os objetos são criados ao abrir e destruídos ao fechar (nada fica
 * escondido na cena). Tudo com `scrollFactor 0`, então serve também sobre
 * a Fazenda, cuja câmera rola.
 */
export class SettingsPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rows: VolumeRow[] = [];
  private opened = false;
  private fullscreenLabel: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly baseDepth: number,
    private readonly onClose?: () => void,
  ) {}

  isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.ensureFrames();

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const top = centerY - PANEL_HEIGHT / 2;

    const shield = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.55);
    shield.setOrigin(0, 0);
    shield.setInteractive(); // Engole os cliques: nada por baixo reage com o painel aberto.
    this.place(shield, 0);

    const panel = this.scene.add.nineslice(
      centerX,
      centerY,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.place(panel, 1);

    this.addText(centerX, top + 36, 'CONFIGURAÇÕES', 18, 'bold', 0.5);

    this.rows = [
      this.createRow(centerX, top + 100, 'Música', getMusicLevel, setMusicLevel),
      this.createRow(centerX, top + 158, 'Efeitos', getEffectsLevel, setEffectsLevel),
    ];
    for (const row of this.rows) this.refreshRow(row);

    this.createFullscreenRow(centerX, top + 216);

    this.createTextButton(centerX, top + PANEL_HEIGHT - 44, BUTTON_WIDTH, BUTTON_HEIGHT, 'VOLTAR', () => {
      playClick(this.scene);
      this.close();
    });
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.refreshFullscreen, this);
    this.scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.refreshFullscreen, this);
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.rows = [];
    this.fullscreenLabel = null;
    this.onClose?.();
  }

  /** Painel/slots vêm da mesma folha de UI do Inventário; garante os frames nomeados (idempotente — quem abre primeiro registra). */
  private ensureFrames(): void {
    const texture = this.scene.textures.get(INVENTORY_PANEL_KEY);
    const frames = [
      { name: INVENTORY_PANEL_FRAME_NAME, rect: INVENTORY_PANEL_RECT },
      { name: INVENTORY_SLOT_FRAME_NAME, rect: INVENTORY_SLOT_RECT },
      { name: INVENTORY_SLOT_DARK_FRAME_NAME, rect: INVENTORY_SLOT_DARK_RECT },
    ];
    for (const { name, rect } of frames) {
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
  }

  private place<T extends Phaser.GameObjects.GameObject>(object: T, depthOffset: number): T {
    const target = object as unknown as Phaser.GameObjects.Image;
    target.setScrollFactor(0);
    target.setDepth(this.baseDepth + depthOffset);
    this.objects.push(object);
    return object;
  }

  private addText(x: number, y: number, content: string, size: number, style: string, originX: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, content, { fontFamily: TEXT_FONT, fontSize: `${size}px`, fontStyle: style, color: INK });
    text.setOrigin(originX, 0.5);
    return this.place(text, 3);
  }

  private createRow(centerX: number, y: number, label: string, getLevel: () => number, setLevel: (level: number) => void): VolumeRow {
    this.addText(centerX - 210, y, label, 14, 'bold', 0);

    const row: VolumeRow = { segments: [], percent: this.addText(centerX + 185, y, '', 14, 'bold', 0.5), getLevel, setLevel };

    this.createTextButton(centerX - 115, y, STEP_BUTTON_SIZE, STEP_BUTTON_SIZE, '−', () => this.change(row, getLevel() - 1));
    this.createTextButton(centerX + 135, y, STEP_BUTTON_SIZE, STEP_BUTTON_SIZE, '+', () => this.change(row, getLevel() + 1));

    const firstX = centerX - 80;
    for (let index = 0; index < VOLUME_LEVELS; index++) {
      const segment = this.scene.add.image(firstX + index * SEGMENT_PITCH, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      this.place(segment, 2);
      segment.setInteractive({ useHandCursor: true });
      segment.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        // Clicar de novo no único segmento aceso zera o volume (mudo).
        const target = index === 0 && getLevel() === 1 ? 0 : index + 1;
        this.change(row, target);
      });
      row.segments.push(segment);
    }
    return row;
  }

  /** Tela cheia: um botão cujo texto mostra o estado atual ("LIGADA"/"DESLIGADA") e alterna ao clicar. */
  private createFullscreenRow(centerX: number, y: number): void {
    this.addText(centerX - 210, y, 'Tela cheia', 14, 'bold', 0);

    this.fullscreenLabel = this.createTextButton(centerX + 10, y, BUTTON_WIDTH, BUTTON_HEIGHT, '', () => {
      toggleFullscreen(this.scene);
      playClick(this.scene);
      this.refreshFullscreen();
    });
    this.refreshFullscreen();

    // No navegador a tela cheia só muda DEPOIS do pedido (evento do Phaser); no Electron já mudou, e o evento não dispara — por isso o refresh acima também.
    this.scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.refreshFullscreen, this);
    this.scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.refreshFullscreen, this);
  }

  private refreshFullscreen(): void {
    this.fullscreenLabel?.setText(isFullscreen(this.scene) ? 'LIGADA' : 'DESLIGADA');
  }

  private change(row: VolumeRow, level: number): void {
    row.setLevel(Math.min(VOLUME_LEVELS, Math.max(0, level)));
    this.refreshRow(row);
    playClick(this.scene); // Já no volume novo: é assim que se ouve o ajuste dos efeitos.
  }

  private refreshRow(row: VolumeRow): void {
    const level = row.getLevel();
    row.segments.forEach((segment, index) => {
      segment.setFrame(index < level ? INVENTORY_SLOT_DARK_FRAME_NAME : INVENTORY_SLOT_FRAME_NAME);
    });
    row.percent.setText(`${Math.round((level / VOLUME_LEVELS) * 100)}%`);
  }

  private createTextButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.scene.add.nineslice(
      x,
      y,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      width,
      height,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.place(button, 2);
    button.setAlpha(IDLE_ALPHA);
    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setAlpha(1));
    button.on('pointerout', () => button.setAlpha(IDLE_ALPHA));
    button.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onClick();
    });

    // Sinais "−"/"+" maiores que o texto dos botões largos, senão somem num botão de 28 px.
    return this.addText(x, y, label, width <= STEP_BUTTON_SIZE ? 20 : 14, 'bold', 0.5);
  }
}
