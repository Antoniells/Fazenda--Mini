import Phaser from 'phaser';
import { gameState } from './gameState';
import { hasMilestone, reachMilestone } from './story';
import { enchant, enchantBlocker, isEnchanted, isEnchantTableUnlocked } from './enchanting';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';
import { save as saveGame } from './saveManager';
import { OPEN_DIALOGUE_EVENT, DialogueAction, DialoguePayload } from '../ui/dialoguePanel';
import { WIZARD, WIZARD_FISH_REQUESTS, WIZARD_LINES } from '../data/hiddenForest';
import { FISH_BY_ID } from '../data/fishing';
import { ENCHANTS, ENCHANT_BAR_ID, EnchantTarget } from '../data/enchanting';
import { RESOURCES } from '../data/resources';
import { SPEND_MONEY_SOUND, UNLOCK_SOUND } from '../data/audio';

/**
 * O MAGO da Floresta Oculta (Fase 11) e a MESA DE ENCANTAMENTOS dele, tudo pelo painel de conversa (`ui/dialoguePanel.ts`):
 * - antes da confiança: pede os peixes (`WIZARD_FISH_REQUESTS`); "Entregar peixes" tira da Bolsa os pedidos que o jogador tiver
 *   (`gameState.wizardDelivered` guarda o progresso). Todos entregues → marco `wizardTrust` e a Mesa se abre;
 * - a Mesa: escolher "Ferramentas" (Picareta, Machado) ou "Espada e Armadura" e encantar com Barras de Azurita + moedas.
 */

const PORTRAIT = { key: WIZARD.idleFrames[0].key, frame: { x: 0, y: 0, width: WIZARD.frameSize, height: WIZARD.frameSize } };

function open(scene: Phaser.Scene, payload: DialoguePayload): void {
  scene.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
}

function fishName(id: string): string {
  return FISH_BY_ID[id]?.name ?? id;
}

/** Os peixes pedidos que ainda faltam entregar. */
export function pendingFish(): string[] {
  return WIZARD_FISH_REQUESTS.filter((id) => !gameState.wizardDelivered.includes(id));
}

/** Entrega os peixes pedidos que estiverem na Bolsa. Devolve os entregues agora. Completo → marco `wizardTrust`. */
export function deliverFish(): string[] {
  const delivered: string[] = [];
  for (const id of pendingFish()) {
    if (gameState.inventory.useResource(id, 1)) {
      gameState.wizardDelivered.push(id);
      delivered.push(id);
    }
  }
  if (pendingFish().length === 0) reachMilestone('wizardTrust');
  return delivered;
}

function fishDetails(): string[] {
  return WIZARD_FISH_REQUESTS.map((id) => {
    if (gameState.wizardDelivered.includes(id)) return `${fishName(id)}: entregue`;
    return `${fishName(id)}: ${gameState.inventory.getResourceCount(id) > 0 ? 'na Bolsa' : 'falta pescar'}`;
  });
}

/** Conversar com o Mago. `anchor` = onde mostrar os avisos flutuantes (a cabeça dele). */
export function talkToWizard(scene: Phaser.Scene, anchor: { x: number; y: number }): void {
  if (isEnchantTableUnlocked()) {
    const line = Phaser.Utils.Array.GetRandom(WIZARD_LINES.trusted);
    open(scene, {
      speaker: WIZARD.name,
      subtitle: WIZARD.title,
      portrait: PORTRAIT,
      text: line,
      actions: [{ label: 'Mesa de Encantamentos', onSelect: () => openEnchantTable(scene, anchor) }],
    });
    return;
  }

  const firstTalk = gameState.wizardDelivered.length === 0;
  const canDeliver = pendingFish().some((id) => gameState.inventory.getResourceCount(id) > 0);
  const actions: DialogueAction[] = [
    {
      label: 'Entregar peixes',
      enabled: canDeliver,
      onSelect: () => {
        const delivered = deliverFish();
        playEffect(scene, SPEND_MONEY_SOUND);
        saveGame();
        if (hasMilestone('wizardTrust')) {
          playEffect(scene, UNLOCK_SOUND);
          open(scene, { speaker: WIZARD.name, subtitle: WIZARD.title, portrait: PORTRAIT, text: WIZARD_LINES.thanks, actions: [{ label: 'Mesa de Encantamentos', onSelect: () => openEnchantTable(scene, anchor) }] });
        } else {
          popText(scene, anchor.x, anchor.y, `Entregue: ${delivered.map(fishName).join(', ')}`, { color: '#b8f5a0', fontSize: 13 });
        }
      },
    },
  ];
  open(scene, {
    speaker: WIZARD.name,
    subtitle: WIZARD.title,
    portrait: PORTRAIT,
    text: WIZARD_LINES.waiting,
    ...(firstTalk ? { pages: [...WIZARD_LINES.intro, WIZARD_LINES.waiting] } : {}),
    details: fishDetails(),
    actions,
  });
}

/** A Mesa de Encantamentos (trancada até o Mago confiar no jogador). */
export function openEnchantTable(scene: Phaser.Scene, anchor: { x: number; y: number }): void {
  if (!isEnchantTableUnlocked()) {
    popText(scene, anchor.x, anchor.y, 'A mesa está selada por magia.', { color: '#ffb3a8', fontSize: 13 });
    return;
  }
  const bars = gameState.inventory.getResourceCount(ENCHANT_BAR_ID);
  open(scene, {
    speaker: 'Mesa de Encantamentos',
    subtitle: `${RESOURCES[ENCHANT_BAR_ID].name}: você tem ${bars}`,
    text: 'O livro se abre sozinho. Escolha o que a Azurita vai encantar.',
    actions: [
      { label: 'Ferramentas', onSelect: () => openEnchantPage(scene, anchor, ['pickaxe', 'axe']) },
      { label: 'Espada e Armadura', onSelect: () => openEnchantPage(scene, anchor, ['sword', 'armor']) },
    ],
  });
}

function openEnchantPage(scene: Phaser.Scene, anchor: { x: number; y: number }, targets: EnchantTarget[]): void {
  const bars = gameState.inventory.getResourceCount(ENCHANT_BAR_ID);
  const coins = gameState.inventory.getCoins();
  const details = targets.map((target) => {
    const enchantDef = ENCHANTS[target];
    if (isEnchanted(target)) return `${enchantDef.name}: encantada (${enchantDef.effect})`;
    return `${enchantDef.name}: ${enchantDef.effect} — ${enchantDef.bars} Barras de Azurita (tem ${bars}) + ${enchantDef.coins} moedas (tem ${coins})`;
  });
  const actions: DialogueAction[] = targets.map((target) => ({
    label: isEnchanted(target) ? `${ENCHANTS[target].name}: encantada` : `Encantar ${ENCHANTS[target].name}`,
    enabled: enchantBlocker(target) === null,
    onSelect: () => {
      if (enchant(target) !== 'done') return;
      playEffect(scene, UNLOCK_SOUND);
      scene.cameras.main.flash(200, 150, 210, 255);
      popText(scene, anchor.x, anchor.y, `${ENCHANTS[target].name} encantada!`, { color: '#9fe8ff', fontSize: 15 });
      saveGame();
      openEnchantPage(scene, anchor, targets);
    },
  }));
  open(scene, { speaker: 'Mesa de Encantamentos', text: 'A Azurita brilha sobre o livro aberto.', details, actions });
}
