import Phaser from 'phaser';
import { playClick, playEffect } from '../systems/soundEffects';
import { popText } from '../systems/floatingText';
import { PLACE_SOUND } from '../data/audio';
import { Inventory, HOTBAR_SIZE, STORAGE_SIZE } from '../systems/inventory';
import { resolveSlotVisual } from '../data/items';
import { CROPS, ALL_CROPS_ICONS_KEY, CropDefinition } from '../data/crops';
import { PLAYER_ANIM_FRAMES, getPlayerAssets } from '../data/player';
import { gameState } from '../systems/gameState';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  INVENTORY_SLOT_DARK_FRAME_NAME,
  INVENTORY_SLOT_DARK_RECT,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  SHOP_TAB_RIBBONS_KEY,
  TAB_FRAME_TOOLS,
  TAB_FRAME_TOOLS_LIGHT,
  TAB_FRAME_AGRICULTURE,
  TAB_FRAME_AGRICULTURE_LIGHT,
  TAB_FRAME_CONSTRUCTION,
  TAB_FRAME_CONSTRUCTION_LIGHT,
  TAB_FRAME_SKILLS,
  TAB_FRAME_SKILLS_LIGHT,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  TRASH_CAN_KEY,
  TRASH_CAN_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
  EXTRAS_UI_KEY,
  GLOBAL_CURSOR_CORNER_NAMES,
  GLOBAL_CURSOR_CORNER_RECTS,
  BACKPACK_ICON_KEY,
  BACKPACK_ICON_FRAME,
  FISHING_ROD_ICON_KEY,
  FISHING_ROD_ICON_FRAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';
import { Tooltip } from './tooltip';
import { PointerInputInterceptor } from '../systems/playerController';
import { SkillTreePanel } from './skillTreePanel';
import { SKILLS_TAB_ICON } from '../data/skills';

type CornerKey = keyof typeof GLOBAL_CURSOR_CORNER_NAMES;

/**
 * Mesmas constantes de geometria/estilo do `ShopMenu` (Fase 8), copiadas de
 * propósito — pedido explícito do usuário ("exatamente o mesmo layout e
 * lógica"). Duplicadas em vez de compartilhadas: o `ShopMenu` já está
 * testado e em uso (comprar), e as duas telas nunca ficam abertas ao mesmo
 * tempo, então uma classe irmã própria evita arriscar uma refatoração no
 * código da Loja só para servir o Inventário.
 */
const BOOK_SCALE = 2.2;
const SLOT_SCALE = 1.7;
const SLOT_GAP = 5;
/** Reduzido de 16 pra 12 (pedido explícito do usuário) pra caber a 5ª linha do grid sem espremer a página. */
const ROW_GAP = 12;
/** Cada página do livro comporta um grid de 6 colunas x 5 linhas (pedido explícito do usuário — antes eram 4 linhas). */
const GRID_COLS = 6;
const GRID_ROWS = 5;
const ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
/**
 * As células do caderno: as da página (o ESTOQUE da Bolsa, na Mochila) e, em cima do livro, a fileira da HOTBAR (pedido explícito: a
 * Hotbar sobe pra cima do caderno aberto, no estilo dele, e não se repete dentro dele — cada célula mostra um slot só da Bolsa).
 */
const HOTBAR_ROW_FIRST_CELL = ITEMS_PER_PAGE;
const CELL_COUNT = ITEMS_PER_PAGE + HOTBAR_SIZE;
/**
 * Fundo da fileira da Hotbar: um "livro fino" montado do próprio `Book.png` — a metade esquerda e a direita das páginas, cada uma
 * num NineSlice (os cantos dourados, a madeira de baixo e o fecho não esticam; o encontro das duas metades vira a lombada). Medidas em
 * pixels nativos, conferidas pixel a pixel: canto dourado de cima 12x19, de baixo 21x20 com a faixa de madeira, fecho no meio de baixo.
 */
const HOTBAR_BOOK_LEFT = { name: 'inventory-hotbar-book-left', rect: { x: 0, y: 0, width: 120, height: 144 } };
const HOTBAR_BOOK_RIGHT = { name: 'inventory-hotbar-book-right', rect: { x: 120, y: 0, width: 119, height: 144 } };
const HOTBAR_BOOK_OUTER = 23;
const HOTBAR_BOOK_INNER = 8;
const HOTBAR_BOOK_TOP = 20;
const HOTBAR_BOOK_BOTTOM = 23;
/** Altura do livro fino (nativa): só os cantos, sem esticar no meio. As células ficam no bege, a `HOTBAR_BOOK_ROW_Y` do topo. */
const HOTBAR_BOOK_HEIGHT = HOTBAR_BOOK_TOP + HOTBAR_BOOK_BOTTOM;
const HOTBAR_BOOK_ROW_Y = 14;
/** Folga (px de tela) entre a fileira e a borda do livro fino, além dos cantos dourados; e entre o livro fino e o caderno. */
const HOTBAR_BOOK_SIDE_PAD = 10;
/** Espaço a mais no meio da fileira (px de tela), em cima da lombada do livro fino: os 4 slots da esquerda ficam bem à esquerda e os 4 da direita bem à direita (pedido explícito — antes as células do meio quase encostavam na lombada). */
const HOTBAR_BOOK_SPINE_GAP = 48;
const HOTBAR_BOOK_GAP = 4;
/** Fração da célula (16px nativos) que um ícone "normal" (16x16) preenche. */
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * SLOT_SCALE * ICON_FILL_RATIO;
/** Ícone da armadura equipada (slot "boneco de papel"): um pouco menor que o padrão (pedido explícito do usuário). */
const EQUIPPED_ARMOR_ICON_TARGET_PX = ICON_TARGET_PX * 0.75;
/** Realce do slot da Hotbar atualmente selecionado, na aba Mochila (mesmo tom já usado antes desta reformulação). */
const SELECTED_HOTBAR_TINT = 0xffe9b3;
const UNSELECTED_TINT = 0xffffff;
/** Realce do slot da armadura vestida (azulado, diferente do creme do slot ativo da Hotbar). */
const EQUIPPED_ARMOR_TINT = 0xcfe6ff;

const TAB_SCALE = 2.0;
const TAB_ROTATION = Math.PI / 2;
const TAB_RIBBON_NATIVE_THICKNESS = 18;
const TAB_DISPLAY_THICKNESS = TAB_RIBBON_NATIVE_THICKNESS * TAB_SCALE;
const TAB_GAP_Y = 8;
const TAB_BOOK_OVERLAP = 4;
const TAB_ICON_TARGET_PX = 28;
const TAB_ICON_OFFSET_X = 2;
const TAB_ICON_OFFSET_Y = -18;

const TAB_SELECTOR_SCALE = 1.5;
const TAB_SELECTOR_PADDING = 2;

const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
const CLOSE_X_TARGET_PX = 30;
/** Altura (px de tela) da lixeira; onde ela fica — fora do livro, junto ao canto de baixo à direita (a partir da coluna do X e do pé do livro); o tanto que cresce com um item arrastado em cima. */
const TRASH_TARGET_PX = 36;
const TRASH_OFFSET_X = 35;
const TRASH_BOTTOM_INSET = 7;
const TRASH_HOVER_FACTOR = 1.2;
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;

/** Área de papel em branco de cada página — ver comentário idêntico em `ShopMenu`. */
const PAGE_RECT = {
  left: { x: 14, width: 100 },
  right: { x: 124, width: 96 },
  top: 4,
  height: 119,
};

/**
 * Reformulação da Mochila (Fase 9 — Interface, pedido explícito do
 * usuário): a página ESQUERDA sempre mostra o grid cheio de 24 slots (cabe
 * exatamente numa página — `GRID_COLS*GRID_ROWS === INVENTORY_SIZE`, por
 * isso o pool de slots deixou de precisar de uma segunda página). A página
 * DIREITA passou a depender da aba ativa: Mochila mostra o personagem +
 * slots de equipamento, Agricultura mostra o painel de detalhe do item
 * selecionado. `EQUIPMENT_SLOTS` são só os 5 tipos pedidos — sem itens de
 * armadura de verdade no jogo ainda (nenhuma arte de armadura sendo
 * usada/comprável), cada um nasce e fica permanentemente vazio, só a
 * moldura + rótulo indicando o que vai ali no futuro.
 */
