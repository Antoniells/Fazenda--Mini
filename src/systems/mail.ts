import { gameState } from './gameState';
import { MAIL_SCHEDULE, MailMessage } from '../data/mail';
import { reachMilestone } from './story';

/**
 * Correio (pedido explícito): só estado, sem game object — quem mostra é `systems/mailbox.ts`. Uma carta está "na caixa" quando o
 * dia do jogo já chegou em `deliverOnDay` e ela ainda não foi lida. As cartas vêm de duas fontes: a lista fixa `MAIL_SCHEDULE`
 * (`data/mail.ts`) e as agendadas por código com `scheduleMail` (guardadas em `gameState.mail.custom`, vão pro save).
 */

function allMail(): MailMessage[] {
  return [...MAIL_SCHEDULE, ...gameState.mail.custom];
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

/** Marca como lida e, se a carta faz parte da história, registra o marco dela (`MailMessage.milestone`). */
export function markMailRead(id: string): void {
  if (!gameState.mail.readIds.includes(id)) gameState.mail.readIds.push(id);
  const milestone = allMail().find((message) => message.id === id)?.milestone;
  if (milestone) reachMilestone(milestone);
}

/** Título e corpo prontos pra mostrar: `{nome}` vira o nome do jogador. */
export function renderMail(message: MailMessage): { title: string; body: string } {
  const name = gameState.profile.playerName;
  return { title: message.title.replace(/\{nome\}/g, name), body: message.body.replace(/\{nome\}/g, name) };
}
