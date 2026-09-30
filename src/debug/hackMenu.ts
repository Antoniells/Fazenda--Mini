import Phaser from 'phaser';
import { debugFlags } from './debugFlags';
import { gameState } from '../systems/gameState';
import { startNewGame, save as saveGame } from '../systems/saveManager';
import { advanceWorldTime } from '../systems/worldTime';
import { startNextDay } from '../systems/dayCycle';
import { DAY_LENGTH_MS } from '../systems/gameClock';
import { applyUpgrades } from '../systems/farmUpgrades';
import { UPGRADE_TRACK_IDS, maxUpgradeLevel } from '../data/upgrades';
import { RESOURCES } from '../data/resources';
import { FISH, FISH_BY_ID } from '../data/fishing';
import { CROPS } from '../data/crops';
import { TOOLS } from '../data/tools';
import { WEAPONS } from '../data/weapons';
import { ARMORS } from '../data/armors';
import { DECORATIONS } from '../data/decorations';
import { TOOL_PROGRESSION } from '../data/toolProgression';
import { farmMap } from '../data/maps/farmMap';
import { CAVE_MAX_FLOOR } from '../data/caveFloors';
import { STORY_MILESTONES } from '../data/story';
import { reachMilestone, clearMilestone, hasMilestone, countPillars } from '../systems/story';
import { closeChestMenu, closeDialogue, closeFurnaceMenu, closeInventoryScreen, closePauseMenu } from '../scenes/UIScene';

/**
 * MENU DE HACK (ferramenta de teste, não faz parte do jogo): aperte F9 pra abrir/fechar. Painel HTML por cima do jogo (não usa arte do jogo — é só uma ferramenta de desenvolvimento).
 * Faz: dinheiro, itens (recursos, sementes, ferramentas/armas/armaduras, decorações e construções), melhorias no máximo, liberar pontes e expansões, acelerar o relógio,
 * pular horas e dias, curar/invencível, trocar de cena sozinho (inclusive o TOUR automático por todas, que conta os erros de execução que aparecerem) e
 * a HISTÓRIA dos Três Pilares (marcar/desfazer marcos, forçar uma horda hoje, ver a tela final).
 * Instalado por `main.ts` (`HACK_MENU_ENABLED`).
 */
/** Só no modo de desenvolvimento (`npm run dev`, `npm run dev:electron`, testes de ponta a ponta): o instalador sai sem o menu de trapaças. */
export const HACK_MENU_ENABLED = import.meta.env.DEV;

const TOGGLE_KEY = 'F9';
const PERSISTENT_SCENES = ['UIScene', 'MainMenuScene', 'CharacterCreationScene'];
const TOUR_INTERVAL_S = 5;

interface SceneTarget {
  label: string;
  key: string;
  data: () => object;
}

/** Dados de entrada das cenas de mapa externo (o que a ponte da Fazenda passaria): voltar pra Fazenda pela célula em frente à porta de casa. */
function externalEntry(areaName: string): { areaName: string; returnSceneKey: string; returnSpawn: { col: number; row: number } } {
  return { areaName, returnSceneKey: 'MainScene', returnSpawn: { col: farmMap.houseDoorPosition[0], row: farmMap.houseDoorPosition[1] + 1 } };
}

const SHOPS: Array<{ label: string; id: string }> = [
  { label: 'Forja (Ferreiro)', id: 'forge' },
  { label: 'Padaria', id: 'bakery' },
  { label: 'Insumos (Lia)', id: 'supplies' },
  { label: 'Marcenaria (Tomás)', id: 'carpentry' },
];

/** Todas as cenas a que o menu leva (e o tour percorre, na ordem). */
function sceneTargets(floor = 1): SceneTarget[] {
  return [
    { label: 'Fazenda', key: 'MainScene', data: () => ({}) },
    { label: 'Casa', key: 'HouseScene', data: () => ({}) },
    { label: 'Vilarejo', key: 'VillageScene', data: () => externalEntry('Vilarejo') },
    ...SHOPS.map((shop): SceneTarget => ({
      label: shop.label,
      key: 'ShopInteriorScene',
      data: () => ({ id: shop.id, village: externalEntry('Vilarejo'), outsideCell: { col: 14, row: 14 } }),
    })),
    { label: 'Pedreira', key: 'QuarryScene', data: () => externalEntry('Pedreira') },
    { label: 'Floresta', key: 'ForestScene', data: () => externalEntry('Floresta') },
    { label: 'Floresta Oculta', key: 'HiddenForestScene', data: () => ({ areaName: 'Floresta Oculta', returnSceneKey: 'ForestScene', returnSpawn: { col: 3, row: 4 }, returnData: externalEntry('Floresta') }) },
    { label: 'Praia', key: 'BeachScene', data: () => externalEntry('Praia') },
    { label: 'Caverna (entrada)', key: 'CaveScene', data: () => externalEntry('Cavernas') },
    { label: `Caverna (andar ${floor})`, key: 'CaveFloorScene', data: () => ({ floor, from: 'above', surface: externalEntry('Cavernas') }) },
  ];
}

