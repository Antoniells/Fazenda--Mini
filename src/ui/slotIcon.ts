import Phaser from 'phaser';

/**
 * Calcula a escala que encaixa o ícone de um slot (Hotbar/Loja/Inventário)
 * num tamanho-alvo, preservando a proporção original — a partir do frame
 * real já carregado (`icon.frame`), não de um número fixo. Sem isso, um
 * ícone com dimensões nativas maiores que o padrão de 16x16 (ex.: o Poço,
 * 28x38) vaza pra fora do slot. `targetPx` é o tamanho, em pixels de tela,
 * que o lado MAIOR do ícone deve ocupar; quem chama decide se aplica o
 * resultado direto (`icon.setScale(...)`) ou como alvo de uma tween.
 */
export function computeFitScale(icon: Phaser.GameObjects.Image, targetPx: number): number {
  const nativeMax = Math.max(icon.frame.width, icon.frame.height);
  return targetPx / nativeMax;
}
