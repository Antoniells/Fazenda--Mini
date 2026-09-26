import { HOE, SICKLE, WATERING_CAN_TOOL } from './tools';
import { DEFAULT_CROP_ID } from './crops';

/**
 * Tutorial passo a passo para jogadores novos (`systems/tutorial.ts`, painel em `ui/tutorialPanel.ts`). Só DADOS: a lista de
 * passos, o texto de cada um e o que ele exige do jogador. Adicionar/reordenar/trocar um passo é mexer só aqui — a lógica
 * (avançar, travar comandos, salvar) não conhece nenhum passo em particular.
 */

/** Um item da Hotbar que o passo exige na mão (ferramenta ou semente). */
export interface TutorialItem {
  category: 'tool' | 'seed';
  id: string;
}

/** Ações do mundo que um passo pode exigir (avisadas por `tutorial.notify`, quando de fato aconteceram). */
export type TutorialAction = 'till' | 'plant' | 'water' | 'cut';

/**
 * O que termina o passo:
 * - `info`: só texto — o jogador aperta o botão. Trava TODOS os comandos enquanto aberto.
 * - `move`: dar `steps` passos (teclado ou clique). Só o movimento fica liberado.
 * - `select`: selecionar `item` na Hotbar. Movimento liberado; a Hotbar só aceita esse item.
 * - `act`: executar `action` na lavoura, com `item` na mão. Movimento e clique em canteiro liberados; a Hotbar só aceita `item`.
 */
export type TutorialGoal =
  | { kind: 'info'; buttonLabel: string }
  | { kind: 'move'; steps: number }
  | { kind: 'select'; item: TutorialItem }
  | { kind: 'act'; action: TutorialAction; item: TutorialItem };

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  goal: TutorialGoal;
}

const HOE_ITEM: TutorialItem = { category: 'tool', id: HOE.id };
const SICKLE_ITEM: TutorialItem = { category: 'tool', id: SICKLE.id };
const WATER_ITEM: TutorialItem = { category: 'tool', id: WATERING_CAN_TOOL.id };
const SEED_ITEM: TutorialItem = { category: 'seed', id: DEFAULT_CROP_ID };

/** Slot da Hotbar (0-7, vazio no começo do jogo) selecionado ao iniciar o tutorial — assim nenhum passo de "selecionar" já nasce cumprido. */
export const TUTORIAL_START_SLOT = 7;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo à fazenda!',
    text: 'Vamos aprender o básico em poucos passos. Alguns comandos ficam travados até você fazer o que o painel pede.',
    goal: { kind: 'info', buttonLabel: 'Começar' },
  },
  {
    id: 'move',
    title: 'Andar',
    text: 'Use W A S D ou as setas — ou clique no chão — para andar pela fazenda.',
    goal: { kind: 'move', steps: 6 },
  },
  {
    id: 'select-sickle',
    title: 'Pegar a Foice',
    text: 'Tem mato crescendo dentro da cerca. Aperte 3 (ou clique na Foice na barra de baixo) para segurá-la.',
    goal: { kind: 'select', item: SICKLE_ITEM },
  },
  {
    id: 'cut',
    title: 'Cortar o mato',
    text: 'Com a Foice na mão, clique no matinho verde dentro da cerca para cortá-lo.',
    goal: { kind: 'act', action: 'cut', item: SICKLE_ITEM },
  },
  {
    id: 'select-hoe',
    title: 'Pegar a Enxada',
    text: 'Aperte 1 (ou clique no ícone na barra de baixo) para segurar a Enxada.',
    goal: { kind: 'select', item: HOE_ITEM },
  },
  {
    id: 'till',
    title: 'Arar a terra',
    text: 'Com a Enxada na mão, clique num quadrado de terra dentro da cerca para arar.',
    goal: { kind: 'act', action: 'till', item: HOE_ITEM },
  },
  {
    id: 'select-seed',
    title: 'Pegar as sementes',
    text: 'Aperte 4 (ou clique no ícone de sementes na barra) para segurar as sementes de cenoura.',
    goal: { kind: 'select', item: SEED_ITEM },
  },
  {
    id: 'plant',
    title: 'Plantar',
    text: 'Clique no quadrado que você arou para plantar uma semente.',
    goal: { kind: 'act', action: 'plant', item: SEED_ITEM },
  },
  {
    id: 'select-water',
    title: 'Pegar o Regador',
    text: 'Aperte 2 (ou clique no Regador na barra) para segurá-lo.',
    goal: { kind: 'select', item: WATER_ITEM },
  },
  {
    id: 'water',
    title: 'Regar',
    text: 'Clique na semente plantada para regar. Sem água ela não cresce!',
    goal: { kind: 'act', action: 'water', item: WATER_ITEM },
  },
  {
    id: 'done',
    title: 'Tudo pronto!',
    text: 'Regue as plantas todo dia e durma na cama (entre pela porta da casa) para passar o dia: elas crescem um estágio por dia. Boa colheita!',
    goal: { kind: 'info', buttonLabel: 'Concluir' },
  },
];

/** Índice do passo em que o jogador corta o mato — enquanto o tutorial não passou dele, o mato do tutorial precisa existir na lavoura (`FarmResources.ensureTutorialWeed`). */
export const TUTORIAL_CUT_STEP_INDEX = TUTORIAL_STEPS.findIndex((step) => step.id === 'cut');

/**
 * Dica do primeiro regador vazio (`systems/tutorial.ts` `notifyWaterEmpty`): aparece no mesmo painel do tutorial, uma única vez por partida nova, no momento em que a
 * água acaba. Manda o jogador ao Vilarejo (ponte a LESTE da Fazenda; vira um objetivo na lista, `WATER_OBJECTIVE_TEXT`) encher o regador no poço da praça e avisa que dá pra
 * comprar um Poço do Marceneiro (o Tomás) pra ter água em casa. Não é um passo da fila: não trava o resto do tutorial.
 */
export const WATER_EMPTY_HINT: TutorialStep = {
  id: 'water-empty',
  title: 'O regador secou!',
  text: 'Sua água acabou. Vá ao Vilarejo pela ponte a leste da fazenda e encha o regador no poço da praça (isso fica na sua lista de objetivos). Dica: o Tomás, o marceneiro do Vilarejo, vende um Poço pra sua fazenda — assim você não precisa ir até lá toda vez.',
  goal: { kind: 'info', buttonLabel: 'Entendi' },
};

/** O objetivo que aparece no marcador do HUD depois da dica, enquanto o regador está vazio (`gameState.waterObjective`). */
export const WATER_OBJECTIVE_TEXT = 'Encher o regador no poço do Vilarejo (ponte a leste)';
