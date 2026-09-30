/**
 * Caixa de Correio (pedido explícito): cartas AGENDADAS pra chegar num dia do jogo. A lógica está em `systems/mailbox.ts`; aqui só os
 * dados — onde fica a caixa, a arte e as cartas fixas. Mesma filosofia de `data/crops.ts`: uma carta nova é só mais uma entrada em
 * `MAIL_SCHEDULE` (ou uma chamada a `scheduleMail` de qualquer sistema, pra cartas que dependem do que o jogador fez).
 */
import { PROPHECY_MAIL_ID, StoryMilestoneId } from './story';

/** Uma carta/mensagem. `{nome}` no título/corpo vira o nome do jogador na hora de abrir. */
export interface MailMessage {
  /** Único: é com ele que se sabe se a carta já foi lida (`MailState.readIds`). */
  id: string;
  title: string;
  body: string;
  /** Dia do jogo (`GameClock.getDay`) a partir do qual ela está na caixa. */
  deliverOnDay: number;
  /** Texto do botão que termina a leitura (padrão "Guardar"). */
  buttonLabel?: string;
  /** Desenha o coração (arte do HUD) no fim da carta. */
  heart?: boolean;
  /** Marco da história (`data/story.ts`) que ler esta carta registra. */
  milestone?: StoryMilestoneId;
}

/** O que precisa ir pro save: quais cartas já foram lidas e as agendadas por código (as fixas vêm de `MAIL_SCHEDULE`, não são duplicadas no save). */
export interface MailState {
  readIds: string[];
  custom: MailMessage[];
}

export function createMailState(): MailState {
  return { readIds: [], custom: [] };
}

/** Onde a caixa fica: do lado esquerdo da casa, na grama (a porta é (18, 8), a caixa do pet aparece em (20, 9)). */
export const MAILBOX_CELL = { col: 15, row: 8 };

/**
 * `Objects/Exterior/Exterior.png` (512x176): a folha de objetos ao ar livre tem 4 caixas de correio em poste na linha de baixo —
 * usada a cinza com bandeirinha vermelha (11x18, recorte pixel a pixel pelo alfa). O papel (8x10) é o "correio novo": flutua em
 * cima da caixa enquanto há carta não lida.
 */
export const MAILBOX_KEY = 'mailbox-props';
export const MAILBOX_PATH = 'Objects/Exterior/Exterior.png';
export const MAILBOX_FRAME = { name: 'mailbox-frame', rect: { x: 68, y: 158, width: 11, height: 18 } };
export const MAIL_PAPER_FRAME = { name: 'mailbox-paper-frame', rect: { x: 148, y: 76, width: 8, height: 10 } };

/** Cartas fixas do jogo, por dia de chegada. */
export const MAIL_SCHEDULE: MailMessage[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo à vizinhança!',
    body:
      'Oi, {nome},\n\n' +
      'Soubemos que você assumiu a fazenda e queríamos dar as boas-vindas! Aqui na região a gente se ajuda: qualquer notícia, ' +
      'convite ou recado vai chegar por esta caixa de correio, então dê uma olhadinha nela de vez em quando.\n\n' +
      'Bom trabalho e boas colheitas!',
    deliverOnDay: 2,
    buttonLabel: 'Guardar',
    heart: true,
  },
  {
    // A história principal começa aqui (`data/story.ts`): lida a carta, os Três Pilares aparecem no marcador de objetivo.
    id: PROPHECY_MAIL_ID,
    title: 'A antiga profecia',
    body:
      '{nome},\n\n' +
      'Uma antiga profecia diz que o mundo, em desequilíbrio há tantos anos, só terá paz quando os Três Pilares forem oferecidos ao altar ' +
      'do Grande Sábio Coelho: a Cenoura Dourada, o Peixe Dourado e um terceiro pilar, cuja essência se perdeu no tempo.\n\n' +
      'Dizem que o altar repousa no fundo das Cavernas. Cuide da sua terra e de quem estiver ao seu lado.\n\n' +
      'Um velho amigo do Vilarejo',
    deliverOnDay: 3,
    buttonLabel: 'Guardar',
    milestone: 'prophecy',
  },
];
