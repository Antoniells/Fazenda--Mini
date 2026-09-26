import { isCharacterId } from '../data/player';
import { isPetId } from '../data/pets';
import { gameState, PlacedDecorationRecord, PlayerProfile, SlimeRespawnRecord, WeatherState, DEFAULT_PROFILE } from './gameState';
import { Inventory, InventorySaveData } from './inventory';
import { GameClock, GameClockSaveData } from './gameClock';
import { PlayerHealth, PlayerHealthSaveData } from './playerHealth';
import { Farmland, PlotSaveData } from './farmland';
import { farmMap } from '../data/maps/farmMap';
import { StorageAdapter, createDefaultStorageAdapter } from './storageAdapter';
import type { ChestSlot } from './chestStorage';
import { HordeState, createHordeState, hordeNumberForDay } from '../data/horde';
import { CampaignState, createCampaignState } from '../data/campaign';
import { RequestsState, createRequestsState } from '../data/requests';
import { MailState, createMailState } from '../data/mail';
import { EventsState, createEventsState } from '../data/events';
import { SkillsState, createSkillsState } from '../data/skills';
import { AnimalsState, createAnimalsState } from '../data/animals';
import { ConstructionState, createConstructionState } from '../data/construction';
import { REMOVED_DECORATIONS } from '../data/decorations';
import { resourceNodeRegistry, ResourceNode } from './resourceNodeRegistry';

/** Fase 10 — Estrutura Base e Persistência: 3 slots fixos, pedido explícito ("3 Slots de Save"). */
export const SAVE_SLOT_COUNT = 3;

const CURRENT_VERSION = 1;
const SAVE_KEY_PREFIX = 'mini-fazenda-save-';

function saveKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

/**
 * Arquivo de save completo de um slot — um campo por pedaço do `gameState`
 * que precisa sobreviver a fechar a aba (moedas/inventário, plantações,
 * construções, pontes liberadas, vida, dia/hora, nome do personagem e da
 * fazenda). A posição do jogador fica de fora de propósito: ele sempre nasce
 * em `PLAYER_START` ao carregar, igual a uma partida nova.
 */
export interface SaveData {
  version: number;
  /** ISO 8601 — só para exibir "salvo em..." nos slots do Menu Principal, nunca usado pra lógica de jogo. */
  savedAt: string;
  /** Opcionais só por compatibilidade: saves criados antes da Criação de Personagem não têm esses campos e caem em `DEFAULT_PROFILE` ao carregar. */
  playerName?: string;
  farmName?: string;
  /** Opcional: saves anteriores à seleção de personagem não têm — carregam com o padrão (Alex). */
  characterId?: string;
  /** Opcional: saves anteriores ao pet companheiro não têm — carregam com o pet padrão. */
  petId?: string;
  /** Opcional: saves anteriores aos recursos persistentes não têm — carregam com árvores/pedras nos lugares originais do mapa. Estado de árvores/pedras (cortadas, brotos, crescimento) por cena. */
  resourceNodes?: Record<string, ResourceNode[]>;
  /** Opcional: saves anteriores ao respawn diário dos Slimes não têm — carregam com todos vivos. */
  slimeRespawn?: SlimeRespawnRecord;
  /** Opcional: saves anteriores à chuva não têm — carregam com tempo firme. */
  weather?: WeatherState;
  inventory: InventorySaveData;
  gameClock: GameClockSaveData;
  playerHealth: PlayerHealthSaveData;
  unlockedBridges: string[];
  /** Trechos de expansão comprados — ausente em saves anteriores (que sempre recomeçavam trancados). */
  unlockedExpansions?: string[];
  farmland: PlotSaveData[];
  placedDecorations: PlacedDecorationRecord[];
  /** Opcionais: saves anteriores aos móveis/baús não têm — carregam com a casa vazia. */
  placedFurniture?: PlacedDecorationRecord[];
  chests?: Record<string, ChestSlot[]>;
  /** Opcionais: saves anteriores ao evento do pet/hordas não têm. `petUnlocked` ausente = save antigo, que já tinha pet desde a criação → carrega liberado. */
  sleepCount?: number;
  petBoxPlaced?: boolean;
  petUnlocked?: boolean;
  /** A caminha do bichinho já foi entregue — ausente em saves antigos (ganham na próxima abertura da Fazenda, se já têm o pet). */
  petBedGiven?: boolean;
  horde?: HordeState;
  /** Campanha (missões, hordas vencidas, Noite Final) — ausente em saves anteriores a ela: começa do zero, contando as hordas que o save antigo já tinha vencido. */
  campaign?: CampaignState;
  /** Pedidos diários dos moradores — ausente em saves anteriores a eles (nenhum cumprido). */
  requests?: RequestsState;
  /** Caixa de Correio (cartas lidas + agendadas por código) — ausente em saves anteriores a ela (nenhuma lida; as fixas chegam nos dias delas). */
  mail?: MailState;
  /** Eventos do mundo já realizados — ausente em saves anteriores a eles (nenhum). */
  events?: EventsState;
  /** Progressão (XP e habilidades compradas) — ausente em saves anteriores a ela: começa do zero. */
  skills?: SkillsState;
  /** Galinhas e ovos por galinheiro — ausente em saves anteriores aos animais (nenhum). */
  animals?: AnimalsState;
  /** Encomendas ao Marceneiro — ausente em saves anteriores a elas (nenhuma). */
  construction?: ConstructionState;
  /** Andar mais fundo alcançado na Caverna — ausente em saves antigos (0). */
  caveDeepest?: number;
  /** Cercas destruídas aguardando conserto — ausente em saves antigos (nenhuma). */
  destroyedFences?: string[];
  /** O tutorial de novos jogadores já foi concluído? Ausente em saves antigos (que já jogavam) = concluído. */
  tutorialCompleted?: boolean;
  /** A dica do regador vazio já foi mostrada? Ausente em saves antigos = já (não recebem a dica). */
  waterHintSeen?: boolean;
}

