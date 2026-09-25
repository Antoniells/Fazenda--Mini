import Phaser from 'phaser';
import { HEALTH_HEARTS_KEY, HEALTH_HEARTS_PATH } from '../data/ui';
import { PET_ANIMS, PET_FRAME_SIZE, PET_IDS, PetAnimName, PetId, getPetDefinition, getPetSleepAnim, getPetTextureKey } from '../data/pets';

/**
 * Carrega a folha do pet escolhido (`gameState.profile.petId`) + o coração do
 * HUD (`UI/Bars.png`, usado no efeito de carinho — arte real, nada desenhado
 * por código). Chamado no `preload()` de toda cena que cria um pet (Fazenda,
 * mapas externos, Casa), pra as texturas sempre existirem antes de o `Pet`
 * nascer. `load.*` ignora chaves que já estão no cache.
 */
export function preloadPet(scene: Phaser.Scene, petId: PetId): void {
  scene.load.spritesheet(getPetTextureKey(petId), encodeURI(`/${getPetDefinition(petId).path}`), {
    frameWidth: PET_FRAME_SIZE,
    frameHeight: PET_FRAME_SIZE,
  });
  scene.load.image(HEALTH_HEARTS_KEY, encodeURI(`/${HEALTH_HEARTS_PATH}`));
}

/** Só a folha de cada pet — o que a Criação de Personagem precisa pra mostrar o preview de todos. */
export function preloadPetPreviews(scene: Phaser.Scene): void {
  for (const id of PET_IDS) {
    scene.load.spritesheet(getPetTextureKey(id), encodeURI(`/${getPetDefinition(id).path}`), {
      frameWidth: PET_FRAME_SIZE,
      frameHeight: PET_FRAME_SIZE,
    });
  }
}

export function petAnimKey(petId: PetId, name: PetAnimName): string {
  return `${getPetTextureKey(petId)}-${name}`;
}

/** Cria (uma vez por `Game` — o gerenciador de animações é global) as animações do pet, com chaves próprias dele. */
export function ensurePetAnimations(scene: Phaser.Scene, petId: PetId): void {
  const textureKey = getPetTextureKey(petId);
  const anims = [...(Object.entries(PET_ANIMS) as Array<[PetAnimName, { frames: number[]; frameRate: number }]>), ['sleep', getPetSleepAnim(petId)] as const];
  for (const [name, { frames, frameRate }] of anims) {
    const key = petAnimKey(petId, name);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: textureKey, frame })),
      frameRate,
      repeat: -1,
    });
  }
}
