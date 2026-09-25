/**
 * Onde o `SaveManager` (Fase 10 — Estrutura Base e Persistência) grava/lê
 * bytes — pedido explícito do usuário: o jogo vai virar um executável
 * (.exe/.app) no futuro, e nesse momento o save deve morar num arquivo real
 * dentro da pasta "Documentos" do jogador (via `fs` do Node/Electron), não
 * no `localStorage` do navegador. Esta interface isola essa decisão: o
 * `SaveManager` só conhece `read`/`write`/`remove`, nunca o mecanismo por
 * trás — trocar de adaptador (`setStorageAdapter`, ver `saveManager.ts`)
 * muda ONDE o save mora, sem tocar em nenhuma lógica de save/load.
 *
 * CLAUDE.md proíbe instalar/configurar Electron antes da Fase 10 de
 * verdade (empacotamento) — esta interface não instala nada, só deixa o
 * encaixe pronto: o adaptador de `fs` real só entra quando essa fase
 * chegar, plugado aqui sem precisar reescrever `SaveManager`.
 */
export interface StorageAdapter {
  /** Lê o valor bruto salvo sob `key`, ou `null` se nunca foi gravado (ou não existir mais). */
  read(key: string): string | null;
  /** Grava `value` sob `key`, substituindo o que houver. */
  write(key: string, value: string): void;
  /** Remove o valor salvo sob `key`, se houver. */
  remove(key: string): void;
}

/**
 * Implementação padrão (navegador) — `window.localStorage`. Cada `key` já
 * chega prefixada pelo `SaveManager` (ex.: `mini-fazenda-save-0`), então
 * este adaptador não precisa de namespace próprio.
 */
export class LocalStorageAdapter implements StorageAdapter {
  read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Modo privado/`localStorage` bloqueado (ex.: alguns navegadores em
      // aba anônima): trata como "nunca salvo" em vez de quebrar o jogo.
      return null;
    }
  }

  write(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error('LocalStorageAdapter: falha ao salvar (quota cheia ou localStorage bloqueado).', error);
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nada a fazer — já não tem o que remover, na prática.
    }
  }
}

/**
 * Implementação do executável (Electron, Fase 10 — Desktop): cada chave vira
 * um arquivo em `Documentos/Mini Fazenda/` (ex.: `mini-fazenda-save-0` ->
 * `savegame-slot1.json`, ver `electron/main.cts`). Usa a ponte
 * `window.electronAPI.storage` do preload — o jogo não tem acesso ao `fs`
 * nem escolhe caminhos, só chaves. As chamadas são síncronas (IPC `sendSync`),
 * como o resto da interface `StorageAdapter`.
 */
export class ElectronStorageAdapter implements StorageAdapter {
  constructor(private readonly bridge: ElectronStorageBridge) {}

  read(key: string): string | null {
    try {
      return this.bridge.read(key);
    } catch (error) {
      console.error(`ElectronStorageAdapter: falha ao ler "${key}".`, error);
      return null;
    }
  }

  write(key: string, value: string): void {
    try {
      if (!this.bridge.write(key, value)) console.error(`ElectronStorageAdapter: o processo principal recusou gravar "${key}".`);
    } catch (error) {
      console.error(`ElectronStorageAdapter: falha ao gravar "${key}".`, error);
    }
  }

  remove(key: string): void {
    try {
      this.bridge.remove(key);
    } catch (error) {
      console.error(`ElectronStorageAdapter: falha ao remover "${key}".`, error);
    }
  }
}

/**
 * Adaptador padrão do ambiente: dentro do Electron (a ponte do preload existe)
 * grava em arquivos no disco; no navegador (`npm run dev`, testes) cai no
 * `localStorage`. É o que o `SaveManager` usa até alguém chamar
 * `setStorageAdapter`.
 */
export function createDefaultStorageAdapter(): StorageAdapter {
  const bridge = typeof window !== 'undefined' ? window.electronAPI?.storage : undefined;
  return bridge ? new ElectronStorageAdapter(bridge) : new LocalStorageAdapter();
}
