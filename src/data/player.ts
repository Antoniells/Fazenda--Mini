/**
 * Referências do sprite do personagem jogável — um conjunto por personagem
 * escolhido na Criação de Personagem (`CHARACTER_IDS`: Alex, Josh, Lyria, Manu,
 * Tori). Todos vêm de `Character/Character/Pre-made/<Nome>` e compartilham o
 * MESMO rig (folhas com as mesmas dimensões e o mesmo layout — conferido nos 5),
 * então só os caminhos/chaves mudam: `getPlayerAssets(characterId)` devolve as
 * chaves de textura/animação e os caminhos de cada folha.
 *
 * Analisado pixel a pixel (Alex): frame de 32x32, com layout confirmado
 * visualmente por recorte/zoom das folhas originais:
 * - linha 0 = de frente (baixo)
 * - linha 1 = de costas (cima)
 * - linha 2 = de lado (usada com flipX para virar para a direita)
 *
 * Essa mesma convenção (3 linhas: baixo/cima/lado) se repete em todas as
 * outras folhas de animação do personagem, incluindo as ferramentas
 * agrícolas abaixo — por isso usam a mesma lógica de direção/flip do
 * `Player`, sem necessidade de tratamento especial por animação.
 *
 * `Idle.png` tem 4 frames por direção (12 no total, grid 4x3).
 * `Walk.png` tem 6 frames por direção (18 no total, grid 6x3).
 * `Run.png` existe no asset mas não é usado nesta fase (não solicitado).
 *
 * Ferramentas agrícolas (Fase 4), confirmadas por recorte/zoom da mesma
 * pasta: `Hoe.png` (arar, 6 frames/direção), `Shovel.png` (usado para
 * plantar — não há animação dedicada de "plantar" no asset; cavar é a
 * melhor aproximação disponível, 5 frames/direção), `Watering.png` (regar,
 * 8 frames/direção) e `Sickle.png` (colher, 6 frames/direção).
 */
import { farmMap } from './maps/farmMap';

export const PLAYER_FRAME_SIZE = 32;

/** Personagens jogáveis (pedido explícito: Alex, Josh, Lyria, Manu, Tori) — o nome é também o nome da pasta de assets. */
export const CHARACTER_IDS = ['Alex', 'Josh', 'Lyria', 'Manu', 'Tori'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const DEFAULT_CHARACTER_ID: CharacterId = 'Alex';

export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && (CHARACTER_IDS as readonly string[]).includes(value);
}

const PRE_MADE_DIR = 'Character/Character/Pre-made';

/**
 * Nomes de arquivo que NÃO são iguais entre as 5 pastas do pacote (maiúsculas,
 * espaço antes do ponto, nome da subpasta de "pegar item"). Conferidos um a
 * um no disco — o instalador serve os assets de dentro de um `.asar`, onde o
 * nome precisa bater exatamente (o Windows normal ignora maiúsculas, o asar não).
 */
const CHARACTER_FILES: Record<CharacterId, { sword: string; watering: string; sitting: string; pickUp: string }> = {
  Alex: { sword: 'Sword.png', watering: 'Watering.png', sitting: 'Sitting .png', pickUp: 'Pick Up itens/pick up.png' },
  Josh: { sword: 'Sword.png', watering: 'Watering.png', sitting: 'Sitting.png', pickUp: 'Pick Up Itens/Pick Up Itens.png' },
  Lyria: { sword: 'sword.png', watering: 'watering.png', sitting: 'Sitting .png', pickUp: 'Pick up itens/Pick up.png' },
  Manu: { sword: 'Sword.png', watering: 'Watering.png', sitting: 'Sitting.png', pickUp: 'Pick Up Itens/Pick Up.png' },
  Tori: { sword: 'Sword.png', watering: 'Watering.png', sitting: 'Sitting.png', pickUp: 'Pick Up Itens/pick up.png' },
};

export const PLAYER_ANIM_FRAMES = {
  idleDown: { start: 0, end: 3 },
  idleUp: { start: 4, end: 7 },
  idleSide: { start: 8, end: 11 },
  walkDown: { start: 0, end: 5 },
  walkUp: { start: 6, end: 11 },
  walkSide: { start: 12, end: 17 },
} as const;

/**
 * Célula de grid onde o personagem aparece ao iniciar — logo em frente à
 * porta de casa (`farmMap.houseDoorPosition`, uma célula ao sul dela, já
 * que a porta em si é bloqueada/interativa, não andável).
 */
