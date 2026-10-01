/**
 * Moradores do Vilarejo: quem são, onde moram, a arte (sprites de andar/repouso e retrato) e a ROTINA do dia. Só DADOS — quem os
 * faz andar é `entities/Npc.ts` + `systems/npcSystem.ts`, e quem decide o que falam é `systems/npcDialogue.ts`.
 *
 * Rotina: uma lista de "a partir da hora H, o morador está em LUGAR". O dia dá a volta (a última entrada vale até a primeira do dia
 * seguinte). Lugares:
 * - `inside`: dentro de casa, invisível (dormindo/descansando) — a porta é a célula em frente à casa (`VillageStructure`).
 * - `post`: dentro do trabalho, VISÍVEL atrás do balcão (não usado mais: as lojas viraram interiores, `data/maps/shopInteriors.ts`).
 * - `spot`: parado numa célula da rua/praça, virado pra `facing`.
 * Na chuva, quem estaria numa rua/praça (`spot`) fica em casa; o `post` continua (o balcão é coberto).
 */
import { VILLAGE_SHOP_HOUSE, VILLAGE_BANKER_HOUSE, VILLAGE_PIRATE_HOUSE, VILLAGE_SUPPLIER_HOUSE, VILLAGE_CARPENTER_HOUSE, VillageStructure } from './maps/villageMap';
import { BEACH_MERMAID_CELL } from './maps/beachDecor';

/** `banker` é o Alberto, agora PADEIRO: o id interno não mudou (campanha, pedidos, saves e o `role` da casa no layout dependem dele) — só o título e as falas. */
export type NpcId = 'blacksmith' | 'banker' | 'pirate' | 'mermaid' | 'supplier' | 'carpenter';

export type NpcFacing = 'down' | 'up' | 'left' | 'right';

/** Expressões de retrato que as falas podem pedir. */
export type PortraitExpression = 'neutral' | 'happy' | 'content' | 'surprised' | 'thoughtful' | 'sad' | 'crying' | 'angry';

export type NpcPlace =
  | { kind: 'inside' }
  | { kind: 'post' }
  | { kind: 'spot'; col: number; row: number; facing: NpcFacing };

export interface NpcScheduleEntry {
  /** Hora (0-24) a partir da qual vale este lugar. */
  fromHour: number;
  place: NpcPlace;
  /** Expediente: neste trecho o vendedor ATENDE (a loja abre ao conversar) — só faz sentido em quem `sells`. */
  working?: boolean;
}

/** Folha de sprites de um morador: `idle`/`walk` seguem a mesma ordem de direções (baixo, cima, esquerda, direita), com `idleFrames`/`walkFrames` quadros cada. */
export interface NpcSpriteSheet {
  idleKey: string;
  idlePath: string;
  /** Folha de caminhada — só quem anda pelo mapa tem (a sereia fica parada no mar). */
  walkKey?: string;
  walkPath?: string;
  frameSize: number;
  /** Quadros por direção nas folhas de repouso e de caminhada. */
  idleFrames: number;
  walkFrames?: number;
  /**
   * Linha (bloco de quadros) de cada direção, quando a folha não é a padrão dos NPCs (baixo, cima, direita, esquerda). As folhas dos personagens
   * `Pre-made` têm só 3 blocos — baixo, cima e um de LADO (virado pra direita) —, então usam `SIDE_SHEET_ROWS` e `flipLeft`.
   */
  rows?: Record<NpcFacing, number>;
  /** Espelha o sprite ao olhar pra esquerda (folha com um só bloco de lado, virado pra direita). */
  flipLeft?: boolean;
}

/** Blocos das folhas de 3 direções (`Character/Character/Pre-made/<nome>/Idle.png` 128x96, `Walk.png` 192x96): baixo, cima e lado (esquerda = lado espelhado). */
const SIDE_SHEET_ROWS: Record<NpcFacing, number> = { down: 0, up: 1, right: 2, left: 2 };
const PREMADE_DIR = 'Character/Character/Pre-made';

export interface NpcDefinition {
  id: NpcId;
  name: string;
  title: string;
  sprite: NpcSpriteSheet;
  /**
   * Retrato: `frame` é o quadro neutro; `expressions`, onde fica cada expressão na MESMA folha (mesmo tamanho de quadro). Expressão
   * que a folha não tem cai no neutro (`systems/npcLines.ts`).
   */
  portrait: {
    key: string;
    path: string;
    frame: { x: number; y: number; width: number; height: number };
    expressions?: Partial<Record<PortraitExpression, { x: number; y: number }>>;
  };
  /** É vendedor: conversar oferece "Ver a loja" durante o expediente (`working` na rotina) — as lojas em si estão em `systems/vendorShops.ts`. */
  sells?: boolean;
  /** Casa (com porta) de quem anda pelo Vilarejo. Ausente = morador PARADO (`stationary`). */
  home?: VillageStructure;
  /** Morador que não anda: fica sempre nesta célula (a sereia, no mar da Praia); a rotina só diz quando está visível. */
  stationary?: { col: number; row: number };
  /** Fica no lugar mesmo na chuva (a regra geral manda quem está na rua pra casa). */
  staysInRain?: boolean;
  schedule: NpcScheduleEntry[];
  /** Falas soltas (quando a conversa não é de missão), sorteadas. */
  chatter: string[];
}

