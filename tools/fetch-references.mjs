// Monta (ou atualiza) a BIBLIOTECA DE REFERÊNCIA em `reference-projects/` — repositórios de terceiros, só pra estudo, fora do git
// (ver docs/REFERENCE_GUIDE.md: o que cada um ensina, por sistema, e as regras de uso). Clones rasos e filtrados: só o que serve pra ler
// código (sem histórico, sem binários grandes; o catálogo de assets vem sem a arte, que fica no Git LFS).
//   node tools/fetch-references.mjs            -> clona o que falta
//   node tools/fetch-references.mjs --update   -> também atualiza os que já existem
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'reference-projects');
const UPDATE = process.argv.includes('--update');

/** pasta (dentro de reference-projects/) -> repositório e como clonar. */
const REFERENCES = [
  { dir: 'phaser/phaser-examples', repo: 'phaserjs/examples', args: ['--filter=blob:none', '--sparse'], sparse: ['public/src'] },
  { dir: 'phaser/elemental-farm', repo: 'devshareacademy/elemental-farm' },
  { dir: 'phaser/farming-rpg', repo: 'Blockost/farming-rpg' },
  { dir: 'farming/Serfdom', repo: 'joshmitcho/Serfdom' },
  { dir: 'farming/FarmSim', repo: 'nova-denton-parry/farmsim-godot', args: ['--filter=blob:limit=1m'] },
  { dir: 'farming/Harvest-Haven', repo: 'gabrield67/Harvest-Haven', args: ['--filter=blob:limit=1m'] },
  { dir: 'farming/ArmprodValley', repo: 'armprod/ArmprodValley' },
  { dir: 'graphics/jam-ready-assets', repo: 'series-ai/jam-ready-assets', env: { GIT_LFS_SKIP_SMUDGE: '1' } },
  { dir: 'audio/free-game-dev-resources', repo: 'jjones26/free-and-open-source-game-dev-resources' },
  { dir: 'gamefeel/hitstop', repo: 'wrwcmaster/hitstop' },
];

const git = (args, cwd, env = {}) => execFileSync('git', args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

for (const ref of REFERENCES) {
  const target = join(ROOT, ref.dir);
  if (existsSync(target)) {
    if (!UPDATE) {
      console.log(`já existe: ${ref.dir}`);
      continue;
    }
    console.log(`atualizando: ${ref.dir}`);
    git(['pull', '--depth', '1', '--ff-only'], target, ref.env);
    continue;
  }
  console.log(`clonando: ${ref.repo} -> ${ref.dir}`);
  mkdirSync(dirname(target), { recursive: true });
  git(['clone', '--depth', '1', ...(ref.args ?? []), `https://github.com/${ref.repo}.git`, target], ROOT, ref.env);
  if (ref.sparse) git(['sparse-checkout', 'set', ...ref.sparse], target);
}
console.log('Biblioteca pronta em reference-projects/ (ver docs/REFERENCE_GUIDE.md).');