export const PLAYER_START = {
  // Lidos a cada uso: a porta muda de fileira com as melhorias da casa (`data/houseLevels.ts`).
  get col(): number {
    return farmMap.houseDoorPosition[0];
  },
  get row(): number {
    return farmMap.houseDoorPosition[1] + 1;
  },
};

/** Tempo (ms) para se mover de uma célula do grid para a adjacente. */
export const PLAYER_MOVE_DURATION_MS = 260;

/** Ações agrícolas com animação própria (Fase 4) + buscar água no Poço (Fase 7) + coleta de recursos (Fase 7 — Machado/Picareta) + ataque com espada (Fase 8 — Combate). */
export type PlayerActionKey = 'hoe' | 'plant' | 'water' | 'harvest' | 'well' | 'axe' | 'pickaxe' | 'sword' | 'eat';

/** Duração (ms) da animação de comer — a folha usada tem 1 frame por direção, então isto vira o `frameRate` (ver `PLAYER_ACTIONS.eat`) e também o tempo das mordidas (`systems/eating.ts`). */
export const EATING_DURATION_MS = 660;

export interface ActionAnimSpec {
  key: string;
  path: string;
  frameRate: number;
  /** Tamanho do frame nesta folha específica — a maioria usa `PLAYER_FRAME_SIZE` (32), mas nem toda folha do pacote segue esse tamanho (ver `well`, 64px). */
  frameSize: number;
  /**
   * Deslocamento (px, já na escala de exibição) pra baixo durante a
   * animação, aplicado por `Player.performAction` e desfeito ao terminar.
   * Necessário quando a folha tem mais espaço vazio abaixo do personagem
   * do que o padrão (`Idle.png`, referência): como o personagem usa
   * `origin(0.5, 1)` (ancorado no canto inferior do frame, não nos pés de
   * verdade), uma folha com mais margem embaixo faz o personagem "flutuar"
   * acima do chão enquanto ela toca. 0 (padrão) se a folha já alinha igual
   * às outras.
   */
  yOffset?: number;
  /**
   * "Impact frame" (Fase 9 — Game Feel, pedido explícito do usuário):
   * índice 0-based, DENTRO da sequência de uma direção (não da folha
   * inteira), do frame em que a ferramenta/espada realmente toca o chão/
   * alvo — é nele que `Player.performAction` chama `onApply` (arar,
   * quebrar pedra, golpe de espada, etc.), não só quando a animação
   * termina. Mesmo índice pra baixo/cima/lado, já que as 3 direções de
   * cada folha sempre têm a mesma contagem de frames (ver `down`/`up`/
   * `side` acima). Confirmado visualmente (recorte/zoom, frame a frame) —
   * não é o mesmo pra todas as folhas: enxada/picareta/machado/foice (6
   * frames, mesmo rig de swing) tocam o alvo no frame 4, não no 3 (esse
   * é o frame de "braço erguido", ainda no ar); regador (8 frames) solta
   * o primeiro jato de água no frame 4; pá/plantar (5 frames) crava a pá
   * no frame 2; buscar água no Poço (4 frames, agachar/levantar) chega no
   * fundo do agachamento no frame 2; espada (10 frames) tem o arco do
   * golpe visível no frame 4. `undefined` (nenhuma ação hoje) preserva o
   * comportamento antigo — `onApply` só ao terminar a animação inteira.
   */
  impactFrameOffset?: number;
  down: { start: number; end: number };
  up: { start: number; end: number };
  side: { start: number; end: number };
}

/** Todas as chaves/caminhos do sprite de UM personagem — ver `getPlayerAssets`. */
export interface PlayerAssets {
  characterId: CharacterId;
  /** Prefixo das chaves de animação de idle/andar (`${animPrefix}-idle-down`, ...). */
  animPrefix: string;
  idleKey: string;
  idlePath: string;
  walkKey: string;
  walkPath: string;
  actions: Record<PlayerActionKey, ActionAnimSpec>;
}

