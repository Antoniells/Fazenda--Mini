import { app, BrowserWindow, ipcMain, IpcMainEvent, Menu, net, protocol, screen } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

/**
 * Processo principal do Electron (Fase 10 — Desktop). Quatro responsabilidades:
 *
 * 1. Janela do jogo: 16:9 (o jogo é 1280x720, ver `src/config/gameConfig.ts`),
 *    sem menu nativo, não redimensionável (redimensionar quebraria a escala
 *    da pixel art), com F11 / Alt+Enter para tela cheia. O jogo abre em
 *    TELA CHEIA por padrão (ver `readFullscreenPreference`).
 * 2. Servir o jogo: em desenvolvimento carrega o servidor do Vite; empacotado,
 *    serve a pasta `dist` pelo protocolo `app://` (ver `registerAppProtocol`
 *    — o jogo carrega assets por caminho absoluto, `/UI/...`, que não
 *    funcionaria sob `file://`).
 * 3. Save em disco: ponte de IPC (`storage:*`) usada pelo
 *    `ElectronStorageAdapter` do jogo (ver `src/systems/storageAdapter.ts`).
 *    Grava em `Documentos/Mini Fazenda/`.
 * 4. Tela cheia: F11 / Alt+Enter e o botão das Configurações do jogo
 *    (`display:*`) mexem na MESMA janela nativa; a preferência fica em
 *    `display_prefs.json` (mesma pasta). Sem preferência salva = tela cheia.
 *
 * Este arquivo é `.cts` (vira `dist-electron/main.cjs`) porque o
 * `package.json` do projeto é `"type": "module"`, e o Electron carrega o
 * processo principal e o preload (sandbox) como CommonJS.
 */

// --- Configuração -----------------------------------------------------------

/** `electron . --dev` (script `dev:electron`): carrega o servidor do Vite em vez da pasta `dist`. */
const isDev = process.argv.includes('--dev');
const DEV_SERVER_URL = 'http://localhost:5173';

const APP_SCHEME = 'app';
const APP_HOST = 'game';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Resolução interna do jogo (`gameConfig.ts`) — a janela mantém sempre esta proporção 16:9. */
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
/** Escalas candidatas pra janela, da maior pra menor: usa a maior que cabe na área útil da tela. */
const WINDOW_SCALES = [1.5, 1.25, 1, 0.75, 0.5];
/** Fração da área útil que a janela pode ocupar (sobra espaço pra barra de título e barra de tarefas). */
const SCREEN_FILL = 0.88;

/** Pasta do save: `Documentos/Mini Fazenda`. `MINI_FAZENDA_SAVE_DIR` só existe pra testes não sujarem a pasta real. */
function getSaveDirectory(): string {
  return process.env.MINI_FAZENDA_SAVE_DIR ?? path.join(app.getPath('documents'), 'Mini Fazenda');
}

// O protocolo precisa ser registrado ANTES do `app.whenReady()`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    // `standard`/`secure`: comporta-se como uma origem web normal (fetch/XHR do Phaser).
    // `stream`: necessário pro <audio> das músicas tocar em streaming.
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// --- Protocolo app:// (produção) -----------------------------------------------

/** Áudio precisa de respostas parciais (`Range`) pra o <audio> pular/retomar faixas longas em streaming. */
const AUDIO_MIME_TYPES: Record<string, string> = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

/** Responde um pedido `Range: bytes=a-b` de um arquivo de áudio com 206 (ou 416 se o intervalo for inválido). */
function serveAudioRange(filePath: string, rangeHeader: string): Response {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  let size = 0;
  try {
    size = fs.statSync(filePath).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!match || (match[1] === '' && match[2] === '')) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });

  // "bytes=-N" = os últimos N bytes; "bytes=a-" = de a até o fim; "bytes=a-b" = intervalo.
  const start = match[1] === '' ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });

  const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as BodyInit;
  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()],
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

function registerAppProtocol(): void {
  const distDir = path.join(app.getAppPath(), 'dist');

  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });

    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(distDir, relative));

    // Nunca sai da pasta `dist` (ex.: `app://game/../../algo`).
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    const range = request.headers.get('range');
    if (range && path.extname(filePath).toLowerCase() in AUDIO_MIME_TYPES) return serveAudioRange(filePath, range);

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// --- Preferência de tela cheia ---------------------------------------------------------

/** `_` nunca aparece numa chave de save (só `[a-z0-9-]`), então nenhuma chave gera este nome. */
const DISPLAY_FILE = 'display_prefs.json';

/** Última escolha do jogador (`display_prefs.json`); sem arquivo/ilegível (primeira execução) = TELA CHEIA. */
function readFullscreenPreference(): boolean {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(getSaveDirectory(), DISPLAY_FILE), 'utf8')) as { fullscreen?: unknown };
    return data.fullscreen !== false;
  } catch {
    return true;
  }
}

