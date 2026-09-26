import { Inventory } from './inventory';
import { GameClock } from './gameClock';
import { PlayerHealth } from './playerHealth';
import { Farmland } from './farmland';
import { farmMap } from '../data/maps/farmMap';
import { CharacterId, DEFAULT_CHARACTER_ID } from '../data/player';
import { PetId, DEFAULT_PET_ID } from '../data/pets';
import type { ChestSlot } from './chestStorage';
import { HordeState, createHordeState } from '../data/horde';
import { CampaignState, createCampaignState } from '../data/campaign';
import { RequestsState, createRequestsState } from '../data/requests';
import { MailState, createMailState } from '../data/mail';
import { EventsState, createEventsState } from '../data/events';
import { SkillsState, createSkillsState } from '../data/skills';
import { AnimalsState, createAnimalsState } from '../data/animals';
import { ConstructionState, createConstructionState } from '../data/construction';

/** Uma construção posicionada pelo jogador na Fazenda (Poço, Fornalha, etc.) — só o necessário pra reconstruir depois: a definição completa (`data/decorations.ts`) é buscada de novo pelo id na hora de restaurar, nunca duplicada aqui. */
export interface PlacedDecorationRecord {
  decorationId: string;
  col: number;
  row: number;
}

/** Fase 10 — Criação de Personagem: nome do personagem e da fazenda, digitados ao escolher um Slot Vazio (`scenes/CharacterCreationScene.ts`) e gravados no save. */
export interface PlayerProfile {
  playerName: string;
  farmName: string;
  /** Personagem escolhido na Criação de Personagem (Alex, Josh, Lyria, Manu ou Tori) — define TODO o sprite do jogador (`data/player.ts`). */
  characterId: CharacterId;
  /** Pet companheiro escolhido na Criação de Personagem (gato ou cachorro, `data/pets.ts`) — acompanha o jogador em todas as cenas. */
  petId: PetId;
}

export const PROFILE_NAME_MAX_LENGTH = 16;

/**
 * Renascimento dos Slimes da Floresta: só depois de passar um dia (pedido
 * explícito) — entrar e sair da cena não os traz de volta. `day` é o dia em
 * que `killed` (quantos morreram desde o último renascimento) vale; quando o
 * dia do relógio muda, `SlimeSpawner` zera a contagem e todos renascem.
 */
export interface SlimeRespawnRecord {
  day: number;
  killed: number;
}

/** Clima do dia atual (`systems/weather.ts`): só "chovendo ou não" — sorteado a cada virada de dia e salvo junto do resto. */
export interface WeatherState {
  raining: boolean;
}

/** Usado por saves anteriores à Criação de Personagem (sem nome gravado) e pelo fluxo de desenvolvimento em que `MainScene` abre sem passar pelo menu. */
export const DEFAULT_PROFILE: PlayerProfile = { playerName: 'Fazendeiro', farmName: 'Minha Fazenda', characterId: DEFAULT_CHARACTER_ID, petId: DEFAULT_PET_ID };

/**
 * Estado do jogo que precisa sobreviver a uma troca de cena de verdade
 * (Sistema de Cenas — pontes/UIScene): até agora, `Inventory` e `GameClock`
 * eram criados dentro de `MainScene.create()` — bom o bastante enquanto só
 * existia uma cena, mas quebraria a `UIScene` persistente pedida agora (o
 * Hotbar/Barra de Dinheiro mostrariam sempre o saldo inicial de novo toda
 * vez que `MainScene` fosse recriada ao voltar de uma ponte).
 *
 * Um único módulo, instanciado uma vez só (nunca recriado enquanto a aba
 * do navegador estiver aberta), em vez de cada `Scene` guardar o seu.
 * **Não é um sistema de save** — nada é gravado em disco/`localStorage`;
 * fechar/recarregar a página ainda reseta tudo. Isso é intencional (o
 * roadmap já tem "Salvamento" como etapa própria, ainda não pedida) — este
 * módulo só resolve "não resetar a cada troca de mapa dentro da mesma
 * sessão", que é o que a `UIScene` precisa pra fazer sentido.
 *
 * `farmland` e `placedDecorations` (bug corrigido — "Scene Persistence"):
 * mesmo raciocínio do `inventory`/`gameClock` acima, só que pro estado da
 * lavoura e das construções da Fazenda, que até então eram recriados do
 * zero (`new Farmland(...)`, `DecorationPlacementSystem.placed` vazio) toda
 * vez que `MainScene.create()` rodava de novo (ex.: ir até a Pedreira e
 * voltar pela ponte é um `scene.start()` de verdade — destrói e recria a
 * cena, ver `systems/bridgeSystem.ts`/`ExternalMapScene.returnToFarm`).
 * `Farmland` já era uma classe pura (sem nenhuma dependência do Phaser),
 * então basta um único módulo aqui — MainScene passa a só pegar a
 * REFERÊNCIA (`gameState.farmland`), nunca instanciar a própria. Já
 * `placedDecorations` não pode guardar os `Phaser.GameObjects.Image` em si
 * (pertencem à cena antiga, destruídos junto com ela) — só o registro
 * mínimo (id + célula) pra `DecorationPlacementSystem.restorePlacements()`
 * recriar os objetos visuais do zero na cena nova.
 */
