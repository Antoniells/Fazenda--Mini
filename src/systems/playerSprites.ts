import Phaser from 'phaser';
import { CharacterId, PlayerLook, PLAYER_FRAME_SIZE, getPlayerAssets, getFishingSheets, FISHING_FRAME_SIZE } from '../data/player';
import { preloadCharacterLook } from './characterComposer';

/**
 * Carrega TODAS as folhas do personagem escolhido (idle, andar e cada ação:
 * enxada, pá, regador, foice, machado, picareta, poço, espada, comer) pelas
 * chaves/caminhos de `getPlayerAssets`. Chamado no `preload()` de toda cena
 * que cria um `Player` (Fazenda, mapas externos, Casa) — assim as texturas
 * SEMPRE existem antes de o `Player` ser instanciado, seja qual for o
 * personagem do save. `load.spritesheet` ignora chaves que já estão no
 * cache, então repetir a chamada a cada troca de cena não recarrega nada.
 */
export function preloadPlayerSprites(scene: Phaser.Scene, look: PlayerLook | CharacterId): void {
  const assets = getPlayerAssets(look);
  // Personagem personalizado: as folhas são montadas das camadas (mesmas chaves e formato) — `systems/characterComposer.ts`.
  if (assets.composed) {
    preloadCharacterLook(scene, assets.composed);
    return;
  }

  scene.load.spritesheet(assets.idleKey, encodeURI(`/${assets.idlePath}`), { frameWidth: PLAYER_FRAME_SIZE, frameHeight: PLAYER_FRAME_SIZE });
  scene.load.spritesheet(assets.walkKey, encodeURI(`/${assets.walkPath}`), { frameWidth: PLAYER_FRAME_SIZE, frameHeight: PLAYER_FRAME_SIZE });
  for (const spec of Object.values(assets.actions)) {
    scene.load.spritesheet(spec.key, encodeURI(`/${spec.path}`), { frameWidth: spec.frameSize, frameHeight: spec.frameSize });
  }
  // Pesca: imagens inteiras, recortadas em `ensureFishingAnimations` (uma das folhas não segue a grade — ver `getFishingSheets`).
  for (const spec of Object.values(getFishingSheets(look))) {
    if (!scene.textures.exists(spec.key)) scene.load.image(spec.key, encodeURI(`/${spec.path}`));
  }
}

const FISHING_DIRECTIONS = ['down', 'up', 'side'] as const;

/**
 * Animações da PESCA (`<chave da folha>-<down|up|side>`): recorta cada quadro de 64x64 da folha (na linha certa, `rowOffsets`) e cria a
 * animação uma vez (o gerenciador de animações é global). Chamado por quem começa uma pescaria (`systems/fishingSession.ts`).
 */
export function ensureFishingAnimations(scene: Phaser.Scene, look: PlayerLook | CharacterId): void {
  for (const spec of Object.values(getFishingSheets(look))) {
    const texture = scene.textures.get(spec.key);
    const rows = spec.rowOffsets ?? [0, FISHING_FRAME_SIZE, FISHING_FRAME_SIZE * 2];
    FISHING_DIRECTIONS.forEach((direction, rowIndex) => {
      const animKey = `${spec.key}-${direction}`;
      if (scene.anims.exists(animKey)) return;
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let index = 0; index < spec.frames; index += 1) {
        const name = `${direction}-${index}`;
        if (!texture.has(name)) texture.add(name, 0, index * FISHING_FRAME_SIZE, rows[rowIndex], FISHING_FRAME_SIZE, FISHING_FRAME_SIZE);
        frames.push({ key: spec.key, frame: name });
      }
      scene.anims.create({ key: animKey, frames, frameRate: spec.frameRate, repeat: spec.repeat });
    });
  }
}
