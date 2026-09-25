import { PET_IDS, getPetDefinition, isPetId } from './pets';
import type { MailMessage } from './mail';

/**
 * Eventos do mundo por dia do jogo (pedido explícito) — só DADOS: dias, textos e o estado que vai pro save. Quem decide quando cada
 * evento roda é `systems/eventManager.ts`; a lógica de cada um está em `systems/events/`.
 */

/** O que precisa ir pro save: quais eventos de uma vez só já aconteceram. */
export interface EventsState {
  completed: string[];
}

export function createEventsState(): EventsState {
  return { completed: [] };
}

// --- Evento 1: o Visitante do Dia 8 -----------------------------------------------------------------------------------------

export const VISITOR_EVENT_ID = 'visitor-day-8';
/** Dia em que o visitante aparece; o relógio do jogo começa cada dia às 6h, então "de manhã" é a partir de `VISITOR_FROM_HOUR`. */
export const VISITOR_DAY = 8;
export const VISITOR_FROM_HOUR = 6;
/** Quem visita: o Capitão Salgado (arte de `data/npcs.ts`, carregada pela Fazenda só quando o evento pode rodar). */
export const VISITOR_NPC_ID = 'pirate';
/** Por onde ele chega (e por onde vai embora): a ponte leste da Fazenda, que leva ao Vilarejo. */
export const VISITOR_ARRIVAL_CELL = { col: 54, row: 21 };
/** Onde ele para: em frente à casa, uma célula à direita de onde o jogador sai (a porta é (18, 8) e a saída, (18, 9)) — chega pelo leste sem cruzar a saída, e não tapa a porta. */
export const VISITOR_STAND_CELL = { col: 19, row: 9 };
export const VISITOR_DIALOGUE_PAGES = [
  'Trabalhar, dormir... trabalhar, dormir... A vida parece um ciclo sem fim, não é?',
  'Mas cuidado ao desejar que os dias passem depressa. Aproveite cada amanhecer enquanto pode...',
  'Afinal, o tempo não espera por ninguém. E quando o décimo dia chegar... bem, digamos que nem todo amanhecer traz coisas boas.',
];

/**
 * `UI/speech bubble, emojis, reaction.png` (144x336, grade de 16x16): o balão de interação em cima do visitante — o balão com "!"
 * (linha 12, coluna 3 da grade), arte já pronta da folha.
 */
export const INTERACT_BUBBLE_KEY = 'ui-speech-bubbles';
export const INTERACT_BUBBLE_PATH = 'UI/speech bubble, emojis, reaction.png';
export const INTERACT_BUBBLE_FRAME = { name: 'interact-bubble-exclamation', rect: { x: 48, y: 192, width: 16, height: 16 } };

// --- Evento 2: o Easter Egg da Amanda ---------------------------------------------------------------------------------------

export const AMANDA_EVENT_ID = 'amanda-cats';
export const AMANDA_NAME = 'amanda';
/** Total de gatos na Fazenda enquanto o evento roda (o escolhido + os que "vieram passear"); no `AMANDA_RESOLVE_DAY` sobra só o dela. */
export const AMANDA_CAT_COUNT = 7;
export const AMANDA_RESOLVE_DAY = 10;

/** É a Amanda com um gato? (nome digitado na Criação de Personagem, sem diferenciar maiúsculas/espaços, e o pet escolhido é um gato). */
export function isAmandaWithCat(profile: { playerName: string; petId: string }): boolean {
  return profile.playerName.trim().toLowerCase() === AMANDA_NAME && isPetId(profile.petId) && getPetDefinition(profile.petId).species === 'cat';
}

/** Os gatos do catálogo (`data/pets.ts`) — as peles que os 6 visitantes sorteiam. */
export const CAT_PET_IDS = PET_IDS.filter((id) => getPetDefinition(id).species === 'cat');

/** A carta do dia 10, na Caixa de Correio: explica, com humor, pra onde foram os outros 6 gatos. */
export const AMANDA_LETTER: MailMessage = {
  id: 'amanda-cats-letter',
  title: 'Sobre aqueles gatinhos...',
  body:
    'Oi, Amanda,\n\n' +
    'Passamos pra explicar a confusão dos gatos: aqueles 6 gatinhos já tinham dono! Eles só estavam passeando por aí, ' +
    'curtindo o quintal mais bonito da região.\n\n' +
    'Já voltaram pra casa, satisfeitos. Ficou só o que você escolheu — esse é todo seu (e a caminha dele é a única, ' +
    'então nem adianta reclamar de espaço).\n\n' +
    'Os vizinhos que perderam a conta dos gatos.',
  deliverOnDay: AMANDA_RESOLVE_DAY,
  buttonLabel: 'Que confusão!',
  heart: true,
};