function writeFullscreenPreference(fullscreen: boolean): void {
  try {
    fs.mkdirSync(getSaveDirectory(), { recursive: true });
    fs.writeFileSync(path.join(getSaveDirectory(), DISPLAY_FILE), JSON.stringify({ fullscreen }), 'utf8');
  } catch (error) {
    console.error('Não foi possível gravar a preferência de tela cheia.', error);
  }
}

// --- Save em disco (IPC) -----------------------------------------------------------

/** Limite de tamanho de um arquivo de save — saves reais têm poucos KB; isto só barra lixo. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Chave usada pelo jogo (`SaveManager`/`audioSettings`) -> nome do arquivo.
 * Lista fechada de propósito: o renderer NUNCA escolhe um caminho, só uma
 * chave, e chave fora do formato é recusada (sem `..`, `/`, `\`, `.`).
 *
 * - `mini-fazenda-save-0..2` -> `savegame-slot1.json` .. `savegame-slot3.json`
 *   (o jogo tem 3 slots, então não cabe num `savegame.json` só)
 * - `mini-fazenda-settings` -> `settings.json`
 * - qualquer outra chave `[a-z0-9-]` -> `<chave>.json`
 */
function fileNameForKey(key: unknown): string | null {
  if (typeof key !== 'string' || !/^[a-z0-9-]{1,64}$/.test(key)) return null;

  const slot = /^mini-fazenda-save-(\d{1,2})$/.exec(key);
  if (slot) return `savegame-slot${Number(slot[1]) + 1}.json`;
  if (key === 'mini-fazenda-settings') return 'settings.json';
  return `${key}.json`;
}

function resolveSaveFile(key: unknown): string | null {
  const fileName = fileNameForKey(key);
  return fileName ? path.join(getSaveDirectory(), fileName) : null;
}

/** Só aceita IPC vindo da própria página do jogo (protocolo `app://` ou, em dev, o servidor do Vite). */
function isTrustedSender(event: IpcMainEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(`${APP_ORIGIN}/`) || (isDev && url.startsWith(DEV_SERVER_URL));
}

function registerStorageIpc(): void {
  // `sendSync` de propósito: o `StorageAdapter` do jogo é síncrono (`read`/`write`/`remove`),
  // então o `SaveManager` não precisou mudar. Os arquivos são de poucos KB.
  ipcMain.on('storage:read', (event, key: unknown) => {
    const file = isTrustedSender(event) ? resolveSaveFile(key) : null;
    if (!file) {
      event.returnValue = null;
      return;
    }
    try {
      event.returnValue = fs.readFileSync(file, 'utf8');
    } catch (error) {
      // Arquivo inexistente é o caso normal ("slot vazio"); outros erros são registrados.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`storage:read falhou (${String(key)})`, error);
      event.returnValue = null;
    }
  });

  ipcMain.on('storage:write', (event, key: unknown, value: unknown) => {
    const file = isTrustedSender(event) ? resolveSaveFile(key) : null;
    if (!file || typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_FILE_BYTES) {
      event.returnValue = false;
      return;
    }
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // Escrita atômica: grava num temporário e renomeia — se o jogo fechar/cair no meio,
      // o save anterior continua intacto em vez de ficar um arquivo pela metade.
      const temporary = `${file}.tmp`;
      fs.writeFileSync(temporary, value, 'utf8');
      fs.renameSync(temporary, file);
      event.returnValue = true;
    } catch (error) {
      console.error(`storage:write falhou (${String(key)})`, error);
      event.returnValue = false;
    }
  });

  ipcMain.on('storage:remove', (event, key: unknown) => {
    const file = isTrustedSender(event) ? resolveSaveFile(key) : null;
    if (file) {
      try {
        fs.rmSync(file, { force: true });
      } catch (error) {
        console.error(`storage:remove falhou (${String(key)})`, error);
      }
    }
    event.returnValue = null;
  });

  ipcMain.on('storage:location', (event) => {
    event.returnValue = isTrustedSender(event) ? getSaveDirectory() : null;
  });
}

/**
 * Liga/desliga a tela cheia de UMA janela do jogo (definido em `createWindow`, porque precisa liberar e
 * reaplicar o tamanho fixo da janela). Único caminho para mudar a tela cheia: IPC, F11/Alt+Enter e
 * a preferência salva passam todos por aqui.
 */
const fullscreenControllers = new WeakMap<BrowserWindow, (fullscreen: boolean) => void>();

