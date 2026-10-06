import { gameState } from './gameState';
import { MAIL_SCHEDULE, MailMessage, PROPHECY_MAIL, createHordeWarningMail } from '../data/mail';
import { hordeNumberForDay, nextHordeDayFrom } from '../data/horde';
import { PROPHECY_CAVE_FLOOR } from '../data/story';
import { hasMilestone, isWorldAtPeace, reachMilestone } from './story';

/**
 * Correio (pedido explícito): só estado, sem game object — quem mostra é `systems/mailbox.ts`. Uma carta está "na caixa" quando o
 * dia do jogo já chegou em `deliverOnDay` e ela ainda não foi lida. As cartas vêm de duas fontes: a lista fixa `MAIL_SCHEDULE`
 * (`data/mail.ts`) e as agendadas por código com `scheduleMail` (guardadas em `gameState.mail.custom`, vão pro save). E as GERADAS na hora,
 * que não vão pro save (`generatedMail`).
 */

function allMail(): MailMessage[] {
  return [...MAIL_SCHEDULE, ...gameState.mail.custom, ...generatedMail()];
}

/** O aviso da próxima horda do calendário (chega na véspera), enquanto o mundo não está em paz — depois do fim da história as hordas acabam. */
function generatedMail(): MailMessage[] {
  if (isWorldAtPeace()) return [];
  const hordeDay = nextHordeDayFrom(gameState.gameClock.getDay());
  return [createHordeWarningMail(hordeDay, hordeNumberForDay(hordeDay))];
}

/** Agenda uma carta nova pra chegar em `message.deliverOnDay`. Um `id` que já existe (fixo, agendado ou lido) é ignorado — agendar de novo é seguro. */
export function scheduleMail(message: MailMessage): void {
  if (allMail().some((existing) => existing.id === message.id)) return;
  gameState.mail.custom.push({ ...message });
}

/** Cartas na caixa agora (chegaram e não foram lidas), da mais antiga pra mais nova. */
export function getUnreadMail(): MailMessage[] {
  const today = gameState.gameClock.getDay();
  const read = new Set(gameState.mail.readIds);
  return allMail()
    .filter((message) => message.deliverOnDay <= today && !read.has(message.id))
    .sort((a, b) => a.deliverOnDay - b.deliverOnDay);
}

export function hasUnreadMail(): boolean {
  return getUnreadMail().length > 0;
}

/**
 * Marca como lida e, se a carta faz parte da história, registra o marco dela (`MailMessage.milestone`). Se traz sementes (a encomenda
 * da Lia, `systems/seedOrders.ts`), elas vão pra Bolsa — só na primeira leitura.
 */
export function markMailRead(id: string): void {
  const message = allMail().find((candidate) => candidate.id === id);
  if (!gameState.mail.readIds.includes(id)) {
    gameState.mail.readIds.push(id);
    for (const [cropId, amount] of Object.entries(message?.seeds ?? {})) gameState.inventory.addSeeds(cropId, amount);
  }
  if (message?.milestone) reachMilestone(message.milestone);
}

/** Título e corpo prontos pra mostrar: `{nome}` vira o nome do jogador. */
export function renderMail(message: MailMessage): { title: string; body: string } {
  const name = gameState.profile.playerName;
  return { title: message.title.replace(/\{nome\}/g, name), body: message.body.replace(/\{nome\}/g, name) };
}

/**
 * A carta da profecia chega (hoje) quando o andar mais fundo já alcançado é o `PROPHECY_CAVE_FLOOR` ou mais. Seguro chamar sempre: devolve
 * `true` só na vez em que agendou. Chamada ao descer nas Cavernas e ao abrir a Fazenda (saves de quem já tinha passado do andar).
 */
export function checkProphecyMail(): boolean {
  if (gameState.cave.deepest < PROPHECY_CAVE_FLOOR || hasMilestone('prophecy')) return false;
  if (allMail().some((message) => message.id === PROPHECY_MAIL.id)) return false;
  scheduleMail({ ...PROPHECY_MAIL, deliverOnDay: gameState.gameClock.getDay() });
  return true;
}
