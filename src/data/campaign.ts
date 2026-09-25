/**
 * Campanha do jogo (progressão com FIM): uma sequência de missões dos moradores do Vilarejo, agrupadas em 4 atos. A missão atual é
 * sempre uma só (`CampaignState.questIndex`) — cumprida, o morador que a deu entrega a recompensa e a próxima é liberada. O ato 4
 * termina na NOITE FINAL: uma horda especial na Fazenda; sobrevivendo a ela a campanha se completa (epílogo, `scenes/EndingScene.ts`)
 * e o jogador pode continuar no modo livre. Só DADOS: a regra (progresso, entrega, recompensa) está em `systems/campaign.ts`.
 */
import type { NpcId } from './npcs';

/** Estado da campanha (vai pro save — `SaveData.campaign`). */
export interface CampaignState {
  /** Índice da missão atual em `QUESTS`; igual a `QUESTS.length` = todas cumpridas. */
  questIndex: number;
  /** Quantas noites de horda o jogador já venceu (as de 10 em 10 dias e a Noite Final). */
  hordesWon: number;
  /** Dia (do calendário) em que a NOITE FINAL vai acontecer, depois que o jogador diz que está pronto; `null` = ainda não marcada. */
  finalNightDay: number | null;
  /** A Noite Final foi vencida: a história terminou (o jogo continua livre). */
  completed: boolean;
}

export function createCampaignState(): CampaignState {
  return { questIndex: 0, hordesWon: 0, finalNightDay: null, completed: false };
}

/** Número da horda da Noite Final (mesmo cálculo de tamanho/vida/recompensa das hordas comuns, `data/horde.ts`): 14 inimigos com 40 de vida. */
export const FINAL_HORDE_NUMBER = 4;

/** Uma condição de missão. Entregas/pagamentos são consumidos ao concluir; as demais só são conferidas. */
export type QuestRequirement =
  | { kind: 'deliverCrop'; id: string; amount: number }
  | { kind: 'deliverResource'; id: string; amount: number }
  /** Pagar moedas ao morador. */
  | { kind: 'pay'; coins: number }
  /** Ter uma arma/armadura (comprada no Ferreiro ou fabricada na Bancada). */
  | { kind: 'own'; category: 'tool' | 'armor'; id: string; label: string }
  /** Ter aberto N pontes de obra (Cavernas, Praia, Pedreira, Floresta — a estrada do Vilarejo não conta). */
  | { kind: 'bridges'; count: number }
  /** Ter vencido N noites de horda. */
  | { kind: 'hordesWon'; count: number }
  /** A própria Noite Final (a missão só termina quando ela é vencida). */
  | { kind: 'finalNight' };

export interface QuestReward {
  coins?: number;
  /** id de recurso → quantidade. */
  resources?: Record<string, number>;
}

export interface QuestDefinition {
  id: string;
  act: 1 | 2 | 3 | 4;
  giver: NpcId;
  title: string;
  /** Fala do morador ao oferecer/lembrar a missão. */
  intro: string;
  requirements: QuestRequirement[];
  reward: QuestReward;
  /** Fala ao entregar a missão. */
  outro: string;
}

export const ACTS: Record<1 | 2 | 3 | 4, { title: string; subtitle: string }> = {
  1: { title: 'Ato I — Raízes', subtitle: 'Mostre que a terra ainda dá frutos.' },
  2: { title: 'Ato II — Fronteiras', subtitle: 'Descubra o que existe além da Fazenda.' },
  3: { title: 'Ato III — Preparativos', subtitle: 'Arme-se: a noite mais escura vem aí.' },
  4: { title: 'Ato IV — A Noite Final', subtitle: 'Defenda a Fazenda pela última vez.' },
};

