import { gameState } from './gameState';
import { Inventory } from './inventory';
import { CROPS } from '../data/crops';
import { RESOURCES } from '../data/resources';
import { farmMap } from '../data/maps/farmMap';
import { NPCS } from '../data/npcs';
import { HORDE_START_HOUR } from '../data/horde';
import { QUESTS, QuestDefinition, QuestRequirement, QuestReward, CampaignState } from '../data/campaign';
import { isWorldAtPeace } from './story';

/** Uma linha de progresso de missão ("Cenoura: 4/10"), já pronta pra tela. */
export interface QuestProgressLine {
  text: string;
  done: boolean;
}

export interface QuestStatus {
  quest: QuestDefinition;
  lines: QuestProgressLine[];
  /** Todas as condições cumpridas — o morador pode receber a entrega. (A Noite Final nunca fica "pronta": ela termina sozinha.) */
  ready: boolean;
}

/** A missão em andamento, ou `null` se todas foram cumpridas (a campanha acabou). */
export function getCurrentQuest(campaign: CampaignState = gameState.campaign): QuestDefinition | null {
  return QUESTS[campaign.questIndex] ?? null;
}

/** Pontes de OBRA abertas (Cavernas, Praia, Pedreira, Floresta) — a estrada do Vilarejo, sempre aberta, não entra na conta. */
function countUnlockedWorkBridges(): number {
  return farmMap.bridges.filter((bridge) => bridge.requirement.coins && gameState.unlockedBridges.has(`${bridge.col},${bridge.row}`)).length;
}

function cropName(id: string): string {
  return CROPS[id]?.name ?? id;
}

function resourceName(id: string): string {
  return RESOURCES[id]?.name ?? id;
}

/** Quanto o jogador tem do que a condição pede (para "tem/pede"), e se já está cumprida. */
export function evaluateRequirement(requirement: QuestRequirement, inventory: Inventory, campaign: CampaignState): { text: string; done: boolean } {
  switch (requirement.kind) {
    case 'deliverCrop': {
      const have = Math.min(inventory.getCount(requirement.id), requirement.amount);
      return { text: `${cropName(requirement.id)}: ${have}/${requirement.amount}`, done: have >= requirement.amount };
    }
    case 'deliverResource': {
      const have = Math.min(inventory.getResourceCount(requirement.id), requirement.amount);
      return { text: `${resourceName(requirement.id)}: ${have}/${requirement.amount}`, done: have >= requirement.amount };
    }
    case 'pay': {
      const have = Math.min(inventory.getCoins(), requirement.coins);
      return { text: `Moedas: ${have}/${requirement.coins}`, done: have >= requirement.coins };
    }
    case 'own': {
      const owned = requirement.category === 'tool' ? inventory.hasTool(requirement.id) : inventory.hasArmor(requirement.id);
      return { text: `${requirement.label}: ${owned ? 'sim' : 'não'}`, done: owned };
    }
    case 'bridges': {
      const have = Math.min(countUnlockedWorkBridges(), requirement.count);
      return { text: `Pontes abertas: ${have}/${requirement.count}`, done: have >= requirement.count };
    }
    case 'hordesWon': {
      // Depois do fim da história não há mais hordas: a missão conta como cumprida.
      if (isWorldAtPeace()) return { text: 'Hordas: o mundo está em paz', done: true };
      const have = Math.min(campaign.hordesWon, requirement.count);
      return { text: `Hordas vencidas: ${have}/${requirement.count}`, done: have >= requirement.count };
    }
    case 'finalNight':
      if (isWorldAtPeace() && !campaign.completed) return { text: 'Noite Final: não haverá mais — o mundo está em paz', done: true };
      return { text: campaign.completed ? 'Noite Final: vencida' : describeFinalNight(campaign), done: campaign.completed };
  }
}

function describeFinalNight(campaign: CampaignState): string {
  if (campaign.finalNightDay === null) return 'Noite Final: diga ao Alberto que está pronto';
  const today = gameState.gameClock.getDay();
  const when = campaign.finalNightDay === today ? 'hoje' : `no dia ${campaign.finalNightDay}`;
  return `Noite Final: ${when}, às ${HORDE_START_HOUR}:00 — defenda a Fazenda!`;
}

export function getQuestStatus(quest: QuestDefinition, inventory: Inventory = gameState.inventory, campaign: CampaignState = gameState.campaign): QuestStatus {
  const lines = quest.requirements.map((requirement) => evaluateRequirement(requirement, inventory, campaign));
  // A Noite Final não é "entregue": a missão termina quando a horda é vencida (`completeCampaign`), então nunca fica pronta pra entrega.
  const isFinalNight = quest.requirements.some((requirement) => requirement.kind === 'finalNight');
  // Em paz, a Noite Final nunca vai acontecer: a missão pode ser entregue direto.
  return { quest, lines, ready: (!isFinalNight || isWorldAtPeace()) && lines.every((line) => line.done) };
}

