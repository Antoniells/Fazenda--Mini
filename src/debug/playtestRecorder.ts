import Phaser from 'phaser';
import { HACK_MENU_ENABLED } from './hackMenu';
import { gameState } from '../systems/gameState';
import { isChestMenuOpen, isDialogueOpen, isFurnaceMenuOpen, isInventoryOpen, isLetterOpen, isPauseMenuOpen } from '../scenes/UIScene';

/**
 * REGISTRADOR DE PLAYTEST (só no `npm run dev`, como o menu de hack): OBSERVA o jogo — não muda regra nenhuma. A cada 250 ms DE JOGO lê o estado
 * (`gameState`, a cena ativa, a animação do personagem) e acumula:
 * - moedas ganhas/gastas, classificadas pelo que mudou junto (venda = moedas sobem e itens saem; compra = moedas descem e itens entram;
 *   recompensa = moedas sobem sem sair item; custo = moedas descem sem entrar item);
 * - itens ganhos/perdidos (colheitas, sementes, madeira, pedra, minérios, peixes...), dano recebido, mortes;
 * - tempo de jogo por atividade (agricultura, coleta, combate, pesca, caminhando, parado, menus) e por área (cena) — medido nos quadros
 *   do Phaser, então vale igual com o jogo rodando sozinho ou "passo a passo";
 * - um retrato a cada virada de dia (moedas, itens, lavoura, vida) e uma linha do tempo de eventos.
 * Console: `__playtest.report()`, `__playtest.reset(nome)`, `__playtest.mark(texto)`. Sobrevive a recarregar a página (localStorage).
 *
 * MODO PASSO A PASSO (pra quem joga por automação, com tempo de reação longo): `pause()` congela o jogo inteiro (relógio, inimigos,
 * animações); `advance(ms)` roda exatamente esse tempo de jogo e congela de novo; `hold(tecla, ms)` segura uma tecla por esse tempo;
 * `press(tecla)` aperta e solta; `resume()` volta ao normal. Assim o "pensar" de quem joga não consome horas do dia nem deixa um inimigo bater.
 */

type Counts = Record<string, number>;

interface DaySnapshot {
  day: number;
  coins: number;
  items: Counts;
  plots: Counts;
  hp: number;
  realMinutes: number;
}

interface PlaytestLog {
  name: string;
  startedAt: number;
  activeMs: number;
  activityMs: Counts;
  sceneMs: Counts;
  coinsIn: Counts;
  coinsOut: Counts;
  gained: Counts;
  lost: Counts;
  damageTaken: number;
  deaths: number;
  days: DaySnapshot[];
  timeline: string[];
}

const STORAGE_KEY = 'mini-fazenda-playtest';
const SAMPLE_MS = 250;
/** Cenas que não são "lugar do mundo" (interface, menus de entrada). */
const NON_WORLD_SCENES = new Set(['UIScene', 'MainMenuScene', 'CharacterCreationScene', 'IntroScene', 'MapEditorScene']);

function emptyLog(name: string): PlaytestLog {
  return { name, startedAt: Date.now(), activeMs: 0, activityMs: {}, sceneMs: {}, coinsIn: {}, coinsOut: {}, gained: {}, lost: {}, damageTaken: 0, deaths: 0, days: [], timeline: [] };
}

function add(counts: Counts, key: string, amount: number): void {
  counts[key] = (counts[key] ?? 0) + amount;
}

/** Todos os itens contáveis do jogador, com prefixo da categoria (colheita, semente, recurso, decoração). */
function itemCounts(): Counts {
  const data = gameState.inventory.serialize();
  const counts: Counts = {};
  for (const [prefix, group] of [['crop', data.items], ['seed', data.seeds], ['res', data.resources], ['decor', data.decorations]] as const) {
    for (const [id, amount] of Object.entries(group)) if (amount > 0) counts[`${prefix}:${id}`] = amount;
  }
  return counts;
}