/** O que o Menu Principal precisa pra desenhar um slot — sem ler/parsear o `SaveData` inteiro fora deste módulo. */
export interface SaveSlotSummary {
  slot: number;
  empty: boolean;
  day?: number;
  coins?: number;
  savedAt?: string;
  playerName?: string;
  farmName?: string;
}

/**
 * Fonte de armazenamento atual — escolhida pelo ambiente
 * (`createDefaultStorageAdapter`): arquivos em `Documentos/Mini Fazenda` no
 * executável (Electron), `localStorage` no navegador. Trocável via
 * `setStorageAdapter` sem mudar nenhuma linha abaixo.
 */
let storage: StorageAdapter = createDefaultStorageAdapter();

export function setStorageAdapter(adapter: StorageAdapter): void {
  storage = adapter;
}

/** Mesmo armazenamento dos saves, pra outros módulos (ex.: `systems/audioSettings.ts`) gravarem no MESMO lugar — quando o adaptador de `fs` do executável entrar, tudo muda junto. */
export function getStorageAdapter(): StorageAdapter {
  return storage;
}

/**
 * Slot em uso na sessão atual — definido por `startNewGame`/`load`, lido
 * por `save()` quando chamado sem argumento (auto-save ao dormir/sair pro
 * menu, ver `MainScene.sleep`/`ui/pauseMenu.ts`). `null` significa "a cena
 * de jogo foi aberta sem passar pelo Menu Principal" (ex.: fluxo de
 * desenvolvimento com `MainScene` reordenada pra primeira da lista em
 * `gameConfig.ts`) — `save()` avisa e não faz nada nesse caso, em vez de
 * adivinhar um slot.
 */
let activeSlot: number | null = null;

export function getActiveSlot(): number | null {
  return activeSlot;
}

/** Lê e resume um slot sem afetar `gameState`/`activeSlot` — usado pelo Menu Principal pra desenhar os 3 slots. Save corrompido/de versão desconhecida conta como vazio, nunca quebra o menu. */
export function getSlotSummary(slot: number): SaveSlotSummary {
  const raw = storage.read(saveKey(slot));
  if (!raw) return { slot, empty: true };

  try {
    const data = JSON.parse(raw) as SaveData;
    return {
      slot,
      empty: false,
      day: data.gameClock.day,
      coins: data.inventory.coins,
      savedAt: data.savedAt,
      playerName: data.playerName ?? DEFAULT_PROFILE.playerName,
      farmName: data.farmName ?? DEFAULT_PROFILE.farmName,
    };
  } catch (error) {
    console.error(`SaveManager: save do slot ${slot} corrompido — tratado como vazio.`, error);
    return { slot, empty: true };
  }
}

