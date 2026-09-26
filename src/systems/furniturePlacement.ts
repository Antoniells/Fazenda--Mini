import Phaser from 'phaser';
import { DecorationDefinition, DECORATIONS, FURNITURE } from '../data/decorations';
import { DISPLAY_SCALE } from './mapBuilder';
import { createGroundShadow } from './shadow';
import { WalkableGrid } from './grid';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { PointerInputInterceptor } from './playerController';
import { Player } from '../entities/Player';
import { findPath, GridPoint } from './pathfinding';
import { gameState } from './gameState';
import { discardChest, isChestEmpty } from './chestStorage';
import { popText } from './floatingText';
import { playBreakEffect } from './breakEffect';
import { playEffect } from './soundEffects';
import { isToolOfFamily } from '../data/toolProgression';
import { OBJECT_BREAK_SOUND, PLACE_SOUND } from '../data/audio';

/** Evento GLOBAL (`game.events`) disparado ao interagir com um Baú — ouvido pela `UIScene`, que abre o `ChestMenu` (mesmo padrão de `OPEN_FURNACE_MENU_EVENT`). */
export const OPEN_CHEST_MENU_EVENT = 'open-chest-menu';
export interface OpenChestMenuPayload {
  chestId: string;
  /** Recolhe o baú (só chamado com ele vazio): devolve o móvel ao estoque e o tira da casa. */
  onPickUp: () => void;
}

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950;
const SHADOW_DEPTH = -0.4;
/** Meia largura (px) do corpo do jogador sentado — quanto o ponto do assento precisa ficar longe das bordas laterais do móvel. */
const SEAT_EDGE_MARGIN_PX = 10;
/** Carrega/registra as texturas dos móveis — a `HouseScene` é auto-suficiente (não depende de a Fazenda já ter carregado nada). */
export function preloadFurniture(scene: Phaser.Scene): void {
  for (const furniture of FURNITURE) scene.load.image(furniture.textureKey, encodeURI(`/${furniture.texturePath}`));
}

export function registerFurnitureFrames(scene: Phaser.Scene): void {
  for (const furniture of FURNITURE) {
    const texture = scene.textures.get(furniture.textureKey);
    if (!texture.has(furniture.frameName)) {
      const { x, y, width, height } = furniture.frameRect;
      texture.add(furniture.frameName, 0, x, y, width, height);
    }
  }
}

/** Um móvel posicionado: a mesma instância de `Interactable` fica registrada em todas as células do `footprint`. */
class PlacedFurnitureInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly system: FurniturePlacementSystem,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
    private readonly decoration: DecorationDefinition,
    private readonly tilePx: number,
  ) {}

  /** Senta o jogador no assento (`DecorationDefinition.seat`): a célula do móvel mais perto dele, virado pra frente, na pose `Sitting`. */
  private sit(): void {
    const { width, height } = this.decoration.footprint;
    let seat = { col: this.col, row: this.row };
    let bestDistance = Infinity;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cell = { col: this.col + dx, row: this.row + dy };
        const distance = Math.abs(cell.col - this.player.col) + Math.abs(cell.row - this.player.row);
        if (distance < bestDistance) {
          bestDistance = distance;
          seat = cell;
        }
      }
    }
    const offset = this.decoration.seat ?? { x: 0, y: 0 };
    // Nunca passa da borda do móvel (sentando na ponta do sofá, o deslocamento lateral não pode deixar o corpo pra fora dele).
    const left = this.col * this.tilePx + SEAT_EDGE_MARGIN_PX;
    const right = (this.col + width) * this.tilePx - SEAT_EDGE_MARGIN_PX;
    const x = Math.min(Math.max(seat.col * this.tilePx + this.tilePx / 2 + offset.x, left), right);
    const y = (seat.row + 1) * this.tilePx + offset.y;
    // Um pouco à frente do móvel (que é ordenado pelo Y da base dele), pra o jogador não sumir atrás do encosto.
    this.player.sitAt(x, y, (this.row + height) * this.tilePx + 1);
  }

  interact(): void {
    if (this.player.isBusy()) return;

    // Picareta na mão: QUALQUER móvel se despedaça (golpe + animação + som) e volta pro estoque — inclusive o baú (pedido explícito), só que
    // vazio: quebrar um baú cheio faria os itens sumirem, então ele avisa pra esvaziar antes.
    const selected = gameState.inventory.getSelectedSlot();
    if (selected?.category === 'tool' && isToolOfFamily(selected.id, 'pickaxe')) {
      if (this.decoration.isChest && !isChestEmpty(`${this.col},${this.row}`)) {
        popText(this.scene, this.col * this.tilePx + this.tilePx / 2, this.row * this.tilePx, 'Esvazie o baú antes', { color: '#ff8a8a' });
        return;
      }
      this.player.performAction('pickaxe', () => this.system.removeAt(this.col, this.row, true));
      return;
    }
    // Baú: abre a tela de transferência (o móvel também sai por "Recolher", com ele vazio).
    if (this.decoration.isChest) {
      const payload: OpenChestMenuPayload = { chestId: `${this.col},${this.row}`, onPickUp: () => this.system.removeAt(this.col, this.row) };
      this.scene.game.events.emit(OPEN_CHEST_MENU_EVENT, payload);
      return;
    }
    // Cadeira/Sofá: um clique comum (jogador ao lado) senta nele — pedido explícito do usuário.
    if (this.decoration.seat) {
      this.sit();
      return;
    }
    // Um clique comum NÃO recolhe o móvel (bug corrigido, pedido explícito do usuário: primeiro na caminha do pet, depois em todos os
    // móveis — cliques à toa (ex.: andar pela casa) os devolviam pra Bolsa). Só a Picareta acima (ou o "Recolher" do baú) os tira.
  }
}

