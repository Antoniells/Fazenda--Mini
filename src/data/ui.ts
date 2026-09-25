/**
 * Referências para os assets de interface (HUD). Igual às outras `data/*`,
 * só descreve onde estão as coisas no asset — nenhuma lógica aqui.
 */
export const INVENTORY_UI_KEY = 'ui-inventory-slots';
export const INVENTORY_UI_PATH = 'UI/Inventory/Slots.png';

/**
 * A barra pronta de 8 slots (o último grupo dentro de `Slots.png`, o mais
 * embaixo do spritesheet) — usada pela `Hotbar` e pela `ShopMenu` por
 * pedido explícito do usuário, em vez de ladrilhar `SLOT_FRAME_RECT` 8
 * vezes. Limites reais confirmados pixel a pixel: a barra inteira (com as
 * pontas arredondadas) ocupa x=6-170, y=249-276; os 8 compartimentos
 * internos têm 16px de largura cada, com centros igualmente espaçados a
 * cada 19px (`HOTBAR_BAR_SLOT_PITCH`) a partir do centro da barra.
 */
export const HOTBAR_BAR_FRAME_NAME = 'hotbar-bar';
export const HOTBAR_BAR_RECT = { x: 6, y: 249, width: 165, height: 28 };
export const HOTBAR_BAR_SLOT_PITCH = 19;

/**
 * Quatro cantinhos de "cursor de seleção" no mesmo spritesheet, cada um
 * uma peça em L que, combinada com as outras três, forma uma moldura
 * discreta ao redor de uma célula. Usados pelo `TileCursor` para destacar
 * o canteiro sob o mouse, em vez de desenhar um quadrado por código.
 *
 * Os retângulos abaixo são os limites reais dos pixels não-transparentes
 * de cada cantinho (confirmados varrendo o PNG pixel a pixel, não
 * estimados visualmente): cada peça é 4x4, não 8x8 como uma primeira
 * inspeção visual sugeria — a diferença eram só pixels transparentes ao
 * redor. Os dois da esquerda (topLeft/bottomLeft) começam em x=119; usar
 * x=120 (um pixel a mais) cortava a coluna mais à esquerda da peça, que é
 * exatamente o defeito visual relatado.
 */
export const SELECTION_CORNER_NAMES = {
  topLeft: 'selection-corner-tl',
  topRight: 'selection-corner-tr',
  bottomLeft: 'selection-corner-bl',
  bottomRight: 'selection-corner-br',
} as const;

export const SELECTION_CORNER_RECTS = {
  topLeft: { x: 119, y: 6, width: 4, height: 4 },
  topRight: { x: 133, y: 6, width: 4, height: 4 },
  bottomLeft: { x: 119, y: 20, width: 4, height: 4 },
  bottomRight: { x: 133, y: 20, width: 4, height: 4 },
} as const;

/**
 * `Icons/RPG icons/Weapons and Armor/1. Wood/Watering can.png`: 32x16, dois
 * frames idênticos de 16x16 (conferido pixel a pixel) — só o primeiro é
 * usado. Ícone da `WaterBar` (barra de água do regador).
 */
export const WATERING_CAN_ICON_KEY = 'ui-watering-can';
export const WATERING_CAN_ICON_PATH = 'Icons/RPG icons/Weapons and Armor/1. Wood/Watering can.png';
export const WATERING_CAN_ICON_FRAME_SIZE = 16;

/**
 * `UI/Inventory/Book.png`: livro aberto de duas páginas, usado como fundo
 * da Loja com abas (Fase 8). Bounding box real dos pixels não-transparentes
 * (varredura pixel a pixel): x=1-238, y=0-143 — o resto do canvas (256x288)
 * é margem vazia e um "marcador de página" solto que não é usado aqui.
 */