export function getAllSlotSummaries(): SaveSlotSummary[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, slot) => getSlotSummary(slot));
}

/**
 * Extrai o `gameState` atual pra `SaveData` e grava no slot informado (ou
 * no `activeSlot` da sessão, se nenhum for passado — é assim que
 * `MainScene.sleep`/o botão "Sair" do `PauseMenu` chamam, sem precisar
 * saber em qual slot o jogador está). Vira o `activeSlot` da sessão, pra
 * qualquer save seguinte (sem argumento) continuar caindo no mesmo lugar.
 */
export function save(slot?: number): void {
  const targetSlot = slot ?? activeSlot;
  if (targetSlot === null || targetSlot === undefined) {
    console.warn('SaveManager: save() chamado sem slot ativo (a cena de jogo não passou pelo Menu Principal) — ignorado.');
    return;
  }
  activeSlot = targetSlot;

  const data: SaveData = {
    version: CURRENT_VERSION,
    savedAt: new Date().toISOString(),
    playerName: gameState.profile.playerName,
    farmName: gameState.profile.farmName,
    characterId: gameState.profile.characterId,
    petId: gameState.profile.petId,
    slimeRespawn: { ...gameState.slimeRespawn },
    weather: { ...gameState.weather },
    resourceNodes: resourceNodeRegistry.serialize(),
    inventory: gameState.inventory.serialize(),
    gameClock: gameState.gameClock.serialize(),
    playerHealth: gameState.playerHealth.serialize(),
    unlockedBridges: Array.from(gameState.unlockedBridges),
    unlockedExpansions: Array.from(gameState.unlockedExpansions),
    farmland: gameState.farmland.serialize(),
    placedDecorations: Array.from(gameState.placedDecorations.values()),
    placedFurniture: Array.from(gameState.placedFurniture.values()),
    chests: JSON.parse(JSON.stringify(gameState.chests)) as Record<string, ChestSlot[]>,
    sleepCount: gameState.sleepCount,
    petBoxPlaced: gameState.petBoxPlaced,
    petUnlocked: gameState.petUnlocked,
    petBedGiven: gameState.petBedGiven,
    horde: { ...gameState.horde, drops: { ...gameState.horde.drops } },
    campaign: { ...gameState.campaign },
    requests: { completed: { ...gameState.requests.completed }, availableFromDay: { ...gameState.requests.availableFromDay } },
    mail: { readIds: [...gameState.mail.readIds], custom: gameState.mail.custom.map((message) => ({ ...message })) },
    events: { completed: [...gameState.events.completed] },
    animals: { coops: JSON.parse(JSON.stringify(gameState.animals.coops)) as AnimalsState['coops'] },
    skills: { xp: gameState.skills.xp, totalXp: gameState.skills.totalXp, ranks: { ...gameState.skills.ranks } },
    construction: { orders: gameState.construction.orders.map((order) => ({ ...order })), nextId: gameState.construction.nextId },
    caveDeepest: gameState.cave.deepest,
    destroyedFences: [...gameState.destroyedFences],
    tutorialCompleted: gameState.tutorialCompleted,
    waterHintSeen: gameState.waterHintSeen,
  };
  storage.write(saveKey(targetSlot), JSON.stringify(data));
}

/**
 * Carrega um slot e SUBSTITUI cada peça do `gameState` pela reconstruída a
 * partir do save — sempre chamado pelo Menu Principal, ANTES de
 * `scene.start('MainScene')`, então nenhuma cena ainda segura uma
 * referência antiga (`MainScene.create()` só faz `this.inventory =
 * gameState.inventory` DEPOIS que isto já rodou). Devolve `false` (e não
 * mexe em nada) se o slot estiver vazio ou corrompido.
 */
