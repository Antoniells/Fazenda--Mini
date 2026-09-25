import Phaser from 'phaser';
import { GroundTilesetConfig } from '../systems/groundTilesets';

/**
 * Reexportado por conveniência (nome mais claro no contexto deste painel) —
 * MESMO tipo de `systems/groundTilesets.ts`, nunca uma cópia. Extensibilidade
 * (pedido explícito do usuário): esse é o ÚNICO formato de configuração de
 * tileset em todo o projeto — o editor (este painel + `MapEditorScene`) e o
 * jogo de verdade (`systems/mapBuilder.ts`) leem o mesmo `GROUND_TILESETS`,
 * então adicionar um tileset novo é sempre "uma linha nesse array", nunca
 * mexer em código de UI.
 */
export type TilePickerTilesetConfig = GroundTilesetConfig;

export interface TilePickerConfig {
  /** Container já existente onde este painel desenha tudo (pai comum com o resto da janela do editor, pra poder ser arrastado como um bloco só, ver `MapEditorScene`). */
  container: Phaser.GameObjects.Container;
  /** Posição/tamanho em coordenadas LOCAIS ao `container` (não em tela) — continuam corretas não importa pra onde o container seja arrastado. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tamanho (px de tela) de cada tile desenhado no painel — controla o zoom do picker, independente da escala do jogo e do tamanho nativo de cada tileset. */
  displayTileSize: number;
  /** Todos os tilesets disponíveis pra pintar no Modo Ground — o primeiro da lista começa selecionado. */
  tilesets: TilePickerTilesetConfig[];
  /** Chamado com o GID (ver doc da classe) assim que o usuário clica numa célula do picker OU troca de aba de tileset. */
  onSelect: (gid: number) => void;
}

/**
 * Painel lateral rolável (Modo Ground) que mostra a imagem REAL e completa
 * de um tileset por vez — com abas no topo pra trocar entre vários
 * tilesets (Grama/Solo/Água, ver `MapEditorScene.GROUND_TILESETS`) — pra o
 * usuário escolher qualquer tile como "pincel", em vez da lista fixa de
 * nomes/ícones que a paleta antiga usava.
 *
 * GID (id global, pedido explícito do usuário — "o ID do pincel deve
 * considerar o offset correto"): como o mapa só tem UMA camada de chão
 * (`FarmMapData.ground`, um `number[][]` só), um valor pintado com o
 * tileset de Solo precisa ser DISTINGUÍVEL do mesmo número pintado com o de
 * Grama — mesma técnica que o formato Tiled usa pra combinar vários
 * tilesets num mapa só: cada tileset reserva uma FAIXA de números
 * (`firstGid` até `firstGid + total de tiles - 1`), e o valor gravado em
 * cada célula é sempre esse GID global, nunca um índice "local" ambíguo.
 * `Phaser.Tilemaps.Tileset` já entende isso nativamente
 * (`addTilesetImage(..., gid)` + `createLayer(id, [tileset1, tileset2,
 * ...])`) — ver `MapEditorScene.buildGroundLayer`. O tileset de Grama usa
 * `firstGid: 0` de propósito, pra continuar batendo com os índices brutos
 * já usados em `data/tiles.ts`/`systems/groundVariation.ts` sem deslocar
 * nada do que já existe.
 *
 * Implementação: uma única `Image` fixa (posição local nunca muda) com
 * `setCrop(...)` recortando, em pixels NATIVOS do tileset ativo, só a faixa
 * atualmente visível — rolar (`scrollY`) só desloca esse recorte, nunca a
 * imagem em si. Evita `Container` + `GeometryMask`: no Phaser 4 com WebGL
 * (renderer padrão deste projeto), máscara geométrica não é suportada em
 * containers (confirmado por um aviso real do próprio Phaser) — `setCrop`
 * funciona igual em Canvas e WebGL. Todo elemento é filho do `container`
 * recebido (nunca desenhado direto na raiz da cena), então arrastar esse
 * container (ver `MapEditorScene`) move o painel inteiro de uma vez, sem
 * este arquivo precisar saber nada sobre arraste.
 */