export const SHOP_BOOK_KEY = 'ui-shop-book';
export const SHOP_BOOK_PATH = 'UI/Inventory/Book.png';
export const SHOP_BOOK_FRAME_NAME = 'shop-book-content';
export const SHOP_BOOK_CONTENT_RECT = { x: 1, y: 0, width: 237, height: 144 };

/**
 * `UI/Inventory/inventory.png`: folha pequena (112x112) com variações de
 * elementos de UI. Confirmado pixel a pixel: duas fileiras de "slot
 * preenchido" de 18x18 (uma avermelhada em y=6-26, uma creme em y=41-58) e,
 * numa terceira fileira mais embaixo, um painel ornamentado de 48x48
 * (x=0-47, y=64-111 — cantos com um desenho entalhado, bordas simples de
 * 2px no meio de cada lado) ao lado de pequenas abas não usadas aqui.
 *
 * Usado na tela de Inventário (Fase 8, tecla E): o painel ornamentado como
 * fundo (via NineSlice, pra esticar sem distorcer os cantos) e o slot creme
 * como moldura ladrilhada dos 24 slots.
 */
export const INVENTORY_PANEL_KEY = 'ui-inventory-panel-sheet';
export const INVENTORY_PANEL_PATH = 'UI/Inventory/inventory.png';

export const INVENTORY_PANEL_FRAME_NAME = 'inventory-panel-bg';
export const INVENTORY_PANEL_RECT = { x: 0, y: 64, width: 48, height: 48 };
/** Margem que contém todo o desenho do canto ornamentado — o NineSlice não estica essa faixa. */
export const INVENTORY_PANEL_BORDER = 10;

export const INVENTORY_SLOT_FRAME_NAME = 'inventory-slot-square';
export const INVENTORY_SLOT_RECT = { x: 7, y: 41, width: 18, height: 18 };

/**
 * Mesma folha, fileira de cima (avermelhada/marrom-escura) — bounding box
 * real confirmado pixel a pixel (igual à fileira creme acima, mesmo
 * tamanho 18x18, só a cor muda): x=7-24, y=9-26. Usado como fundo dos
 * slots "não descobertos" (Fase 9 — diário de descobertas, pedido
 * explícito do usuário), em vez de tingir o slot creme de escuro.
 */
export const INVENTORY_SLOT_DARK_FRAME_NAME = 'inventory-slot-square-dark';
export const INVENTORY_SLOT_DARK_RECT = { x: 7, y: 9, width: 18, height: 18 };

/**
 * `UI/Inventory/Banner.png` (112x256): folha de banners/painéis grandes.
 * O painel usado aqui (canto superior-esquerdo da folha) é um quadrado de
 * 48x48 com borda dupla preta+marrom e cantos ornamentados (bolinhas/
 * cantoneiras) — bounding box e extensão da decoração dos cantos
 * confirmados recortando/ampliando pixel a pixel (decoração some por volta
 * de 20px a partir de cada canto, resto é só a linha de borda reta).
 * Pedido explícito do usuário: painel "grande" de verdade pra usar com
 * `scene.add.nineslice` na página de detalhe (Agricultura) — diferente do
 * painel pequeno/creme de `INVENTORY_PANEL_*` (usado em telas menores como
 * `PauseMenu`/`LockedMessage`), esse tem uma moldura mais chamativa,
 * melhor pra dar destaque ao ícone/texto de um item em destaque.
 */
export const INVENTORY_LARGE_PANEL_KEY = 'ui-inventory-banner';
export const INVENTORY_LARGE_PANEL_PATH = 'UI/Inventory/Banner.png';
export const INVENTORY_LARGE_PANEL_FRAME_NAME = 'inventory-large-panel';
export const INVENTORY_LARGE_PANEL_RECT = { x: 0, y: 0, width: 48, height: 48 };
/** Margem que contém toda a decoração dos cantos — o NineSlice não estica essa faixa (ver comentário acima). */
export const INVENTORY_LARGE_PANEL_BORDER = 20;

