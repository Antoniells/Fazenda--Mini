import { contextBridge, ipcRenderer } from 'electron';

/**
 * Ponte segura entre o jogo (renderer) e o processo principal. Roda com
 * `contextIsolation` + `sandbox`: o jogo NÃO tem `require`/`fs`/`ipcRenderer`,
 * só o objeto `window.electronAPI` abaixo — e cada função só repassa uma
 * CHAVE de save (nunca um caminho) ao processo principal, que decide o
 * arquivo (ver `electron/main.cts`).
 *
 * `sendSync` porque o `StorageAdapter` do jogo é síncrono. O formato deste
 * objeto é espelhado em `src/types/electron-api.d.ts` (um preload em sandbox
 * não pode importar arquivos locais, então o tipo é escrito nos dois lados).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  storage: {
    read: (key: string): string | null => ipcRenderer.sendSync('storage:read', key) as string | null,
    write: (key: string, value: string): boolean => ipcRenderer.sendSync('storage:write', key, value) as boolean,
    remove: (key: string): void => {
      ipcRenderer.sendSync('storage:remove', key);
    },
    /** Pasta onde os saves ficam (Documentos/Mini Fazenda) — só informativo. */
    location: (): string | null => ipcRenderer.sendSync('storage:location') as string | null,
  },
  /** Janela nativa (tela cheia) — a mesma que o F11 controla; `setFullscreen` devolve o estado real depois do pedido. */
  display: {
    isFullscreen: (): boolean => ipcRenderer.sendSync('display:is-fullscreen') as boolean,
    setFullscreen: (fullscreen: boolean): boolean => ipcRenderer.sendSync('display:set-fullscreen', fullscreen) as boolean,
  },
});
