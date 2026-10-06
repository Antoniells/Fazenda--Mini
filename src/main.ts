import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { installHackMenu } from './debug/hackMenu';
import { installPlaytestRecorder } from './debug/playtestRecorder';

const game = new Phaser.Game(gameConfig);
installHackMenu(game); // Menu de hack (F9) — ferramenta de teste, ver `debug/hackMenu.ts`.
installPlaytestRecorder(game); // Registrador de playtest (só no dev) — ver `debug/playtestRecorder.ts`.
