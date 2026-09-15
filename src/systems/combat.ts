import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';

/** Alcance (px) da hitbox de ataque à frente do jogador, e seu tamanho (quadrado). */
const ATTACK_RANGE_PX = 26;
const ATTACK_SIZE_PX = 42;
/**
 * Desloca o centro vertical da hitbox um pouco ACIMA dos pés do jogador —
 * golpe "na altura do peito", não rente ao chão. Pequeno de propósito: os
 * inimigos (`entities/Enemy.ts`) ficam ancorados pelo próprio CENTRO
 * (`origin` padrão do Phaser, 0.5/0.5), não pelos pés como o jogador — um
 * deslocamento grande (ex.: metade da altura do sprite) fazia a hitbox
 * passar bem ACIMA de um inimigo parado ao lado, testado ao vivo.
 */
const ATTACK_HEIGHT_OFFSET_PX = 12;

/**
 * Área de ataque (Fase 8 — Combate): um retângulo simples na frente do
 * jogador, na direção `facing` recebida — não precisa do grid/pathfinding
 * porque inimigos têm posição livre em pixels (ver `entities/Enemy.ts`),
 * então um teste de overlap geométrico já basta, sem nenhuma célula
 * envolvida.
 *
 * Recebe a direção já pronta (em vez de ler `player.getFacingVector()`
 * aqui dentro) porque quem dispara o golpe (`PlayerController.handleAttackKey`)
 * captura a direção ANTES de chamar `Player.performAction` — a animação só
 * termina de tocar (e só então este código roda, dentro do callback
 * `onApply`) um bom tempo depois, então ler a direção só agora dependeria
 * de o jogador não ter girado entretanto; capturar no instante do golpe é
 * mais direto e não depende de mais nada sobre `performAction`.
 */
export function computeAttackHitbox(player: Player, facing: { dx: number; dy: number }): Phaser.Geom.Rectangle {
  const { dx, dy } = facing;
  const cx = player.sprite.x + dx * ATTACK_RANGE_PX;
  const cy = player.sprite.y - ATTACK_HEIGHT_OFFSET_PX + dy * ATTACK_RANGE_PX;
  return new Phaser.Geom.Rectangle(cx - ATTACK_SIZE_PX / 2, cy - ATTACK_SIZE_PX / 2, ATTACK_SIZE_PX, ATTACK_SIZE_PX);
}

/**
 * Resolve um golpe de espada (Fase 8 — Combate): calcula a hitbox na frente
 * do jogador (direção `facing`, capturada por quem chama ANTES do
 * `performAction` — ver doc de `computeAttackHitbox`) e aplica dano +
 * empurrão em todo inimigo vivo dentro dela — o empurrão sempre na direção
 * jogador→inimigo (normalizada), não na direção que o jogador está olhando,
 * pra golpes "de raspão" empurrarem pro lado certo mesmo perto da borda da
 * hitbox.
 */
export function resolveSwordAttack(player: Player, enemies: Enemy[], damage: number, facing: { dx: number; dy: number }): void {
  const hitbox = computeAttackHitbox(player, facing);
  
  for (const enemy of enemies) {
    if (enemy.isDead()) continue;

    // Pega a caixa de colisão inteira do slime (cabeça até os pés)
    const enemyBounds = enemy.sprite.getBounds();
    
    // NOVA VERIFICAÇÃO: Testa se a caixa do ataque bate na caixa do slime!
    if (!Phaser.Geom.Intersects.RectangleToRectangle(hitbox, enemyBounds)) continue;

    const dx = enemy.x - player.sprite.x;
    const dy = enemy.y - player.sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.takeDamage(damage, dx / distance, dy / distance);
  }
}
