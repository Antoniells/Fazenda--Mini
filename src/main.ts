import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { installHackMenu } from './debug/hackMenu';

const game = new Phaser.Game(gameConfig);
installHackMenu(game); // Menu de hack (F9) — ferramenta de teste, ver `debug/hackMenu.ts`.