interface PlacedFurniture {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  decorationId: string;
  footprint: { width: number; height: number };
}

export interface FurnitureRoom {
  cols: number;
  rows: number;
  /** Células que NUNCA recebem móvel (o ponto de nascimento em frente à porta, a própria porta). */
  reserved: GridPoint[];
  /** Célula de onde o jogador nasce — de lá a cama (e a porta) precisam continuar alcançáveis. */
  spawn: GridPoint;
  /** Células de onde se pode usar a cama: pelo menos uma tem que continuar alcançável (senão não dá pra dormir). */
  bedAccess: GridPoint[];
}

/**
 * Posicionamento de móveis DENTRO da casa (`HouseScene`) — mesma técnica de fantasma + clique do
 * `DecorationPlacementSystem` da Fazenda (o clique é "roubado" do fluxo normal via `PointerInputInterceptor`), só
 * que dentro do cômodo: só células internas (a parede fica de fora), nunca em cima da porta/ponto de entrada, e
 * nunca de um jeito que feche o caminho até a cama (`bedAccess`). Um móvel posicionado bloqueia as células do
 * `footprint` no `WalkableGrid` (objeto estático com colisão), registra-se no `InteractionRegistry` em cada uma e
 * vai pro `gameState.placedFurniture` (save). O Baú abre a tela do baú; os outros móveis voltam pro estoque ao clicar.
 */