export const QUESTS: QuestDefinition[] = [
  // ---- Ato I ------------------------------------------------------------------------------------------------------
  {
    id: 'first-harvest',
    act: 1,
    giver: 'banker',
    title: 'A primeira colheita',
    intro:
      'Então você é quem herdou a velha Fazenda! Terra parada não paga imposto, meu jovem. Traga-me 10 Cenouras colhidas por você e eu apresento o Vilarejo a quem trabalha de verdade.',
    requirements: [{ kind: 'deliverCrop', id: 'carrot', amount: 10 }],
    reward: { coins: 150 },
    outro: 'Cenouras lindas! Prova de que a Fazenda tem futuro. Aqui está um adiantamento pelo trabalho.',
  },
  {
    id: 'forge-repairs',
    act: 1,
    giver: 'blacksmith',
    title: 'A forja precisa de reparos',
    intro: 'Sou o Bruno, o ferreiro. Minha forja está caindo aos pedaços... 20 de Madeira e 15 de Pedra e eu volto a trabalhar de verdade. Preciso de você.',
    requirements: [
      { kind: 'deliverResource', id: 'wood', amount: 20 },
      { kind: 'deliverResource', id: 'stone', amount: 15 },
    ],
    reward: { coins: 200 },
    outro: 'Agora sim! A forja está quentinha de novo. Passe aqui sempre: tenho espadas e armaduras à venda.',
  },
  {
    id: 'village-supper',
    act: 1,
    giver: 'banker',
    title: 'Um jantar para o Vilarejo',
    intro: 'O Vilarejo vai fazer um jantar de boas-vindas em sua honra! Preciso de 8 Batatas e 8 Cebolas da sua horta para o ensopado.',
    requirements: [
      { kind: 'deliverCrop', id: 'potato', amount: 8 },
      { kind: 'deliverCrop', id: 'onion', amount: 8 },
    ],
    reward: { coins: 250 },
    outro: 'O ensopado ficou divino, e todos querem conhecer a sua horta. A Fazenda ganhou fama!',
  },

  // ---- Ato II -----------------------------------------------------------------------------------------------------
  {
    id: 'new-horizons',
    act: 2,
    giver: 'pirate',
    title: 'Novos horizontes',
    intro:
      'Arr! Sou o Capitão Salgado. Você só planta e vende? Há Cavernas, Praia, Pedreira e Floresta ao redor da Fazenda! Abra pelo menos 2 das pontes e me diga o que viu.',
    requirements: [{ kind: 'bridges', count: 2 }],
    reward: { coins: 300 },
    outro: 'Sabia que tinha alma de explorador! O mundo é bem maior que uma horta, marujo.',
  },
  {
    id: 'good-timber',
    act: 2,
    giver: 'pirate',
    title: 'Madeira de lei',
    intro: 'Meu barco anda precisando de reparos, e o casco só aguenta madeira boa. Traga-me 40 de Madeira e eu pago bem.',
    requirements: [{ kind: 'deliverResource', id: 'wood', amount: 40 }],
    reward: { coins: 250, resources: { stone: 10 } },
    outro: 'Belas tábuas! O casco vai ficar firme. Leve umas pedras de lastro, cortesia do capitão.',
  },
  {
    id: 'real-ore',
    act: 2,
    giver: 'pirate',
    title: 'Minério de verdade',
    intro: 'Tem ferro escondido nas pedras da Pedreira. Se me trouxer 15 de Ferro, eu conto o que sei sobre as noites de horda que assombram a Fazenda...',
    requirements: [{ kind: 'deliverResource', id: 'iron', amount: 15 }],
    reward: { coins: 400 },
    outro:
      'Ferro puro! Então escute: de tempos em tempos, criaturas descem sobre a Fazenda à noite. Cada horda vem mais forte que a anterior. Prepare-se.',
  },

  // ---- Ato III ----------------------------------------------------------------------------------------------------
  {
    id: 'iron-blade',
    act: 3,
    giver: 'blacksmith',
    title: 'Uma lâmina de ferro',
    intro: 'Ouvi falar das hordas... Com a espada de madeira você não dura uma noite. Tenha uma Espada de Ferro: compre na minha loja ou fabrique na Bancada.',
    requirements: [{ kind: 'own', category: 'tool', id: 'sword-iron', label: 'Espada de Ferro' }],
    reward: { coins: 200 },
    outro: 'Bela lâmina! Cuide bem dela — o fio é o que separa você dos monstros.',
  },
  {
    id: 'iron-armor',
    act: 3,
    giver: 'blacksmith',
    title: 'Uma armadura à altura',
    intro: 'Espada sem armadura é coragem sem juízo. Consiga uma Armadura de Ferro — comprada aqui ou fabricada — e vista-a no Inventário.',
    requirements: [{ kind: 'own', category: 'armor', id: 'armor-iron', label: 'Armadura de Ferro' }],
    reward: { coins: 250 },
    outro: 'Agora você parece um verdadeiro defensor. Falta pouco.',
  },
  {
    id: 'slime-goo',
    act: 3,
    giver: 'blacksmith',
    title: 'Gosma para a têmpera',
    intro: 'Um segredo de ferreiro: gosma de Slime deixa o aço mais resistente. Traga-me 25 Gosmas — os Slimes da Floresta e as hordas dão bastante.',
    requirements: [{ kind: 'deliverResource', id: 'slime-goo', amount: 25 }],
    reward: { coins: 500 },
    outro: 'Hmm, que cheiro... mas que resultado! O ferro nunca esteve tão bom.',
  },
  {
    id: 'first-night',
    act: 3,
    giver: 'banker',
    title: 'Sobreviver à primeira noite',
    intro: 'A primeira horda cai no dia 10. Defenda a Fazenda até o amanhecer e prove que é capaz de proteger o que é seu.',
    requirements: [{ kind: 'hordesWon', count: 1 }],
    reward: { coins: 600 },
    outro: 'Você sobreviveu! O Vilarejo inteiro está impressionado. Mas ainda há uma noite pior por vir.',
  },

  // ---- Ato IV -----------------------------------------------------------------------------------------------------
  {
    id: 'defense-fund',
    act: 4,
    giver: 'banker',
    title: 'O fundo de defesa',
    intro: 'A Noite Final se aproxima. Preciso reunir um fundo para reforçar a defesa da Fazenda e do Vilarejo: 2000 moedas. É um investimento — você vai ver.',
    requirements: [{ kind: 'pay', coins: 2000 }],
    reward: { resources: { wood: 60, stone: 40, iron: 20 } },
    outro: 'O fundo está feito. Aqui estão materiais para reforçar suas defesas. Falta só você dizer que está pronto.',
  },
  {
    id: 'final-night',
    act: 4,
    giver: 'banker',
    title: 'A Noite Final',
    intro: 'Chegou a hora. Quando disser que está pronto, a última horda descerá sobre a Fazenda às 19:00 — a maior de todas. Sobreviva até o amanhecer e a Fazenda será livre. Está pronto?',
    requirements: [{ kind: 'finalNight' }],
    reward: { coins: 1000 },
    outro: 'A Fazenda está salva.',
  },
];

/** Texto de epílogo mostrado na tela final (`scenes/EndingScene.ts`), página a página. */
export const EPILOGUE_PAGES: string[] = [
  'O sol nasce sobre a Fazenda.\n\nA última horda se foi, e o silêncio da manhã nunca foi tão doce.',
  'No Vilarejo, Alberto abre o cofre, Bruno acende a forja e o Capitão Salgado iça as velas: todos sabem que aquela terra agora tem dono — e ele não desiste.',
  'Do que era um terreno abandonado, nasceram hortas, pontes e amizades.\n\nA Fazenda será lembrada por gerações.',
];