function plotCounts(): Counts {
  const counts: Counts = {};
  for (const plot of gameState.farmland.getAllPlots()) {
    const ready = plot.state === 'growing' && gameState.farmland.isReady(plot);
    add(counts, ready ? 'ready' : plot.state, 1);
  }
  return counts;
}

function worldScene(game: Phaser.Game): Phaser.Scene | null {
  return game.scene.getScenes(true).find((scene) => !NON_WORLD_SCENES.has(scene.scene.key)) ?? null;
}

/** Atividade do momento, pela animação que o personagem está tocando (ou por um menu aberto). */
function activityOf(scene: Phaser.Scene | null): string {
  if (isPauseMenuOpen()) return 'pausa';
  if (isInventoryOpen() || isChestMenuOpen() || isFurnaceMenuOpen() || isDialogueOpen() || isLetterOpen()) return 'menu';
  const player = (scene as unknown as { player?: { sprite?: Phaser.GameObjects.Sprite } } | null)?.player;
  const key = player?.sprite?.anims?.currentAnim?.key ?? '';
  if (!key) return scene ? 'sem personagem' : 'fora do jogo';
  if (/fish/.test(key)) return 'pesca';
  if (/pickaxe|axe/.test(key)) return 'coleta';
  if (/sword/.test(key)) return 'combate';
  if (/hoe|shovel|plant|water|sickle|harvest|pickup/.test(key)) return 'agricultura';
  if (/walk/.test(key)) return 'caminhando';
  return 'parado';
}