/**
 * `UI/Extras.png`: folha com barras/pílulas de progresso e, mais à direita,
 * vários conjuntos de 4 cantinhos em L (mesma ideia de `SELECTION_CORNER_RECTS`,
 * só que em cores diferentes — branco/azulado, laranja, marrom-escuro,
 * rosa-claro). Usado pelo `TileCursor` (Fase 9) como "cursor global": o
 * conjunto branco/azulado (o mais neutro, sem cor de destaque própria) em
 * qualquer célula do mapa fora da lavoura — dentro da lavoura continua
 * valendo o cursor marrom de `SELECTION_CORNER_RECTS`.
 *
 * Bounds confirmados pixel a pixel (cada cantinho, 8x8): topLeft
 * x=187-194,y=11-18; topRight x=205-212,y=11-18; bottomLeft
 * x=187-194,y=29-36; bottomRight x=205-212,y=29-36.
 */
export const EXTRAS_UI_KEY = 'ui-extras';
export const EXTRAS_UI_PATH = 'UI/Extras.png';

export const GLOBAL_CURSOR_CORNER_NAMES = {
  topLeft: 'global-cursor-corner-tl',
  topRight: 'global-cursor-corner-tr',
  bottomLeft: 'global-cursor-corner-bl',
  bottomRight: 'global-cursor-corner-br',
} as const;

export const GLOBAL_CURSOR_CORNER_RECTS = {
  topLeft: { x: 187, y: 11, width: 8, height: 8 },
  topRight: { x: 205, y: 11, width: 8, height: 8 },
  bottomLeft: { x: 187, y: 29, width: 8, height: 8 },
  bottomRight: { x: 205, y: 29, width: 8, height: 8 },
} as const;

/**
 * `UI/Clock/Extras.png`: folha de "placas de madeira" para HUD — várias
 * variações de barra/placa, confirmadas pixel a pixel. Usadas pelo HUD
 * combinado de Relógio + Dinheiro do canto superior direito (Fase 7/9):
 *
 * - Placa de 2 linhas (x=66-124, y=33-60, 59x28): área esquerda em branco
 *   (sem uso aqui) e duas "janelinhas" creme à direita, uma por linha —
 *   linha de cima = "DIA N", linha de baixo = hora ("HH:MM"). Os retângulos
 *   das janelinhas são relativos ao canto superior esquerdo da placa.
 * - Placa de moedas (x=66-124, y=9-26, 60x18): pilha de moedas à esquerda
 *   (arte pronta, não a moeda giratória de `COIN_ICON_KEY`) + 7 "janelinhas"
 *   de dígito à direita, 5px de largura cada, com centros espaçados a cada
 *   6px a partir do primeiro — o saldo é escrito um dígito por janelinha,
 *   alinhado à direita (janelinhas à esquerda sobrando ficam em branco),
 *   exatamente como o layout do asset propõe.
 */
export const CLOCK_MONEY_HUD_KEY = 'ui-clock-money-hud';
export const CLOCK_MONEY_HUD_PATH = 'UI/Clock/Extras.png';

export const CLOCK_PLAQUE_FRAME_NAME = 'clock-plaque';
export const CLOCK_PLAQUE_RECT = { x: 66, y: 33, width: 59, height: 28 };
export const CLOCK_PLAQUE_TOP_INSET = { x: 25, y: 5, width: 31, height: 8 };
export const CLOCK_PLAQUE_BOTTOM_INSET = { x: 25, y: 16, width: 31, height: 8 };

export const COIN_PLAQUE_FRAME_NAME = 'coin-plaque';
export const COIN_PLAQUE_RECT = { x: 66, y: 9, width: 60, height: 18 };
export const COIN_PLAQUE_DIGIT_COUNT = 7;
export const COIN_PLAQUE_DIGIT_FIRST_CENTER_X = 18;
export const COIN_PLAQUE_DIGIT_PITCH = 6;
export const COIN_PLAQUE_DIGIT_CENTER_Y = 10;

