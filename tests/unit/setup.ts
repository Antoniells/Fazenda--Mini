import { vi } from 'vitest';

/**
 * Os testes de lógica rodam no Node, sem navegador: alguns módulos testados importam o Phaser só de passagem (pra tipos, classes de
 * cena, constantes de eventos), e o Phaser exige `window` ao carregar. Aqui ele vira um substituto vazio: qualquer propriedade é outro
 * substituto, que também pode ser estendido por classes (`extends Phaser.Scene`). Nada nestes testes chama o Phaser de verdade.
 */
vi.mock('phaser', () => {
  const cache = new Map<PropertyKey, unknown>();
  const handler: ProxyHandler<object> = {
    get(_target, property) {
      if (property === 'prototype') return {};
      if (!cache.has(property)) cache.set(property, new Proxy(class {}, handler));
      return cache.get(property);
    },
  };
  const phaser = new Proxy(class {}, handler);
  return { default: phaser };
});