export function installHackMenu(game: Phaser.Game): void {
  if (!HACK_MENU_ENABLED || typeof document === 'undefined') return;

  // ---------- estado local ----------
  let tourTimer: number | null = null;
  let tourIndex = 0;
  let errorCount = 0;
  let floorChoice = 10;
  let milestoneChoice = 0;
  const log: string[] = [];

  window.addEventListener('error', () => (errorCount += 1));
  window.addEventListener('unhandledrejection', () => (errorCount += 1));

  // ---------- helpers de jogo ----------
  const say = (message: string): void => {
    log.unshift(`${new Date().toLocaleTimeString()}  ${message}`);
    log.length = Math.min(log.length, 8);
    renderLog();
  };
  const inventory = (): typeof gameState.inventory => gameState.inventory;
  /** Há uma cena de jogo rodando OU começando (carregando/criando) — a Fazenda leva uns segundos no `preload` e não pode ser recriada no meio. */
  const gameRunning = (): boolean =>
    game.scene.getScenes(false).some((scene) => {
      const status = scene.sys.settings.status;
      return !PERSISTENT_SCENES.includes(scene.scene.key) && status >= Phaser.Scenes.START && status <= Phaser.Scenes.RUNNING;
    });

  /** Sem partida em andamento (menu principal), cria uma de teste na Fazenda: as cenas dependem das texturas que a Fazenda carrega. Devolve `true` se criou. */
  function ensureGame(): boolean {
    if (gameRunning()) return false;
    startNewGame(0);
    gameState.tutorialCompleted = true;
    game.scene.getScenes(true).forEach((scene) => game.scene.stop(scene.scene.key));
    game.scene.stop('MainMenuScene'); // (Pode ainda estar carregando, fora da lista de ativas.)
    game.scene.start('MainScene');
    game.scene.getScene('MainScene').events.once(Phaser.Scenes.Events.CREATE, () => say('Fazenda pronta.'));
    say('Partida de teste criada (slot 1).');
    return true;
  }

  function closeMenus(): void {
    closeInventoryScreen();
    closeFurnaceMenu();
    closeDialogue();
    closeChestMenu();
    closePauseMenu();
  }

  function goTo(target: SceneTarget): void {
    if (ensureGame()) {
      // A Fazenda acabou de começar: espera ela terminar (texturas carregadas) antes de trocar de cena.
      if (target.key !== 'MainScene') game.scene.getScene('MainScene').events.once(Phaser.Scenes.Events.CREATE, () => goTo(target));
      return;
    }
    closeMenus();
    for (const scene of game.scene.getScenes(true)) {
      if (!PERSISTENT_SCENES.includes(scene.scene.key)) game.scene.stop(scene.scene.key);
    }
    game.scene.start(target.key, target.data());
    say(`Cena: ${target.label}`);
  }

  function skipHours(hours: number): void {
    const previous = debugFlags.timeScale;
    debugFlags.timeScale = 1; // O salto não sofre a aceleração do relógio.
    const onFarm = game.scene.isActive('MainScene');
    advanceWorldTime((hours / 24) * DAY_LENGTH_MS, onFarm);
    debugFlags.timeScale = previous;
    say(`+${hours} h → dia ${gameState.gameClock.getDay()}, ${formatHours(gameState.gameClock.getHours())}`);
  }

  function goToHour(target: number): void {
    const now = gameState.gameClock.getHours();
    skipHours(((target - now + 24) % 24) || 24);
  }

  function skipDays(days: number): void {
    for (let i = 0; i < days; i += 1) startNextDay();
    say(`+${days} dia(s) → dia ${gameState.gameClock.getDay()} (${formatHours(gameState.gameClock.getHours())})`);
  }

  function giveResources(): void {
    // Sem os peixes: são muitos e lotariam a Bolsa (têm botão próprio).
    for (const id of Object.keys(RESOURCES)) if (!FISH_BY_ID[id]) inventory().addResources(id, 99);
    say('Recursos +99 (todos, menos peixes).');
  }
  function giveFish(): void {
    for (const fish of FISH.filter((candidate) => candidate.rarity !== 'golden').slice(0, 5)) inventory().addResources(fish.id, 5);
    say('Peixes +5 (5 espécies).');
  }
  function giveSeeds(): void {
    for (const id of Object.keys(CROPS)) inventory().addSeeds(id, 50);
    say('Sementes +50 (todas).');
  }
  function giveTools(): void {
    for (const id of Object.keys(TOOLS)) {
      // Machado e Picareta: sobe a progressão até o Ouro (o de cada tier substitui o anterior).
      if (Object.values(TOOL_PROGRESSION).some((list) => list.includes(id as never))) continue;
      inventory().unlockTool(id);
    }
    for (const family of Object.values(TOOL_PROGRESSION)) for (const id of family.slice(1)) inventory().upgradeTool(id);
    for (const id of Object.keys(WEAPONS)) inventory().unlockTool(id);
    for (const id of Object.keys(ARMORS)) inventory().unlockArmor(id);
    say('Ferramentas (Machado/Picareta de Ouro), armas e armaduras dadas.');
  }
  function giveDecorations(): void {
    for (const id of Object.keys(DECORATIONS)) inventory().addDecorations(id, 5);
    say('Decorações, móveis e construções +5 (posicione com B).');
  }
  function maxUpgrades(reset: boolean): void {
    for (const track of UPGRADE_TRACK_IDS) gameState.upgrades[track] = reset ? 0 : maxUpgradeLevel(track);
    applyUpgrades();
    say(reset ? 'Melhorias zeradas (reabra a Fazenda/casa).' : 'Melhorias no máximo (reabra a Fazenda/casa).');
  }
  function unlockWorld(): void {
    for (const chunk of farmMap.expansions) gameState.unlockedExpansions.add(chunk.direction);
    for (const bridge of farmMap.bridges) gameState.unlockedBridges.add(`${bridge.col},${bridge.row}`);
    say('Expansões e pontes liberadas (reabra a Fazenda).');
  }

  // ---------- história ----------
  /** Marca todos os marcos até o escolhido (inclusive) — o estado de quem jogou a história até ali. */
  function reachStoryUpTo(index: number): void {
    for (const milestone of STORY_MILESTONES.slice(0, index + 1)) reachMilestone(milestone.id);
    say(`História: até "${STORY_MILESTONES[index].title}".`);
  }
  /** Desfaz o marco escolhido e todos os seguintes. */
  function clearStoryFrom(index: number): void {
    for (const milestone of STORY_MILESTONES.slice(index)) clearMilestone(milestone.id);
    say(`História: desfeita a partir de "${STORY_MILESTONES[index].title}".`);
  }
  /** Os itens que a história pede (pra testar cada etapa sem jogar a anterior): o mapa, Azurita, os peixes do Mago, a semente e os pilares, e a Picareta encantada. */
  function giveStoryItems(): void {
    for (const [id, amount] of [['mysterious-map', 1], ['azurite-bar', 10], ['fish-clownfish', 1], ['fish-tiger-trout', 1], ['fish-sturgeon', 1], ['golden-carrot-seed', 1], ['golden-carrot', 1], ['fish-golden', 1]] as const) inventory().addResources(id, amount);
    if (!gameState.enchants.includes('pickaxe')) gameState.enchants.push('pickaxe');
    say('Itens da história dados (+ Picareta encantada).');
  }

  /** Horda comum hoje às 19:00 (pra testar o chamado de volta à Fazenda sem esperar o dia 10). */
  function hordeTonight(): void {
    debugFlags.forcedHordeDay = gameState.gameClock.getDay();
    say(`Horda forçada hoje (dia ${debugFlags.forcedHordeDay}), às 19:00. Use "ir p/ 18:00" e espere.`);
  }

  // ---------- tour automático ----------
  function stopTour(): void {
    if (tourTimer !== null) window.clearInterval(tourTimer);
    tourTimer = null;
    say(`Tour parado (${errorCount} erro(s) de execução).`);
    renderStatus();
  }
  function startTour(): void {
    ensureGame();
    const targets = sceneTargets(floorChoice);
    tourIndex = 0;
    errorCount = 0;
    const step = (): void => {
      if (tourIndex >= targets.length) {
        say(`Tour terminado: ${targets.length} cenas, ${errorCount} erro(s).`);
        if (tourTimer !== null) window.clearInterval(tourTimer);
        tourTimer = null;
        renderStatus();
        return;
      }
      goTo(targets[tourIndex]);
      tourIndex += 1;
    };
    step();
    tourTimer = window.setInterval(step, TOUR_INTERVAL_S * 1000);
    say(`Tour: ${targets.length} cenas, ${TOUR_INTERVAL_S}s cada.`);
    renderStatus();
  }

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.id = 'hack-menu'; // (os testes de ponta a ponta o acham por aqui, `tests/e2e`)
  root.style.cssText = 'position:fixed;top:8px;right:8px;width:310px;max-height:94vh;overflow:auto;background:rgba(18,18,22,.94);color:#e8e8e8;font:12px/1.35 monospace;border:1px solid #6f5a3a;border-radius:6px;padding:8px;z-index:99999;display:none;';
  document.body.appendChild(root);

  const status = document.createElement('div');
  status.style.cssText = 'margin-bottom:6px;color:#ffd98a;white-space:pre-line;';
  const logBox = document.createElement('div');
  logBox.id = 'hack-menu-log';
  logBox.style.cssText = 'margin-top:6px;color:#9fd8ff;white-space:pre-line;font-size:11px;';

  function formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function renderStatus(): void {
    const scenes = game.scene.getScenes(true).map((scene) => scene.scene.key).filter((key) => !PERSISTENT_SCENES.includes(key));
    status.textContent = `Dia ${gameState.gameClock.getDay()}  ${formatHours(gameState.gameClock.getHours())}  x${debugFlags.timeScale}\nMoedas: ${gameState.inventory.getCoins()}   Cena: ${scenes.join(', ') || '(menu)'}\nInvencível: ${debugFlags.godMode ? 'sim' : 'não'}   Lojas abertas: ${debugFlags.shopsAlwaysOpen ? 'sempre' : 'no horário'}
Tour: ${tourTimer !== null ? 'rodando' : 'parado'}   Erros: ${errorCount}
História: ${STORY_MILESTONES.filter((milestone) => hasMilestone(milestone.id)).length}/${STORY_MILESTONES.length} marcos, pilares ${countPillars()}/3`;
  }
  function renderLog(): void {
    logBox.textContent = log.join('\n');
  }

  function section(title: string): HTMLDivElement {
    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.cssText = 'margin:8px 0 3px;color:#b8f5a0;font-weight:bold;border-bottom:1px solid #444;';
    root.appendChild(heading);
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    root.appendChild(box);
    return box;
  }
  function button(box: HTMLElement, label: string, onClick: () => void): void {
    const element = document.createElement('button');
    element.textContent = label;
    element.style.cssText = 'font:11px monospace;padding:3px 6px;background:#2c2c2c;color:#eee;border:1px solid #6f5a3a;border-radius:3px;cursor:pointer;';
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      try {
        onClick();
      } catch (error) {
        errorCount += 1;
        say(`ERRO: ${(error as Error).message}`);
      }
      renderStatus();
      element.blur();
    });
    root.addEventListener('keydown', (event) => event.stopPropagation()); // Digitar nos campos não aciona teclas do jogo.
    box.appendChild(element);
  }
  function numberField(box: HTMLElement, initial: number, onChange: (value: number) => void): void {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(initial);
    input.style.cssText = 'width:64px;font:11px monospace;background:#111;color:#eee;border:1px solid #6f5a3a;';
    input.addEventListener('input', () => onChange(Number(input.value)));
    input.addEventListener('keydown', (event) => event.stopPropagation());
    box.appendChild(input);
  }

  const title = document.createElement('div');
  title.textContent = `MENU DE HACK (${TOGGLE_KEY} fecha)`;
  title.style.cssText = 'font-weight:bold;color:#ff9a8a;margin-bottom:4px;';
  root.appendChild(title);
  root.appendChild(status);

  const money = section('Dinheiro');
  button(money, '+1.000', () => inventory().addCoins(1000));
  button(money, '+10.000', () => inventory().addCoins(10000));
  button(money, '+100.000', () => inventory().addCoins(100000));

  const items = section('Itens (a Bolsa tem 24 slots)');
  button(items, 'Recursos x99', giveResources);
  button(items, 'Sementes x50', giveSeeds);
  button(items, 'Peixes x5', giveFish);
  button(items, 'Ferramentas/armas/armaduras', giveTools);
  button(items, 'Decorações e construções x5', giveDecorations);
  button(items, 'Melhorias: máximo', () => maxUpgrades(false));
  button(items, 'Melhorias: zerar', () => maxUpgrades(true));
  button(items, 'Liberar pontes e expansões', unlockWorld);

  const time = section('Tempo');
  for (const hours of [1, 3, 6]) button(time, `+${hours} h`, () => skipHours(hours));
  for (const hour of [6, 12, 18, 23]) button(time, `ir p/ ${String(hour).padStart(2, '0')}:00`, () => goToHour(hour));
  for (const days of [1, 3, 10]) button(time, `+${days} dia${days > 1 ? 's' : ''}`, () => skipDays(days));
  for (const scale of [1, 5, 20, 60]) button(time, `velocidade x${scale}`, () => (debugFlags.timeScale = scale));

  const player = section('Jogador');
  button(player, 'Curar tudo', () => gameState.playerHealth.restoreFull());
  button(player, 'Invencível: alternar', () => (debugFlags.godMode = !debugFlags.godMode));
  button(player, 'Lojas sempre abertas: alternar', () => {
    debugFlags.shopsAlwaysOpen = !debugFlags.shopsAlwaysOpen;
    say(`Lojas sempre abertas: ${debugFlags.shopsAlwaysOpen ? 'sim' : 'não'}`);
  });
  button(player, 'Salvar (slot ativo)', () => {
    saveGame();
    say('Jogo salvo.');
  });

  const scenes = section('Cenas');
  for (const target of sceneTargets().filter((entry) => entry.key !== 'CaveFloorScene')) button(scenes, target.label, () => goTo(target));
  const floorRow = section('Caverna: andar');
  numberField(floorRow, floorChoice, (value) => (floorChoice = Math.max(1, Math.min(CAVE_MAX_FLOOR, Math.floor(value) || 1))));
  button(floorRow, 'Ir', () => goTo(sceneTargets(floorChoice).find((entry) => entry.key === 'CaveFloorScene')!));

  const story = section('História (Três Pilares)');
  const milestoneSelect = document.createElement('select');
  milestoneSelect.style.cssText = 'font:11px monospace;background:#111;color:#eee;border:1px solid #6f5a3a;max-width:290px;';
  STORY_MILESTONES.forEach((milestone, index) => milestoneSelect.add(new Option(`${index + 1}. ${milestone.title}`, String(index))));
  milestoneSelect.addEventListener('change', () => (milestoneChoice = Number(milestoneSelect.value)));
  milestoneSelect.addEventListener('keydown', (event) => event.stopPropagation());
  story.appendChild(milestoneSelect);
  button(story, 'Alcançar até aqui', () => reachStoryUpTo(milestoneChoice));
  button(story, 'Desfazer daqui em diante', () => clearStoryFrom(milestoneChoice));
  button(story, 'Zerar história', () => clearStoryFrom(0));
  button(story, 'Horda hoje às 19:00', hordeTonight);
  button(story, 'Cena introdutória', () => goTo({ label: 'Cena introdutória', key: 'IntroScene', data: () => ({}) }));
  button(story, 'Itens da história', giveStoryItems);
  button(story, 'Cinemática final', () => goTo({ label: 'Cinemática final', key: 'FinalCinematicScene', data: () => ({}) }));
  button(story, 'Tela final (prévia)', () => goTo({ label: 'Tela final', key: 'EndingScene', data: () => ({}) }));

  const tour = section('Tour automático');
  button(tour, `Iniciar (${TOUR_INTERVAL_S}s por cena)`, startTour);
  button(tour, 'Parar', stopTour);

  root.appendChild(logBox);

  // ---------- abrir/fechar ----------
  window.addEventListener('keydown', (event) => {
    if (event.key !== TOGGLE_KEY) return;
    event.preventDefault();
    root.style.display = root.style.display === 'none' ? 'block' : 'none';
    renderStatus();
  });
  window.setInterval(() => {
    if (root.style.display !== 'none') renderStatus();
  }, 500);
}
