import Phaser from 'phaser';

/**
 * AS CÉLULAS DE CERCA de cada cena (toda cerca passa por `mapBuilder.placeFenceTile`): embaixo de cerca não nasce grama, flor nem cogumelo.
 * Os detalhes de grama (`systems/grassDetails.ts`) pulam essas células ao nascer e, se a cerca vier depois (a da lavoura, a dos trechos
 * comprados), tiram o que já estava ali (`onFenceCell`). Sem import entre os dois sistemas: cada um só fala com este registro.
 */
interface FenceCellRegistry {
  cells: Set<string>;
  listeners: Array<(col: number, row: number) => void>;
}

const registries = new WeakMap<Phaser.Scene, FenceCellRegistry>();

function registryOf(scene: Phaser.Scene): FenceCellRegistry {
  let registry = registries.get(scene);
  if (!registry) {
    registry = { cells: new Set(), listeners: [] };
    registries.set(scene, registry);
    // A instância da cena é reaproveitada entre `scene.start`: cada abertura começa sem cercas.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => registries.delete(scene));
  }
  return registry;
}

/** Uma cerca foi posta na célula (`col`, `row`). */
export function markFenceCell(scene: Phaser.Scene, col: number, row: number): void {
  const registry = registryOf(scene);
  registry.cells.add(`${col},${row}`);
  for (const listener of registry.listeners) listener(col, row);
}

/** Tem cerca nesta célula (`col,row`)? */
export function isFenceCell(scene: Phaser.Scene, key: string): boolean {
  return registries.get(scene)?.cells.has(key) ?? false;
}

/** Avisa a cada cerca posta DEPOIS desta chamada (na mesma abertura da cena). */
export function onFenceCell(scene: Phaser.Scene, listener: (col: number, row: number) => void): void {
  registryOf(scene).listeners.push(listener);
}