export class TilePickerPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly localX: number;
  private readonly localY: number;
  private readonly width: number;
  private readonly height: number;
  private readonly displayTileSize: number;
  /** Não `readonly`: `addTileset` (botão "Importar", pedido explícito) cresce essa lista em tempo de execução. */
  private tilesets: TilePickerTilesetConfig[];
  private readonly onSelect: (gid: number) => void;

  /** Altura reservada pras abas de tileset, no topo do painel. */
  private static readonly TABS_HEIGHT = 26;

  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly tabs: Array<{ config: TilePickerTilesetConfig; background: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
  private readonly tilesetImage: Phaser.GameObjects.Image;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly hitZone: Phaser.GameObjects.Zone;

  private activeTilesetIndex = 0;
  /** Em px de TELA (display), não nativos — convertido pra nativo só na hora de chamar `setCrop`. */
  private scrollY = 0;
  private selectedGid = 0;

  constructor(scene: Phaser.Scene, config: TilePickerConfig) {
    this.scene = scene;
    this.container = config.container;
    this.localX = config.x;
    this.localY = config.y;
    this.width = config.width;
    this.height = config.height;
    this.displayTileSize = config.displayTileSize;
    this.tilesets = config.tilesets;
    this.onSelect = config.onSelect;

    this.background = scene.add.rectangle(this.localX, this.localY, this.width, this.height, 0x1b1b1b, 0.96);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(2, 0x555555, 1);
    this.container.add(this.background);

    this.rebuildTabs();

    const gridLocalY = this.localY + TilePickerPanel.TABS_HEIGHT;
    this.tilesetImage = scene.add.image(this.localX, gridLocalY, this.tilesets[0].textureKey);
    this.tilesetImage.setOrigin(0, 0);
    this.container.add(this.tilesetImage);

    this.highlight = scene.add.graphics();
    this.container.add(this.highlight);

    // Zona de clique/scroll cobrindo só a GRADE (não as abas, que já têm
    // hitzone própria) — mais fácil de acertar que a imagem em si (que pode
    // ter áreas transparentes).
    this.hitZone = scene.add.zone(this.localX, gridLocalY, this.width, this.gridHeight);
    this.hitZone.setOrigin(0, 0);
    this.hitZone.setInteractive();
    this.container.add(this.hitZone);

    this.hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => this.handlePointerDown(localX, localY));
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, deltaY: number) => {
      if (!this.getBounds().contains(pointer.x, pointer.y)) return;
      this.scroll(deltaY);
    });

    this.applyCrop();
    this.updateTabStyles();
    // Não chama `onSelect` aqui: dispararia de volta pra quem criou este
    // painel — se isso acontecesse DENTRO do construtor, o campo que guarda
    // esta instância (`MapEditorScene.tilePicker`) ainda não teria sido
    // atribuído (o `new TilePickerPanel(...)` ainda não retornou). Só
    // desenha o destaque no GID 0 do tileset padrão; quem criou o painel
    // decide a seleção inicial de verdade chamando `setSelected` depois.
    this.updateHighlightPosition();
  }

  private get activeTileset(): TilePickerTilesetConfig {
    return this.tilesets[this.activeTilesetIndex];
  }

  private get scale(): number {
    return this.displayTileSize / this.activeTileset.tileSize;
  }

  private get gridHeight(): number {
    return this.height - TilePickerPanel.TABS_HEIGHT;
  }

  /** Área ocupada pelo painel inteiro, em coordenadas de TELA — recalculada a cada chamada a partir da posição ATUAL do `container` (correta mesmo depois de arrastado). Usada pela cena pra decidir "isto foi clique/scroll no picker ou no mundo?". */
  getBounds(): Phaser.Geom.Rectangle {
    return this.background.getBounds();
  }

  /** GID (ver doc da classe) atualmente selecionado — o "pincel". */
  getSelectedGid(): number {
    return this.selectedGid;
  }

  /** Marca um GID como selecionado sem exigir um clique real (ex.: valor inicial) — troca de aba se o GID pertencer a outro tileset, reposiciona o destaque e chama `onSelect`. */
  setSelected(gid: number): void {
    const ownerIndex = this.resolveTilesetIndexForGid(gid);
    if (ownerIndex !== this.activeTilesetIndex) {
      this.activeTilesetIndex = ownerIndex;
      this.scrollY = 0;
      this.tilesetImage.setTexture(this.activeTileset.textureKey);
      this.applyCrop();
      this.updateTabStyles();
    }

    this.selectedGid = gid;
    this.updateHighlightPosition();
    this.onSelect(gid);
  }

  setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    for (const tab of this.tabs) {
      tab.background.setVisible(visible);
      tab.text.setVisible(visible);
    }
    this.tilesetImage.setVisible(visible);
    this.highlight.setVisible(visible);
    if (visible) this.hitZone.setInteractive();
    else this.hitZone.disableInteractive();
  }

  destroy(): void {
    this.background.destroy();
    for (const tab of this.tabs) {
      tab.background.destroy();
      tab.text.destroy();
    }
    this.tilesetImage.destroy();
    this.highlight.destroy();
    this.hitZone.destroy();
  }

  private resolveTilesetIndexForGid(gid: number): number {
    let bestIndex = 0;
    let bestFirstGid = -Infinity;
    this.tilesets.forEach((tileset, index) => {
      if (tileset.firstGid <= gid && tileset.firstGid > bestFirstGid) {
        bestFirstGid = tileset.firstGid;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  /**
   * (Re)desenha as abas do zero a partir de `this.tilesets` — chamado pelo
   * construtor E por `addTileset` (botão "Importar", pedido explícito):
   * como o número de abas muda, a largura de CADA uma muda também
   * (`this.width / this.tilesets.length`), então é mais simples destruir e
   * recriar todas do que tentar reposicionar/redimensionar as existentes.
   */
  private rebuildTabs(): void {
    for (const tab of this.tabs) {
      tab.background.destroy();
      tab.text.destroy();
    }
    this.tabs.length = 0;

    const tabWidth = this.width / this.tilesets.length;
    this.tilesets.forEach((tileset, index) => {
      const tabX = this.localX + index * tabWidth;
      const tabBg = this.scene.add.rectangle(tabX, this.localY, tabWidth, TilePickerPanel.TABS_HEIGHT, 0x2c2c2c, 1);
      tabBg.setOrigin(0, 0);
      tabBg.setStrokeStyle(1, 0x555555, 1);
      tabBg.setInteractive({ useHandCursor: true });
      tabBg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectTileset(index);
      });
      this.container.add(tabBg);

      const tabText = this.scene.add.text(tabX + tabWidth / 2, this.localY + TilePickerPanel.TABS_HEIGHT / 2, tileset.label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      tabText.setOrigin(0.5, 0.5);
      this.container.add(tabText);

      this.tabs.push({ config: tileset, background: tabBg, text: tabText });
    });

    this.updateTabStyles();
  }

  /**
   * Extensibilidade (pedido explícito — "botão para importar novos
   * tilesets"): adiciona um tileset novo à lista e já pinta a aba dele,
   * sem precisar recriar o painel inteiro. Quem chama (`MapEditorScene`,
   * via o botão "Importar") já garantiu que a textura correspondente
   * (`config.textureKey`) está carregada e pronta antes de chamar isto.
   */
  addTileset(config: TilePickerTilesetConfig): void {
    this.tilesets.push(config);
    this.rebuildTabs();
  }

  private selectTileset(index: number): void {
    if (index === this.activeTilesetIndex) return;
    // GID 0 dentro do novo tileset — o usuário troca de aba pra escolher um
    // tile novo, não faz sentido manter o destaque numa posição que nem
    // existe no tileset recém-selecionado.
    this.setSelected(this.tilesets[index].firstGid);
  }

  private updateTabStyles(): void {
    this.tabs.forEach((tab, index) => {
      tab.background.setFillStyle(index === this.activeTilesetIndex ? 0x4a7a4a : 0x2c2c2c, 1);
    });
  }

  /** Só redesenha o retângulo de destaque na posição atual (chamado após rolar/trocar de aba) — não é uma nova seleção, então não chama `onSelect` de novo. */
  private updateHighlightPosition(): void {
    const localIndex = this.selectedGid - this.activeTileset.firstGid;
    const col = localIndex % this.activeTileset.columns;
    const row = Math.floor(localIndex / this.activeTileset.columns);
    const gridLocalY = this.localY + TilePickerPanel.TABS_HEIGHT;

    this.highlight.clear();
    if (col < 0 || col >= this.activeTileset.columns || row < 0 || row >= this.activeTileset.rows) return; // GID fora da grade visível (não deveria acontecer, mas não trava o destaque numa posição inválida).

    // `this.highlight` é filho do MESMO `container` de tudo aqui — desenha
    // em coordenadas LOCAIS (relativas ao container), nunca em tela: o
    // próprio Phaser desloca isso automaticamente pra onde o container
    // estiver (arrastado ou não), sem este método precisar saber a posição
    // atual dele.
    this.highlight.lineStyle(3, 0xffd23f, 1);
    this.highlight.strokeRect(
      this.localX + col * this.displayTileSize,
      gridLocalY + row * this.displayTileSize - this.scrollY,
      this.displayTileSize,
      this.displayTileSize,
    );
  }

  private handlePointerDown(localX: number, localY: number): void {
    const col = Math.floor(localX / this.displayTileSize);
    const row = Math.floor((localY + this.scrollY) / this.displayTileSize);
    if (col < 0 || col >= this.activeTileset.columns || row < 0 || row >= this.activeTileset.rows) return;

    const localIndex = row * this.activeTileset.columns + col;
    this.setSelected(this.activeTileset.firstGid + localIndex);
  }

  private scroll(deltaY: number): void {
    const contentHeight = this.activeTileset.rows * this.displayTileSize;
    const maxScroll = Math.max(0, contentHeight - this.gridHeight);
    this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY, 0, maxScroll);
    this.applyCrop();
    this.updateHighlightPosition();
  }

  /** Recorta a imagem (em px NATIVOS do tileset ativo) pra mostrar só a faixa correspondente ao `scrollY` atual (em px de tela). */
  private applyCrop(): void {
    this.tilesetImage.setScale(this.scale);
    const cropY = this.scrollY / this.scale;
    const cropHeight = this.gridHeight / this.scale;
    this.tilesetImage.setCrop(0, cropY, this.activeTileset.columns * this.activeTileset.tileSize, cropHeight);
  }
}