export function load(slot: number): boolean {
  const raw = storage.read(saveKey(slot));
  if (!raw) return false;

  try {
    const data = JSON.parse(raw) as SaveData;

    // ATÔMICO: primeiro reconstrói TUDO em variáveis locais (qualquer campo corrompido lança AQUI, antes de tocar em qualquer coisa) e só
    // depois troca o `gameState` de uma vez. Antes cada peça era trocada na hora: um erro no meio (ex.: a lavoura corrompida) deixava o
    // jogo meio carregado — inventário do save novo com relógio/fazenda do save antigo — e o "devolve false sem mexer em nada" era mentira.
    const profile: PlayerProfile = {
      playerName: data.playerName ?? DEFAULT_PROFILE.playerName,
      farmName: data.farmName ?? DEFAULT_PROFILE.farmName,
      characterId: isCharacterId(data.characterId) ? data.characterId : DEFAULT_PROFILE.characterId,
      petId: isPetId(data.petId) ? data.petId : DEFAULT_PROFILE.petId,
    };
    const slimeRespawn = data.slimeRespawn ? { ...data.slimeRespawn } : { day: data.gameClock.day, killed: 0 };
    const weather = { raining: data.weather?.raining === true };
    const inventory = Inventory.deserialize(data.inventory);
    const gameClock = GameClock.deserialize(data.gameClock);
    const playerHealth = PlayerHealth.deserialize(data.playerHealth);
    const unlockedBridges = new Set(data.unlockedBridges);
    // A ponte da Floresta mudou de lugar (parede leste 39,20 → oeste 0,20): quem já a tinha pago continua com ela destravada.
    if (unlockedBridges.delete('39,20')) unlockedBridges.add('0,20');
    // A Fazenda cresceu (40x30 → 56x42): a ponte da Praia (parede sul) mudou de linha. A do Vilarejo (leste) é livre e não precisa de registro.
    if (unlockedBridges.delete('30,29')) unlockedBridges.add('30,41');
    unlockedBridges.delete('39,15');
    const farmland = Farmland.deserialize(data.farmland, weather.raining);
    // Decorações que saíram do jogo (a Bancada de Trabalho): somem do mundo, da fila do Marceneiro e da Bolsa, e o valor volta em moedas.
    let removedRefund = 0;
    for (const [id, price] of Object.entries(REMOVED_DECORATIONS)) {
      while (inventory.getDecorationCount(id) > 0 && inventory.useDecoration(id)) removedRefund += price;
    }
    const placedDecorations = new Map(
      data.placedDecorations
        .filter((entry) => {
          const price = REMOVED_DECORATIONS[entry.decorationId];
          if (price !== undefined) removedRefund += price;
          return price === undefined;
        })
        .map((entry) => [`${entry.col},${entry.row}`, entry] as const),
    );
    const placedFurniture = new Map((data.placedFurniture ?? []).map((entry) => [`${entry.col},${entry.row}`, entry] as const));
    const chests = data.chests ? JSON.parse(JSON.stringify(data.chests)) : {};
    const horde = data.horde ? { ...createHordeState(), ...data.horde, drops: { ...(data.horde.drops ?? {}) } } : createHordeState();
    // Save de antes da campanha: recomeça as missões, mas as hordas que ele já tinha passado (a última já terminada) contam como vencidas.
    const legacyHordesWon = horde.lastHordeDay > 0 ? hordeNumberForDay(horde.lastHordeDay) - (horde.active ? 1 : 0) : 0;
    const requests: RequestsState = { completed: { ...(data.requests?.completed ?? {}) }, availableFromDay: { ...(data.requests?.availableFromDay ?? {}) } };
    const campaign: CampaignState = { ...createCampaignState(), hordesWon: Math.max(0, legacyHordesWon), ...(data.campaign ?? {}) };
    const mail: MailState = { readIds: [...(data.mail?.readIds ?? [])], custom: (data.mail?.custom ?? []).map((message) => ({ ...message })) };
    const events: EventsState = { completed: [...(data.events?.completed ?? [])] };
    const animals: AnimalsState = { coops: data.animals?.coops ? (JSON.parse(JSON.stringify(data.animals.coops)) as AnimalsState['coops']) : {} };
    const construction: ConstructionState = {
      orders: (data.construction?.orders ?? [])
        .filter((order) => {
          if (REMOVED_DECORATIONS[order.decorationId] === undefined) return true;
          removedRefund += order.paid;
          return false;
        })
        .map((order) => ({ ...order })),
      nextId: data.construction?.nextId ?? 1,
    };
    if (removedRefund > 0) inventory.addCoins(removedRefund);
    const skills: SkillsState = { xp: data.skills?.xp ?? 0, totalXp: data.skills?.totalXp ?? 0, ranks: { ...(data.skills?.ranks ?? {}) } };

    // Tudo reconstruído sem erro: aplica.
    gameState.profile = profile;
    gameState.slimeRespawn = slimeRespawn;
    gameState.weather = weather;
    resourceNodeRegistry.resetToInitial();
    if (data.resourceNodes) resourceNodeRegistry.restore(data.resourceNodes);
    gameState.inventory = inventory;
    gameState.gameClock = gameClock;
    gameState.playerHealth = playerHealth;
    gameState.unlockedBridges = unlockedBridges;
    gameState.unlockedExpansions = new Set(data.unlockedExpansions ?? []);
    gameState.farmland = farmland;
    gameState.placedDecorations = placedDecorations;
    gameState.placedFurniture = placedFurniture;
    gameState.chests = chests;
    gameState.sleepCount = data.sleepCount ?? 0;
    gameState.petBoxPlaced = data.petBoxPlaced === true;
    gameState.petUnlocked = data.petUnlocked ?? true;
    gameState.petBedGiven = data.petBedGiven === true;
    gameState.horde = horde;
    gameState.campaign = campaign;
    gameState.requests = requests;
    gameState.mail = mail;
    gameState.events = events;
    gameState.skills = skills;
    gameState.animals = animals;
    gameState.construction = construction;
    gameState.cave = { deepest: data.caveDeepest ?? 0 };
    gameState.destroyedFences = new Set(data.destroyedFences ?? []);
    gameState.tutorialCompleted = data.tutorialCompleted ?? true;
    gameState.waterHintSeen = data.waterHintSeen ?? true;
    gameState.waterObjective = false;
    gameState.tutorialStep = 0;
    gameState.tutorialProgress = 0;
    gameState.sprinklerAnimDay = 0;
    gameState.roosterSoundDay = 0;
    activeSlot = slot;
    return true;
  } catch (error) {
    console.error(`SaveManager: falha ao carregar o slot ${slot}.`, error);
    return false;
  }
}