/**
 * `UI/Inventory/Extras.png` (384x256): folha de "fitas"/etiquetas em várias
 * cores e formatos — usada para o fundo das abas verticais do Livro
 * (`ShopMenu`), por indicação explícita do usuário (asset real do pacote,
 * em vez do retângulo colorido temporário usado antes). As 3 usadas aqui
 * (uma por categoria) são o formato "bandeirola" (retângulo com a base
 * entalhada em V) — bounds confirmados pixel a pixel dentro do grid
 * uniforme de 32x32 do spritesheet.
 */
export const SHOP_TAB_RIBBONS_KEY = 'ui-inventory-extras';
export const SHOP_TAB_RIBBONS_PATH = 'UI/Inventory/Extras.png';
/** Fita azul (aba "Ferramentas"). */
export const TAB_FRAME_TOOLS = { name: 'shop-tab-ribbon-blue', rect: { x: 199, y: 195, width: 18, height: 25 } };
/** Fita verde (aba "Agricultura"). */
export const TAB_FRAME_AGRICULTURE = { name: 'shop-tab-ribbon-green', rect: { x: 263, y: 227, width: 18, height: 25 } };
/** Fita laranja (aba "Construções") — a folha não tem uma fita vermelha entre as cores já usadas em outras telas do jogo; laranja combina melhor com a paleta terrosa do livro. */
export const TAB_FRAME_CONSTRUCTION = { name: 'shop-tab-ribbon-orange', rect: { x: 327, y: 195, width: 18, height: 25 } };

/**
 * Variantes CLARAS das 3 fitas acima (efeito de hover, pedido explícito do
 * usuário) — mesma folha, mesma forma/tamanho (18x25), uma coluna à direita
 * de cada fita normal no grid uniforme de 32x32 (confirmado pixel a pixel:
 * bounds idênticos aos das fitas escuras, só deslocados +32/+33px em x).
 */
export const TAB_FRAME_TOOLS_LIGHT = { name: 'shop-tab-ribbon-blue-light', rect: { x: 232, y: 195, width: 18, height: 25 } };
export const TAB_FRAME_AGRICULTURE_LIGHT = { name: 'shop-tab-ribbon-green-light', rect: { x: 296, y: 227, width: 18, height: 25 } };
export const TAB_FRAME_CONSTRUCTION_LIGHT = { name: 'shop-tab-ribbon-orange-light', rect: { x: 360, y: 195, width: 18, height: 25 } };

/**
 * Mesmo `Book.png` já usado como fundo do Livro (`SHOP_BOOK_KEY`) tem, fora
 * da área da página (canto inferior direito do canvas original), um
 * "marcador de página" solto (blob arredondado com uma pontinha, como um
 * lacre/etiqueta de couro) — não usado até agora (ver comentário antigo em
 * `SHOP_BOOK_CONTENT_RECT`). Reaproveitado como fundo do botão de fechar.
 */
export const CLOSE_TAB_BG_FRAME = { name: 'close-tab-bg', rect: { x: 221, y: 201, width: 25, height: 29 } };

/**
 * `UI/HUD.png` (416x96): folha de ícones de interface genéricos (lixeira,
 * envelope, engrenagem, setas, etc.). Usamos o "X" vermelho robusto (pedido
 * explícito do usuário: "grande e vermelho", em vez do glifo fino que a
 * folha anterior — `UI/button.png` — tinha) como marca do botão de fechar,
 * com fundo do marcador de couro (`CLOSE_TAB_BG_FRAME`). Bounding box real
 * confirmado pixel a pixel (varredura completa por cor, sem sobra
 * transparente): 8x8, cheio (quase sem margem dentro do próprio quadro),
 * ao lado de um ícone de "proibido" e um de "power" na mesma folha.
 */
