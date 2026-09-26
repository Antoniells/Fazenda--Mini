/**
 * Encomendas ao Marceneiro (Tomás): as estruturas grandes (poço, galinheiro, fornalha — `DecorationDefinition.carpenterBuilt`) não vão
 * pra Bolsa: o jogador escolhe o LOCAL na Fazenda, paga, e no dia seguinte o Tomás vai até lá e as constrói (`systems/construction.ts`,
 * `systems/builderCrew.ts`). Aspersores e o resto continuam sendo comprados normalmente.
 */

/** Hora do dia (relógio do jogo) em que o Tomás começa a construir no dia seguinte à encomenda. */
export const BUILD_START_HOUR = 8;
/** Quanto a obra demora (horas do relógio do jogo) quando a definição não diz (`DecorationDefinition.buildHours`). */
export const DEFAULT_BUILD_HOURS = 3;
/** Fração do preço devolvida ao DESTRUIR uma construção pronta (cancelar uma encomenda devolve tudo). */
export const DESTROY_REFUND_RATE = 0.8;

/** Uma encomenda ainda não construída. */
export interface ConstructionOrder {
  id: number;
  decorationId: string;
  /** Célula-âncora (canto superior-esquerdo do footprint) do local escolhido. */
  col: number;
  row: number;
  /** Dia (do relógio) em que foi encomendada — a obra é no dia SEGUINTE. */
  orderedDay: number;
  /** Hora em que a obra começa no dia seguinte (a fila das encomendas do mesmo dia, calculada ao pedir — não muda quando as anteriores terminam). */
  startHour: number;
  /** Quanto o jogador pagou (devolvido no cancelamento). 0 numa MUDANÇA de construção pronta (o Tomás só a refaz noutro lugar: não dá pra cancelar). */
  paid: number;
}

/** Vai pro save: as encomendas e o próximo id. */
export interface ConstructionState {
  orders: ConstructionOrder[];
  nextId: number;
}

export function createConstructionState(): ConstructionState {
  return { orders: [], nextId: 1 };
}

/** Em que pé está uma encomenda agora: à espera do dia/hora, o Tomás trabalhando nela, ou já pronta pra virar construção. */
export type BuildStatus = 'waiting' | 'building' | 'done';

/** O alvo de uma ação sobre uma construção: uma encomenda ainda pendente ou uma construção pronta (pela célula-âncora). */
export type BuildTarget = { kind: 'order'; id: number } | { kind: 'built'; col: number; row: number };

/**
 * O que a Fazenda deve fazer quando abre a partir da loja do Marceneiro (`systems/buildFlow.ts`):
 * - `order`: escolher o local de uma estrutura nova (paga ao confirmar);
 * - `move`: escolher um novo local pra uma encomenda pendente ou construção pronta (sem custo: o Tomás a refaz lá no dia seguinte);
 * - `cancel` / `destroy`: escolher qual encomenda cancelar (devolve tudo) / qual construção pronta destruir (devolve 80%).
 * `target` já vem preenchido quando só há uma candidata (o jogador não precisa escolher).
 */
export interface BuildRequest {
  mode: 'order' | 'move' | 'cancel' | 'destroy';
  decorationId: string;
  target?: BuildTarget;
  /** Cena pra onde voltar (a loja) e os dados dela — a Fazenda não precisa saber o que é. */
  returnTo: { sceneKey: string; data: object };
}

/** Chegada do Tomás à Fazenda: a célula logo dentro da ponte LESTE (a que leva ao Vilarejo). */
export const CARPENTER_ARRIVAL_CELL = { col: 54, row: 21 };

/**
 * Placa "Em obras" do local da encomenda: recorte só da PLACA (capacete e martelo) de `Objects/Exterior/Construction area.png`
 * (112x48, já carregada como `CONSTRUCTION_SIGN_KEY` pela Fazenda, onde a imagem inteira — a barricada — marca os trechos à venda).
 */
export const CONSTRUCTION_SITE_SIGN_FRAME = { name: 'construction-site-sign', rect: { x: 38, y: 2, width: 39, height: 27 } };

/**
 * A picareta do Tomás trabalhando: a folha `Pickaxe.png` do Josh (a mesma arte do personagem, 192x96 = 6 quadros x 3 linhas de 32x32 — baixo, cima e lado, o lado olha pra
 * direita e o outro lado é o espelho), no mesmo desenho da ação "picareta" do jogador (`data/player.ts`): a picareta encontra o chão no quadro 4 (`PICKAXE_IMPACT_FRAME`, 0-based).
 */
export const CARPENTER_PICKAXE_SHEET = { key: 'npc-carpenter-pickaxe', path: 'Character/Character/Pre-made/Josh/Pickaxe.png', frameSize: 32 };
export const PICKAXE_ROWS = { down: { start: 0, end: 5 }, up: { start: 6, end: 11 }, side: { start: 12, end: 17 } };
export const PICKAXE_FRAME_RATE = 10;
export const PICKAXE_IMPACT_FRAME = 4;
