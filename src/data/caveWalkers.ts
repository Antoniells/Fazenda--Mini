import { WalkerSheets, archerSheets, myconidSheets, spearSheets, sproutSheets } from './caveEnemies';

/**
 * Como cada bicho de 4 direções da Caverna ataca (`entities/cave/CaveWalker.ts`). Distâncias em px de mundo (uma célula = 32px), tempos em ms; os índices de quadro
 * são colunas da folha de ataque (cada direção é uma linha): `windupTo` = último quadro do aviso (o bicho congela nele até o golpe), `strikeFrom..strikeTo` = o golpe.
 */
export interface WalkerAttack {
  kind: 'melee' | 'ranged';
  /** Distância em que começa a preparar o golpe (no `ranged`, é o alcance de onde ele mira). */
  startRange: number;
  /** Alcance do golpe no impacto (corpo a corpo). */
  hitRange: number;
  windupMs: number;
  strikeMs: number;
  recoverMs: number;
  windupTo: number;
  strikeFrom: number;
  strikeTo: number;
  /** Só `ranged`: meia-largura do corredor do tiro e alcance máximo. */
  lineWidth?: number;
  maxRange?: number;
}

export interface WalkerConfig {
  sheets: WalkerSheets;
  attack?: WalkerAttack;
  /** Quem só encosta (o Broto): alcance do toque e recarga entre toques. */
  contact?: { range: number; cooldownMs: number };
  /** Raio em que nota o jogador, e raio em que desiste (maior de propósito: sem isso ele alternaria perseguir/vagar na borda). */
  aggro: number;
  deaggro: number;
  scale?: number;
}

export type WalkerKind = 'myconid' | 'spear' | 'archer' | 'sprout';

export function walkerConfig(kind: WalkerKind, color: string): WalkerConfig {
  switch (kind) {
    case 'myconid':
      return {
        sheets: myconidSheets(color),
        attack: { kind: 'melee', startRange: 46, hitRange: 56, windupMs: 520, strikeMs: 340, recoverMs: 900, windupTo: 1, strikeFrom: 2, strikeTo: 5 },
        aggro: 140,
        deaggro: 220,
      };
    case 'spear':
      return {
        sheets: spearSheets(),
        attack: { kind: 'melee', startRange: 64, hitRange: 74, windupMs: 420, strikeMs: 320, recoverMs: 780, windupTo: 1, strikeFrom: 2, strikeTo: 5 },
        aggro: 170,
        deaggro: 260,
      };
    case 'archer':
      return {
        sheets: archerSheets(),
        attack: { kind: 'ranged', startRange: 190, hitRange: 0, windupMs: 620, strikeMs: 380, recoverMs: 1100, windupTo: 2, strikeFrom: 3, strikeTo: 6, lineWidth: 18, maxRange: 240 },
        aggro: 230,
        deaggro: 320,
      };
    case 'sprout':
      return { sheets: sproutSheets(color), contact: { range: 26, cooldownMs: 800 }, aggro: 160, deaggro: 240 };
  }
}
