import Phaser from 'phaser';

/**
 * ILUMINAÇÃO NATIVA DO PHASER 4 numa cena (Lights2D — estudo em docs/studies/ILUMINACAO_PHASER4.md): liga o sistema de luzes e faz TODO
 * objeto do mundo receber luz (`setLighting(true)`) — os que já existem e os que nascerem depois (inimigos de onda, loot, poeira, folhas),
 * sempre antes de serem desenhados. A cor de cada um passa a ser multiplicada pela luz ambiente (`scene.lights.setAmbientColor`) somada às
 * luzes (`scene.lights.addLight`). Ficam de fora a interface (`scrollFactor` 0), textos (números de dano e avisos legíveis) e brilhos em ADD
 * (lampião aceso, estrelinhas dos veios — continuam brilhando no escuro). Ao fechar a cena, o Phaser limpa as luzes.
 *
 * Quem usa: o céu da superfície (`systems/dayNightOverlay.ts` — cor do sol por hora) e as Cavernas (`systems/caveLighting.ts`).
 */

/** Este objeto do mundo deve receber a luz? */
export function shouldLight(object: Phaser.GameObjects.GameObject): boolean {
  const candidate = object as Phaser.GameObjects.GameObject & { setLighting?: (enable: boolean) => unknown; scrollFactorX?: number; blendMode?: number | string };
  if (typeof candidate.setLighting !== 'function') return false;
  if (candidate.scrollFactorX === 0) return false; // Interface.
  if (object.type === 'Text' || object.type === 'BitmapText') return false;
  return candidate.blendMode !== Phaser.BlendModes.ADD;
}

const litScenes = new WeakSet<Phaser.Scene>();

/** Liga a luz nativa na cena (uma vez por vida da cena; repetir não faz nada). */
export function enableWorldLighting(scene: Phaser.Scene): void {
  if (litScenes.has(scene)) return;
  litScenes.add(scene);
  scene.lights.enable();

  // O que já existe e o que entrar depois: ligado no PRE_RENDER, quando o `scrollFactor` (que separa mundo × interface) já foi definido.
  const pending: Phaser.GameObjects.GameObject[] = [...scene.children.list];
  const onAdded = (object: Phaser.GameObjects.GameObject): void => {
    pending.push(object);
  };
  const onPreRender = (): void => {
    while (pending.length > 0) {
      const object = pending.pop()!;
      if (object.active && shouldLight(object)) (object as unknown as { setLighting: (enable: boolean) => void }).setLighting(true);
    }
  };
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, onPreRender);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, onPreRender);
    scene.lights.disable();
    litScenes.delete(scene);
  });
}
