/**
 * Props de decoração ambiente (pedido explícito do usuário — aba
 * "Decoração" do `MapEditorScene`, disponível em QUALQUER tipo de mapa):
 * cada entrada é um recorte de `PROPS_TILESET_KEY` (`assets/Tileset/ALL
 * props seasons.png`). Puramente visual — nunca bloqueia a passagem do
 * jogador (decisão explícita do usuário), então não têm campo de colisão
 * nem participam do `WalkableGrid`.
 *
 * `frame` de cada prop foi obtido por detecção de componentes conectados no
 * canal alpha da imagem (script único, não repetível a partir daqui — os
 * valores abaixo já são o resultado final), não estimado a olho: a folha
 * mistura dezenas de sprites de tamanhos bem diferentes (cogumelo pequeno,
 * pedra, tronco comprido, trepadeira alta), e um recorte impreciso cortaria
 * ou deslocaria o sprite visivelmente. Este catálogo cobre uma amostra
 * representativa de cada categoria visual da folha (pedras em várias cores/
 * tamanhos — pedido explícito do usuário —, cogumelos, moitas, flores,
 * tronco caído, trepadeira, parede de coral), não every pixel-blob
 * detectado (muitos são apenas variações de cor quase idênticas).
 */
export interface MapPropDef {
  id: string;
  label: string;
  frame: { x: number; y: number; width: number; height: number };
  /**
   * Prop "de chão" (deitado, sem altura — tronco/lama caída no chão): desenhado NO chão, atrás de
   * TODO personagem/objeto, em vez de ordenado por Y como os props com volume. Sem isso a arte
   * (que pode ter 2+ tiles de altura) cobria o jogador/pet que passasse atrás dela.
   */
  flat?: boolean;
}

export const MAP_PROPS: MapPropDef[] = [
  // --- Pedras (pedido explícito — "faltam as pedras") -----------------------
  { id: 'prop-rock-pebble-brown', label: 'Pedra Pequena', frame: { x: 66, y: 97, width: 12, height: 8 } },
  { id: 'prop-rock-boulder-brown', label: 'Pedra Marrom', frame: { x: 49, y: 103, width: 13, height: 8 } },
  { id: 'prop-rock-cluster-brown', label: 'Pedra Marrom Grande', frame: { x: 146, y: 115, width: 13, height: 9 } },
  { id: 'prop-rock-boulder-blue', label: 'Pedra Azul', frame: { x: 32, y: 112, width: 11, height: 11 } },
  { id: 'prop-rock-boulder-blue-tall', label: 'Pedra Azul Grande', frame: { x: 53, y: 112, width: 11, height: 16 } },
  { id: 'prop-rock-pebble-purple', label: 'Pedra Roxa', frame: { x: 178, y: 97, width: 12, height: 8 } },

  // --- Cogumelos -------------------------------------------------------------
  { id: 'prop-mushroom-brown', label: 'Cogumelo Marrom', frame: { x: 178, y: 36, width: 12, height: 11 } },
  { id: 'prop-mushroom-dark-spiky', label: 'Cogumelo Escuro', frame: { x: 192, y: 35, width: 15, height: 13 } },
  { id: 'prop-mushroom-orange', label: 'Cogumelo Laranja', frame: { x: 211, y: 36, width: 10, height: 11 } },
  { id: 'prop-mushroom-tan', label: 'Cogumelo Bege', frame: { x: 292, y: 66, width: 12, height: 11 } },
  { id: 'prop-mushroom-tan-double', label: 'Cogumelo Bege Duplo', frame: { x: 306, y: 66, width: 12, height: 12 } },
  { id: 'prop-mushroom-tan-leaning', label: 'Cogumelo Inclinado', frame: { x: 337, y: 66, width: 13, height: 11 } },
  { id: 'prop-mushroom-blue', label: 'Cogumelo Azul', frame: { x: 289, y: 82, width: 15, height: 13 } },

  // --- Moitas / touceiras ------------------------------------------------
  { id: 'prop-tuft-orange-dry', label: 'Moita Seca', frame: { x: 160, y: 33, width: 16, height: 15 } },
  { id: 'prop-tuft-teal', label: 'Moita Azul-esverdeada', frame: { x: 146, y: 65, width: 13, height: 15 } },
  { id: 'prop-flowerbed-blue', label: 'Canteiro Azul', frame: { x: 96, y: 49, width: 47, height: 15 } },
  { id: 'prop-fern-blue-tall', label: 'Samambaia Azul', frame: { x: 160, y: 51, width: 16, height: 45 } },

  // --- Flores ------------------------------------------------------------
  { id: 'prop-flower-white-cluster', label: 'Flor Branca', frame: { x: 226, y: 34, width: 12, height: 12 } },
  { id: 'prop-flower-white-small', label: 'Flor Branca Pequena', frame: { x: 144, y: 51, width: 15, height: 13 } },
  { id: 'prop-flower-blue-1', label: 'Flor Azul', frame: { x: 176, y: 53, width: 15, height: 11 } },
  { id: 'prop-flower-blue-2', label: 'Flor Azul Clara', frame: { x: 192, y: 53, width: 15, height: 11 } },
  { id: 'prop-flower-pink', label: 'Flor Rosa', frame: { x: 113, y: 67, width: 14, height: 9 } },
  { id: 'prop-flower-purple-crystal', label: 'Flor Cristal', frame: { x: 274, y: 66, width: 12, height: 11 } },

  // --- Especiais -----------------------------------------------------------
  { id: 'prop-fallen-log', label: 'Tronco Caído', frame: { x: 78, y: 152, width: 70, height: 35 }, flat: true },
  { id: 'prop-climbing-vine', label: 'Trepadeira', frame: { x: 66, y: 150, width: 12, height: 40 } },
  { id: 'prop-coral-wall', label: 'Parede de Coral', frame: { x: 0, y: 144, width: 48, height: 16 } },
];
