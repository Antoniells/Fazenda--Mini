/**
 * Referências do sprite do personagem jogável.
 *
 * Asset escolhido: `Character/Character/Pre-made/Alex` (macacão azul, bom
 * contraste com a grama). Analisado pixel a pixel: frame de 32x32, com
 * layout confirmado visualmente por recorte/zoom das folhas originais:
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
 * pasta `Pre-made/Alex`: `Hoe.png` (arar, 6 frames/direção), `Shovel.png`
 * (usado para plantar — não há animação dedicada de "plantar" no asset;
 * cavar é a melhor aproximação disponível, 5 frames/direção),
 * `Watering.png` (regar, 8 frames/direção) e `Sickle.png` (colher,
 * 6 frames/direção).
 */

export const PLAYER_FRAME_SIZE = 32;

export const PLAYER_IDLE_KEY = 'player-alex-idle';
export const PLAYER_IDLE_PATH = 'Character/Character/Pre-made/Alex/Idle.png';

export const PLAYER_WALK_KEY = 'player-alex-walk';
export const PLAYER_WALK_PATH = 'Character/Character/Pre-made/Alex/Walk.png';

export const PLAYER_ANIM_FRAMES = {
  idleDown: { start: 0, end: 3 },
  idleUp: { start: 4, end: 7 },
  idleSide: { start: 8, end: 11 },
  walkDown: { start: 0, end: 5 },
  walkUp: { start: 6, end: 11 },
  walkSide: { start: 12, end: 17 },
} as const;

/** Célula de grid onde o personagem aparece ao iniciar. */
export const PLAYER_START = { col: 12, row: 9 };

/** Tempo (ms) para se mover de uma célula do grid para a adjacente. */
export const PLAYER_MOVE_DURATION_MS = 260;

/** Ações agrícolas com animação própria (Fase 4) + buscar água no Poço (Fase 7). */
export type PlayerActionKey = 'hoe' | 'plant' | 'water' | 'harvest' | 'well';

interface ActionAnimSpec {
  key: string;
  path: string;
  frameRate: number;
  /** Tamanho do frame nesta folha específica — a maioria usa `PLAYER_FRAME_SIZE` (32), mas nem toda folha do pacote segue esse tamanho (ver `well`, 64px). */
  frameSize: number;
  down: { start: number; end: number };
  up: { start: number; end: number };
  side: { start: number; end: number };
}

export const PLAYER_ACTIONS: Record<PlayerActionKey, ActionAnimSpec> = {
  hoe: {
    key: 'player-alex-hoe',
    path: 'Character/Character/Pre-made/Alex/Hoe.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    down: { start: 0, end: 5 },
    up: { start: 6, end: 11 },
    side: { start: 12, end: 17 },
  },
  plant: {
    key: 'player-alex-shovel',
    path: 'Character/Character/Pre-made/Alex/Shovel.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    down: { start: 0, end: 4 },
    up: { start: 5, end: 9 },
    side: { start: 10, end: 14 },
  },
  water: {
    key: 'player-alex-watering',
    path: 'Character/Character/Pre-made/Alex/Watering.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    down: { start: 0, end: 7 },
    up: { start: 8, end: 15 },
    side: { start: 16, end: 23 },
  },
  harvest: {
    key: 'player-alex-sickle',
    path: 'Character/Character/Pre-made/Alex/Sickle.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
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
    key: 'player-alex-pickup',
    path: 'Character/Character/Pre-made/Alex/Pick Up itens/pick up.png',
    frameRate: 8,
    frameSize: 64,
    down: { start: 0, end: 3 },
    up: { start: 4, end: 7 },
    side: { start: 8, end: 11 },
  },
};
