import { setStorageAdapter, startNewGame } from '../../src/systems/saveManager';

/** Armazenamento em memória (os testes não tocam no localStorage nem em arquivos). */
export const memoryStorage = new Map<string, string>();

setStorageAdapter({
  read: (key) => memoryStorage.get(key) ?? null,
  write: (key, value) => void memoryStorage.set(key, value),
  remove: (key) => void memoryStorage.delete(key),
});

/** Uma partida nova e limpa no slot 1 (sem apagar o que já foi salvo). */
export function freshGame(): void {
  startNewGame(0);
}