type EquipmentSlotType = 'hat' | 'shirt' | 'pants' | 'boots' | 'accessory';
interface EquipmentSlotDefinition {
  type: EquipmentSlotType;
  label: string;
  /** Deslocamento (px, antes da escala do livro) relativo ao centro do personagem na página direita. */
  offsetX: number;
  offsetY: number;
}
const EQUIPMENT_SLOTS: EquipmentSlotDefinition[] = [
  { type: 'hat', label: 'Chapéu', offsetX: 0, offsetY: -52 },
  { type: 'shirt', label: 'Armadura', offsetX: -46, offsetY: -16 },
  { type: 'pants', label: 'Calça', offsetX: 46, offsetY: -16 },
  { type: 'boots', label: 'Botas', offsetX: -30, offsetY: 48 },
  { type: 'accessory', label: 'Acessório', offsetX: 30, offsetY: 48 },
];
/** Menores que antes (pedido explícito do usuário: "colados" ao personagem, não espalhados) — slot e personagem reduzidos pra caber um "boneco de papel" compacto na página direita. */
const EQUIPMENT_SLOT_SCALE = 2.0;
const CHARACTER_SPRITE_SCALE = 3.0;
const EQUIPMENT_LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '8px',
  color: '#4a3524',
  stroke: '#f6e6cf',
  strokeThickness: 2,
};

/**
 * Painel de detalhe da aba Agricultura (diário de descobertas, pedido
 * explícito do usuário — layout de referência: grid de "?" na página
 * esquerda, ícone grande + nome + status na direita ao selecionar).
 *
 * Correção urgente (pedido explícito do usuário): a versão anterior pegava
 * o slot PEQUENO (`INVENTORY_SLOT_FRAME_NAME`, 18x18) e dava `setScale`
 * gigante nele — isso estica os cantos/bordas desenhados junto com o resto,
 * ficando com a decoração toda borrada/deformada. Agora usa
 * `INVENTORY_LARGE_PANEL_*` com `scene.add.nineslice`: largura/altura FIXAS
 * abaixo, cantos preservados (`INVENTORY_LARGE_PANEL_BORDER`), só o miolo
 * estica.
 */
const DETAIL_ICON_PANEL_WIDTH = 100;
const DETAIL_ICON_PANEL_HEIGHT = 100;
const DETAIL_TEXT_PANEL_WIDTH = 100;
const DETAIL_TEXT_PANEL_HEIGHT = 72;
const DETAIL_PANEL_GAP = 10;
/** Ícone (a arte em si, não a moldura) preenchendo a maior parte do painel de ícone, com folga pra não encostar na borda. */
const DETAIL_ICON_TARGET_PX = DETAIL_ICON_PANEL_WIDTH * 0.55;
const DETAIL_NAME_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '13px',
  fontStyle: 'bold',
  color: '#4a3524',
  align: 'center',
};
const DETAIL_STATUS_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  color: '#6b5a4a',
  align: 'center',
  wordWrap: { width: DETAIL_TEXT_PANEL_WIDTH - 16 },
};
const QUESTION_MARK_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '16px',
  fontStyle: 'bold',
  color: '#4a3524',
};

/** As 4 abas do Inventário (pedido explícito): Mochila (equipáveis, com seleção de Hotbar), Pesca (ainda sem mecânica), Agricultura (colheita, só visualização) e Habilidades (XP e árvore de habilidades — `ui/skillTreePanel.ts`). */
export type InventoryTabCategory = 'backpack' | 'fishing' | 'agriculture' | 'skills';

interface InventoryTabDefinition {
  category: InventoryTabCategory;
  textureKey: string;
  iconFrame: number | string;
  tabFrame: string;
  tabFrameLight: string;
}

/** Reaproveita as fitas de cor já usadas na Loja (`data/ui.ts`) — verde combina com o sentido real da aba Agricultura; azul/laranja ficam livres para Mochila/Pesca (as duas telas nunca abrem juntas, então não há conflito de identidade visual). */
const TAB_DEFS: InventoryTabDefinition[] = [
  {
    category: 'backpack',
    textureKey: BACKPACK_ICON_KEY,
    iconFrame: BACKPACK_ICON_FRAME.name,
    tabFrame: TAB_FRAME_TOOLS.name,
    tabFrameLight: TAB_FRAME_TOOLS_LIGHT.name,
  },
  {
    category: 'fishing',
    textureKey: FISHING_ROD_ICON_KEY,
    iconFrame: FISHING_ROD_ICON_FRAME.name,
    tabFrame: TAB_FRAME_CONSTRUCTION.name,
    tabFrameLight: TAB_FRAME_CONSTRUCTION_LIGHT.name,
  },
  {
    category: 'agriculture',
    textureKey: ALL_CROPS_ICONS_KEY,
    iconFrame: Object.values(CROPS)[0]?.cropFrameName ?? '',
    tabFrame: TAB_FRAME_AGRICULTURE.name,
    tabFrameLight: TAB_FRAME_AGRICULTURE_LIGHT.name,
  },
  {
    category: 'skills',
    textureKey: SKILLS_TAB_ICON.key,
    iconFrame: SKILLS_TAB_ICON.frame.name,
    tabFrame: TAB_FRAME_SKILLS.name,
    tabFrameLight: TAB_FRAME_SKILLS_LIGHT.name,
  },
];

interface InventoryTab {
  category: InventoryTabCategory;
  background: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  baseX: number;
  y: number;
}

interface InventorySlot {
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  badgeText: Phaser.GameObjects.Text;
  /** "?" central (Fase 9 — diário de descobertas), visível só num slot de Agricultura ainda não descoberto — ver `QUESTION_MARK_STYLE`. */
  questionMark: Phaser.GameObjects.Text;
  /** Posição fixa do slot (a mesma sempre — o que muda de frame a frame é o CONTEÚDO nela, nunca a célula). Usada pra resetar o ícone de volta no lugar certo a cada render, já que o drag o move temporariamente. */
  x: number;
  y: number;
  onClick: (() => void) | null;
  /** Nome do item no slot (balão do `Tooltip` ao passar o mouse); `''` = slot vazio, sem balão. Atualizado a cada `renderActiveCategory`. */
  name: string;
  /** Célula da fileira da Hotbar (em cima do livro): aparece em todas as abas e sempre aceita arrasto. */
  hotbar: boolean;
}

/** O que um slot do grid mostra, resolvido a partir do `Inventory`/`CROPS` — ver `computeContent`. */
interface InventorySlotContent {
  textureKey: string;
  iconFrame: number | string;
  badge: string;
  tint: number;
  /** Tom do ÍCONE (não do quadro): o do item, quando ele tem (`SlotVisual.tint`). */
  iconTint?: number;
  /** Nome mostrado no balão (`Tooltip`) ao passar o mouse; `''` = nada a mostrar. */
  name: string;
  onClick: (() => void) | null;
  /** Só relevante na aba Agricultura (Fase 9 — diário de descobertas): mostra "?" em vez do ícone quando `false`. `true` em qualquer outra aba (não afeta o comportamento de antes). */
  discovered: boolean;
  /** Índice do slot que pode ser arrastado para OUTRO (Fase 9 — drag and drop, pedido explícito do usuário) — só a Mochila usa isso; `undefined` desativa o arrasto (Agricultura é só leitura). */
  slotIndex?: number;
  /** Slot TRANCADO da Bolsa (`Inventory.isSlotLocked`): moldura escura e o aviso de como destrancar no balão. */
  locked?: boolean;
}

/** O balão de um slot trancado vazio. */
const LOCKED_SLOT_TEXT = 'Trancado: compre a Bolsa maior com o Tomás (Marceneiro)';

/**
 * Tela de Inventário (Fase 8, tecla E), reformulada para usar exatamente o
 * mesmo layout/lógica visual do `ShopMenu` (pedido explícito): fundo do
 * Livro, abas rotacionadas na lateral esquerda com hover, seletor branco de
 * canto na aba ativa e botão de fechar (marcador de couro + X) na direita.
 *
 * Abas: Mochila (o ESTOQUE da Bolsa — os slots de `Inventory` depois dos 8 da Hotbar: ferramentas,
 * sementes, decorações e materiais guardados), Pesca, Agricultura e Habilidades. Em cima do livro, em
 * todas as abas, fica a fileira da HOTBAR (os 8 primeiros slots, no estilo do caderno): clicar seleciona
 * o slot ativo e arrastar entre ela e a página troca os slots — um item nunca aparece nos dois lugares.
 * Detalhe das outras abas:
 * Pesca (placeholder "Em breve" — sem mecânica de pesca ainda) e Agricultura
 * (visão só-leitura da colheita: `CROPS` + `inventory.getCount(cropId)`, em
 * vez de depender de um slot físico — corrige o bug relatado de colheitas
 * nunca aparecerem em lugar nenhum, já que `Farmland.harvest` nunca chama
 * `ensureSlotted`, diferente de sementes/decorações/materiais).
 *
 * Instanciada uma única vez pela `UIScene` (persistente entre cenas — ver
 * `scenes/UIScene.ts`), para poder abrir em qualquer mapa (Fazenda ou
 * externo), não só na Fazenda.
 */