/** Tela cheia pedida pelas Configurações do jogo. Devolve o estado REAL depois do pedido. */
function registerDisplayIpc(): void {
  ipcMain.on('display:is-fullscreen', (event) => {
    event.returnValue = isTrustedSender(event) ? (BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false) : false;
  });

  ipcMain.on('display:set-fullscreen', (event, fullscreen: unknown) => {
    const win = isTrustedSender(event) ? BrowserWindow.fromWebContents(event.sender) : null;
    if (win && typeof fullscreen === 'boolean') fullscreenControllers.get(win)?.(fullscreen);
    event.returnValue = win?.isFullScreen() ?? false;
  });
}

// --- Janela ---------------------------------------------------------------------------

/** Maior janela 16:9 (conteúdo, sem a barra de título) que cabe na tela principal — usada fora da tela cheia. */
function computeWindowSize(): { width: number; height: number } {
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
  const scale =
    WINDOW_SCALES.find((candidate) => GAME_WIDTH * candidate <= workWidth * SCREEN_FILL && GAME_HEIGHT * candidate <= workHeight * SCREEN_FILL) ??
    WINDOW_SCALES[WINDOW_SCALES.length - 1];
  return { width: Math.round(GAME_WIDTH * scale), height: Math.round(GAME_HEIGHT * scale) };
}

function createWindow(): void {
  const { width, height } = computeWindowSize();

  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    // Tamanho FIXO sem `resizable: false`: no Windows, `resizable: false` (e alternar `setResizable`
    // depois) deixava o Chromium, às vezes, com uma área de 816x639 dentro de um conteúdo nativo de
    // 800x600 (medido em execuções repetidas). Mínimo = máximo = tamanho do conteúdo impede o
    // jogador de redimensionar (mexer quebraria a escala da pixel art); pra ampliar, tela cheia (F11).
    resizable: true,
    minWidth: width,
    maxWidth: width,
    minHeight: height,
    maxHeight: height,
    maximizable: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000', // As faixas pretas ao redor do jogo em tela cheia 16:9.
    title: 'Mini Fazenda',
    show: false, // Só mostra depois do primeiro frame (sem flash branco).
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A música de fundo começa sem gesto do usuário (ver `systems/dayMusic.ts`).
      autoplayPolicy: 'no-user-gesture-required',
      devTools: isDev,
      spellcheck: false,
    },
  });

  win.setMenuBarVisibility(false);

  // Tamanho externo (com moldura) da janela normal: os limites min = max acima o travam nele, e é a ele
  // que se volta ao sair da tela cheia. Em tela cheia os limites precisam sair (senão a janela fica presa
  // no tamanho pequeno) e voltam em `leave-full-screen`.
  const [lockedWidth, lockedHeight] = win.getSize();
  const lockWindowSize = (): void => {
    win.setMinimumSize(lockedWidth, lockedHeight);
    win.setMaximumSize(lockedWidth, lockedHeight);
    win.setSize(lockedWidth, lockedHeight);
  };
  const setFullscreen = (fullscreen: boolean): void => {
    if (fullscreen) {
      win.setMinimumSize(0, 0);
      win.setMaximumSize(0, 0); // 0 = sem limite
    }
    win.setFullScreen(fullscreen);
  };
  fullscreenControllers.set(win, setFullscreen);

  win.once('ready-to-show', () => {
    // Tela cheia ANTES de mostrar: a janela pequena nunca "pisca" na tela antes de ampliar.
    if (readFullscreenPreference()) setFullscreen(true);
    win.show();
  });
  // Toda mudança (F11, Alt+Enter ou botão das Configurações) vira a nova preferência.
  win.on('enter-full-screen', () => writeFullscreenPreference(true));
  win.on('leave-full-screen', () => {
    lockWindowSize();
    writeFullscreenPreference(false);
  });

  // O jogo nunca abre janelas nem navega pra fora.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`) && !(isDev && url.startsWith(DEV_SERVER_URL))) event.preventDefault();
  });

  // F11 / Alt+Enter: tela cheia. (ESC fica livre — é do jogo.) F12 abre o DevTools só em desenvolvimento.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const toggleFullscreen = input.key === 'F11' || (input.alt && input.key === 'Enter');
    if (toggleFullscreen) {
      setFullscreen(!win.isFullScreen());
      event.preventDefault();
    } else if (isDev && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  void win.loadURL(isDev ? DEV_SERVER_URL : `${APP_ORIGIN}/index.html`);
}

// --- Ciclo de vida do app ---------------------------------------------------------------

// Uma instância só: abrir o jogo de novo traz a janela existente pra frente (dois processos
// escrevendo nos mesmos arquivos de save se atropelariam).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // Sem File/Edit/View.
    if (!isDev) registerAppProtocol();
    registerStorageIpc();
    registerDisplayIpc();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
