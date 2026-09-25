/**
 * Pets companheiros (escolhidos na Criação de Personagem — `CharacterCreationScene`).
 * Só DADOS: catálogo, caminhos das folhas, layout dos quadros e números de
 * comportamento/combate — quem move o bicho é `entities/Pet.ts`, quem carrega
 * as folhas é `systems/petSprites.ts` e quem liga o pet a uma cena é
 * `systems/petCompanion.ts`. Trocar a arte = trocar `path`; adicionar um pet =
 * uma linha em `PETS` (nenhuma lógica muda).
 *
 * As folhas de `assets/Animals/Pets` (gatos e cachorros) são grades de 4 colunas
 * de 32x32 e o mesmo layout nas linhas usadas aqui (conferido por recorte/zoom
 * num gato e em vários cachorros; da linha 5 em diante o layout muda entre gato
 * e cachorro, por isso só as linhas 0-4 são usadas):
 * - linha 0: andar DE LADO (olhando para a ESQUERDA — para a direita, espelha)
 * - linha 1: andar DE FRENTE (para baixo)
 * - linha 2: andar DE COSTAS (para cima)
 * - linha 3: de lado, em pé (quadros 0-1) → sentado (quadros 2-3)
 * - linha 4: de frente, em pé (quadro 0) → sentado (quadros 1-3; o 3 é a pose
 *   feliz, de língua pra fora nos cachorros)
 */

export const PET_FRAME_SIZE = 32;

const PETS_DIR = 'Animals/Pets';

export type PetSpecies = 'cat' | 'dog';

export interface PetDefinition {
  id: string;
  /** Nome exibido na Criação de Personagem. */
  name: string;
  species: PetSpecies;
  /** Caminho a partir de `assets/` (nomes conferidos no disco — o executável serve os assets de dentro de um `.asar`, que diferencia maiúsculas). */
  path: string;
}

/** Catálogo (curado — o pacote tem dezenas de cores/raças, aqui vão 3 gatos e 3 cachorros bem distintos entre si). O primeiro é o padrão. */
export const PETS = [
  { id: 'gato-laranja', name: 'Gato Laranja', species: 'cat', path: `${PETS_DIR}/Cats/1/Ginger.png` },
  { id: 'gato-preto', name: 'Gato Preto', species: 'cat', path: `${PETS_DIR}/Cats/1/Black.png` },
  { id: 'gato-malhado', name: 'Gato Malhado', species: 'cat', path: `${PETS_DIR}/Cats/3/1.png` },
  { id: 'cachorro-branco', name: 'Cachorro Branco', species: 'dog', path: `${PETS_DIR}/Dogs/Premade/1/1.png` },
  { id: 'cachorro-caramelo', name: 'Cachorro Cinza', species: 'dog', path: `${PETS_DIR}/Dogs/Premade/5/3.png` },
  { id: 'cachorro-marrom', name: 'Cachorro Marrom', species: 'dog', path: `${PETS_DIR}/Dogs/Premade/2/1.png` },
] as const satisfies readonly PetDefinition[];

export type PetId = (typeof PETS)[number]['id'];

export const PET_IDS: readonly PetId[] = PETS.map((pet) => pet.id);
export const DEFAULT_PET_ID: PetId = PETS[0].id;

export function isPetId(value: unknown): value is PetId {
  return typeof value === 'string' && (PET_IDS as readonly string[]).includes(value);
}

export function getPetDefinition(id: PetId): PetDefinition {
  return PETS.find((pet) => pet.id === id) ?? PETS[0];
}

/** Chave da textura (e prefixo das animações) do pet — uma por pet, nunca reaproveitada entre eles. */
export function getPetTextureKey(id: PetId): string {
  return `pet-${id}`;
}

const COLUMNS = 4;
const frameAt = (row: number, column: number): number => row * COLUMNS + column;

export type PetAnimName = 'walk-side' | 'walk-down' | 'walk-up' | 'sit-side' | 'sit-front' | 'happy' | 'sleep';

/**
 * Dormindo (pedido explícito do usuário — todo pet tem essa animação na folha, 4 quadros de respiração): a linha muda entre as
 * espécies. Gatos: linha 9 (enroladinho). Cachorros: linha 8 (deitado com a cabeça nas patas) — a folha deles é deslocada uma linha
 * pra cima nessa altura (a linha 9 dos cachorros é o "deitar", a 10 é deitado andando). Ritmo lento, o quadro balança como um respiro.
 */
const PET_SLEEP_ROW: Record<PetSpecies, number> = { cat: 9, dog: 8 };
const PET_SLEEP_FRAME_RATE = 2;