export function installPlaytestRecorder(game: Phaser.Game): void {
  if (!HACK_MENU_ENABLED || typeof window === 'undefined') return;

  let log: PlaytestLog = emptyLog('sessão');
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) log = JSON.parse(saved) as PlaytestLog;
  } catch {
    // Sem armazenamento: o registro vale só pra esta página.
  }

  let lastCoins: number | null = null;
  let lastItems: Counts = {};
  let lastHp: number | null = null;
  let lastDay: number | null = null;
  let lastHorde = false;
  let lastScene = '';
  let lastSave = 0;
  let sampleClock = 0;

  const note = (text: string): void => {
    log.timeline.push(`[dia ${gameState.gameClock.getDay()} ${formatHour(gameState.gameClock.getHours())}] ${text}`);
  };
  const persist = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {
      // Sem armazenamento.
    }
  };

  const sample = (): void => {
    const scene = worldScene(game);
    const sceneKey = scene?.scene.key ?? '(menu)';
    const inGame = scene !== null;
    if (inGame) {
      log.activeMs += SAMPLE_MS;
      add(log.activityMs, activityOf(scene), SAMPLE_MS);
      add(log.sceneMs, sceneKey, SAMPLE_MS);
    }
    if (sceneKey !== lastScene) {
      if (inGame) note(`cena: ${sceneKey}`);
      lastScene = sceneKey;
    }
    if (!inGame) return;

    const coins = gameState.inventory.getCoins();
    const items = itemCounts();
    let itemsIn = 0;
    let itemsOut = 0;
    const changes: string[] = [];
    if (lastCoins !== null) {
      for (const id of new Set([...Object.keys(items), ...Object.keys(lastItems)])) {
        const delta = (items[id] ?? 0) - (lastItems[id] ?? 0);
        if (delta > 0) {
          add(log.gained, id, delta);
          itemsIn += delta;
        } else if (delta < 0) {
          add(log.lost, id, -delta);
          itemsOut -= delta;
        }
        if (delta !== 0) changes.push(`${delta > 0 ? '+' : ''}${delta} ${id}`);
      }
      const coinDelta = coins - lastCoins;
      if (coinDelta > 0) add(log.coinsIn, itemsOut > 0 ? 'venda' : 'recompensa', coinDelta);
      if (coinDelta < 0) add(log.coinsOut, itemsIn > 0 ? 'compra' : 'custo', -coinDelta);
      if (coinDelta !== 0) changes.unshift(`${coinDelta > 0 ? '+' : ''}${coinDelta} moedas`);
      if (changes.length > 0) note(`${sceneKey}: ${changes.join(', ')}`);
    }
    lastCoins = coins;
    lastItems = items;

    const hp = gameState.playerHealth.getHp();
    if (lastHp !== null && hp < lastHp) {
      log.damageTaken += lastHp - hp;
      if (hp <= 0) {
        log.deaths += 1;
        note(`MORREU em ${sceneKey}`);
      }
    }
    lastHp = hp;

    if (gameState.horde.active !== lastHorde) {
      note(gameState.horde.active ? `HORDA ${gameState.horde.number} começou (${gameState.horde.total} inimigos)` : `horda terminou (${gameState.horde.killed}/${gameState.horde.total} derrotados)`);
      lastHorde = gameState.horde.active;
    }

    const day = gameState.gameClock.getDay();
    if (day !== lastDay) {
      log.days.push({ day, coins, items, plots: plotCounts(), hp, realMinutes: Math.round(log.activeMs / 600) / 100 });
      lastDay = day;
    }

    if (Date.now() - lastSave > 5000) {
      persist();
      lastSave = Date.now();
    }
  };

  // Amostra pelo tempo de JOGO (os quadros do Phaser), não pelo relógio da parede.
  game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) => {
    sampleClock += delta;
    while (sampleClock >= SAMPLE_MS) {
      sampleClock -= SAMPLE_MS;
      sample();
    }
  });

  // ---------- modo passo a passo ----------
  const FRAME_MS = 1000 / 60;
  let virtualTime = 0;
  let paused = false;
  const keyEvent = (type: 'keydown' | 'keyup', key: string): void => {
    const code = key.length === 1 ? (/[0-9]/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`) : key;
    const keyCode = key.length === 1 ? key.toUpperCase().charCodeAt(0) : ({ Space: 32, Escape: 27, Enter: 13, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, F9: 120 } as Record<string, number>)[key] ?? 0;
    window.dispatchEvent(new KeyboardEvent(type, { key: key === 'Space' ? ' ' : key, code, keyCode, bubbles: true }));
  };
  /** Roda `ms` de jogo em quadros de 60 fps (em blocos, pra página continuar respondendo); só o último quadro é desenhado. */
  const advance = async (ms: number): Promise<void> => {
    if (!paused) {
      await new Promise((resolve) => window.setTimeout(resolve, ms));
      return;
    }
    let frames = Math.round(ms / FRAME_MS);
    while (frames > 0) {
      const batch = Math.min(frames, 30);
      for (let index = 0; index < batch; index++) {
        virtualTime += FRAME_MS;
        // Só o último quadro é desenhado: os outros rodam a lógica sem renderizar (bem mais rápido sem GPU).
        if (frames - index === 1) game.step(virtualTime, FRAME_MS);
        else {
          game.headlessStep(virtualTime, FRAME_MS);
          // A câmera acompanha o personagem na etapa de desenho (que o passo sem desenho pula): atualiza à mão.
          for (const scene of game.scene.getScenes(true)) for (const camera of scene.cameras.cameras) camera.preRender();
        }
      }
      frames -= batch;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  };

  const AUTO_PAUSE_KEY = 'mini-fazenda-playtest-autopause';
  const pauseNow = (): void => {
    if (paused) return;
    paused = true;
    virtualTime = game.loop.now;
    game.loop.sleep();
  };
  // Playtest por automação: a página já abre pausada (recarregar não deixa o jogo rodando solto, sem ninguém jogando).
  try {
    if (window.localStorage.getItem(AUTO_PAUSE_KEY) === '1') game.events.once(Phaser.Core.Events.READY, () => window.setTimeout(pauseNow, 0));
  } catch {
    // Sem armazenamento.
  }

  (window as unknown as { __playtest: unknown }).__playtest = {
    /** Resumo: tempo por atividade/área (em % e minutos reais), moedas por origem, itens, dano, dias e a linha do tempo. */
    report: () => {
      const percent = (counts: Counts): Counts =>
        Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, ms]) => [key, Math.round((1000 * ms) / Math.max(1, log.activeMs)) / 10]));
      return {
        name: log.name,
        realMinutes: Math.round(log.activeMs / 600) / 100,
        activityPercent: percent(log.activityMs),
        scenePercent: percent(log.sceneMs),
        coinsIn: log.coinsIn,
        coinsOut: log.coinsOut,
        gained: log.gained,
        lost: log.lost,
        damageTaken: log.damageTaken,
        deaths: log.deaths,
        days: log.days,
        timeline: log.timeline,
      };
    },
    reset: (name = 'sessão') => {
      log = emptyLog(name);
      lastCoins = null;
      lastHp = null;
      lastDay = null;
      persist();
    },
    mark: (text: string) => note(`NOTA: ${text}`),
    pause: pauseNow,
    /** Liga/desliga abrir a página já pausada. */
    autoPause: (on: boolean) => {
      try {
        window.localStorage.setItem(AUTO_PAUSE_KEY, on ? '1' : '0');
      } catch {
        // Sem armazenamento.
      }
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      game.loop.wake();
    },
    isPaused: () => paused,
    /** Imagem do jogo agora (PNG em data URL): com o jogo pausado, roda 1 quadro e copia o canvas no mesmo passo. */
    snapshot: () => {
      if (paused) {
        virtualTime += FRAME_MS;
        game.step(virtualTime, FRAME_MS);
      }
      return game.canvas.toDataURL('image/png');
    },
    /** Cenas ativas agora (inclusive menus). */
    scenes: () => game.scene.getScenes(true).map((scene) => scene.scene.key),
    /** A cena do mundo ativa (pra INSPECIONAR estado — não usar pra agir no lugar do jogador). */
    scene: () => worldScene(game),
    /** Converte uma célula do mundo na posição do clique na página (pra clicar nela como o jogador). */
    cellToPage: (col: number, row: number) => {
      const scene = worldScene(game);
      if (!scene) return null;
      const cam = scene.cameras.main;
      const rect = game.canvas.getBoundingClientRect();
      const sx = ((col + 0.5) * 32 - cam.worldView.x) * cam.zoom;
      const sy = ((row + 0.5) * 32 - cam.worldView.y) * cam.zoom;
      return { x: Math.round(rect.left + (sx * rect.width) / game.canvas.width), y: Math.round(rect.top + (sy * rect.height) / game.canvas.height) };
    },
    advance,
    hold: async (key: string, ms: number) => {
      keyEvent('keydown', key);
      await advance(ms);
      keyEvent('keyup', key);
      await advance(FRAME_MS * 2);
    },
    press: async (key: string) => {
      keyEvent('keydown', key);
      await advance(FRAME_MS * 3);
      keyEvent('keyup', key);
      await advance(FRAME_MS * 3);
    },
    /** Um retrato rápido: dia, hora, moedas, vida, cena, posição do personagem e a Hotbar. */
    state: () => {
      const scene = worldScene(game);
      const player = (scene as unknown as { player?: { sprite?: Phaser.GameObjects.Sprite } } | null)?.player;
      const data = gameState.inventory.serialize();
      return {
        day: gameState.gameClock.getDay(),
        hour: formatHour(gameState.gameClock.getHours()),
        coins: data.coins,
        hp: gameState.playerHealth.getHp(),
        scene: scene?.scene.key ?? '(menu)',
        player: player?.sprite ? { x: Math.round(player.sprite.x), y: Math.round(player.sprite.y), col: Math.floor(player.sprite.x / 32), row: Math.floor(player.sprite.y / 32) } : null,
        hotbar: data.slots.slice(0, 8).map((slot) => (slot ? `${slot.category}:${slot.id}` : null)),
        selected: data.selectedHotbarIndex,
        plots: plotCounts(),
      };
    },
  };
}

function formatHour(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
