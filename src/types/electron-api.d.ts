/**
 * Ponte exposta pelo preload do Electron (`electron/preload.cts`) em
 * `window.electronAPI`. Só existe rodando dentro do Electron — no navegador
 * (`npm run dev`) é `undefined`, por isso é opcional. O jogo NUNCA acessa isto
 * direto: só o `ElectronStorageAdapter` (`systems/storageAdapter.ts`) e
 * `systems/displayMode.ts` (tela cheia).
 */
interface ElectronStorageBridge {
  read(key: string): string | null;
  write(key: string, value: string): boolean;
  remove(key: string): void;
  location(): string | null;
}

interface ElectronDisplayBridge {
  isFullscreen(): boolean;
  /** Devolve o estado REAL da janela depois do pedido. */
  setFullscreen(fullscreen: boolean): boolean;
}

interface ElectronAPI {
  isElectron: true;
  storage: ElectronStorageBridge;
  display: ElectronDisplayBridge;
}

interface Window {
  electronAPI?: ElectronAPI;
}
