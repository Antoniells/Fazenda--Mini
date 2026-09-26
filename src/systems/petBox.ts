import Phaser from 'phaser';
import { Interactable, InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';
import { PET_BOX_CELL, getPetLetter } from './petEvent';

/** Evento GLOBAL (`game.events`) disparado ao abrir a caixa — ouvido pela `UIScene`, que mostra a carta (`ui/letterPanel.ts`). Mesmo padrão de `OPEN_FURNACE_MENU_EVENT`. */
export const OPEN_LETTER_EVENT = 'open-letter';
export interface OpenLetterPayload {
  title: string;
  body: string;
  buttonLabel: string;
  /** Desenha o coração (arte do HUD) no fim da carta — o ❤️ do texto original, sem depender de emoji/fonte. */
  heart: boolean;
  /** Chamado quando o jogador termina de ler (aperta o botão). */
  onRead: () => void;
}

/** Caixa de papelão (`Animals/Pets/Cats/Box.png`, 32x32 com o conteúdo em 11x13): a caixa em que o animalzinho chega. */
export const PET_BOX_KEY = 'pet-box';
export const PET_BOX_PATH = 'Animals/Pets/Cats/Box.png';
const PET_BOX_FRAME = { name: 'pet-box-frame', rect: { x: 11, y: 18, width: 11, height: 13 } };
/** O sprite tem só 11px de largura: escala inteira 3 (33px) pra ocupar um tile de 32 sem borrar. */
const PET_BOX_SCALE = 3;

export function preloadPetBox(scene: Phaser.Scene): void {
  scene.load.image(PET_BOX_KEY, encodeURI(`/${PET_BOX_PATH}`));
}

class PetBoxInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly onRead: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    const letter = getPetLetter();
    const payload: OpenLetterPayload = { title: letter.title, body: letter.body, buttonLabel: 'Cuidar dele', heart: true, onRead: this.onRead };
    this.scene.game.events.emit(OPEN_LETTER_EVENT, payload);
  }
}

/**
 * A caixa do pet em frente à casa (evento narrativo, `systems/petEvent.ts`): objeto sólido (bloqueia a célula, o jogador chega
 * ao lado e interage) com sombra, ordenado por Y como qualquer objeto do mundo. `onRead` (quem cria a define) roda quando a
 * carta é lida — tira a caixa (`destroy`) e chama o pet.
 */
export class PetBox {
  private readonly image: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    player: Player,
    onRead: () => void,
  ) {
    const texture = scene.textures.get(PET_BOX_KEY);
    if (!texture.has(PET_BOX_FRAME.name)) {
      const { x, y, width, height } = PET_BOX_FRAME.rect;
      texture.add(PET_BOX_FRAME.name, 0, x, y, width, height);
    }

    const x = PET_BOX_CELL.col * tilePx + tilePx / 2;
    const y = (PET_BOX_CELL.row + 1) * tilePx;

    this.shadow = createGroundShadow(scene, x, y - 6, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    this.shadow.setDepth(y - 0.1);
    this.image = scene.add.image(x, y - 2, PET_BOX_KEY, PET_BOX_FRAME.name);
    this.image.setOrigin(0.5, 1);
    this.image.setScale(PET_BOX_SCALE);
    this.image.setDepth(y);

    // Uma balançadinha de vez em quando: o bichinho mexendo lá dentro (transformação do próprio sprite, sem arte nova).
    scene.tweens.add({ targets: this.image, angle: { from: -3, to: 3 }, duration: 260, yoyo: true, repeat: -1, repeatDelay: 1800, ease: 'Sine.easeInOut' });

    grid.block(PET_BOX_CELL.col, PET_BOX_CELL.row);
    interactions.set(PET_BOX_CELL.col, PET_BOX_CELL.row, new PetBoxInteractable(scene, player, onRead));
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.image);
    this.image.destroy();
    this.shadow.destroy();
    this.grid.unblock(PET_BOX_CELL.col, PET_BOX_CELL.row);
    this.interactions.remove(PET_BOX_CELL.col, PET_BOX_CELL.row);
  }
}
