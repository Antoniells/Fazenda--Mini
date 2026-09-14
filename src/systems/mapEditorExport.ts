import { TILE_SIZE } from '../data/tiles';

/**
 * Estado "puro" (sem nada do Phaser) que o `MapEditorScene` mantém enquanto
 * o usuário pinta — só os dados necessários pra gerar o `FarmMapData`.
 * Separado da cena pra a lógica de exportação poder ser testada/lida sem
 * depender de nenhum game object.
 */
export interface EditorExportState {
  cols: number;
  rows: number;
  treePositions: Array<[number, number]>;
  farmlandArea: Array<[number, number]>;
  /** Não existe campo equivalente em `FarmMapData` — ver comentário gerado abaixo. */
  fencePositions: Array<[number, number]>;
  shopPosition: [number, number] | null;
  shippingBinPosition: [number, number] | null;
}

function formatCoordArray(cells: Array<[number, number]>, indent: string): string {
  if (cells.length === 0) return '[]';
  const rows = cells.map(([col, row]) => `${indent}  [${col}, ${row}],`).join('\n');
  return `[\n${rows}\n${indent}]`;
}

/**
 * Gera o texto TypeScript de um `FarmMapData`, pronto pra colar em
 * `data/maps/farmMap.ts` no lugar do objeto `farmMap` atual.
 *
 * Só preenche de verdade os campos que o editor tem ferramenta pra pintar
 * (ver `MapEditorScene`): árvores, terra arável, loja e caixa de remessas.
 * Dois campos obrigatórios da interface não têm ferramenta própria aqui —
 * por pedido explícito, o editor não cuida de casa nem de expansões — então
 * saem como placeholder óbvio (`TODO`) em vez de um valor inventado, pra
 * nunca colar por engano algo errado sem o usuário perceber.
 *
 * "Cerca" também é pintável no editor, mas não é um campo de `FarmMapData`:
 * o jogo desenha a cerca sozinho, a partir de `farmlandArea` e dos limites
 * do núcleo (ver `getFarmlandFenceLayout`). As células de cerca pintadas
 * saem como comentário, só como guia visual de onde o usuário desenhou.
 */
export function exportFarmMapData(state: EditorExportState): string {
  const lines: string[] = [];

  lines.push('// Gerado pelo MapEditorScene — cole dentro de data/maps/farmMap.ts,');
  lines.push('// substituindo o objeto `farmMap` atual. Revise os TODOs antes de usar.');
  lines.push('export const farmMap: FarmMapData = {');
  lines.push(`  tileSize: ${TILE_SIZE},`);
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push('  // Expansões não têm ferramenta no editor — ajuste manualmente.');
  lines.push('  expansions: [],');
  lines.push(`  treePositions: ${formatCoordArray(state.treePositions, '  ')},`);
  lines.push(`  farmlandArea: ${formatCoordArray(state.farmlandArea, '  ')},`);

  const shippingBin = state.shippingBinPosition;
  lines.push(
    `  shippingBinPosition: ${
      shippingBin ? `[${shippingBin[0]}, ${shippingBin[1]}]` : '[0, 0], // TODO: posicione a Caixa de Remessas'
    }${shippingBin ? ',' : ''}`,
  );

  const shop = state.shopPosition;
  lines.push(
    `  shopPosition: ${
      shop ? `[${shop[0]}, ${shop[1]}]` : '[0, 0], // TODO: posicione a Loja'
    }${shop ? ',' : ''}`,
  );

  lines.push('  // Casa não tem ferramenta no editor (fora do escopo pedido) — ajuste manualmente,');
  lines.push('  // ou copie o bloco `housePosition`/`houseDoorPosition` do farmMap.ts atual.');
  lines.push('  housePosition: { col0: 0, row0: 0, cols: PLAYER_HOUSE_TILE_COLS, rows: PLAYER_HOUSE_TILE_ROWS }, // TODO');
  lines.push('  houseDoorPosition: [0, 0], // TODO');
  lines.push('};');

  if (state.fencePositions.length > 0) {
    lines.push('');
    lines.push('// "Cerca" pintada no editor — isto NÃO é um campo de FarmMapData: o jogo');
    lines.push('// desenha a cerca sozinho a partir de farmlandArea/limites do núcleo (ver');
    lines.push('// getFarmlandFenceLayout em data/maps/farmMap.ts). Guia visual apenas:');
    lines.push(`// ${JSON.stringify(state.fencePositions)}`);
  }

  return lines.join('\n');
}