/** Uma linha só pro marcador de objetivo do HUD: título da missão + o que falta na primeira condição pendente. */
export function describeObjective(campaign: CampaignState = gameState.campaign): string | null {
  const quest = getCurrentQuest(campaign);
  if (!quest) return null;
  const status = getQuestStatus(quest, gameState.inventory, campaign);
  const pending = status.lines.find((line) => !line.done);
  const isFinalNight = quest.requirements.some((requirement) => requirement.kind === 'finalNight');
  if (isFinalNight) return `${quest.title} — ${status.lines[0]?.text ?? ''}`;
  return status.ready ? `${quest.title} — entregue a ${giverLabel(quest)}` : `${quest.title} — ${pending?.text ?? ''}`;
}

function giverLabel(quest: QuestDefinition): string {
  const giver = NPCS[quest.giver];
  return `${giver.name} (${giver.title})`;
}

/** Descrição curta da recompensa, pra mostrar na fala ("150 moedas, 10 Pedra"). */
export function describeReward(reward: QuestReward): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`${reward.coins} moedas`);
  for (const [id, amount] of Object.entries(reward.resources ?? {})) parts.push(`${amount} ${resourceName(id)}`);
  return parts.join(', ');
}

/**
 * Entrega a missão atual: reconfere TUDO (a UI pode estar desatualizada), consome o que foi pedido (colheita, recurso, moedas),
 * paga a recompensa e avança pra próxima. Devolve a missão concluída, ou `null` (sem tocar em nada) se ainda não dá pra entregar.
 */
export function turnInCurrentQuest(inventory: Inventory = gameState.inventory): QuestDefinition | null {
  const quest = getCurrentQuest();
  if (!quest) return null;
  const status = getQuestStatus(quest, inventory);
  if (!status.ready) return null;

  consumeRequirements(quest.requirements, inventory);
  grantReward(quest.reward, inventory);

  gameState.campaign.questIndex += 1;
  if (quest.requirements.some((requirement) => requirement.kind === 'finalNight')) gameState.campaign.completed = true;
  return quest;
}

/** Consome o que as condições pedem (entregas e pagamento) — as demais condições só são conferidas, nada se gasta. */
export function consumeRequirements(requirements: QuestRequirement[], inventory: Inventory): void {
  for (const requirement of requirements) {
    if (requirement.kind === 'deliverCrop') inventory.takeCrop(requirement.id, requirement.amount);
    else if (requirement.kind === 'deliverResource') inventory.useResource(requirement.id, requirement.amount);
    else if (requirement.kind === 'pay') inventory.spendCoins(requirement.coins);
  }
}

/** Paga a recompensa (moedas e recursos) ao jogador. */
export function grantReward(reward: QuestReward, inventory: Inventory): void {
  if (reward.coins) inventory.addCoins(reward.coins);
  for (const [id, amount] of Object.entries(reward.resources ?? {})) inventory.addResources(id, amount);
}

/** A missão atual é a da Noite Final e ela ainda não foi marcada? */
export function canScheduleFinalNight(): boolean {
  const quest = getCurrentQuest();
  return !isWorldAtPeace() && !!quest && quest.requirements.some((requirement) => requirement.kind === 'finalNight') && gameState.campaign.finalNightDay === null && !gameState.horde.active;
}

/**
 * "Estou pronto": marca a Noite Final — hoje, se ainda dá tempo (antes das 19:00), senão amanhã. Devolve o dia marcado. O dia
 * fica em `campaign.finalNightDay`; a horda em si é iniciada pelo `HordeDirector` (`systems/horde.ts` trata esse dia como dia de horda).
 */
export function scheduleFinalNight(): number {
  const { gameClock } = gameState;
  const day = gameClock.getHours() < HORDE_START_HOUR ? gameClock.getDay() : gameClock.getDay() + 1;
  gameState.campaign.finalNightDay = day;
  return day;
}

/** A Noite Final foi vencida: a campanha se completa (a missão final vale a recompensa dela). */
export function completeCampaign(): void {
  const quest = QUESTS[QUESTS.length - 1];
  gameState.campaign.completed = true;
  gameState.campaign.finalNightDay = null;
  gameState.campaign.questIndex = QUESTS.length;
  if (quest.reward.coins) gameState.inventory.addCoins(quest.reward.coins);
}

/**
 * A Noite Final marcada passou sem acontecer (o jogador estava longe da Fazenda às 19:00 e o dia virou): desmarca, pra o Alberto
 * poder marcar de novo. Não mexe se a horda dela está em andamento (a noite atravessa a meia-noite) nem se ela já começou hoje.
 */
export function expireMissedFinalNight(): void {
  const { campaign, horde, gameClock } = gameState;
  if (campaign.finalNightDay === null || horde.active) return;
  if (gameClock.getDay() > campaign.finalNightDay && horde.lastHordeDay !== campaign.finalNightDay) campaign.finalNightDay = null;
}