export const gameState = {
  profile: { ...DEFAULT_PROFILE } as PlayerProfile,
  slimeRespawn: { day: 1, killed: 0 } as SlimeRespawnRecord,
  weather: { raining: false } as WeatherState,
  inventory: new Inventory(),
  gameClock: new GameClock(),
  unlockedBridges: new Set<string>(),
  /** Trechos de expansão da Fazenda já comprados (direção: 'north' | 'south' | 'east' | 'west') — a câmera só mostra a Fazenda e o que já foi liberado. Vai pro save. */
  unlockedExpansions: new Set<string>(),
  /** Fase 8 — Combate: vida do jogador, ver `systems/playerHealth.ts`. */
  playerHealth: new PlayerHealth(),
  farmland: new Farmland(farmMap.farmlandArea),
  /** Chave = célula-âncora (`"col,row"`), mesmo esquema de `DecorationPlacementSystem.placed`. */
  placedDecorations: new Map<string, PlacedDecorationRecord>(),
  /** Móveis posicionados DENTRO da casa (`HouseScene`, `systems/furniturePlacement.ts`) — mesmo esquema de `placedDecorations`, mas coordenadas do cômodo. */
  placedFurniture: new Map<string, PlacedDecorationRecord>(),
  /** Conteúdo dos baús da casa, por id de baú (a célula-âncora do móvel) — ver `systems/chestStorage.ts`. */
  chests: {} as Record<string, ChestSlot[]>,
  /** Quantas vezes o jogador dormiu na cama (`HouseScene`) — a 3ª libera o evento do pet (`systems/petEvent.ts`). */
  sleepCount: 0,
  /** A caixa do pet está em frente à casa esperando ser aberta. */
  petBoxPlaced: false,
  /** O pet foi desbloqueado (carta lida): só então ele existe nas cenas (`systems/petCompanion.ts`). */
  petUnlocked: false,
  /** A caminha do bichinho já foi entregue ao jogador (`systems/petEvent.ts` `grantPetBed`)? */
  petBedGiven: false,
  /** Hordas (a cada 10 dias): estado da noite de ataque — `systems/horde.ts`. */
  horde: createHordeState() as HordeState,
  /** Campanha: missão atual dos moradores do Vilarejo, hordas vencidas e a Noite Final — `systems/campaign.ts`. Vai pro save. */
  campaign: createCampaignState() as CampaignState,
  /** Pedidos diários dos moradores (missões secundárias) — `systems/requests.ts`. Vai pro save. */
  requests: createRequestsState() as RequestsState,
  /** Caixa de Correio: cartas já lidas e as agendadas por código — `systems/mail.ts`. Vai pro save. */
  mail: createMailState() as MailState,
  /** Eventos do mundo por dia (`systems/eventManager.ts`): quais eventos de uma vez só já aconteceram. Vai pro save. */
  events: createEventsState() as EventsState,
  /** Progressão: XP ganho/disponível e o nível comprado de cada habilidade — `systems/skills.ts`. Vai pro save. */
  skills: createSkillsState() as SkillsState,
  /** Animais: galinhas e ovos de cada galinheiro (`systems/animals.ts`). Vai pro save. */
  animals: createAnimalsState() as AnimalsState,
  /** Encomendas ao Marceneiro ainda não construídas (`systems/construction.ts`). Vai pro save. */
  construction: createConstructionState() as ConstructionState,
  /** Caverna: o andar mais fundo já alcançado (0 = nunca entrou) — libera um atalho a cada 5 andares (`data/caveFloors.ts`). Vai pro save. */
  cave: { deepest: 0 },
  /** Cercas da lavoura destruídas pela horda ("col,row"), à espera do Martelo (`systems/farmFences.ts`) — vai pro save. */
  destroyedFences: new Set<string>(),
  /**
   * Tutorial de novos jogadores (`systems/tutorial.ts`): `tutorialCompleted` vai pro Save Game — partida nova começa `false`, save
   * antigo (sem o campo) carrega `true`; o padrão `true` cobre o fluxo de desenvolvimento que abre a Fazenda sem passar pelo menu.
   * `tutorialStep`/`tutorialProgress` (passo atual e contagem dentro dele) só vivem na sessão — não vão pro save.
   */
  tutorialCompleted: true,
  /** A dica "o regador secou, vá à Vila" (`data/tutorial.ts` `WATER_EMPTY_HINT`) já foi mostrada? Vai pro save: partida nova começa `false`, save antigo carrega `true` (quem já jogava conhece o poço); o padrão `true` cobre o fluxo de desenvolvimento. */
  waterHintSeen: true,
  /** Depois da dica, enquanto o regador está vazio o objetivo "encher o regador no poço da Vila" aparece na lista (`data/tutorial.ts` `WATER_OBJECTIVE_TEXT`) — só na sessão, some ao encher. */
  waterObjective: false,
  tutorialStep: 0,
  tutorialProgress: 0,
  /** Último dia em que os aspersores tocaram a animação da manhã (só uma vez por dia) — não vai pro save. */
  sprinklerAnimDay: 0,
  /** Último dia em que o galo cantou (só uma vez por dia, ao amanhecer) — não vai pro save. */
  roosterSoundDay: 0,
};
