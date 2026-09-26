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
    // ícone e a flor vizinha (sombras se tocam), então o primeiro ajuste
    // (x:158,w:18) foi longe demais: a coluna x=158 pega 1px roxo da
    // florzinha vizinha (confirmado varrendo x=157-159 pixel a pixel — só
    // x=158,y=8 tem cor fora da paleta verde do tufo), aparecendo como uma
    // manchinha de "outra arte" na base esquerda — reportado pelo usuário de
    // novo. x=159 já é 100% verde do próprio tufo em todas as linhas.
    frameRect: { x: 159, y: 1, width: 17, height: 15 },
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

/**
 * Os 4 desenhos de mato da fileira y≈128-143 da mesma folha (limites medidos varrendo o canal alfa, sem pegar nada dos vizinhos):
 * - `WILD_GRASS_DETAIL` — a moita folhosa (14x14): o MATO colhível com a Foice (`systems/wildGrass.ts`), também o ícone do item Capim.
 * - `GRASS_BLADE_DETAILS` — os 3 tufos de lâminas finas: decoração espalhada pela grama da Fazenda (`systems/grassDetails.ts`), que balança ao pisar.
 */
export const WILD_GRASS_DETAIL: GrassDetailDefinition = {
  id: 'wild-grass',
  frameName: 'wild-grass-bush',
  frameRect: { x: 145, y: 129, width: 14, height: 14 },
};

export const GRASS_BLADE_DETAILS: GrassDetailDefinition[] = [
  { id: 'blade-a', frameName: 'grass-blade-a', frameRect: { x: 163, y: 133, width: 10, height: 9 } },
  { id: 'blade-b', frameName: 'grass-blade-b', frameRect: { x: 180, y: 133, width: 7, height: 9 } },
  { id: 'blade-c', frameName: 'grass-blade-c', frameRect: { x: 195, y: 131, width: 9, height: 12 } },
];
