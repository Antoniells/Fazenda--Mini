import Phaser from 'phaser';
import { ALL_SOUND_EFFECTS, SoundEffectDef, STEP_GRASS_SOUNDS, STEP_BRIDGE_SOUND, CLICK_SOUND } from '../data/audio';
import { getEffectsVolume } from './audioSettings';

/**
 * Efeitos sonoros curtos (passos, dano, colheita, enxada, cliques). O
 * gerenciador de som do Phaser é GLOBAL (por `Game`, não por cena) e o cache
 * de áudio também — então carregar uma vez no boot (`preloadSoundEffects`,
 * chamado pelo Menu Principal) basta pra qualquer cena tocar depois. Falhas
 * de áudio (arquivo não carregado, navegador sem áudio) nunca quebram o
 * jogo: o efeito só não toca. O volume final é o base de cada som
 * (`data/audio.ts`) vezes o ajuste do jogador (`audioSettings`).
 */
export function preloadSoundEffects(scene: Phaser.Scene): void {
  for (const effect of ALL_SOUND_EFFECTS) {
    scene.load.audio(effect.key, encodeURI(`/${effect.path}`));
  }
}

export function playEffect(scene: Phaser.Scene, effect: SoundEffectDef): void {
  const volume = effect.volume * getEffectsVolume();
  if (volume <= 0 || !scene.cache.audio.exists(effect.key)) return;
  scene.sound.play(effect.key, { volume, seek: effect.seek ?? 0 });
}

/** Toca um dos sons da lista, sorteado (ex.: as duas variações da enxada). */
export function playRandomEffect(scene: Phaser.Scene, effects: SoundEffectDef[]): void {
  playEffect(scene, Phaser.Utils.Array.GetRandom(effects));
}

/** Clique de botão de interface — chamado no `pointerdown` de cada botão (não dá pra ouvir isso num ponto só: os botões usam `stopPropagation`, que corta o evento global de clique da cena). */
export function playClick(scene: Phaser.Scene): void {
  playEffect(scene, CLICK_SOUND);
}

export type StepSurface = 'grass' | 'bridge';

/**
 * Passos: toca um som a cada célula que o jogador pisa, escutando o mesmo
 * `player-stepped` que já anima mato/plantação (`PlayerController` emite ao
 * COMEÇAR cada passo — vale igual pra teclado e pra rota do clique). A cena
 * diz qual chão é aquele (`surfaceAt`): hoje só grama e a célula da ponte de
 * transição. Na grama sorteia uma das variações, nunca a mesma duas vezes
 * seguidas (senão o "tá-tá-tá" fica robótico). O listener sai junto com a
 * cena (`shutdown`), pra não acumular a cada `scene.start`.
 */
export function attachFootstepSounds(scene: Phaser.Scene, surfaceAt: (col: number, row: number) => StepSurface): void {
  let lastGrassIndex = -1;

  const onStep = (col: number, row: number): void => {
    if (surfaceAt(col, row) === 'bridge') {
      playEffect(scene, STEP_BRIDGE_SOUND);
      return;
    }
    let index = Phaser.Math.Between(0, STEP_GRASS_SOUNDS.length - 1);
    if (index === lastGrassIndex) index = (index + 1) % STEP_GRASS_SOUNDS.length;
    lastGrassIndex = index;
    playEffect(scene, STEP_GRASS_SOUNDS[index]);
  };
  scene.events.on('player-stepped', onStep);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off('player-stepped', onStep));
}
