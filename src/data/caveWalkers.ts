import { WalkerSheets, archerSheets, myconidSheets, spearSheets, sproutSheets } from './caveEnemies';

/**
 * Como cada bicho de 4 direções da Caverna ataca (`entities/cave/CaveWalker.ts`). Distâncias em px de mundo (uma célula = 32px), tempos em ms; os índices de quadro
 * são colunas da folha de ataque (cada direção é uma linha): `windupTo` = último quadro do aviso (o bicho congela nele até o golpe), `strikeFrom..strikeTo` = o golpe.
 * O `lunge` (o bote do Broto, que não tem folha de ataque) não usa quadros: no aviso ele se encolhe avermelhado e no golpe se LANÇA no jogador.
 */
export interface WalkerAttack {
  kind: 'melee' | 'ranged' | 'lunge';
  /** Distância em que começa a preparar o golpe (no `ranged`, é o alcance de onde ele mira). */
  startRange: number;
  /** Alcance do golpe no impacto (corpo a corpo). */
  hitRange: number;
  windupMs: number;
  strikeMs: number;
  recoverMs: number;
  /** Quadros da folha de ataque (o `lunge` não tem folha e não usa). */
  windupTo?: number;
  strikeFrom?: number;
  strikeTo?: number;
  /** Só `ranged`: meia-largura do corredor do tiro e alcance máximo. */
  lineWidth?: number;
  maxRange?: number;
  /** Só `lunge`: velocidade do bote (px/s) na direção em que o jogador estava no fim do aviso, e quanto ele avança (px) — `strikeMs` é só o limite. */
  lungeSpeed?: number;
  lungeDistance?: number;
}

export interface WalkerConfig {
  sheets: WalkerSheets;
  attack?: WalkerAttack;
  /** Raio em que nota o jogador, e raio em que desiste (maior de propósito: sem isso ele alternaria perseguir/vagar na borda). */
  aggro: number;
  deaggro: number;
  scale?: number;
  /**
   * Quantos px (de mundo) acima da base do quadro fica o CENTRO da sombra. O quadro tem uma margem vazia embaixo dos pés (medida pela última linha opaca da folha: goblins e cogumelo 6 linhas
   * nativas = 12 px; Broto 2 = 4 px), e a sombra tem que ficar sob os pés, não abaixo deles (senão o bicho parece flutuar): margem + ~2 px.
   */
  shadowOffsetY: number;
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
        shadowOffsetY: 14,
      };
    case 'spear':
      return {
        sheets: spearSheets(),
        attack: { kind: 'melee', startRange: 64, hitRange: 74, windupMs: 420, strikeMs: 320, recoverMs: 780, windupTo: 1, strikeFrom: 2, strikeTo: 5 },
        aggro: 170,
        deaggro: 260,
        shadowOffsetY: 14,
      };
    case 'archer':
      return {
        sheets: archerSheets(),
        attack: { kind: 'ranged', startRange: 190, hitRange: 0, windupMs: 620, strikeMs: 380, recoverMs: 1100, windupTo: 2, strikeFrom: 3, strikeTo: 6, lineWidth: 18, maxRange: 240 },
        aggro: 230,
        deaggro: 320,
        shadowOffsetY: 14,
      };
    case 'sprout':
      // O bote: antes ele só "encostava" (alcance 26 px), mas parava de andar a 30 px do jogador e nunca o machucava.
      return {
        sheets: sproutSheets(color),
        attack: { kind: 'lunge', startRange: 58, hitRange: 30, windupMs: 450, strikeMs: 400, recoverMs: 750, lungeSpeed: 240, lungeDistance: 60 },
        aggro: 160,
        deaggro: 240,
        shadowOffsetY: 6,
      };
  }
}
