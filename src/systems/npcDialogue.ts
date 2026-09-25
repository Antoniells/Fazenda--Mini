import Phaser from 'phaser';
import { NPCS, NpcId } from '../data/npcs';
import { ACTS, QUESTS, QuestDefinition } from '../data/campaign';
import { OPEN_DIALOGUE_EVENT, DialoguePayload, DialogueAction } from '../ui/dialoguePanel';
import { gameState } from './gameState';
import { canScheduleFinalNight, describeReward, getCurrentQuest, getQuestStatus, scheduleFinalNight, turnInCurrentQuest } from './campaign';
import { save as saveGame } from './saveManager';
import { playEffect } from './soundEffects';
import { UNLOCK_SOUND } from '../data/audio';
import { HORDE_START_HOUR } from '../data/horde';
import { getCurrentRequest, getRequestStatus, turnInRequest } from './requests';

/** O que a conversa precisa da cena: o painel da loja (só o Ferreiro) e um jeito de tocar som. */
export interface NpcTalkContext {
  scene: Phaser.Scene;
  /** A loja está aberta agora (o Ferreiro está atrás do balcão)? */
  canOpenShop: () => boolean;
  openShop: () => void;
}

const COMPLETED_LINES: Record<NpcId, string[]> = {
  blacksmith: ['A Fazenda está salva graças a você! A forja nunca esteve tão animada.', 'Se precisar de um fio novo na lâmina, é só chamar.'],
  banker: ['A lenda da Fazenda! Meu cofre e eu agradecemos.', 'Continue prosperando — o Vilarejo inteiro torce por você.'],
  pirate: ['Arr! Um verdadeiro herói de terra firme. Quem diria!', 'Quando quiser navegar de novo, o convés é seu, marujo.'],
  mermaid: ['Ouvi dizer que a Fazenda foi salva! Até as ondas comemoraram.', 'Volte sempre à praia, herói. O mar nunca esquece quem protege a terra.'],
};

function pickChatter(id: NpcId): string {
  const lines = NPCS[id].chatter;
  return lines[Math.floor(Math.random() * lines.length)];
}

function open(scene: Phaser.Scene, payload: DialoguePayload): void {
  scene.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
}

function isFinalNightQuest(quest: QuestDefinition): boolean {
  return quest.requirements.some((requirement) => requirement.kind === 'finalNight');
}

/**
 * Conversa com um morador. O que ele diz depende da campanha (`systems/campaign.ts`): se a missão atual é DELE, mostra o pedido e o
 * progresso (com o botão "Entregar" quando dá); senão, avisa quem está com a missão e solta uma fala do dia. O Ferreiro sempre
 * oferece também a loja (só habilitada com ele no balcão). Toda entrega é reconferida em `turnInCurrentQuest` e salva o jogo.
 */
export function talkToNpc(id: NpcId, context: NpcTalkContext): void {
  const def = NPCS[id];
  const { scene } = context;
  const quest = getCurrentQuest();

  const base = { speaker: def.name, subtitle: def.title, portrait: { key: def.portrait.key, frame: def.portrait.frame } };
  const shopAction: DialogueAction | null =
    id === 'blacksmith'
      ? {
          label: 'Ver a loja',
          enabled: context.canOpenShop(),
          onSelect: () => context.openShop(),
        }
      : null;
  // Pedido do dia (missão secundária): sempre disponível como escolha; quem já cumpriu o de hoje recebe um "volte amanhã".
  const requestAction: DialogueAction = { label: 'Pedido do dia', onSelect: () => showRequest(context, id) };
  const withShop = (actions: DialogueAction[]): DialogueAction[] => [...actions, ...(shopAction ? [shopAction] : []), requestAction];

  // Campanha completa: só conversa de agradecimento.
  if (!quest) {
    const lines = COMPLETED_LINES[id];
    open(scene, { ...base, text: lines[Math.floor(Math.random() * lines.length)], actions: withShop([]) });
    return;
  }

  // A missão é de OUTRO morador.
  if (quest.giver !== id) {
    const giver = NPCS[quest.giver];
    open(scene, { ...base, text: `${pickChatter(id)}\n\nAh, e ${giver.name} (${giver.title}) está procurando por você: ele tem um pedido.`, actions: withShop([]) });
    return;
  }

  // A missão é DESTE morador.
  const status = getQuestStatus(quest);
  const details = status.lines.map((line) => `${line.done ? '[x]' : '[ ]'} ${line.text}`);
  details.push(`Recompensa: ${describeReward(quest.reward) || '—'}`);

  if (isFinalNightQuest(quest)) {
    const actions: DialogueAction[] = [];
    if (canScheduleFinalNight()) {
      actions.push({ label: 'Estou pronto!', onSelect: () => confirmFinalNight(context, id) });
    }
    open(scene, { ...base, text: quest.intro, details, actions: withShop(actions) });
    return;
  }

  const actions: DialogueAction[] = [];
  if (status.ready) actions.push({ label: 'Entregar', onSelect: () => deliver(context, id) });
  open(scene, { ...base, text: `${ACTS[quest.act].title}\n${quest.intro}`, details, actions: withShop(actions) });
}