function buildActions(characterId: CharacterId): Record<PlayerActionKey, ActionAnimSpec> {
  const dir = `${PRE_MADE_DIR}/${characterId}`;
  const prefix = `player-${characterId.toLowerCase()}`;
  const files = CHARACTER_FILES[characterId];

  return {
    hoe: {
      key: `${prefix}-hoe`,
      path: `${dir}/Hoe.png`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 5 },
      up: { start: 6, end: 11 },
      side: { start: 12, end: 17 },
    },
    plant: {
      key: `${prefix}-shovel`,
      path: `${dir}/Shovel.png`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 2,
      down: { start: 0, end: 4 },
      up: { start: 5, end: 9 },
      side: { start: 10, end: 14 },
    },
    water: {
      key: `${prefix}-watering`,
      path: `${dir}/${files.watering}`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 7 },
      up: { start: 8, end: 15 },
      side: { start: 16, end: 23 },
    },
    harvest: {
      key: `${prefix}-sickle`,
      path: `${dir}/Sickle.png`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 5 },
      up: { start: 6, end: 11 },
      side: { start: 12, end: 17 },
    },
    /** Cortar árvore com o Machado (Fase 7 — Coleta de Recursos). Mesmo layout de `Hoe.png`/`Sickle.png` (192x96, 6 frames/direção), confirmado pelas dimensões da folha. */
    axe: {
      key: `${prefix}-axe`,
      path: `${dir}/Axe.png`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 5 },
      up: { start: 6, end: 11 },
      side: { start: 12, end: 17 },
    },
    /** Quebrar pedra/rocha com a Picareta (Fase 7 — Coleta de Recursos). Mesmo layout das demais. */
    pickaxe: {
      key: `${prefix}-pickaxe`,
      path: `${dir}/Pickaxe.png`,
      frameRate: 10,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 5 },
      up: { start: 6, end: 11 },
      side: { start: 12, end: 17 },
    },
    /**
     * Buscar água no Poço (Fase 7) — diferente da animação de regar a
     * lavoura (`water`, usa o regador já erguido), essa mostra o personagem
     * se abaixando e levantando algo, mais parecida com "pegar água" do que
     * "regar uma planta". Não existe uma animação dedicada de "poço" no
     * pacote de assets — `Pick Up itens/pick up.png` (abaixar e levantar) foi
     * a mais próxima disponível, sem precisar de arte nova. Essa folha usa
     * frames de 64x64 (o dobro das outras), confirmado recortando/ampliando
     * pixel a pixel — tentar carregá-la como 32x32 (padrão das outras)
     * cortaria cada frame ao meio.
     */
    well: {
      key: `${prefix}-pickup`,
      path: `${dir}/${files.pickUp}`,
      frameRate: 8,
      frameSize: 64,
      // Pés (frame de baixo) acabam em y=41 de um frame de 64px (22px de
      // margem embaixo) contra y=25 de um frame de 32px do `Idle.png` (6px
      // de margem) — ambos escaneados pixel a pixel. Diferença: 16px nativos
      // = 32px na escala de exibição (DISPLAY_SCALE = 2).
      yOffset: 32,
      impactFrameOffset: 2,
      down: { start: 0, end: 3 },
      up: { start: 4, end: 7 },
      side: { start: 8, end: 11 },
    },
    /**
     * Golpe de espada (Fase 8 — Combate): `Sword.png` (320x96) tem 10
     * frames/direção, não 6 como as demais — confirmado pelas dimensões da
     * folha (320/32=10). Mais rápido que as ferramentas (`frameRate` maior)
     * pra um golpe responsivo em combate.
     */
    sword: {
      key: `${prefix}-sword`,
      path: `${dir}/${files.sword}`,
      frameRate: 16,
      frameSize: PLAYER_FRAME_SIZE,
      impactFrameOffset: 4,
      down: { start: 0, end: 9 },
      up: { start: 10, end: 19 },
      side: { start: 20, end: 29 },
    },
    /**
     * Comer (pedido explícito). O pacote NÃO tem uma animação de comer para o
     * personagem humano (só "Horse - Eating"); a mais próxima é `Sitting .png`
     * (96x32, 3 frames de 32x32: baixo / cima / lado, conferido por zoom) — o
     * personagem agachado. Como tem UM frame por direção, a "animação" é essa
     * pose mantida por `EATING_DURATION_MS` (`frameRate` = 1000/duração, sem
     * repetir); o movimento fica por conta do alimento sendo mordido sobre a
     * cabeça (`systems/eating.ts`). Sem `impactFrameOffset`: o efeito (gastar a
     * colheita e curar) só é aplicado ao TERMINAR de comer.
     * `yOffset`: os pés da pose agachada acabam em y=24 (baixo) / y=22
     * (cima e lado) do frame de 32px, contra y=25 do `Idle.png` — medido pelo
     * canal alfa; 4px de exibição é o meio-termo (erro máximo de 2px).
     */
    eat: {
      key: `${prefix}-sitting`,
      path: `${dir}/${files.sitting}`,
      frameRate: 1000 / EATING_DURATION_MS,
      frameSize: PLAYER_FRAME_SIZE,
      yOffset: 4,
      down: { start: 0, end: 0 },
      up: { start: 1, end: 1 },
      side: { start: 2, end: 2 },
    },
  };
}

