import { Inventory } from './inventory';
import { GameClock } from './gameClock';

/**
 * Estado do jogo que precisa sobreviver a uma troca de cena de verdade
 * (Sistema de Cenas — pontes/UIScene): até agora, `Inventory` e `GameClock`
 * eram criados dentro de `MainScene.create()` — bom o bastante enquanto só
 * existia uma cena, mas quebraria a `UIScene` persistente pedida agora (o
 * Hotbar/Barra de Dinheiro mostrariam sempre o saldo inicial de novo toda
 * vez que `MainScene` fosse recriada ao voltar de uma ponte).
 *
 * Um único módulo, instanciado uma vez só (nunca recriado enquanto a aba
 * do navegador estiver aberta), em vez de cada `Scene` guardar o seu.
 * **Não é um sistema de save** — nada é gravado em disco/`localStorage`;
 * fechar/recarregar a página ainda reseta tudo. Isso é intencional (o
 * roadmap já tem "Salvamento" como etapa própria, ainda não pedida) — este
 * módulo só resolve "não resetar a cada troca de mapa dentro da mesma
 * sessão", que é o que a `UIScene` precisa pra fazer sentido.
 */
export const gameState = {
  inventory: new Inventory(),
  gameClock: new GameClock(),
};