export function getPetSleepAnim(id: PetId): { frames: number[]; frameRate: number } {
  const row = PET_SLEEP_ROW[getPetDefinition(id).species];
  return { frames: [0, 1, 2, 3].map((column) => frameAt(row, column)), frameRate: PET_SLEEP_FRAME_RATE };
}

/** Animações do pet compartilhadas por todos (índices de quadro na grade 4 colunas) — ver o layout no topo do arquivo; `sleep` é por espécie (`getPetSleepAnim`). */
export const PET_ANIMS: Record<Exclude<PetAnimName, 'sleep'>, { frames: number[]; frameRate: number }> = {
  'walk-side': { frames: [0, 1, 2, 3].map((column) => frameAt(0, column)), frameRate: 8 },
  'walk-down': { frames: [0, 1, 2, 3].map((column) => frameAt(1, column)), frameRate: 8 },
  'walk-up': { frames: [0, 1, 2, 3].map((column) => frameAt(2, column)), frameRate: 8 },
  'sit-side': { frames: [frameAt(3, 2), frameAt(3, 3)], frameRate: 2 },
  'sit-front': { frames: [frameAt(4, 1), frameAt(4, 2)], frameRate: 2 },
  happy: { frames: [frameAt(4, 2), frameAt(4, 3)], frameRate: 5 },
};

/** Quadro parado (em pé) de cada direção — o primeiro quadro do ciclo de andar. */
export const PET_STAND_FRAMES = { side: frameAt(0, 0), down: frameAt(1, 0), up: frameAt(2, 0) } as const;
/** Quadro "agachado" do ciclo de andar de lado, usado no bote da mordida. */
export const PET_LUNGE_FRAME = frameAt(0, 3);

/**
 * Comportamento por tipo de mapa (em células). O pet nunca fica preso ao
 * jogador: vagueia livremente num raio em volta dele (`wanderRadius`), e só
 * quando o jogador se afasta além do `leash` ele vem atrás. A Fazenda é
 * grande e segura, então ele solta mais; nas áreas (Floresta com Slimes) e
 * dentro de casa fica mais perto.
 */
export interface PetRoamConfig {
  wanderRadiusTiles: number;
  leashTiles: number;
}
export const PET_ROAM = {
  farm: { wanderRadiusTiles: 6, leashTiles: 8 },
  area: { wanderRadiusTiles: 3, leashTiles: 5 },
  house: { wanderRadiusTiles: 2, leashTiles: 4 },
} as const satisfies Record<string, PetRoamConfig>;

/** Números do pet (px de mundo, px/s, ms). Ver `entities/Pet.ts`. */
export const PET_TUNING = {
  /** Vagando/passeando. */
  walkSpeed: 62,
  /** Vindo atrás do jogador, atendendo ao chamado ou perseguindo um agressor — acompanha o passo do jogador (~123 px/s). */
  runSpeed: 135,
  /** Ao seguir, para de andar quando chega a esta distância do jogador. */
  settleDistance: 60,
  /** Distância (pé a pé) do jogador em que o carinho é possível. */
  petReach: 56,
  /** Longe demais (ou sem caminho até o jogador): reaparece ao lado dele. */
  teleportDistance: 420,
  /** Intervalo (ms) entre uma decisão de vagar/descansar e a próxima. */
  idleMinMs: 1800,
  idleMaxMs: 4500,
  /** Chance de sair passeando (em vez de continuar sentado) a cada decisão. */
  wanderChance: 0.6,
  /** Intervalo mínimo (ms) entre recálculos de rota (A*). */
  repathMs: 320,
  /** Duração (ms) da pose feliz e mínimo entre dois carinhos. */
  pettedMs: 1800,
  petCooldownMs: 700,
  /** Dormir na caminha (`Pet.setBedCell`/`HouseScene`, pedido explícito do usuário): chance de ir dormir em vez de vagar a cada
   * decisão de "calmo" (só quando a caminha existe nesta cena), e por quanto tempo fica lá antes de acordar sozinho. */
  sleepChance: 0.7,
  sleepMinMs: 15000,
  sleepMaxMs: 35000,
  /**
   * Combate: dano por mordida (o Slime tem 25 de vida e a espada de madeira dá 5), recarga,
   * alcance (pé a pé — cobre o pet no centro da célula VIZINHA do inimigo, o mais perto que
   * a rota célula a célula chega quando ele está encostado numa parede/obstáculo), distância
   * em que desiste do agressor e quanto tempo parado sem conseguir chegar até ele antes de desistir.
   */
  biteDamage: 5,
  biteCooldownMs: 900,
  biteRange: 52,
  chaseGiveUpDistance: 420,
  chaseStuckMs: 2500,
} as const;