/**
 * PESCA (Fase 11): as folhas de `Pre-made/<Nome>/Fishing/` usam quadros de 64x64 com as 3 linhas de sempre (baixo/cima/lado) —
 * pés em y=41 (22px de margem embaixo, como o `well`: `yOffset` 32). Os nomes de arquivo mudam de pasta pra pasta (maiúsculas),
 * conferidos um a um no disco. A folha "Hooked" do Alex é a única fora do padrão: 512x208, com as linhas em y=0, 80 e 144 (uma
 * faixa vazia de 16px entre a 1ª e a 2ª) — `rowOffsets` recorta cada quadro no lugar certo.
 */
export type FishingPhase = 'cast' | 'wait' | 'hooked' | 'reel' | 'catch' | 'miss';

export interface FishingSheetSpec {
  key: string;
  path: string;
  frames: number;
  frameRate: number;
  /** -1 = repete até trocar de fase. */
  repeat: number;
  /** Onde começa cada linha (baixo/cima/lado); padrão 0/64/128. */
  rowOffsets?: [number, number, number];
}

export const FISHING_FRAME_SIZE = 64;
/** Mesmo ajuste do `well` (quadro de 64px): 16px nativos = 32px na tela. */
export const FISHING_Y_OFFSET = 32;

const FISHING_FILES: Record<CharacterId, Record<FishingPhase, string>> = {
  Alex: { cast: 'Casting.png', wait: 'Wait Idle.png', hooked: 'Hooked.png', reel: 'Roll.png', catch: 'Captured Fish.png', miss: 'Captured no Fish.png' },
  Josh: { cast: 'Casting.png', wait: 'Wait Idle.png', hooked: 'Hooked.png', reel: 'Roll.png', catch: 'Captured Fish.png', miss: 'Captured No Fish.png' },
  Lyria: { cast: 'Casting.png', wait: 'idle wait.png', hooked: 'hooked.png', reel: 'roll.png', catch: 'Captured fish.png', miss: 'Captured no fish.png' },
  Manu: { cast: 'Casting.png', wait: 'Wait Idle.png', hooked: 'Hooked.png', reel: 'Roll.png', catch: 'Captured Fish.png', miss: 'Captured no Fish.png' },
  Tori: { cast: 'Casting.png', wait: 'Wait Idle.png', hooked: 'Hooked.png', reel: 'Roll.png', catch: 'Captured Fish.png', miss: 'Captured no Fish.png' },
};

const FISHING_TIMING: Record<FishingPhase, { frames: number; frameRate: number; repeat: number }> = {
  cast: { frames: 15, frameRate: 16, repeat: 0 },
  wait: { frames: 4, frameRate: 4, repeat: -1 },
  hooked: { frames: 8, frameRate: 12, repeat: -1 },
  reel: { frames: 4, frameRate: 8, repeat: -1 },
  catch: { frames: 4, frameRate: 6, repeat: 0 },
  miss: { frames: 4, frameRate: 7, repeat: 0 },
};

export function getFishingSheets(characterId: CharacterId): Record<FishingPhase, FishingSheetSpec> {
  const dir = `${PRE_MADE_DIR}/${characterId}/Fishing`;
  const prefix = `player-${characterId.toLowerCase()}-fishing`;
  const files = FISHING_FILES[characterId];
  const sheets = {} as Record<FishingPhase, FishingSheetSpec>;
  for (const phase of Object.keys(FISHING_TIMING) as FishingPhase[]) {
    sheets[phase] = { key: `${prefix}-${phase}`, path: `${dir}/${files[phase]}`, ...FISHING_TIMING[phase] };
  }
  if (characterId === 'Alex') sheets.hooked.rowOffsets = [0, 80, 144];
  return sheets;
}

const assetsCache = new Map<CharacterId, PlayerAssets>();

/** Chaves/caminhos do sprite do personagem escolhido (memoizado). Cada personagem tem as PRÓPRIAS chaves de textura/animação, então trocar de personagem (outro slot) nunca reaproveita a arte do anterior. */
export function getPlayerAssets(characterId: CharacterId): PlayerAssets {
  const cached = assetsCache.get(characterId);
  if (cached) return cached;

  const animPrefix = `player-${characterId.toLowerCase()}`;
  const assets: PlayerAssets = {
    characterId,
    animPrefix,
    idleKey: `${animPrefix}-idle`,
    idlePath: `${PRE_MADE_DIR}/${characterId}/Idle.png`,
    walkKey: `${animPrefix}-walk`,
    walkPath: `${PRE_MADE_DIR}/${characterId}/Walk.png`,
    actions: buildActions(characterId),
  };
  assetsCache.set(characterId, assets);
  return assets;
}
