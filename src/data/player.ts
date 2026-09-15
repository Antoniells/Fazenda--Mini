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
import { farmMap } from './maps/farmMap';

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

/**
 * Célula de grid onde o personagem aparece ao iniciar — logo em frente à
 * porta de casa (`farmMap.houseDoorPosition`, uma célula ao sul dela, já
 * que a porta em si é bloqueada/interativa, não andável).
 */
export const PLAYER_START = {
  col: farmMap.houseDoorPosition[0],
  row: farmMap.houseDoorPosition[1] + 1,
};

/** Tempo (ms) para se mover de uma célula do grid para a adjacente. */
export const PLAYER_MOVE_DURATION_MS = 260;

/** Ações agrícolas com animação própria (Fase 4) + buscar água no Poço (Fase 7) + coleta de recursos (Fase 7 — Machado/Picareta) + ataque com espada (Fase 8 — Combate). */
export type PlayerActionKey = 'hoe' | 'plant' | 'water' | 'harvest' | 'well' | 'axe' | 'pickaxe' | 'sword';

interface ActionAnimSpec {
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

export const PLAYER_ACTIONS: Record<PlayerActionKey, ActionAnimSpec> = {
  hoe: {
    key: 'player-alex-hoe',
    path: 'Character/Character/Pre-made/Alex/Hoe.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 4,
    down: { start: 0, end: 5 },
    up: { start: 6, end: 11 },
    side: { start: 12, end: 17 },
  },
  plant: {
    key: 'player-alex-shovel',
    path: 'Character/Character/Pre-made/Alex/Shovel.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 2,
    down: { start: 0, end: 4 },
    up: { start: 5, end: 9 },
    side: { start: 10, end: 14 },
  },
  water: {
    key: 'player-alex-watering',
    path: 'Character/Character/Pre-made/Alex/Watering.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 4,
    down: { start: 0, end: 7 },
    up: { start: 8, end: 15 },
    side: { start: 16, end: 23 },
  },
  harvest: {
    key: 'player-alex-sickle',
    path: 'Character/Character/Pre-made/Alex/Sickle.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 4,
    down: { start: 0, end: 5 },
    up: { start: 6, end: 11 },
    side: { start: 12, end: 17 },
  },
  /** Cortar árvore com o Machado (Fase 7 — Coleta de Recursos). Mesmo layout de `Hoe.png`/`Sickle.png` (192x96, 6 frames/direção), confirmado pelas dimensões da folha. */
  axe: {
    key: 'player-alex-axe',
    path: 'Character/Character/Pre-made/Alex/Axe.png',
    frameRate: 10,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 4,
    down: { start: 0, end: 5 },
    up: { start: 6, end: 11 },
    side: { start: 12, end: 17 },
  },
  /** Quebrar pedra/rocha com a Picareta (Fase 7 — Coleta de Recursos). Mesmo layout das demais. */
  pickaxe: {
    key: 'player-alex-pickaxe',
    path: 'Character/Character/Pre-made/Alex/Pickaxe.png',
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
    key: 'player-alex-pickup',
    path: 'Character/Character/Pre-made/Alex/Pick Up itens/pick up.png',
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
   * Golpe de espada (Fase 8 — Combate): `Character/Pre-made/Alex/Sword.png`
   * (320x96) tem 10 frames/direção, não 6 como as demais — confirmado pelas
   * dimensões da folha (320/32=10). Mais rápido que as ferramentas
   * (`frameRate` maior) pra um golpe responsivo em combate.
   */
  sword: {
    key: 'player-alex-sword',
    path: 'Character/Character/Pre-made/Alex/Sword.png',
    frameRate: 16,
    frameSize: PLAYER_FRAME_SIZE,
    impactFrameOffset: 4,
    down: { start: 0, end: 9 },
    up: { start: 10, end: 19 },
    side: { start: 20, end: 29 },
  },
};