/**
 * Zera o `gameState` pros padrões de "partida nova" (mesmos valores que já
 * existiam antes deste módulo, ver `systems/gameState.ts`) e marca o slot
 * como ativo — chamado pela Criação de Personagem ao confirmar os nomes (ou
 * pelo menu como rede de segurança, sem perfil, se um save estiver corrompido:
 * aí cai em `DEFAULT_PROFILE`).
 */
export function startNewGame(slot: number, profile: PlayerProfile = DEFAULT_PROFILE): void {
  gameState.profile = { ...profile };
  gameState.slimeRespawn = { day: 1, killed: 0 };
  gameState.weather = { raining: false };
  resourceNodeRegistry.resetToInitial();
  gameState.inventory = new Inventory();
  gameState.gameClock = new GameClock();
  gameState.playerHealth = new PlayerHealth();
  gameState.unlockedBridges = new Set();
  gameState.unlockedExpansions = new Set();
  gameState.farmland = new Farmland(farmMap.farmlandArea);
  gameState.placedDecorations = new Map();
  gameState.placedFurniture = new Map();
  gameState.chests = {};
  gameState.sleepCount = 0;
  gameState.petBoxPlaced = false;
  gameState.petUnlocked = false;
  gameState.petBedGiven = false;
  gameState.horde = createHordeState();
  gameState.campaign = createCampaignState();
  gameState.requests = createRequestsState();
  gameState.mail = createMailState();
  gameState.events = createEventsState();
  gameState.skills = createSkillsState();
  gameState.animals = createAnimalsState();
  gameState.construction = createConstructionState();
  gameState.cave = { deepest: 0 };
  gameState.destroyedFences = new Set();
  gameState.sprinklerAnimDay = 0;
  gameState.roosterSoundDay = 0;
  gameState.tutorialCompleted = false; // Partida nova: o tutorial roda uma vez (`systems/tutorial.ts`).
  gameState.waterHintSeen = false; // ...e a dica do primeiro regador vazio também.
  gameState.waterObjective = false;
  gameState.tutorialStep = 0;
  gameState.tutorialProgress = 0;
  activeSlot = slot;
}

export function deleteSave(slot: number): void {
  storage.remove(saveKey(slot));
}
