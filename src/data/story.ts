/**
 * A HISTÓRIA PRINCIPAL — "Os Três Pilares do Equilíbrio": o mundo está em desequilíbrio e só volta à paz quando os três pilares forem
 * oferecidos no altar do Sábio Coelho, no fundo das Cavernas (andar 100): a Cenoura Dourada, o Peixe Dourado e a Amizade Dourada
 * (o pet escolhido na criação, que se sacrifica no fim). Só DADOS: os marcos, na ordem da jornada, com o objetivo que o marcador do
 * HUD mostra enquanto cada um é o próximo. Quem registra/consulta é `systems/story.ts`.
 *
 * A campanha dos moradores (`data/campaign.ts`) corre em paralelo e não encerra mais o jogo: o fim é o sacrifício no altar.
 */

/** Marcos da história, na ordem da jornada. */
export type StoryMilestoneId =
  /** Leu a carta da profecia (Caixa de Correio) — a história aparece no marcador de objetivo. */
  | 'prophecy'
  /** Extraiu a primeira Azurita (Cavernas, a partir do andar 45). */
  | 'azurite'
  /** Chegou à barreira mágica do andar 50. */
  | 'barrier'
  /** Abriu o baú esquecido do andar 50: o mapa da área oculta da Floresta. */
  | 'map'
  /** Encontrou o castelo engolido pelas árvores, na área oculta da Floresta. */
  | 'hiddenForest'
  /** Entregou os peixes ao Mago: a Mesa de Encantamentos foi liberada. */
  | 'wizardTrust'
  /** Encantou a Picareta. */
  | 'enchantedPickaxe'
  /** Quebrou a barreira do andar 50. */
  | 'barrierBroken'
  /** Venceu a Horda Final do andar 100: o santuário se revelou e a terra entregou a semente da Cenoura Dourada. */
  | 'sanctuary'
  /** Pescou o Peixe Dourado no lago do santuário — 2º pilar. */
  | 'goldenFish'
  /** Colheu a Cenoura Dourada plantada no altar — 1º pilar. */
  | 'goldenCarrot'
  /** O pet se sacrificou e virou a Amizade Dourada — 3º pilar. */
  | 'goldenFriendship'
  /** O Sábio Coelho despertou (cinemática e créditos vistos). */
  | 'awakening'
  /** Recebeu a caixa com o filhote, depois do fim. */
  | 'newPet';

export interface StoryMilestone {
  id: StoryMilestoneId;
  /** Nome curto (menu de hack, diário). */
  title: string;
  /** O que o jogador precisa fazer pra chegar a este marco — o marcador de objetivo mostra o do PRÓXIMO marco pendente. */
  objective: string;
}

export const STORY_MILESTONES: StoryMilestone[] = [
  { id: 'prophecy', title: 'A profecia', objective: 'Leia a carta na Caixa de Correio' },
  { id: 'azurite', title: 'Azurita', objective: 'Desça as Cavernas até o andar 45 e extraia Azurita' },
  { id: 'barrier', title: 'A barreira', objective: 'Chegue ao andar 50 das Cavernas' },
  { id: 'map', title: 'O mapa', objective: 'Abra o baú esquecido do andar 50' },
  { id: 'hiddenForest', title: 'A Floresta oculta', objective: 'Siga o mapa até a área oculta da Floresta' },
  { id: 'wizardTrust', title: 'O Mago', objective: 'Entregue ao Mago os peixes que ele pede' },
  { id: 'enchantedPickaxe', title: 'Picareta encantada', objective: 'Encante a Picareta na Mesa de Encantamentos (com Azurita)' },
  { id: 'barrierBroken', title: 'Barreira quebrada', objective: 'Quebre a barreira do andar 50 com a Picareta encantada' },
  { id: 'sanctuary', title: 'O santuário', objective: 'Desça até o andar 100 e vença a Horda Final' },
  { id: 'goldenFish', title: 'Peixe Dourado', objective: 'Pesque o Peixe Dourado no lago do santuário' },
  { id: 'goldenCarrot', title: 'Cenoura Dourada', objective: 'Plante a semente no altar do Sábio Coelho e colha a Cenoura Dourada' },
  { id: 'goldenFriendship', title: 'Amizade Dourada', objective: 'Ofereça os pilares no altar do Sábio Coelho' },
  { id: 'awakening', title: 'O despertar', objective: 'Desperte o Sábio Coelho' },
  { id: 'newPet', title: 'Um novo começo', objective: 'Abra a caixa que chegou na Fazenda' },
];

/** Os três pilares e o marco que conclui cada um. */
export const STORY_PILLARS: Array<{ name: string; milestone: StoryMilestoneId }> = [
  { name: 'Cenoura Dourada', milestone: 'goldenCarrot' },
  { name: 'Peixe Dourado', milestone: 'goldenFish' },
  { name: 'Amizade Dourada', milestone: 'goldenFriendship' },
];

/** Estado da história (vai pro save — `SaveData.story`): marco → dia do jogo em que foi alcançado. */
export interface StoryState {
  reached: Partial<Record<StoryMilestoneId, number>>;
}

export function createStoryState(): StoryState {
  return { reached: {} };
}

/** A carta que conta a profecia (`data/mail.ts`): lê-la registra o marco `prophecy`. */
export const PROPHECY_MAIL_ID = 'prophecy';
