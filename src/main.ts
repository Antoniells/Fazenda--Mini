import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { installHackMenu } from './debug/hackMenu';
import { installPlaytestRecorder } from './debug/playtestRecorder';

const game = new Phaser.Game(gameConfig);

// Canvas na CPU: em pixel art o Phaser cria cada canvas do pool já pedindo o contexto 2D acelerado pela GPU (pra desligar a suavização),
// e no Chrome/Electron do Windows enviar dezenas desses canvas pro WebGL de uma vez (os textos dos menus da Fazenda ao entrar nela)
// travava a tela ~1 s — a "tela preta" ao voltar pra Fazenda. Sem o pool pedir o contexto antes, a textura de canvas do Phaser o pede
// com `willReadFrequently` (canvas na CPU), cujo envio é instantâneo. A suavização não faz falta: tudo é copiado 1:1 nos canvas.
const keepCanvasesOnCpu = (): void => Phaser.Display.Canvas.CanvasPool.enableSmoothing();
if (game.isBooted) keepCanvasesOnCpu();
else game.events.once(Phaser.Core.Events.BOOT, keepCanvasesOnCpu);
installHackMenu(game); // Menu de hack (F9) — ferramenta de teste, ver `debug/hackMenu.ts`.
installPlaytestRecorder(game); // Registrador de playtest (só no dev) — ver `debug/playtestRecorder.ts`.