export class InventoryScreen implements PointerInputInterceptor {
  private readonly book: Phaser.GameObjects.Image;
  private readonly tabs: InventoryTab[] = [];
  private readonly tabSelector: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly slots: InventorySlot[] = [];
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  /** A lixeira (embaixo do botão de fechar): soltar um item arrastado nela o joga fora inteiro (`Inventory.trashSlot`). */
  private readonly trashCan: Phaser.GameObjects.Image;
  private trashBaseScale = 1;
  private activeCategory: InventoryTabCategory = 'backpack';
  private isOpen_ = false;
  /** Referência viva do `Inventory` sendo mostrado — guardada pra o `dragend` (disparado fora do fluxo normal de `refresh`) poder chamar `swapSlots` sem precisar receber o inventário de novo. */
  private currentInventory: Inventory | null = null;
  /** Slot que está sendo arrastado no momento (Fase 9 — drag and drop), `null` quando não há arrasto em andamento. */
  private dragSourceIndex: number | null = null;
  /** Ponteiro sob o qual o balão do `Tooltip` se posiciona quando o redesenho (não um evento do mouse) pede pra atualizá-lo. */
  private readonly activePointer: Phaser.Input.Pointer;
  /** Por slot: o ponteiro está em cima da moldura / do ícone (o ícone cobre o centro da moldura, então cada um recebe o hover da sua própria área) — `pointerover`/`pointerout` ligam e desligam. */
  private readonly frameHovered: boolean[] = new Array(CELL_COUNT).fill(false);
  private readonly iconHovered: boolean[] = new Array(CELL_COUNT).fill(false);
  /** Slot da Bolsa que cada célula mostra agora (`undefined` = célula sem slot, ex.: a Agricultura) — o arrasto troca esses slots. */
  private cellSlotIndex: Array<number | undefined> = [];
  /** O "livro fino" atrás da fileira da Hotbar (duas metades). */
  private readonly hotbarBook: Phaser.GameObjects.NineSlice[] = [];

  // Página direita da aba Mochila (Fase 9 — personagem + equipamento).
  private readonly characterSprite: Phaser.GameObjects.Image;
  private readonly equipmentSlots: Array<{ type: EquipmentSlotType; frame: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image }> = [];

  // Página direita da aba Agricultura (Fase 9 — diário de descobertas).
  // `NineSlice` (correção urgente pedida pelo usuário — ver doc de
  // `DETAIL_ICON_PANEL_WIDTH`): tamanho FIXO, cantos preservados.
  private readonly detailIconPanel: Phaser.GameObjects.NineSlice;
  private readonly detailTextPanel: Phaser.GameObjects.NineSlice;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailQuestionMark: Phaser.GameObjects.Text;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailStatus: Phaser.GameObjects.Text;
  private selectedCropId: string | null = null;
  /** Cantinhos de destaque (mesma técnica de `tabSelector`) ao redor do slot selecionado no grid da Agricultura — referência visual pedida pelo usuário. */
  private readonly gridSelector: Record<CornerKey, Phaser.GameObjects.Image>;

  // Aba Habilidades (Progressão e RPG): as duas páginas são do painel próprio.
  private readonly skillPanel: SkillTreePanel;

  constructor(scene: Phaser.Scene, private readonly onSelectHotbarSlot: (index: number) => void, private readonly tooltip: Tooltip) {
    this.activePointer = scene.input.activePointer;
    const panelTexture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!panelTexture.has(INVENTORY_SLOT_FRAME_NAME)) {
      panelTexture.add(
        INVENTORY_SLOT_FRAME_NAME,
        0,
        INVENTORY_SLOT_RECT.x,
        INVENTORY_SLOT_RECT.y,
        INVENTORY_SLOT_RECT.width,
        INVENTORY_SLOT_RECT.height,
      );
    }
    if (!panelTexture.has(INVENTORY_SLOT_DARK_FRAME_NAME)) {
      panelTexture.add(
        INVENTORY_SLOT_DARK_FRAME_NAME,
        0,
        INVENTORY_SLOT_DARK_RECT.x,
        INVENTORY_SLOT_DARK_RECT.y,
        INVENTORY_SLOT_DARK_RECT.width,
        INVENTORY_SLOT_DARK_RECT.height,
      );
    }
    const largePanelTexture = scene.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largePanelTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      largePanelTexture.add(
        INVENTORY_LARGE_PANEL_FRAME_NAME,
        0,
        INVENTORY_LARGE_PANEL_RECT.x,
        INVENTORY_LARGE_PANEL_RECT.y,
        INVENTORY_LARGE_PANEL_RECT.width,
        INVENTORY_LARGE_PANEL_RECT.height,
      );
    }
    const backpackTexture = scene.textures.get(BACKPACK_ICON_KEY);
    if (!backpackTexture.has(BACKPACK_ICON_FRAME.name)) {
      const rect = BACKPACK_ICON_FRAME.rect;
      backpackTexture.add(BACKPACK_ICON_FRAME.name, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const fishingRodTexture = scene.textures.get(FISHING_ROD_ICON_KEY);
    if (!fishingRodTexture.has(FISHING_ROD_ICON_FRAME.name)) {
      const rect = FISHING_ROD_ICON_FRAME.rect;
      fishingRodTexture.add(FISHING_ROD_ICON_FRAME.name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    // Fita vermelha e ícone da aba Habilidades (a fita vem da mesma folha das outras; o ícone, da folha carregada pela UIScene).
    const ribbonsTexture = scene.textures.get(SHOP_TAB_RIBBONS_KEY);
    for (const ribbon of [TAB_FRAME_SKILLS, TAB_FRAME_SKILLS_LIGHT]) {
      if (!ribbonsTexture.has(ribbon.name)) ribbonsTexture.add(ribbon.name, 0, ribbon.rect.x, ribbon.rect.y, ribbon.rect.width, ribbon.rect.height);
    }
    const skillsTabTexture = scene.textures.get(SKILLS_TAB_ICON.key);
    if (!skillsTabTexture.has(SKILLS_TAB_ICON.frame.name)) {
      const rect = SKILLS_TAB_ICON.frame.rect;
      skillsTabTexture.add(SKILLS_TAB_ICON.frame.name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;

    this.book = scene.add.image(centerX, centerY, SHOP_BOOK_KEY, SHOP_BOOK_FRAME_NAME);
    this.book.setOrigin(0.5, 0.5);
    this.book.setScale(BOOK_SCALE);
    this.book.setScrollFactor(0);
    this.book.setDepth(3000);

    const bookWidth = this.book.displayWidth;
    const bookHeight = this.book.displayHeight;
    const bookLeft = centerX - bookWidth / 2;
    const bookTop = centerY - bookHeight / 2;

    const tabX = bookLeft + TAB_BOOK_OVERLAP;
    const totalTabsHeight = TAB_DEFS.length * TAB_DISPLAY_THICKNESS + (TAB_DEFS.length - 1) * TAB_GAP_Y;
    let tabY = centerY - totalTabsHeight / 2 + TAB_DISPLAY_THICKNESS / 2;
    const tabDepth = this.book.depth + 1;

    for (const tabDef of TAB_DEFS) {
      const background = scene.add.image(tabX, tabY, SHOP_TAB_RIBBONS_KEY, tabDef.tabFrame);
      background.setOrigin(1, 0.5);
      background.setScale(TAB_SCALE);
      background.setRotation(TAB_ROTATION);
      background.setScrollFactor(0);
      background.setDepth(tabDepth);

      const icon = scene.add.image(tabX + TAB_ICON_OFFSET_X, tabY + TAB_ICON_OFFSET_Y, tabDef.textureKey, tabDef.iconFrame);
      icon.setOrigin(0.5, 0.5);
      icon.setScale(computeFitScale(icon, TAB_ICON_TARGET_PX));
      icon.setScrollFactor(0);
      icon.setDepth(tabDepth + 1);

      background.setInteractive({ useHandCursor: true });
      background.disableInteractive();
      background.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          playClick(scene);
          this.selectCategory(tabDef.category);
        },
      );
      background.on('pointerover', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrameLight);
      });
      background.on('pointerout', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrame);
      });

      this.tabs.push({ category: tabDef.category, background, icon, baseX: tabX, y: tabY });
      tabY += TAB_DISPLAY_THICKNESS + TAB_GAP_Y;
    }

    const cursorTexture = scene.textures.get(EXTRAS_UI_KEY);
    for (const key of Object.keys(GLOBAL_CURSOR_CORNER_NAMES) as CornerKey[]) {
      const name = GLOBAL_CURSOR_CORNER_NAMES[key];
      if (!cursorTexture.has(name)) {
        const rect = GLOBAL_CURSOR_CORNER_RECTS[key];
        cursorTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }
    const makeSelectorCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
      corner.setOrigin(originX, originY);
      corner.setScale(TAB_SELECTOR_SCALE);
      corner.setScrollFactor(0);
      corner.setDepth(tabDepth + 2);
      return corner;
    };
    this.tabSelector = {
      topLeft: makeSelectorCorner('topLeft', 0, 0),
      topRight: makeSelectorCorner('topRight', 1, 0),
      bottomLeft: makeSelectorCorner('bottomLeft', 0, 1),
      bottomRight: makeSelectorCorner('bottomRight', 1, 1),
    };

    const bookRight = bookLeft + bookWidth;
    const closeX = bookRight - CLOSE_BOOK_OVERLAP;
    const closeDepth = this.book.depth + 1;

    this.closeButton = scene.add.image(closeX, centerY, SHOP_BOOK_KEY, CLOSE_TAB_BG_FRAME.name);
    this.closeButton.setOrigin(0, 0.5);
    this.closeButton.setScale(CLOSE_MARK_SCALE);
    this.closeButton.setScrollFactor(0);
    this.closeButton.setDepth(closeDepth);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.disableInteractive();