const NPC_DIR = "Character/Character/Others/NPC'S";

export const NPCS: Record<NpcId, NpcDefinition> = {
  blacksmith: {
    id: 'blacksmith',
    name: 'Bruno',
    title: 'Ferreiro',
    sprite: {
      idleKey: 'npc-blacksmith-idle',
      idlePath: `${NPC_DIR}/Blacksmith/Idle.png`,
      walkKey: 'npc-blacksmith-walk',
      walkPath: `${NPC_DIR}/Blacksmith/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
    },
    // Folha 256x192 com 11 expressões (4 por linha).
    portrait: {
      key: 'npc-blacksmith-portrait',
      path: `${NPC_DIR}/Blacksmith/Portrait.png`,
      frame: { x: 0, y: 0, width: 64, height: 64 },
      expressions: {
        happy: { x: 64, y: 0 },
        surprised: { x: 128, y: 0 },
        thoughtful: { x: 192, y: 0 },
        sad: { x: 0, y: 64 },
        content: { x: 64, y: 64 },
        crying: { x: 192, y: 64 },
        angry: { x: 128, y: 128 },
      },
    },
    home: VILLAGE_SHOP_HOUSE,
    sells: true,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 7, place: { kind: 'inside' }, working: true },
      { fromHour: 12, place: { kind: 'spot', col: 12, row: 16, facing: 'down' } },
      { fromHour: 13, place: { kind: 'inside' }, working: true },
      { fromHour: 18, place: { kind: 'spot', col: 9, row: 17, facing: 'right' } },
      { fromHour: 21, place: { kind: 'inside' } },
    ],
    chatter: [
      'O ferro só se dobra a quem tem paciência. Igual à terra, aliás.',
      'Uma boa lâmina e uma boa armadura valem mais que qualquer moeda numa noite de horda.',
      'Se quiser ver o que tenho no balcão, é só falar comigo na forja.',
      'Já viu o fogo da forja de noite? Não troco por nada.',
    ],
  },
  banker: {
    id: 'banker',
    name: 'Alberto',
    title: 'Padeiro',
    sprite: {
      idleKey: 'npc-banker-idle',
      idlePath: `${NPC_DIR}/Banker/Idle.png`,
      walkKey: 'npc-banker-walk',
      walkPath: `${NPC_DIR}/Banker/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
    },
    // Folha 256x128: 4 expressões na 1ª linha (a 2ª é a mesma com contorno).
    portrait: {
      key: 'npc-banker-portrait',
      path: `${NPC_DIR}/Banker/Portrait.png`,
      frame: { x: 0, y: 0, width: 64, height: 64 },
      expressions: { surprised: { x: 64, y: 0 }, angry: { x: 64, y: 0 }, happy: { x: 128, y: 0 }, content: { x: 192, y: 0 } },
    },
    home: VILLAGE_BANKER_HOUSE,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 6, place: { kind: 'inside' }, working: true },
      { fromHour: 12, place: { kind: 'spot', col: 16, row: 16, facing: 'left' } },
      { fromHour: 13, place: { kind: 'inside' }, working: true },
      { fromHour: 18, place: { kind: 'spot', col: 19, row: 15, facing: 'left' } },
      { fromHour: 20, place: { kind: 'inside' } },
    ],
    chatter: [
      'Pão bom pede paciência: massa que descansa e fermento que cresce. Igual à lavoura.',
      'Nunca gaste mais do que colhe, esse é o segredo — na padaria e na fazenda.',
      'Com tantas hordas, até eu aprendi a dormir com um olho aberto (e o forno aceso).',
      'Passe sempre por aqui: eu adoro ouvir sobre a sua colheita. Trigo, então, nem se fala!',
    ],
  },
  pirate: {
    id: 'pirate',
    name: 'Capitão Salgado',
    title: 'Explorador',
    sprite: {
      idleKey: 'npc-pirate-idle',
      idlePath: `${NPC_DIR}/Pirate/Idle.png`,
      walkKey: 'npc-pirate-walk',
      walkPath: `${NPC_DIR}/Pirate/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
    },
    portrait: { key: 'npc-pirate-portrait', path: `${NPC_DIR}/Pirate/Portrait.png`, frame: { x: 0, y: 0, width: 64, height: 64 } },
    home: VILLAGE_PIRATE_HOUSE,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 7, place: { kind: 'spot', col: 18, row: 25, facing: 'down' } },
      { fromHour: 10, place: { kind: 'spot', col: 12, row: 17, facing: 'up' } },
      { fromHour: 14, place: { kind: 'spot', col: 24, row: 25, facing: 'down' } },
      { fromHour: 17, place: { kind: 'spot', col: 14, row: 17, facing: 'left' } },
      { fromHour: 21, place: { kind: 'inside' } },
    ],
    chatter: [
      'Arr! O mar é bonito, mas nada bate uma boa terra firme sob os pés.',
      'Já viu a Praia ao pôr do sol? Vale cada passo.',
      'Uma vez enfrentei uma tempestade de três dias... e nem derrubei o chapéu!',
      'Vá explorar, marujo. Quem só olha pro próprio quintal nunca vê a tempestade chegando.',
    ],
  },
  supplier: {
    id: 'supplier',
    name: 'Lia',
    title: 'Insumos da Fazenda',
    sprite: {
      idleKey: 'npc-supplier-idle',
      idlePath: `${PREMADE_DIR}/Tori/Idle.png`,
      walkKey: 'npc-supplier-walk',
      walkPath: `${PREMADE_DIR}/Tori/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
      rows: SIDE_SHEET_ROWS,
      flipLeft: true,
    },
    // Sem retrato próprio na pasta: o quadro de repouso de frente (32x32) faz as vezes.
    portrait: { key: 'npc-supplier-idle-portrait', path: `${PREMADE_DIR}/Tori/Idle.png`, frame: { x: 0, y: 0, width: 32, height: 32 } },
    home: VILLAGE_SUPPLIER_HOUSE,
    sells: true,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 8, place: { kind: 'inside' }, working: true },
      { fromHour: 12, place: { kind: 'spot', col: 13, row: 17, facing: 'right' } },
      { fromHour: 13, place: { kind: 'inside' }, working: true },
      { fromHour: 18, place: { kind: 'spot', col: 12, row: 18, facing: 'up' } },
      { fromHour: 20, place: { kind: 'inside' } },
    ],
    chatter: [
      'Semente boa, terra bem regada e um pouquinho de paciência: é só isso que a lavoura pede.',
      'Já viu um pintinho crescer? Num piscar de olhos vira uma galinha. Cuide bem deles!',
      'Uma casa bonita começa pelos móveis. Passe na loja quando quiser decorar a sua.',
      'Dizem que cenoura de manhã cedo rende mais. Não é verdade, mas eu adoro acordar cedo mesmo assim.',
    ],
  },
  carpenter: {
    id: 'carpenter',
    name: 'Tomás',
    title: 'Marceneiro',
    sprite: {
      idleKey: 'npc-carpenter-idle',
      idlePath: `${PREMADE_DIR}/Josh/Idle.png`,
      walkKey: 'npc-carpenter-walk',
      walkPath: `${PREMADE_DIR}/Josh/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
      rows: SIDE_SHEET_ROWS,
      flipLeft: true,
    },
    portrait: { key: 'npc-carpenter-idle-portrait', path: `${PREMADE_DIR}/Josh/Idle.png`, frame: { x: 0, y: 0, width: 32, height: 32 } },
    home: VILLAGE_CARPENTER_HOUSE,
    sells: true,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 7, place: { kind: 'inside' }, working: true },
      { fromHour: 12, place: { kind: 'spot', col: 15, row: 17, facing: 'left' } },
      { fromHour: 13, place: { kind: 'inside' }, working: true },
      { fromHour: 18, place: { kind: 'spot', col: 20, row: 16, facing: 'left' } },
      { fromHour: 20, place: { kind: 'inside' } },
    ],
    chatter: [
      'Madeira boa a gente reconhece pelo cheiro. E pelo preço, infelizmente!',
      'Um galinheiro bem feito dura a vida toda. Vem cá que eu te mostro o projeto.',
      'Pedra e madeira: com as duas na mão dá pra construir quase qualquer coisa.',
      'Tenho planos de aumentar o Vilarejo... mas primeiro, a sua casa!',
    ],
  },
  mermaid: {
    id: 'mermaid',
    name: 'Marina',
    title: 'Sereia',
    sprite: {
      idleKey: 'npc-mermaid-idle',
      idlePath: `${NPC_DIR}/Beach/Mermaid .png`,
      frameSize: 32,
      idleFrames: 4,
    },
    portrait: { key: 'npc-mermaid-portrait', path: `${NPC_DIR}/Beach/Mermaid Portrait.png`, frame: { x: 0, y: 0, width: 64, height: 64 } },
    stationary: BEACH_MERMAID_CELL,
    staysInRain: true,
    // Aparece de dia (dorme no fundo do mar à noite).
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 6, place: { kind: 'spot', col: BEACH_MERMAID_CELL.col, row: BEACH_MERMAID_CELL.row, facing: 'down' } },
      { fromHour: 21, place: { kind: 'inside' } },
    ],
    chatter: [
      'Ahh, o mar hoje está tão calmo... Você também gosta de ouvir as ondas?',
      'Dizem que tem um tesouro no fundo daqui. Eu nunca o achei — mas as conchas são lindas!',
      'Os pescadores da casinha sempre me trazem pão. Eu trago histórias do fundo do mar.',
      'Cuidado com as noites de horda! Daqui de baixo eu ouço os monstros descendo pra Fazenda.',
    ],
  },
};

/** Moradores de cada cena (cada cena só cria os seus). */
export const VILLAGE_NPC_IDS: NpcId[] = ['blacksmith', 'banker', 'pirate', 'supplier', 'carpenter'];
export const BEACH_NPC_IDS: NpcId[] = ['mermaid'];
