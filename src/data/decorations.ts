/**
 * Definições de objetos decorativos/construções posicionáveis (Fase 6).
 * Mesma filosofia de `data/crops.ts`: estrutura de dados separada da
 * lógica (`systems/decorationPlacement.ts`) — adicionar uma nova decoração
 * no futuro é só acrescentar uma entrada aqui.
 */
export interface DecorationDefinition {
  id: string;
  name: string;
  textureKey: string;
  texturePath: string;
  /** Nome do frame recortado manualmente (registrado uma vez em `MainScene`). */
  frameName: string;
  /** Retângulo do recorte no spritesheet original. */
  frameRect: { x: number; y: number; width: number; height: number };
  /** Preço (moedas) para comprar na Loja. */
  price: number;
}

/**
 * `Objects/Exterior/Well .png` (128x192, note o espaço no nome do arquivo):
 * uma folha com variações de poço decorativo. O primeiro ícone (canto
 * superior esquerdo) foi isolado varrendo os pixels não-transparentes um a
 * um (não estimado visualmente) — os poços vizinhos ficam colados lado a
 * lado sem uma grade limpa de 16px, então um recorte "no olho" cortaria a
 * arte errado, do mesmo jeito que já aconteceu antes com o cursor de
 * seleção.
 */
export const WELL: DecorationDefinition = {
  id: 'well',
  name: 'Poço',
  textureKey: 'decor-well',
  texturePath: 'Objects/Exterior/Well .png',
  frameName: 'decor-well-icon',
  frameRect: { x: 0, y: 10, width: 28, height: 38 },
  price: 40,
};

export const DECORATIONS: Record<string, DecorationDefinition> = {
  [WELL.id]: WELL,
};