this.closeButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (!this.isOpen_) return;
      event.stopPropagation();
      playClick(scene);
      
      // 1. Muda a arte instantaneamente
      this.closeButtonMark.setFrame(CLOSE_X_ICON_PRESSED_FRAME.name); 

      // 2. O relógio nativo do sistema (setTimeout) conta 100ms e fecha a tela!
      setTimeout(() => {
        if (this.isOpen_) {
          this.closeButtonMark.setFrame(CLOSE_X_ICON_FRAME.name); 
          this.close(); 
        }
      }, 90);
    });

    const ajusteX = -16; // Valores negativos puxam para a esquerda
    const ajusteY = -8;  // Valores negativos sobem, positivos descem
    
    this.closeButtonMark = scene.add.image(
      closeX + CLOSE_X_OFFSET_X + ajusteX, 
      centerY + ajusteY, 
      CLOSE_BUTTON_SHEET_KEY, 
      CLOSE_X_ICON_FRAME.name
    );
    
    this.closeButtonMark.setOrigin(0.5, 0.5);
    this.closeButtonMark.setScale(computeFitScale(this.closeButtonMark, CLOSE_X_TARGET_PX));
    this.closeButtonMark.setScrollFactor(0);
    this.closeButtonMark.setDepth(closeDepth + 1);

    // A lixeira: fora do livro, junto ao canto de baixo à direita — arraste um item até ela pra jogá-lo fora.
    const trashTexture = scene.textures.get(TRASH_CAN_KEY);
    if (!trashTexture.has(TRASH_CAN_FRAME.name)) trashTexture.add(TRASH_CAN_FRAME.name, 0, TRASH_CAN_FRAME.rect.x, TRASH_CAN_FRAME.rect.y, TRASH_CAN_FRAME.rect.width, TRASH_CAN_FRAME.rect.height);
    this.trashCan = scene.add.image(closeX + CLOSE_X_OFFSET_X + ajusteX + TRASH_OFFSET_X, bookTop + bookHeight - TRASH_BOTTOM_INSET, TRASH_CAN_KEY, TRASH_CAN_FRAME.name);
    this.trashCan.setOrigin(0.5, 1).setScrollFactor(0).setDepth(closeDepth + 1);
    this.trashBaseScale = computeFitScale(this.trashCan, TRASH_TARGET_PX);
    this.trashCan.setScale(this.trashBaseScale);
    this.trashCan.setVisible(false);

    const slotWidth = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const slotHeight = INVENTORY_SLOT_RECT.height * SLOT_SCALE;
    const gridWidth = GRID_COLS * slotWidth + (GRID_COLS - 1) * SLOT_GAP;
    const gridHeight = GRID_ROWS * slotHeight + (GRID_ROWS - 1) * ROW_GAP;

    const pageTop = bookTop + PAGE_RECT.top * BOOK_SCALE;
    const pageHeight = PAGE_RECT.height * BOOK_SCALE;
    const startY = pageTop + (pageHeight - gridHeight) / 2 + slotHeight / 2;

    const leftPageWidth = PAGE_RECT.left.width * BOOK_SCALE;
    const leftStartX = bookLeft + PAGE_RECT.left.x * BOOK_SCALE + (leftPageWidth - gridWidth) / 2 + slotWidth / 2;

    // O grid da página ESQUERDA (6x5 = `STORAGE_SIZE`, o estoque inteiro numa página); a direita é conteúdo próprio por aba
    // (personagem+equipamento, painel de detalhe). A Hotbar fica numa fileira à parte, em cima do livro (abaixo).
    for (let index = 0; index < ITEMS_PER_PAGE; index++) {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);

      const x = leftStartX + col * (slotWidth + SLOT_GAP);
      const y = startY + row * (slotHeight + ROW_GAP);

      this.createCell(scene, index, x, y, slotWidth, slotHeight, false);
    }

    // A fileira da Hotbar, em cima do caderno e centralizada nele, sobre o "livro fino" (ver `HOTBAR_BOOK_*`).
    const rowWidth = HOTBAR_SIZE * slotWidth + (HOTBAR_SIZE - 1) * SLOT_GAP + HOTBAR_BOOK_SPINE_GAP;
    const hotbarBookHalfWidth = (rowWidth / 2 + HOTBAR_BOOK_SIDE_PAD) / BOOK_SCALE + HOTBAR_BOOK_OUTER;
    const hotbarBookTop = bookTop - HOTBAR_BOOK_GAP - HOTBAR_BOOK_HEIGHT * BOOK_SCALE;
    const bookTexture = scene.textures.get(SHOP_BOOK_KEY);
    for (const half of [HOTBAR_BOOK_LEFT, HOTBAR_BOOK_RIGHT]) {
      if (!bookTexture.has(half.name)) bookTexture.add(half.name, 0, half.rect.x, half.rect.y, half.rect.width, half.rect.height);
      const isLeft = half === HOTBAR_BOOK_LEFT;
      const piece = scene.add.nineslice(centerX, hotbarBookTop, SHOP_BOOK_KEY, half.name, hotbarBookHalfWidth, HOTBAR_BOOK_HEIGHT, isLeft ? HOTBAR_BOOK_OUTER : HOTBAR_BOOK_INNER, isLeft ? HOTBAR_BOOK_INNER : HOTBAR_BOOK_OUTER, HOTBAR_BOOK_TOP, HOTBAR_BOOK_BOTTOM);
      piece.setOrigin(isLeft ? 1 : 0, 0).setScale(BOOK_SCALE).setScrollFactor(0).setDepth(3000);
      this.hotbarBook.push(piece);
    }
    const rowY = hotbarBookTop + HOTBAR_BOOK_ROW_Y * BOOK_SCALE;
    for (let cell = 0; cell < HOTBAR_SIZE; cell++) {
      const x = centerX - rowWidth / 2 + slotWidth / 2 + cell * (slotWidth + SLOT_GAP) + (cell >= HOTBAR_SIZE / 2 ? HOTBAR_BOOK_SPINE_GAP : 0);
      this.createCell(scene, HOTBAR_ROW_FIRST_CELL + cell, x, rowY, slotWidth, slotHeight, true);
    }

    // Página direita — Mochila: personagem parado (mesmo frame usado como
    // pose de repouso no mundo) cercado pelos 5 slots de equipamento.
    const rightPageWidth = PAGE_RECT.right.width * BOOK_SCALE;
    const rightCenterX = bookLeft + PAGE_RECT.right.x * BOOK_SCALE + rightPageWidth / 2;
    const rightCenterY = bookTop + PAGE_RECT.top * BOOK_SCALE + pageHeight / 2;

    this.characterSprite = scene.add.image(rightCenterX, rightCenterY, getPlayerAssets(gameState.profile).idleKey, PLAYER_ANIM_FRAMES.idleDown.start);
    this.characterSprite.setOrigin(0.5, 0.5);
    this.characterSprite.setScale(CHARACTER_SPRITE_SCALE);
    this.characterSprite.setScrollFactor(0);
    this.characterSprite.setDepth(3001);

    for (const def of EQUIPMENT_SLOTS) {
      const ex = rightCenterX + def.offsetX * (BOOK_SCALE / 2);
      const ey = rightCenterY + def.offsetY * (BOOK_SCALE / 2);

      const frame = scene.add.image(ex, ey, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5);
      frame.setScale(EQUIPMENT_SLOT_SCALE);
      frame.setScrollFactor(0);
      frame.setDepth(3002);

      const label = scene.add.text(ex, ey + (INVENTORY_SLOT_RECT.height * EQUIPMENT_SLOT_SCALE) / 2 + 2, def.label, EQUIPMENT_LABEL_STYLE);
      label.setOrigin(0.5, 0);
      label.setScrollFactor(0);
      label.setDepth(3002);

      // Ícone do que está vestido (hoje só a armadura, no slot "shirt"): clicar tira.
      const icon = scene.add.image(ex, ey, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      icon.setOrigin(0.5, 0.5);
      icon.setScrollFactor(0);
      icon.setDepth(3003);
      icon.setVisible(false);
      icon.setInteractive({ useHandCursor: true });
      icon.disableInteractive();
      icon.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_ || !this.currentInventory) return;
        event.stopPropagation();
        const equipped = this.currentInventory.getEquippedArmorId();
        if (!equipped) return;
        playClick(scene);
        this.currentInventory.toggleArmor(equipped);
      });
      icon.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        const equipped = this.currentInventory?.getEquippedArmorId();
        const name = equipped ? resolveSlotVisual({ category: 'armor', id: equipped })?.name : '';
        if (name) this.tooltip.show(`${name} (clique para tirar)`, pointer);
      });
      icon.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (this.tooltip.isVisible()) this.tooltip.follow(pointer);
      });
      icon.on('pointerout', () => this.tooltip.hide());

      this.equipmentSlots.push({ type: def.type, frame, label, icon });
    }

    // Página direita — Agricultura: painel de detalhe do item selecionado
    // no grid da esquerda (layout de referência do usuário: ícone grande +
    // nome + status "Descoberto"/"Ainda não descoberto"). Correção urgente
    // pedida pelo usuário: `NineSlice` com tamanho FIXO em vez de `Image` +
    // `setScale` gigante — os cantos ornamentados do painel nunca esticam,
    // só o miolo (ver `INVENTORY_LARGE_PANEL_BORDER`).
    const detailIconY = rightCenterY - (DETAIL_TEXT_PANEL_HEIGHT + DETAIL_PANEL_GAP) / 2;
    const detailTextY = detailIconY + DETAIL_ICON_PANEL_HEIGHT / 2 + DETAIL_PANEL_GAP + DETAIL_TEXT_PANEL_HEIGHT / 2;

    this.detailIconPanel = scene.add.nineslice(
      rightCenterX,
      detailIconY,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      DETAIL_ICON_PANEL_WIDTH,
      DETAIL_ICON_PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    this.detailIconPanel.setOrigin(0.5, 0.5);
    this.detailIconPanel.setScrollFactor(0);
    this.detailIconPanel.setDepth(3001);

    this.detailIcon = scene.add.image(rightCenterX, detailIconY, ALL_CROPS_ICONS_KEY, '');
    this.detailIcon.setOrigin(0.5, 0.5);
    this.detailIcon.setScrollFactor(0);
    this.detailIcon.setDepth(3002);

    this.detailQuestionMark = scene.add.text(rightCenterX, detailIconY, '???', {
      ...QUESTION_MARK_STYLE,
      fontSize: '22px',
    });
    this.detailQuestionMark.setOrigin(0.5, 0.5);
    this.detailQuestionMark.setScrollFactor(0);
    this.detailQuestionMark.setDepth(3002);

    this.detailTextPanel = scene.add.nineslice(
      rightCenterX,
      detailTextY,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      DETAIL_TEXT_PANEL_WIDTH,
      DETAIL_TEXT_PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    this.detailTextPanel.setOrigin(0.5, 0.5);
    this.detailTextPanel.setScrollFactor(0);
    this.detailTextPanel.setDepth(3001);

    this.detailName = scene.add.text(rightCenterX, detailTextY - 14, '', DETAIL_NAME_STYLE);
    this.detailName.setOrigin(0.5, 0.5);
    this.detailName.setScrollFactor(0);
    this.detailName.setDepth(3002);

    this.detailStatus = scene.add.text(rightCenterX, detailTextY + 10, '', DETAIL_STATUS_STYLE);
    this.detailStatus.setOrigin(0.5, 0.5);
    this.detailStatus.setScrollFactor(0);
    this.detailStatus.setDepth(3002);

    const makeGridSelectorCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
      corner.setOrigin(originX, originY);
      corner.setScale(SLOT_SCALE);
      corner.setScrollFactor(0);
      corner.setDepth(3003);
      return corner;
    };
    this.gridSelector = {
      topLeft: makeGridSelectorCorner('topLeft', 0, 0),
      topRight: makeGridSelectorCorner('topRight', 1, 0),
      bottomLeft: makeGridSelectorCorner('bottomLeft', 0, 1),
      bottomRight: makeGridSelectorCorner('bottomRight', 1, 1),
    };

    this.skillPanel = new SkillTreePanel(scene, {
      leftX: bookLeft + PAGE_RECT.left.x * BOOK_SCALE,
      leftWidth: leftPageWidth,
      rightX: bookLeft + PAGE_RECT.right.x * BOOK_SCALE,
      rightWidth: rightPageWidth,
      top: pageTop,
      height: pageHeight,
    });

    this.emptyText = scene.add.text(centerX, centerY, 'Em breve', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#6b5a4a',
    });
    this.emptyText.setOrigin(0.5, 0.5);
    this.emptyText.setScrollFactor(0);
    this.emptyText.setDepth(3002);

    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  /** `PointerInputInterceptor`: enquanto aberta, os cliques nos slots já fazem `stopPropagation` — só existir já evita que o clique vaze para o mundo (mover/interagir). */
  isActive(): boolean {
    return this.isOpen_;
  }

  handleClick(): void {
    // Nada a fazer — ver `isActive()`.
  }

  open(inventory: Inventory): void {
    this.isOpen_ = true;
    this.currentInventory = inventory;
    this.setElementsVisible(true);
    this.renderActiveCategory(inventory);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
    this.clearHover();
  }

  toggle(inventory: Inventory): void {
    if (this.isOpen_) this.close();
    else this.open(inventory);
  }

  /**
   * Balão com o nome do item (`Tooltip`): liga `pointerover` (mostra), `pointermove`
   * (acompanha o ponteiro) e `pointerout` (esconde) do `target` ao slot `index`.
   * `hovered` é a lista (moldura ou ícone) que registra se o ponteiro está nele.
   */
  private attachSlotHover(target: Phaser.GameObjects.Image, index: number, hovered: boolean[]): void {
    target.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      hovered[index] = true;
      this.updateTooltip(pointer);
    });
    target.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.tooltip.isVisible()) this.tooltip.follow(pointer);
    });
    target.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      hovered[index] = false;
      this.updateTooltip(pointer);
    });
  }

  /** Mostra o nome do slot sob o ponteiro (se houver e a tela estiver aberta/sem arrasto), senão esconde o balão. */
  private updateTooltip(pointer: Phaser.Input.Pointer): void {
    const index = this.slots.findIndex((_slot, i) => this.frameHovered[i] || this.iconHovered[i]);
    const name = this.isOpen_ && this.dragSourceIndex === null && index !== -1 ? this.slots[index].name : '';
    if (name) this.tooltip.show(name, pointer);
    else this.tooltip.hide();
  }

  private clearHover(): void {
    this.frameHovered.fill(false);
    this.iconHovered.fill(false);
    this.tooltip.hide();
  }

  /** Chamado a cada frame enquanto aberta (ver `UIScene.update`) — mantém a aba Mochila e o realce da Hotbar sempre em dia com o `Inventory` ao vivo. */
  refresh(inventory: Inventory): void {
    if (!this.isOpen_) return;
    this.currentInventory = inventory;
    this.renderActiveCategory(inventory);
  }

  private selectCategory(category: InventoryTabCategory): void {
    if (category === this.activeCategory) return;
    this.activeCategory = category;
  }

  /** Clicado num slot do grid da Agricultura (pedido explícito do usuário: clicar mostra o detalhe na página direita, descoberto ou não). */
  private selectCropDetail(cropId: string): void {
    this.selectedCropId = cropId;
  }

