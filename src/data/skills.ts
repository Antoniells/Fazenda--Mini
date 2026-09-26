/**
 * Progressão e RPG (Fase 8 — Níveis e Experiência): só DADOS — o que dá XP, quanto, e as habilidades compráveis com ele. A lógica (ganhar
 * XP, comprar, bônus resultantes) está em `systems/skills.ts`; a tela é `ui/skillTreePanel.ts`.
 *
 * O XP é uma moeda só: cada ação no mundo o soma (`XP_REWARDS`) e cada compra de habilidade o GASTA — o que sobra é o "XP disponível" mostrado
 * na tela. `totalXp` guarda tudo o que já foi ganhado (nunca diminui).
 */

/** O que dá XP. `fish` já tem valor pra quando existir pesca no jogo (ainda não existe — nada o dispara hoje). */
export type XpSource = 'harvest' | 'chop' | 'mineSmall' | 'mineBig' | 'slime' | 'raider' | 'fish';

/** XP por ocorrência (uma colheita, uma árvore derrubada, uma pedra quebrada, um inimigo derrotado, um peixe). */
export const XP_REWARDS: Record<XpSource, number> = {
  harvest: 3,
  chop: 3,
  mineSmall: 2,
  mineBig: 6,
  slime: 6,
  raider: 10,
  fish: 8,
};

/** O que vai pro save. */
export interface SkillsState {
  /** XP disponível pra gastar. */
  xp: number;
  /** Tudo que já foi ganho (não diminui ao comprar). */
  totalXp: number;
  /** Nível comprado de cada habilidade (`SkillId` → 0..maxRank); ausente = 0. */
  ranks: Record<string, number>;
}

export function createSkillsState(): SkillsState {
  return { xp: 0, totalXp: 0, ranks: {} };
}

export type SkillId = 'swiftFeet' | 'merchant' | 'doubleDrop' | 'fishingLuck' | 'stamina';

/** Ícone de uma habilidade: um quadro recortado de uma folha existente (`Icons/RPG icons/...`), carregada pela `UIScene`. */
export interface SkillIcon {
  key: string;
  path: string;
  frame: { name: string; rect: { x: number; y: number; width: number; height: number } };
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  icon: SkillIcon;
  /** XP de cada nível: `costs[0]` compra o nível 1, e assim por diante. `maxRank` = `costs.length`. */
  costs: number[];
  /** Texto do efeito com `rank` níveis comprados (`rank` 0 = sem bônus). */
  effectText: (rank: number) => string;
  /** Aviso quando o bônus ainda não tem onde agir no jogo (o atributo já fica guardado e passa a valer quando o sistema existir). */
  pendingNote?: string;
}

/** Bônus por nível de cada habilidade (fonte única — o texto e a lógica leem daqui). */
export const SKILL_BONUS = {
  /** +6% de velocidade de movimento por nível. */
  swiftFeetPerRank: 0.06,
  /** +5% no valor de venda por nível. */
  merchantPerRank: 0.05,
  /** +6% de chance de drop duplo por nível. */
  doubleDropPerRank: 0.06,
  /** +2 de sorte na pesca por nível (a sorte base é 0). */
  fishingLuckPerRank: 2,
  /** +10 de resistência máxima por nível. */
  staminaPerRank: 10,
};

/** Resistência máxima sem nenhuma habilidade (o jogo ainda não tem a barra de resistência — quando tiver, parte deste valor). */
export const BASE_MAX_STAMINA = 100;

const pct = (value: number): string => `+${Math.round(value * 100)}%`;

const SKILL_ICON_DIR = 'Icons/RPG icons';

export const SKILLS: SkillDefinition[] = [
  {
    id: 'swiftFeet',
    name: 'Pés Ligeiros',
    description: 'Você anda mais rápido em qualquer mapa.',
    icon: {
      key: 'skill-icon-boots',
      path: `${SKILL_ICON_DIR}/Weapons and Armor/1. Wood/Boots.png`,
      frame: { name: 'skill-boots', rect: { x: 0, y: 0, width: 16, height: 16 } },
    },
    costs: [30, 60, 100, 150, 220],
    effectText: (rank) => `${pct(rank * SKILL_BONUS.swiftFeetPerRank)} de velocidade`,
  },
  {
    id: 'merchant',
    name: 'Comerciante',
    description: 'A Caixa de Remessas paga mais por tudo que você vende.',
    icon: {
      key: 'skill-icon-rings',
      path: `${SKILL_ICON_DIR}/Extras/Rings.png`,
      frame: { name: 'skill-ring', rect: { x: 16, y: 0, width: 16, height: 16 } },
    },
    costs: [40, 80, 130, 190, 270],
    effectText: (rank) => `${pct(rank * SKILL_BONUS.merchantPerRank)} no valor de venda`,
  },
  {
    id: 'doubleDrop',
    name: 'Mãos de Ouro',
    description: 'Ao colher legumes, cortar árvores e quebrar pedras, às vezes o drop vem em dobro.',
    icon: {
      key: 'skill-icon-gloves',
      path: `${SKILL_ICON_DIR}/Extras/Gloves.png`,
      frame: { name: 'skill-gloves', rect: { x: 0, y: 0, width: 16, height: 16 } },
    },
    costs: [50, 90, 140, 200, 280],
    effectText: (rank) => `${pct(rank * SKILL_BONUS.doubleDropPerRank)} de chance de drop duplo`,
  },
  {
    id: 'fishingLuck',
    name: 'Sorte do Pescador',
    description: 'Mais sorte no minigame de pesca: peixes melhores mordem a isca.',
    icon: {
      key: 'skill-icon-rod',
      path: `${SKILL_ICON_DIR}/Weapons and Armor/1. Wood/Fishing Rod.png`,
      frame: { name: 'skill-rod', rect: { x: 0, y: 0, width: 16, height: 16 } },
    },
    costs: [30, 60, 100, 150, 220],
    effectText: (rank) => `+${rank * SKILL_BONUS.fishingLuckPerRank} de sorte na pesca`,
    pendingNote: 'A pesca ainda não existe no jogo: o bônus fica guardado e passa a valer quando ela chegar.',
  },
  {
    id: 'stamina',
    name: 'Fôlego',
    description: 'Aumenta a barra máxima de resistência (stamina).',
    icon: {
      key: 'skill-icon-potions',
      path: `${SKILL_ICON_DIR}/Extras/Potions.png`,
      frame: { name: 'skill-potion', rect: { x: 16, y: 32, width: 16, height: 16 } },
    },
    costs: [40, 80, 130, 190, 270],
    effectText: (rank) => `+${rank * SKILL_BONUS.staminaPerRank} de resistência máxima (${BASE_MAX_STAMINA + rank * SKILL_BONUS.staminaPerRank} no total)`,
    pendingNote: 'O jogo ainda não tem a barra de resistência: o bônus fica guardado e passa a valer quando ela chegar.',
  },
];

export function getSkillDefinition(id: string): SkillDefinition | undefined {
  return SKILLS.find((skill) => skill.id === id);
}

/** Aba "Habilidades" do Inventário: ícone (Livro de estrela, `Icons/RPG icons/Extras/Books.png`) e fita vermelha (`UI/Inventory/Extras.png`). */
export const SKILLS_TAB_ICON: SkillIcon = {
  key: 'skill-icon-books',
  path: `${SKILL_ICON_DIR}/Extras/Books.png`,
  frame: { name: 'skill-book', rect: { x: 32, y: 16, width: 16, height: 16 } },
};