export const CLOSE_BUTTON_SHEET_KEY = 'ui-hud-icons';
export const CLOSE_BUTTON_SHEET_PATH = 'UI/HUD.png';
export const CLOSE_X_ICON_FRAME = { 
  name: 'close-x-icon', 
  rect: { 
    x: 274, 
    y: 65, 
    width: 13, 
    height: 13 
  } 
};

/**
 * Mesma folha (`UI/HUD.png`): as duas lixeiras da primeira fileira — fechada
 * (normal) e aberta (hover) — usadas no botão "Excluir save" de cada slot do
 * Menu Principal. Bounding boxes reais medidos pelo canal alfa (componentes
 * conectados): fechada x=66,y=1 (12x14); aberta x=82,y=0 (12x15).
 */
export const DELETE_ICON_FRAME = { name: 'delete-icon', rect: { x: 66, y: 1, width: 12, height: 14 } };
export const DELETE_ICON_OPEN_FRAME = { name: 'delete-icon-open', rect: { x: 82, y: 0, width: 12, height: 15 } };

/**
 * Ponteiro do mouse do jogo (`systems/gameCursor.ts`): o PRIMEIRO ícone de
 * `UI/HUD.png` (seta marrom, célula 16x16 em 0,0). Retângulo = bounding box
 * real medido pelo alfa (x=3,y=2; 11x12). `HOTSPOT` = pixel da ponta da seta
 * dentro do recorte (é ali que o clique "acerta"). `SCALE` = ampliação inteira
 * (nítida): 2x dá 22x24 px, abaixo do limite de 32x32 que os navegadores
 * aceitam sem esconder o cursor perto das bordas.
 */
export const GAME_CURSOR_RECT = { x: 3, y: 2, width: 11, height: 12 };
export const GAME_CURSOR_HOTSPOT = { x: 1, y: 1 };
export const GAME_CURSOR_SCALE = 2;

/**
 * Defesa da armadura equipada (`ui/armorHud.ts`): `UI/Armor.png` (207x80) tem 3
 * peitorais lado a lado — cheio (aço), meio (metade aço/metade branco) e
 * vazio (branco) — o mesmo esquema cheio/meio/vazio dos corações
 * (`HEART_*_FRAME`). Retângulos = bounding boxes reais medidos pelo alfa
 * (57x57 cada, passo de 65px).
 */
export const ARMOR_HUD_KEY = 'ui-armor-icons';
export const ARMOR_HUD_PATH = 'UI/Armor.png';
export const ARMOR_FULL_FRAME = { name: 'armor-full', rect: { x: 12, y: 12, width: 57, height: 57 } };
export const ARMOR_HALF_FRAME = { name: 'armor-half', rect: { x: 77, y: 12, width: 57, height: 57 } };
export const ARMOR_EMPTY_FRAME = { name: 'armor-empty', rect: { x: 142, y: 12, width: 57, height: 57 } };

export const CLOSE_X_ICON_PRESSED_FRAME = {
  name: 'close-x-icon-pressed',
  rect: { 
    x: 274, 
    y: 82, 
    width: 13, 
    height: 13 
  }
};

/**
 * `Icons/RPG icons/Extras/Bags.png` (112x16, grid uniforme de 16x16): 7
 * variações de mochila. Usada só como ÍCONE da aba "Mochila" do Inventário
 * (Fase 8) — a primeira (marrom, sem enfeite) combina com a paleta terrosa
 * do Livro. Bounding box real confirmado pixel a pixel: x=0-15, y=1-15 (cabe
 * inteira no primeiro quadro do grid, sem sobra de transparência relevante).
 */
export const BACKPACK_ICON_KEY = 'ui-backpack-icon';
export const BACKPACK_ICON_PATH = 'Icons/RPG icons/Extras/Bags.png';
export const BACKPACK_ICON_FRAME = { name: 'backpack-icon', rect: { x: 0, y: 0, width: 16, height: 16 } };

