import Phaser from 'phaser';
import { CHARACTER_IDS, CharacterId, PLAYER_FRAME_SIZE, PLAYER_ANIM_FRAMES, getPlayerAssets } from '../data/player';

/**
 * Carrega TODAS as folhas do personagem escolhido (idle, andar e cada ação:
 * enxada, pá, regador, foice, machado, picareta, poço, espada, comer) pelas
 * chaves/caminhos de `getPlayerAssets`. Chamado no `preload()` de toda cena
 * que cria um `Player` (Fazenda, mapas externos, Casa) — assim as texturas
 * SEMPRE existem antes de o `Player` ser instanciado, seja qual for o
 * personagem do save. `load.spritesheet` ignora chaves que já estão no
 * cache, então repetir a chamada a cada troca de cena não recarrega nada.
 */
export function preloadPlayerSprites(scene: Phaser.Scene, characterId: CharacterId): void {
  const assets = getPlayerAssets(characterId);

  scene.load.spritesheet(assets.idleKey, encodeURI(`/${assets.idlePath}`), { frameWidth: PLAYER_FRAME_SIZE, frameHeight: PLAYER_FRAME_SIZE });
  scene.load.spritesheet(assets.walkKey, encodeURI(`/${assets.walkPath}`), { frameWidth: PLAYER_FRAME_SIZE, frameHeight: PLAYER_FRAME_SIZE });
  for (const spec of Object.values(assets.actions)) {
    scene.load.spritesheet(spec.key, encodeURI(`/${spec.path}`), { frameWidth: spec.frameSize, frameHeight: spec.frameSize });
  }
}

/** Só o `Idle.png` de cada personagem — o que a Criação de Personagem precisa pra mostrar o preview de todos. */
export function preloadCharacterPreviews(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    const assets = getPlayerAssets(id);
    scene.load.spritesheet(assets.idleKey, encodeURI(`/${assets.idlePath}`), { frameWidth: PLAYER_FRAME_SIZE, frameHeight: PLAYER_FRAME_SIZE });
  }
}

/** Cria (uma vez) a animação de idle "de frente" do preview do personagem e devolve a chave. */
export function ensureCharacterPreviewAnimation(scene: Phaser.Scene, characterId: CharacterId): string {
  const assets = getPlayerAssets(characterId);
  const key = `preview-${assets.animPrefix}-idle-down`;
  if (!scene.anims.exists(key)) {
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(assets.idleKey, PLAYER_ANIM_FRAMES.idleDown),
      frameRate: 4,
      repeat: -1,
    });
  }
  return key;
}