/** Uma célula (moldura, ícone arrastável, número, "?") — as da página do caderno e as da fileira da Hotbar em cima dele. */
  private createCell(scene: Phaser.Scene, index: number, x: number, y: number, slotWidth: number, slotHeight: number, hotbar: boolean): void {
    const frame = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
    frame.setOrigin(0.5, 0.5);
    frame.setScale(SLOT_SCALE);
    frame.setScrollFactor(0);
    frame.setDepth(3001);

    // "Clique" no slot (selecionar a Hotbar, vestir a armadura...). A moldura também é interativa em
    // slots sem ação (só pro balão do nome) — esses não fazem "clique".
    const activateSlot = (): void => {
      if (!this.isOpen_ || !this.slots[index].onClick) return;
      playClick(scene);
      this.slots[index].onClick?.();
    };

    frame.setInteractive({ useHandCursor: true });
    frame.disableInteractive();
    frame.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        activateSlot();
      },
    );
    this.attachSlotHover(frame, index, this.frameHovered);

    const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
    icon.setOrigin(0.5, 0.5);
    icon.setScrollFactor(0);
    icon.setDepth(3002);

    // Drag and drop (Fase 9, pedido explícito do usuário): só o ÍCONE é
    // arrastável (o `frame` embaixo continua cuidando do clique-pra-
    // selecionar-Hotbar, igual antes) — só fica interativo/arrastável
    // quando a aba Mochila está ativa E o slot tem algo dentro
    // (`renderActiveCategory` decide isso a cada frame).
    //
    // "Juice" (pedido explícito): pop de escala/opacidade ao pegar, e um
    // tween suave ao soltar — tanto no caso de encaixe válido (volta à
    // escala normal) quanto inválido (some volta pro slot de origem).
    // `dragBaseScale` guarda a escala "de repouso" (a que `computeFitScale`
    // calculou pra esse ícone) capturada no instante do pickup, porque o
    // pop escala RELATIVO a ela (não um valor fixo) — cada ícone pode ter
    // uma escala de repouso diferente dependendo do tamanho nativo do
    // frame. `renderActiveCategory` só solta o controle de posição/escala
    // de volta pro ícone quando `dragSourceIndex` volta a `null` — por
    // isso só é zerado no `onComplete` do tween de retorno, não na hora
    // do `dragend`: senão o redesenho de todo frame reposicionaria/
    // reescalaria o ícone instantaneamente, cortando o tween no meio.
    let dragBaseScale = 1;
    icon.setInteractive({ useHandCursor: true });
    icon.disableInteractive();
    scene.input.setDraggable(icon, true);
    this.attachSlotHover(icon, index, this.iconHovered);
    // O ícone (arrastável) fica POR CIMA da moldura e leva o clique sozinho — sem isto, clicar no item
    // nunca chegava na moldura. Soltar sem ter arrastado conta como clique no slot.
    let dragged = false;
    icon.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      dragged = false;
      if (this.isOpen_) event.stopPropagation();
    });
    icon.on('pointerup', () => {
      if (!dragged) activateSlot();
    });
    icon.on('dragstart', () => {
      dragged = true;
      this.clearHover(); // Arrastando: o balão some (o ícone segue o cursor por conta própria).
      this.dragSourceIndex = index;
      icon.setDepth(3500);
      dragBaseScale = icon.scaleX;
      scene.tweens.killTweensOf(icon);
      scene.tweens.add({
        targets: icon,
        scale: dragBaseScale * 1.2,
        alpha: 0.85,
        duration: 100,
        ease: 'Quad.easeOut',
      });
    });
    icon.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      icon.setPosition(dragX, dragY);
      this.setTrashHover(this.isOverTrash(dragX, dragY));
    });
    icon.on('dragend', () => {
      const sourceIndex = this.dragSourceIndex;
      icon.setDepth(3002);
      if (sourceIndex === null || !this.currentInventory) return;

      const targetIndex = this.slots.findIndex((slot) => Phaser.Geom.Rectangle.Contains(slot.frame.getBounds(), icon.x, icon.y));
      // Troca os SLOTS da Bolsa que as duas células mostram (a página é o estoque, a fileira de cima é a Hotbar): equipar tira do
      // caderno e guardar tira da Hotbar — o item nunca aparece duas vezes.
      const sourceSlot = this.cellSlotIndex[sourceIndex];
      const targetSlot = targetIndex === -1 ? undefined : this.cellSlotIndex[targetIndex];
      const validDrop = targetIndex !== -1 && targetIndex !== sourceIndex && sourceSlot !== undefined && targetSlot !== undefined && this.currentInventory.canSwapSlots(sourceSlot, targetSlot);
      if (validDrop) this.currentInventory.swapSlots(sourceSlot!, targetSlot!);
      else if (sourceSlot !== undefined && this.isOverTrash(icon.x, icon.y)) this.trash(sourceSlot);
      this.setTrashHover(false);

      // Encaixe válido: tween curto e rápido (já "encaixou"). Inválido:
      // tween mais longo com "Back.easeOut" — um pequeno ricochete ao
      // pousar de volta na origem, mais perceptível como "devolvido".
      scene.tweens.killTweensOf(icon);
      scene.tweens.add({
        targets: icon,
        x: this.slots[index].x,
        y: this.slots[index].y,
        scale: dragBaseScale,
        alpha: 1,
        duration: validDrop ? 100 : 180,
        ease: validDrop ? 'Quad.easeOut' : 'Back.easeOut',
        onComplete: () => {
          this.dragSourceIndex = null;
        },
      });
    });

    const badgeText = scene.add.text(x + slotWidth / 2 - 2, y + slotHeight / 2 - 2, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#2b1d0e',
      strokeThickness: 3,
    });
    badgeText.setOrigin(1, 1);
    badgeText.setScrollFactor(0);
    badgeText.setDepth(3004); // Acima do ícone (3002; 3500 enquanto arrasta): a quantidade nunca fica atrás dele.

    const questionMark = scene.add.text(x, y, '?', QUESTION_MARK_STYLE);
    questionMark.setOrigin(0.5, 0.5);
    questionMark.setScrollFactor(0);
    questionMark.setDepth(3002);
    questionMark.setVisible(false);

    this.slots.push({ frame, icon, badgeText, questionMark, x, y, onClick: null, name: '', hotbar });
  }

  /**
   * O que uma célula mostra pra um slot da Bolsa: ícone, quantidade, clique. Slot da Hotbar (0-7): clicar seleciona e o ativo ganha o tom
   * creme. Armadura: clicar veste/tira (a vestida ganha "E" e um tom azulado).
   */
  /** O ponto (px de tela) está sobre a lixeira (visível)? */
  private isOverTrash(x: number, y: number): boolean {
    return this.trashCan.visible && Phaser.Geom.Rectangle.Contains(this.trashCan.getBounds(), x, y);
  }

  /** A lixeira cresce um pouco enquanto um item arrastado está sobre ela. */
  private setTrashHover(over: boolean): void {
    this.trashCan.setScale(this.trashBaseScale * (over ? TRASH_HOVER_FACTOR : 1));
  }

  /** Joga fora o item do slot da Bolsa `slotIndex` (ferramentas e armaduras ficam — `Inventory.trashSlot`), com o aviso em cima da lixeira. */
  private trash(slotIndex: number): void {
    if (!this.currentInventory) return;
    const ref = this.currentInventory.getSlot(slotIndex);
    const name = ref ? (resolveSlotVisual(ref)?.name ?? ref.id) : '';
    const result = this.currentInventory.trashSlot(slotIndex);
    const x = this.trashCan.x;
    const y = this.trashCan.y - this.trashCan.displayHeight - 4;
    if (result.kind === 'refused') {
      popText(this.trashCan.scene, x, y, 'Ferramentas e armaduras não vão pro lixo', { color: '#ff8a8a', fontSize: 14, screenFixed: true });
      return;
    }
    if (result.kind !== 'trashed') return;
    playEffect(this.trashCan.scene, PLACE_SOUND);
    popText(this.trashCan.scene, x, y, `Jogado fora: ${result.amount > 1 ? `${result.amount} ` : ''}${name}`, { color: '#ffe9b3', fontSize: 14, screenFixed: true });
    this.refresh(this.currentInventory);
  }

  private slotContent(inventory: Inventory, slotIndex: number): InventorySlotContent {
    const isHotbarSlot = slotIndex < HOTBAR_SIZE;
    const tint = isHotbarSlot && slotIndex === inventory.getSelectedHotbarIndex() ? SELECTED_HOTBAR_TINT : UNSELECTED_TINT;
    const onClick = isHotbarSlot ? () => this.onSelectHotbarSlot(slotIndex) : null;
    const ref = inventory.getSlot(slotIndex);
    const visual = ref ? resolveSlotVisual(ref) : null;
    const locked = inventory.isSlotLocked(slotIndex);
    // Trancado e vazio: nada entra (sem `slotIndex`, soltar um item aqui não vale).
    if (locked && (!visual || !ref)) return { textureKey: '', iconFrame: '', badge: '', tint, name: LOCKED_SLOT_TEXT, onClick: null, discovered: true, locked };
    if (!visual || !ref) return { textureKey: '', iconFrame: '', badge: '', tint, name: '', onClick, discovered: true, slotIndex };

    const isArmor = ref.category === 'armor';
    const armorEquipped = isArmor && inventory.getEquippedArmorId() === ref.id;
    let badge = '';
    if (armorEquipped) badge = 'E';
    else if (ref.category === 'seed') badge = String(inventory.getSeedCount(ref.id));
    else if (ref.category === 'decoration') badge = String(inventory.getDecorationCount(ref.id));
    else if (ref.category === 'resource') badge = String(inventory.getResourceCount(ref.id));
    // 'crop': estoque ATUAL na Bolsa — diferente do "Total já coletado" (histórico) mostrado na aba Agricultura.
    else if (ref.category === 'crop') badge = String(inventory.getCount(ref.id));

    return {
      textureKey: visual.textureKey,
      iconFrame: visual.iconFrame,
      badge,
      tint: armorEquipped ? EQUIPPED_ARMOR_TINT : tint,
      iconTint: visual.tint,
      name: armorEquipped ? `${visual.name} (equipada)` : visual.name,
      onClick: isArmor ? () => inventory.toggleArmor(ref.id) : onClick,
      discovered: true,
      slotIndex,
      locked,
    };
  }

  /**
   * O conteúdo de todas as células: as da página (aba ativa — na Mochila, o ESTOQUE: slots `HOTBAR_SIZE` em diante) e as da fileira da
   * Hotbar (slots 0-7), que aparecem em toda aba. `gridCount` = quantas células da página têm conteúdo (o "Em breve" usa).
   */
  private computeContent(inventory: Inventory): { cells: Array<InventorySlotContent | undefined>; gridCount: number } {
    const grid = this.computeGridContent(inventory);
    const cells: Array<InventorySlotContent | undefined> = new Array(CELL_COUNT).fill(undefined);
    grid.forEach((entry, index) => (cells[index] = entry));
    for (let slot = 0; slot < HOTBAR_SIZE; slot++) cells[HOTBAR_ROW_FIRST_CELL + slot] = this.slotContent(inventory, slot);
    return { cells, gridCount: grid.length };
  }

  /** O conteúdo da PÁGINA do caderno na aba ativa. */
  private computeGridContent(inventory: Inventory): InventorySlotContent[] {
    if (this.activeCategory === 'backpack') {
      return Array.from({ length: STORAGE_SIZE }, (_, cell) => this.slotContent(inventory, HOTBAR_SIZE + cell));
    }

    if (this.activeCategory === 'agriculture') {
      // Diário de descobertas (Fase 9, pedido explícito do usuário):
      // `Inventory.hasHarvested` nunca esquece — mesmo se o jogador vender
      // toda a colheita depois, a cultura continua "descoberta".
      return Object.values(CROPS).map((crop) => {
        const discovered = inventory.hasHarvested(crop.id);
        return {
          textureKey: ALL_CROPS_ICONS_KEY,
          // Fruto colhido (pedido explícito, item 4) — não o saquinho de
          // semente: esta aba é sobre o que já foi colhido, não plantado.
          iconFrame: crop.cropFrameName,
          // "Total já coletado" (pedido explícito, item 3) — histórico, não
          // o estoque atual (que cai a zero ao vender tudo na Caixa de Remessas).
          badge: discovered ? String(inventory.getTotalHarvested(crop.id)) : '',
          tint: UNSELECTED_TINT,
          // Mesma regra do painel de detalhe: cultura ainda não descoberta aparece como "???".
          name: discovered ? crop.name : '???',
          onClick: () => this.selectCropDetail(crop.id),
          discovered,
        };
      });
    }

    // 'fishing' — sem mecânica ainda, mostra só o texto "Em breve".
    return [];
  }

  /** Reposiciona as abas/seletor (fixo, sem "puxar" a ativa pra fora — só o seletor branco indica qual está ativa) e redesenha o grid com o conteúdo da categoria ativa. */
  private renderActiveCategory(inventory: Inventory): void {
    for (const tab of this.tabs) {
      tab.background.setPosition(tab.baseX, tab.y);
      tab.icon.setPosition(tab.baseX + TAB_ICON_OFFSET_X, tab.y + TAB_ICON_OFFSET_Y);
    }
    this.positionTabSelector();

    const { cells: content, gridCount } = this.computeContent(inventory);
    const isBackpack = this.activeCategory === 'backpack';
    const isAgriculture = this.activeCategory === 'agriculture';
    const isSkills = this.activeCategory === 'skills';

    this.slots.forEach((slot, index) => {
      const entry: InventorySlotContent | undefined = content[index];
      slot.onClick = entry?.onClick ?? null;
      slot.name = entry?.name ?? '';
      this.cellSlotIndex[index] = entry?.slotIndex;
      // A aba Habilidades tem as páginas dela: sem o grid de slots (a fileira da Hotbar fica).
      slot.frame.setVisible(this.isOpen_ && (slot.hotbar || !isSkills));

      // A moldura precisa estar interativa pra receber o hover do balão: com ação de clique (como antes) OU com um item dentro.
      const frameInteractive = this.isOpen_ && (!!slot.onClick || !!slot.name);
      if (frameInteractive) {
        if (!slot.frame.input?.enabled) slot.frame.setInteractive();
      } else if (slot.frame.input?.enabled) {
        slot.frame.disableInteractive();
        this.frameHovered[index] = false; // Desativar não dispara `pointerout`.
      }

      // Slot "não descoberto" (Fase 9): troca pra textura do slot ESCURO de
      // verdade (`INVENTORY_SLOT_DARK_FRAME_NAME`) em vez de tingir o slot
      // creme — pedido explícito do usuário, mesma folha `inventory.png`,
      // só a fileira de cima em vez da de baixo.
      const isDark = isAgriculture && !!entry && !entry.discovered;
      // Slot trancado da Bolsa: o mesmo slot escuro, sem o "?" (e, num save de antes da trava, ainda com o item que estiver nele).
      const isLocked = isBackpack && !!entry?.locked;
      slot.frame.setTexture(INVENTORY_PANEL_KEY, isDark || isLocked ? INVENTORY_SLOT_DARK_FRAME_NAME : INVENTORY_SLOT_FRAME_NAME);
      slot.frame.setTint(entry ? entry.tint : UNSELECTED_TINT);
      // O drag pode ter movido o ícone pra fora da célula — sempre volta
      // pro lugar fixo antes de decidir o que mostrar nele (ver `dragend`),
      // EXCETO enquanto esse ícone está sendo arrastado/animado de volta
      // (`dragSourceIndex` — ver o tween de "Juice" em `dragstart`/`dragend`
      // acima): sem essa exceção, este reset instantâneo rodando todo frame
      // brigaria com o `drag`/tween, fazendo o ícone "pular" de volta pro
      // slot em vez de seguir o cursor livremente.
      const isBeingDragged = index === this.dragSourceIndex;
      if (!isBeingDragged) slot.icon.setPosition(slot.x, slot.y);

      // Arrasta quem mostra um slot da Bolsa: as células da Mochila e as da Hotbar (em qualquer aba).
      const draggable = this.isOpen_ && entry?.slotIndex !== undefined && !!entry.textureKey && (isBackpack || slot.hotbar);
      if (draggable) {
        slot.icon.setInteractive();
      } else if (slot.icon.input?.enabled) {
        slot.icon.disableInteractive();
        this.iconHovered[index] = false;
      }

      if (!entry || !entry.textureKey || isDark) {
        slot.icon.setVisible(false);
        slot.badgeText.setVisible(false);
        slot.questionMark.setVisible(isDark);
        return;
      }

      slot.icon.setTexture(entry.textureKey, entry.iconFrame);
      if (entry.iconTint !== undefined) slot.icon.setTint(entry.iconTint);
      else slot.icon.clearTint();
      if (!isBeingDragged) slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      slot.icon.setVisible(true);
      slot.badgeText.setText(entry.badge);
      slot.badgeText.setVisible(!!entry.badge);
      slot.questionMark.setVisible(false);
    });

    this.emptyText.setVisible(gridCount === 0 && !isSkills);
    this.skillPanel.setVisible(this.isOpen_ && isSkills);
    this.skillPanel.refresh();
    this.updateTooltip(this.activePointer); // O conteúdo do slot sob o mouse pode ter mudado (troca de slot, aba).

    this.characterSprite.setVisible(isBackpack);
    const equippedArmorId = inventory.getEquippedArmorId();
    for (const equipmentSlot of this.equipmentSlots) {
      equipmentSlot.frame.setVisible(isBackpack);
      equipmentSlot.label.setVisible(isBackpack);

      const armorVisual = equipmentSlot.type === 'shirt' && isBackpack && equippedArmorId ? resolveSlotVisual({ category: 'armor', id: equippedArmorId }) : null;
      equipmentSlot.icon.setVisible(!!armorVisual);
      if (armorVisual) {
        equipmentSlot.icon.setTexture(armorVisual.textureKey, armorVisual.iconFrame);
        equipmentSlot.icon.setScale(computeFitScale(equipmentSlot.icon, EQUIPPED_ARMOR_ICON_TARGET_PX));
        if (!equipmentSlot.icon.input?.enabled) equipmentSlot.icon.setInteractive();
      } else if (equipmentSlot.icon.input?.enabled) {
        equipmentSlot.icon.disableInteractive();
        this.tooltip.hide();
      }
    }

    this.renderAgricultureDetail(inventory, isAgriculture);
  }

  /** Painel de detalhe da página direita da Agricultura (Fase 9) — ver doc da classe/`EQUIPMENT_SLOTS`. */
  private renderAgricultureDetail(inventory: Inventory, visible: boolean): void {
    this.detailIconPanel.setVisible(visible);
    this.detailTextPanel.setVisible(visible);
    this.detailName.setVisible(visible);
    this.detailStatus.setVisible(visible);
    for (const corner of Object.values(this.gridSelector)) corner.setVisible(visible && this.selectedCropId !== null);

    if (!visible) {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(false);
      return;
    }

    const crop: CropDefinition | undefined = this.selectedCropId ? CROPS[this.selectedCropId] : undefined;
    if (!crop) {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(true);
      this.detailName.setText('');
      this.detailStatus.setText('Selecione um item.');
      return;
    }

    const discovered = inventory.hasHarvested(crop.id);
    if (discovered) {
      // Fruto colhido (pedido explícito, item 4) + total histórico (item 3) — ver `computeContent`.
      this.detailIcon.setTexture(ALL_CROPS_ICONS_KEY, crop.cropFrameName);
      this.detailIcon.setScale(computeFitScale(this.detailIcon, DETAIL_ICON_TARGET_PX));
      this.detailIcon.setVisible(true);
      this.detailQuestionMark.setVisible(false);
      this.detailName.setText(crop.name);
      this.detailStatus.setText(`Total colhido: ${inventory.getTotalHarvested(crop.id)}`);
    } else {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(true);
      this.detailName.setText('???');
      this.detailStatus.setText('Ainda não descoberto.');
    }

    // Cantinhos de destaque ao redor do slot selecionado no grid esquerdo.
    const selectedIndex = Object.values(CROPS).findIndex((c) => c.id === this.selectedCropId);
    const selectedSlot = selectedIndex !== -1 ? this.slots[selectedIndex] : null;
    if (selectedSlot) {
      const bounds = selectedSlot.frame.getBounds();
      const left = bounds.left - TAB_SELECTOR_PADDING;
      const top = bounds.top - TAB_SELECTOR_PADDING;
      const right = bounds.right + TAB_SELECTOR_PADDING;
      const bottom = bounds.bottom + TAB_SELECTOR_PADDING;
      this.gridSelector.topLeft.setPosition(left, top);
      this.gridSelector.topRight.setPosition(right, top);
      this.gridSelector.bottomLeft.setPosition(left, bottom);
      this.gridSelector.bottomRight.setPosition(right, bottom);
    }
  }

  private positionTabSelector(): void {
    const activeTab = this.tabs.find((tab) => tab.category === this.activeCategory);
    if (!activeTab) return;

    const bounds = activeTab.background.getBounds();
    const left = bounds.left - TAB_SELECTOR_PADDING;
    const top = bounds.top - TAB_SELECTOR_PADDING;
    const right = bounds.right + TAB_SELECTOR_PADDING;
    const bottom = bounds.bottom + TAB_SELECTOR_PADDING;

    this.tabSelector.topLeft.setPosition(left, top);
    this.tabSelector.topRight.setPosition(right, top);
    this.tabSelector.bottomLeft.setPosition(left, bottom);
    this.tabSelector.bottomRight.setPosition(right, bottom);
  }

  private setElementsVisible(visible: boolean): void {
    this.book.setVisible(visible);
    for (const tab of this.tabs) {
      tab.background.setVisible(visible);
      tab.icon.setVisible(visible);
      if (visible) tab.background.setInteractive();
      else tab.background.disableInteractive();
    }
    for (const corner of Object.values(this.tabSelector)) corner.setVisible(visible);

    this.closeButton.setVisible(visible);
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();
    this.closeButtonMark.setVisible(visible);
    this.trashCan.setVisible(visible);

    this.skillPanel.setVisible(visible && this.activeCategory === 'skills');
    for (const piece of this.hotbarBook) piece.setVisible(visible);
    for (const slot of this.slots) {
      slot.frame.setVisible(visible && (slot.hotbar || this.activeCategory !== 'skills'));
      const slotVisible = visible && slot.icon.visible;
      slot.icon.setVisible(slotVisible);
      slot.badgeText.setVisible(visible && slot.badgeText.visible);
      slot.questionMark.setVisible(visible && slot.questionMark.visible);

      if (visible && slot.onClick) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
      // Arrasto (Fase 9): nunca deixa um ícone arrastável escutando depois
      // que a tela fecha — `renderActiveCategory` reativa certo no próximo
      // `open`/`refresh`.
      if (!visible) slot.icon.disableInteractive();
    }
    this.emptyText.setVisible(visible && this.emptyText.visible);

    // Página direita — Mochila (Fase 9): visibilidade real decidida por
    // `renderActiveCategory` (depende da aba ativa); fechar a tela some com
    // tudo incondicionalmente, igual ao resto.
    this.characterSprite.setVisible(visible && this.characterSprite.visible);
    for (const equipmentSlot of this.equipmentSlots) {
      equipmentSlot.frame.setVisible(visible && equipmentSlot.frame.visible);
      equipmentSlot.label.setVisible(visible && equipmentSlot.label.visible);
      equipmentSlot.icon.setVisible(visible && equipmentSlot.icon.visible);
      if (!visible) equipmentSlot.icon.disableInteractive();
    }

    // Página direita — Agricultura (Fase 9): mesma ideia.
    this.detailIconPanel.setVisible(visible && this.detailIconPanel.visible);
    this.detailTextPanel.setVisible(visible && this.detailTextPanel.visible);
    this.detailIcon.setVisible(visible && this.detailIcon.visible);
    this.detailQuestionMark.setVisible(visible && this.detailQuestionMark.visible);
    this.detailName.setVisible(visible && this.detailName.visible);
    this.detailStatus.setVisible(visible && this.detailStatus.visible);
    for (const corner of Object.values(this.gridSelector)) corner.setVisible(visible && corner.visible);
  }
}