export class FurniturePlacementSystem implements PointerInputInterceptor {
  private readonly placed = new Map<string, PlacedFurniture>();
  private readonly ghost: Phaser.GameObjects.Image;
  private active: DecorationDefinition | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
    private readonly room: FurnitureRoom,
  ) {
    registerFurnitureFrames(scene);
    const first = FURNITURE[0];
    this.ghost = scene.add.image(0, 0, first.textureKey, first.frameName);
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setScale(DISPLAY_SCALE);
    this.ghost.setDepth(GHOST_DEPTH);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setVisible(false);

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer.worldX, pointer.worldY));
  }

  isActive(): boolean {
    return this.active !== null;
  }

  /** Entra/sai do modo de posicionamento do móvel informado. Sem estoque, não entra. */
  toggle(furniture: DecorationDefinition): void {
    if (this.active) {
      this.cancel();
      return;
    }
    if (this.inventory.getDecorationCount(furniture.id) <= 0) {
      console.log(`Sem ${furniture.name} no estoque — compre na loja.`);
      return;
    }
    this.active = furniture;
    this.ghost.setTexture(furniture.textureKey, furniture.frameName);
    this.ghost.setScale(DISPLAY_SCALE * (furniture.displayScaleMultiplier ?? 1));
    this.ghost.setVisible(true);
  }

  cancel(): void {
    this.active = null;
    this.ghost.setVisible(false);
  }

  private handlePointerMove(x: number, y: number): void {
    const furniture = this.active;
    if (!furniture) return;
    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    const { width, height } = furniture.footprint;
    this.ghost.setPosition(col * this.tilePx + (width * this.tilePx) / 2, (row + height) * this.tilePx);
    this.ghost.setTint(this.canPlaceAt(col, row, furniture) ? GHOST_VALID_TINT : GHOST_INVALID_TINT);
  }

  /** Todas as células do footprint dentro do cômodo (fora da parede), livres, fora das reservadas — e a cama continua alcançável. */
  private canPlaceAt(col: number, row: number, furniture: DecorationDefinition): boolean {
    const { width, height } = furniture.footprint;
    const cells: GridPoint[] = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) cells.push({ col: col + dx, row: row + dy });
    }

    for (const cell of cells) {
      if (cell.col < 1 || cell.row < 1 || cell.col > this.room.cols - 2 || cell.row > this.room.rows - 2) return false;
      if (!this.grid.isWalkable(cell.col, cell.row)) return false;
      if (this.room.reserved.some((reserved) => reserved.col === cell.col && reserved.row === cell.row)) return false;
    }

    // Simula o bloqueio e confere que dá pra chegar na cama a partir da entrada.
    for (const cell of cells) this.grid.block(cell.col, cell.row);
    const reachable = this.room.bedAccess.some((target) => this.grid.isWalkable(target.col, target.row) && findPath(this.grid, this.room.spawn, target) !== null);
    for (const cell of cells) this.grid.unblock(cell.col, cell.row);
    return reachable;
  }

  /** Chamado pelo `PlayerController` enquanto o modo está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    const furniture = this.active;
    if (!furniture) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlaceAt(col, row, furniture)) return;
    if (!this.inventory.useDecoration(furniture.id)) return;

    this.placeAt(furniture, col, row);
    playEffect(this.scene, PLACE_SOUND);
    if (this.inventory.getDecorationCount(furniture.id) <= 0) this.cancel();
  }

  private placeAt(furniture: DecorationDefinition, col: number, row: number): void {
    const { width, height } = furniture.footprint;
    const scaleMultiplier = furniture.displayScaleMultiplier ?? 1;
    const x = col * this.tilePx + (width * this.tilePx) / 2;
    const y = (row + height) * this.tilePx;

    const shadow = createGroundShadow(this.scene, x, y - 2, DISPLAY_SCALE * 0.9 * width * scaleMultiplier, DISPLAY_SCALE * 0.45 * scaleMultiplier);
    shadow.setDepth(SHADOW_DEPTH);

    const image = this.scene.add.image(x, y, furniture.textureKey, furniture.frameName);
    image.setOrigin(0.5, 1);
    image.setScale(DISPLAY_SCALE * scaleMultiplier);
    image.setDepth(y);

    const interactable = new PlacedFurnitureInteractable(this.scene, this, this.player, col, row, furniture, this.tilePx);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.grid.block(col + dx, row + dy);
        this.interactions.set(col + dx, row + dy, interactable);
      }
    }

    this.placed.set(`${col},${row}`, { image, shadow, decorationId: furniture.id, footprint: { width, height } });
    gameState.placedFurniture.set(`${col},${row}`, { decorationId: furniture.id, col, row });
  }

  /** Recolhe o móvel da célula-âncora: desbloqueia o grid, tira a interação e devolve 1 ao estoque. */
  removeAt(col: number, row: number, breakEffect = false): void {
    const key = `${col},${row}`;
    const entry = this.placed.get(key);
    if (!entry) return;

    if (breakEffect) {
      playBreakEffect(this.scene, entry.image, entry.shadow);
      playEffect(this.scene, OBJECT_BREAK_SOUND);
    } else {
      entry.image.destroy();
      entry.shadow.destroy();
    }
    this.placed.delete(key);
    gameState.placedFurniture.delete(key);

    const { width, height } = entry.footprint;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.grid.unblock(col + dx, row + dy);
        this.interactions.remove(col + dx, row + dy);
      }
    }

    if (DECORATIONS[entry.decorationId]?.isChest) discardChest(key);
    this.inventory.addDecorations(entry.decorationId, 1);
    console.log(`Móvel recolhido: 1 ${entry.decorationId}.`);
  }

  /** Recria os móveis já posicionados (do `gameState`, que sobrevive à cena e vai pro save) — sem descontar estoque. Id que não existe mais é ignorado. */
  restorePlacements(): void {
    for (const { decorationId, col, row } of gameState.placedFurniture.values()) {
      const furniture = DECORATIONS[decorationId];
      if (furniture) this.placeAt(furniture, col, row);
    }
  }
}