/** Mostra o pedido do dia do morador (ou o "volte amanhã") com o progresso e o botão de entregar. */
function showRequest(context: NpcTalkContext, id: NpcId): void {
  const def = NPCS[id];
  const base = { speaker: def.name, subtitle: def.title, portrait: { key: def.portrait.key, frame: def.portrait.frame } };
  const request = getCurrentRequest(id);
  if (!request) {
    open(context.scene, { ...base, text: 'Por hoje já me ajudou o bastante, obrigado! Volte amanhã: sempre aparece alguma coisa.', actions: [] });
    return;
  }
  const status = getRequestStatus(request);
  const details = status.lines.map((line) => `${line.done ? '[x]' : '[ ]'} ${line.text}`);
  details.push(`Recompensa: ${describeReward(request.reward) || '—'}`);
  const actions: DialogueAction[] = [];
  if (status.ready) actions.push({ label: 'Entregar', onSelect: () => deliverRequest(context, id) });
  open(context.scene, { ...base, text: `Pedido: ${request.title}\n${request.text}`, details, actions });
}

/** Entrega o pedido do dia e mostra a recompensa. */
function deliverRequest(context: NpcTalkContext, id: NpcId): void {
  const done = turnInRequest(id);
  if (!done) {
    showRequest(context, id); // O estado mudou desde que abriu: reabre com o real.
    return;
  }
  playEffect(context.scene, UNLOCK_SOUND);
  saveGame();
  const def = NPCS[id];
  open(context.scene, {
    speaker: def.name,
    subtitle: def.title,
    portrait: { key: def.portrait.key, frame: def.portrait.frame },
    text: 'Muito obrigado! Foi uma grande ajuda. Volte amanhã: eu sempre tenho algum pedido.',
    details: [`Recompensa: ${describeReward(done.reward) || '—'}`],
    actions: [],
  });
}

/** Entrega a missão atual e mostra a fala de conclusão + a recompensa (e o que vem a seguir). */
function deliver(context: NpcTalkContext, id: NpcId): void {
  const { scene } = context;
  const done = turnInCurrentQuest();
  if (!done) {
    talkToNpc(id, context); // Mudou desde que abriu (ex.: gastou o que precisava): reabre com o estado real.
    return;
  }
  playEffect(scene, UNLOCK_SOUND);
  saveGame();

  const def = NPCS[id];
  const next = getCurrentQuest();
  const details = [`Recompensa: ${describeReward(done.reward) || '—'}`];
  if (next && next.act !== done.act) details.push(`Novo capítulo: ${ACTS[next.act].title} — ${ACTS[next.act].subtitle}`);
  if (next) details.push(`Próxima missão: ${next.title} (com ${NPCS[next.giver].name}).`);

  const actions: DialogueAction[] = [];
  if (next && next.giver === id) actions.push({ label: 'Continuar', onSelect: () => talkToNpc(id, context) });
  open(scene, {
    speaker: def.name,
    subtitle: def.title,
    portrait: { key: def.portrait.key, frame: def.portrait.frame },
    text: done.outro,
    details,
    actions,
  });
}

/** "Estou pronto!": marca a Noite Final (hoje, se ainda dá tempo; senão amanhã) e avisa. */
function confirmFinalNight(context: NpcTalkContext, id: NpcId): void {
  const day = scheduleFinalNight();
  saveGame();
  const when = day === gameState.gameClock.getDay() ? 'HOJE' : `no dia ${day}`;
  const def = NPCS[id];
  open(context.scene, {
    speaker: def.name,
    subtitle: def.title,
    portrait: { key: def.portrait.key, frame: def.portrait.frame },
    text: `Então está combinado. A Noite Final será ${when}, às ${HORDE_START_HOUR}:00. Volte pra Fazenda, reforce as cercas, leve a melhor espada e a melhor armadura. Sobreviva até o amanhecer!`,
    details: ['Dormir fica bloqueado até a Noite Final acontecer.', `Você não pode estar longe da Fazenda às ${HORDE_START_HOUR}:00.`],
    actions: [],
  });
}

/** Quantas missões existem (pro marcador/tela final). */
export const TOTAL_QUESTS = QUESTS.length;
