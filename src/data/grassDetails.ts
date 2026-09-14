/**
 * Detalhes decorativos soltos pela grama (tufos de grama alta, cogumelo,
 * pedrinha, florzinha branca) — melhoria visual puramente estética, sem
 * colisão nem interação (pedido explícito). Recortados de
 * `Tileset/ALL props seasons.png` (352x192), uma folha "solta" de ícones
 * de tamanhos variados, sem grid uniforme — cada retângulo abaixo foi
 * encontrado escaneando pixel a pixel (opacidade), não estimado
 * visualmente, para não pegar pedaço de um ícone vizinho (a folha é bem
 * apertada, vários ícones quase se tocando).
 */
export const GRASS_DETAILS_KEY = 'grass-details';
export const GRASS_DETAILS_PATH = 'Tileset/ALL props seasons.png';

export interface GrassDetailDefinition {
  id: string;
  frameName: string;
  frameRect: { x: number; y: number; width: number; height: number };
}

export const GRASS_DETAILS: GrassDetailDefinition[] = [
  {
    id: 'tuft',
    frameName: 'grass-detail-tuft',
    // Recorte original (x:163,w:14) cortava a lâmina esquerda do tufo —
    // reportado pelo usuário. A folha não tem um vão vazio limpo entre este
    // ícone e a flor vizinha (sombras se tocam); alargado até a última
    // coluna onde ainda há pixel verde de verdade (não da flor ao lado).
    frameRect: { x: 158, y: 1, width: 18, height: 15 },
  },
  {
    id: 'mushroom',
    frameName: 'grass-detail-mushroom',
    // Recorte original (x:211,w:8) cortava as bordas esquerda/direita do
    // chapéu — reportado pelo usuário. Largura real confirmada varrendo
    // coluna a coluna: há um vão vazio limpo (x=207-210) separando este
    // cogumelo da flor vizinha, então este retângulo é exato, sem sobra.
    frameRect: { x: 211, y: 4, width: 10, height: 11 },
  },
  {
    id: 'rock',
    frameName: 'grass-detail-rock',
    frameRect: { x: 35, y: 106, width: 7, height: 4 },
  },
  {
    id: 'flower',
    frameName: 'grass-detail-flower',
    frameRect: { x: 144, y: 51, width: 15, height: 13 },
  },
];
