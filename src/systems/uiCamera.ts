import Phaser from 'phaser';

type Scrollable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor;

/** Marca (com `setData`) um objeto de tela cheia que deve ficar na câmera do MUNDO mesmo com `scrollFactor` 0 — o véu da noite (`systems/dayNightOverlay.ts`): coberto pelo zoom, continua cobrindo a tela e escurece também o que está por cima (textos flutuantes). */
export const KEEP_ON_WORLD_CAMERA = 'keepOnWorldCamera';

/**
 * Câmera de INTERFACE para cenas de mapa com zoom no mundo (`systems/cameraSetup.ts`). Vários menus e avisos são desenhados na
 * própria cena do mapa, com `scrollFactor` 0 (Loja, Pausa, Caixa de Remessas, aviso "DIA n", contador da horda, título das
 * áreas…) — a câmera principal os AMPLIARIA junto com o mundo (e o zoom empurra o que fica perto da borda pra fora da tela, como o
 * aviso de topo, além de embaçar todo texto). Esta segunda câmera (zoom 1, mesmo tamanho da janela) desenha SÓ os objetos de tela
 * (scrollFactor 0); a principal desenha só o mundo. A classificação é automática — a cada frame, todo objeto novo da cena é
 * atribuído a uma das duas câmeras conforme o `scrollFactor` dele — então nenhum sistema precisa saber que ela existe (o clique
 * também acerta: cada câmera só considera os objetos que ela desenha). Quem consulta `cameras.main.zoom` continua certo: o zoom
 * é só do mundo.
 */
export function installUiCamera(scene: Phaser.Scene): void {
  const main = scene.cameras.main;
  const ui = scene.cameras.add(0, 0, main.width, main.height, false, 'world-ui');
  /** true = desenhado pela câmera de UI; false = pelo mundo. */
  const assignment = new WeakMap<Phaser.GameObjects.GameObject, boolean>();

  const sweep = (): void => {
    for (const child of scene.children.list) {
      const obj = child as Scrollable;
      const isUi = obj.scrollFactorX === 0 && obj.scrollFactorY === 0 && !obj.getData(KEEP_ON_WORLD_CAMERA);
      const known = assignment.get(obj);
      if (known === isUi) continue;

      assignment.set(obj, isUi);
      // `cameraFilter` é a máscara das câmeras que IGNORAM o objeto: o de interface é ignorado pela principal; o de mundo, pela de UI.
      // (Um contêiner ignorado por uma câmera some inteiro dela, filhos incluídos.)
      if (isUi) obj.cameraFilter = (obj.cameraFilter & ~ui.id) | main.id;
      else obj.cameraFilter = (obj.cameraFilter & ~main.id) | ui.id;
    }
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, sweep);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, sweep));
}
