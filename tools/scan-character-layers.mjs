// Varre as pastas de camadas do personagem no pacote de arte e gera `src/data/characterLayers.generated.ts`: para cada pasta usada pelo
// jogo, um mapa "id normalizado da peça" -> "nome real do arquivo" (relativo à pasta). O instalador serve os assets de dentro de um
// `.asar`, onde maiúsculas e espaços precisam bater exatamente — e o pacote mistura "Santa hat"/"Santa Hat", "Standard"/"Standart",
// "pirate eye patch"/"Pirate eyepatch". Rodar de novo sempre que o pacote mudar:  node tools/scan-character-layers.mjs
import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'assets');
const OUT = join(ROOT, 'src', 'data', 'characterLayers.generated.ts');

/** Pastas usadas (dentro de `assets/`). */
const FOLDERS = [
  'Character/Character/PNG/1. Idle',
  'Character/Character/PNG/2. Walk',
  'Character/Character/PNG/4. Pickaxe, Hoe and Catching insects',
  'Character/Character/PNG/5. Axe and Sickle',
  'Character/Character/PNG/6. Shovel',
  'Character/Character/PNG/7. Watering',
  'Character/Character/PNG/8. SwordAttack',
  'Character/Character/PNG/13.3 Carrying - Pick Up',
  'Character/Character/PNG/18. Setting',
  'Character/Character/PNG/12. Fishing - Cast',
  'Character/Character/PNG/12.1. Fishing - Wait',
  'Character/Character/PNG/12.2. Fishing - Bite',
  'Character/Character/PNG/12.3. Fishing - Reel',
  'Character/Character/PNG/12.4. Fishing - Catch',
  'Character/Character/Portrait/PNG',
];

/** Arquivos soltos do pacote que não são peças (sobras de exportação). */
const IGNORE = /bloco de mapa/i;

/** "Hair's/Standart/Black.png" -> "hair/standard/black". */
export function normalizeLayerId(path) {
  return path
    .replace(/\.png$/i, '')
    .split('/')
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/^hair's$/, 'hair')
        .replace(/^clothers$/, 'clothes')
        .replace(/^skin$/, 'skins')
        .replace(/^standart$/, 'standard')
        .replace(/^pirate eye ?patch$/, 'pirate-eyepatch')
        .replace(/\s+/g, '-'),
    )
    .join('/');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.toLowerCase().endsWith('.png')) out.push(full);
  }
  return out;
}

const table = {};
for (const folder of FOLDERS) {
  const base = join(ASSETS, ...folder.split('/'));
  const map = {};
  for (const file of walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    if (IGNORE.test(rel)) continue;
    const id = normalizeLayerId(rel);
    if (map[id] && map[id] !== rel) throw new Error(`Duas peças com o mesmo id "${id}" em ${folder}: ${map[id]} e ${rel}`);
    map[id] = rel;
  }
  table[folder] = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
}

const header = `// GERADO por tools/scan-character-layers.mjs — não editar à mão (rode o script de novo se o pacote de arte mudar).
// Para cada pasta de camadas do personagem: id normalizado da peça -> nome real do arquivo, relativo à pasta.
`;
writeFileSync(OUT, `${header}export const CHARACTER_LAYER_FILES: Record<string, Record<string, string>> = ${JSON.stringify(table, null, 2)};\n`);
console.log(`Gerado ${relative(ROOT, OUT)}: ${FOLDERS.length} pastas, ${Object.values(table).reduce((sum, map) => sum + Object.keys(map).length, 0)} peças.`);
