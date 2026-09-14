/**
 * Praia (Sistema de Cenas): areia (chão tingido, mesmo tom já usado na
 * faixa de expansão da Fazenda — ver `mapBuilder.BIOME_TINTS.beach`) e um
 * pedaço de oceano/mar — só o "visual básico" pedido (pesca é Fase 7,
 * pendente).
 */
export interface BeachMapData {
  cols: number;
  rows: number;
  /** Retângulo (em células) do mar — o resto do mapa é areia. */
  oceanArea: { col0: number; row0: number; cols: number; rows: number };
}

export const beachMap: BeachMapData = {
  cols: 26,
  rows: 20,
  // Mar na borda de BAIXO (pedido explícito) — a ponte de volta pra
  // Fazenda fica na borda de CIMA (ver `BeachScene.returnDirection`), então
  // o jogador entra na areia e o mar fica mais à frente, não atrás dele.
  oceanArea: { col0: 0, row0: 13, cols: 26, rows: 7 },
};
