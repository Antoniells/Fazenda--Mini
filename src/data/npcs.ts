/**
 * Moradores do Vilarejo: quem são, onde moram, a arte (sprites de andar/repouso e retrato) e a ROTINA do dia. Só DADOS — quem os
 * faz andar é `entities/Npc.ts` + `systems/npcSystem.ts`, e quem decide o que falam é `systems/npcDialogue.ts`.
 *
 * Rotina: uma lista de "a partir da hora H, o morador está em LUGAR". O dia dá a volta (a última entrada vale até a primeira do dia
 * seguinte). Lugares:
 * - `inside`: dentro de casa, invisível (dormindo/descansando) — a porta é a célula em frente à casa (`VillageStructure`).
 * - `post`: dentro do trabalho, VISÍVEL atrás do balcão (só o Ferreiro: `postPx` vem da fachada da loja, `data/villageShop.ts`).
 * - `spot`: parado numa célula da rua/praça, virado pra `facing`.
 * Na chuva, quem estaria numa rua/praça (`spot`) fica em casa; o `post` continua (o balcão é coberto).
 */
import { VILLAGE_SHOP_HOUSE, VILLAGE_BANKER_HOUSE, VILLAGE_PIRATE_HOUSE, VillageStructure } from './maps/villageMap';
import { BEACH_MERMAID_CELL } from './maps/beachDecor';

export type NpcId = 'blacksmith' | 'banker' | 'pirate' | 'mermaid';

export type NpcFacing = 'down' | 'up' | 'left' | 'right';

export type NpcPlace =
  | { kind: 'inside' }
  | { kind: 'post' }
  | { kind: 'spot'; col: number; row: number; facing: NpcFacing };

export interface NpcScheduleEntry {
  /** Hora (0-24) a partir da qual vale este lugar. */
  fromHour: number;
  place: NpcPlace;
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
}

export interface NpcDefinition {
  id: NpcId;
  name: string;
  title: string;
  sprite: NpcSpriteSheet;
  /** Retrato (quadro 64x64 no canto superior-esquerdo da folha). */
  portrait: { key: string; path: string; frame: { x: number; y: number; width: number; height: number } };
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
    portrait: { key: 'npc-blacksmith-portrait', path: `${NPC_DIR}/Blacksmith/Portrait.png`, frame: { x: 0, y: 0, width: 64, height: 64 } },
    home: VILLAGE_SHOP_HOUSE,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 7, place: { kind: 'post' } },
      { fromHour: 12, place: { kind: 'spot', col: 12, row: 16, facing: 'down' } },
      { fromHour: 13, place: { kind: 'post' } },
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
    title: 'Banqueiro',
    sprite: {
      idleKey: 'npc-banker-idle',
      idlePath: `${NPC_DIR}/Banker/Idle.png`,
      walkKey: 'npc-banker-walk',
      walkPath: `${NPC_DIR}/Banker/Walk.png`,
      frameSize: 32,
      idleFrames: 4,
      walkFrames: 6,
    },
    portrait: { key: 'npc-banker-portrait', path: `${NPC_DIR}/Banker/Portrait.png`, frame: { x: 0, y: 0, width: 64, height: 64 } },
    home: VILLAGE_BANKER_HOUSE,
    schedule: [
      { fromHour: 0, place: { kind: 'inside' } },
      { fromHour: 8, place: { kind: 'spot', col: 23, row: 15, facing: 'down' } },
      { fromHour: 12, place: { kind: 'spot', col: 16, row: 16, facing: 'left' } },
      { fromHour: 13, place: { kind: 'spot', col: 23, row: 15, facing: 'down' } },
      { fromHour: 18, place: { kind: 'spot', col: 19, row: 15, facing: 'left' } },
      { fromHour: 20, place: { kind: 'inside' } },
    ],
    chatter: [
      'Uma fazenda é como uma conta bancária: rende juros a quem tem constância.',
      'Nunca gaste mais do que colhe, esse é o segredo.',
      'Com tantas hordas, até eu aprendi a dormir com um olho aberto.',
      'Passe sempre por aqui: eu adoro ouvir sobre a sua colheita.',
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
export const VILLAGE_NPC_IDS: NpcId[] = ['blacksmith', 'banker', 'pirate'];
export const BEACH_NPC_IDS: NpcId[] = ['mermaid'];