/**
 * `Icons/RPG icons/Weapons and Armor/1. Wood/Fishing Rod.png` (32x16): dois
 * frames idênticos de 16x16 (mesma convenção de `WATERING_CAN_ICON_*`) — só
 * o primeiro é usado. Ícone da aba "Pesca" do Inventário (Fase 8) — vara de
 * madeira, mesmo tier visual das outras ferramentas iniciais (Enxada/Foice).
 */
export const FISHING_ROD_ICON_KEY = 'ui-fishing-rod-icon';
export const FISHING_ROD_ICON_PATH = 'Icons/RPG icons/Weapons and Armor/1. Wood/Fishing Rod.png';
export const FISHING_ROD_ICON_FRAME = { name: 'fishing-rod-icon', rect: { x: 0, y: 0, width: 16, height: 16 } };

/**
 * `UI/Bars.png` (192x160): corações e barras de status. Usado só o conjunto
 * de corações GRANDES COM CONTORNO BRANCO (linha 1 do grid de 16x16 —
 * legível sobre qualquer fundo do mundo): cheio / meio / vazio, cada um
 * inteiro dentro da própria célula 16x16 (bounding box real conferido pelo
 * canal alpha: x=0-15, y=1-14, então nenhum pixel do contorno é cortado).
 * O `HealthHud` (Fase 8 — Combate) usa estes 3 estados.
 */
export const HEALTH_HEARTS_KEY = 'ui-bars';
export const HEALTH_HEARTS_PATH = 'UI/Bars.png';
export const HEART_FULL_FRAME = { name: 'heart-full', rect: { x: 0, y: 16, width: 16, height: 16 } };
export const HEART_HALF_FRAME = { name: 'heart-half', rect: { x: 16, y: 16, width: 16, height: 16 } };
export const HEART_EMPTY_FRAME = { name: 'heart-empty', rect: { x: 32, y: 16, width: 16, height: 16 } };

/**
 * Menu Principal (`MainMenuScene`): fundo estático da fazenda + UMA folha de peças (`menu_parts.webp`, 1536x1024, com
 * canal alfa) com o logo, a coroa de folhas (semicírculo que fica ATRÁS do logo), as 3 placas de madeira dos botões
 * (vazias — o texto "Iniciar"/"Configurações"/"Sair" é escrito pela cena) e uma placa dourada vazia, que é o destaque do
 * hover (só a moldura: o interior é transparente, então vai por cima da placa sem esconder o texto). Em vez de fatiar a
 * imagem num editor, a cena adiciona FRAMES nomeados por retângulo (mesma técnica dos corações/painéis acima) e monta
 * objetos independentes — trocar a arte = trocar o arquivo e (se o layout mudar) estes retângulos, nunca a lógica da cena.
 * Retângulos medidos pelo alfa, em coordenadas da imagem original.
 */
export const MENU_BACKGROUND_KEY = 'menu_bg';
export const MENU_BACKGROUND_PATH = 'UI/Menu/menu_bg.jpg';
export const MENU_UI_KEY = 'menu_ui';
export const MENU_UI_PATH = 'UI/Menu/menu_parts.webp';
export const MENU_PART_FRAMES = {
  logo: { name: 'menu-logo', rect: { x: 27, y: 80, width: 851, height: 448 } },
  wreath: { name: 'menu-wreath', rect: { x: 56, y: 632, width: 755, height: 340 } },
  goldPlate: { name: 'menu-gold-plate', rect: { x: 876, y: 735, width: 604, height: 147 } },
};
export const MENU_BUTTON_FRAMES = {
  start: { name: 'menu-btn-start', rect: { x: 911, y: 119, width: 557, height: 142 } },
  settings: { name: 'menu-btn-settings', rect: { x: 913, y: 301, width: 560, height: 145 } },
  quit: { name: 'menu-btn-quit', rect: { x: 913, y: 481, width: 558, height: 145 } },
};
